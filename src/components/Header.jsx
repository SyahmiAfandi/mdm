// src/components/Header.jsx
import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "../firebaseClient";
import { doc, getDoc } from "firebase/firestore";
import {
  CalendarDays,
  Bell,
  HelpCircle,
  UserCircle,
  Moon,
  Sun,
  LogOut,
  User,
  Server,
  X,
} from "lucide-react";

import { useUser } from "../context/UserContext";
import { useTooltip } from "../context/TooltipContext";
import { APP_FULL_NAME, ORG_COMP } from "../config";

import {
  normalizeUrl,
  getBackendUrl,
  getBackendMode,
  saveBackendMode,
  getBackendUrlTunnel,
  saveBackendUrlTunnel,
  clearBackendUrlTunnel,
  getBackendUrlLocal,
  saveBackendUrlLocal,
  clearBackendUrlLocal,
  isLocalhostUrl,
  isVercelProdDomain,
} from "../config/backend";

/** storage keys */
const ROLE_STORAGE_KEY = "ff.role";
const PERM_STORAGE_KEY = "ff.perms";

/** Theme toggle logic */
function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  return [theme, toggleTheme];
}

const Header = ({ title = "", breadcrumbs = [] }) => {
  const navigate = useNavigate();
  const { user, role, setRole } = useUser();
  const { showTooltip, setShowTooltip } = useTooltip();
  const [theme, toggleTheme] = useTheme();

  // --- Permissions (from Firestore rolePermissions/{role}) ---
  const [permLoading, setPermLoading] = useState(true);
  const [permMap, setPermMap] = useState({}); // { "settings.backend.view": true, ... }
  const can = (key) => !!permMap?.[key];

  const canViewBackend = can("settings.backend.view");
  const canEditBackend = can("settings.backend.edit");

  // --- UI menus ---
  const [showUserMenu, setShowUserMenu] = useState(false);
  const dropdownRef = useRef(null);

  const [showBackendPopover, setShowBackendPopover] = useState(false);
  const backendPopoverRef = useRef(null);

  // --- Backend status ---
  const HEALTH_PATH = "/test";

  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isMyProdDomain = isVercelProdDomain(host);

  const [backendMode, setBackendMode] = useState(() => getBackendMode());
  const [tunnelUrl, setTunnelUrl] = useState(() => getBackendUrlTunnel());
  const [localUrl, setLocalUrl] = useState(() => getBackendUrlLocal());

  const [tunnelUrlInput, setTunnelUrlInput] = useState(() => getBackendUrlTunnel() || "");
  const [localUrlInput, setLocalUrlInput] = useState(() => getBackendUrlLocal() || "http://127.0.0.1:5000");

  const [backendUrl, setBackendUrl] = useState(() => getBackendUrl());

  const [backendStatus, setBackendStatus] = useState(backendUrl ? "checking" : "missing");
  const [backendMsg, setBackendMsg] = useState(backendUrl ? "Checking..." : "No URL set");

  const isAbsoluteHttpUrl = (url) => /^https?:\/\/.+/i.test(url);

  const testBackend = async (url) => {
    const base = normalizeUrl(url);

    if (!base) {
      setBackendStatus("missing");
      setBackendMsg("No URL set");
      return false;
    }
    if (!isAbsoluteHttpUrl(base)) {
      setBackendStatus("down");
      setBackendMsg("Invalid URL (must start with http:// or https://)");
      return false;
    }

    setBackendStatus("checking");
    setBackendMsg(`Checking (${String(backendMode).toUpperCase()})...`);

    try {
      const res = await fetch(`${base}${HEALTH_PATH}`, { method: "GET", cache: "no-store" });
      if (res.ok) {
        setBackendStatus("up");
        setBackendMsg(`Online (${String(backendMode).toUpperCase()})`);
        return true;
      }
      setBackendStatus("down");
      setBackendMsg(`Offline (HTTP ${res.status})`);
      return false;
    } catch {
      setBackendStatus("down");
      setBackendMsg("Offline (network/CORS)");
      return false;
    }
  };

  // Load permissions for current role
  useEffect(() => {
    let cancelled = false;

    async function loadPerms() {
      setPermLoading(true);
      try {
        const r = String(role || "viewer").toLowerCase();
        const ref = doc(db, "rolePermissions", r);
        const snap = await getDoc(ref);
        const permissions = snap.exists() ? (snap.data()?.permissions || {}) : {};
        if (!cancelled) setPermMap(permissions);
      } catch (e) {
        console.error("Failed to load permissions", e);
        if (!cancelled) setPermMap({});
      } finally {
        if (!cancelled) setPermLoading(false);
      }
    }

    loadPerms();
    return () => { cancelled = true; };
  }, [role]);

  // On prod domain force tunnel mode (optional, keep your existing logic)
  useEffect(() => {
    if (!isMyProdDomain) return;

    saveBackendMode("tunnel");
    setBackendMode("tunnel");

    const t = getBackendUrlTunnel();
    setBackendUrl(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyProdDomain]);

  // Recompute canonical backendUrl when mode/url changes, then test
  useEffect(() => {
    const effectiveMode = isMyProdDomain ? "tunnel" : backendMode;
    const canonical = effectiveMode === "local" ? getBackendUrlLocal() : getBackendUrlTunnel();

    setBackendUrl(canonical);

    if (canonical) testBackend(canonical);
    else {
      setBackendStatus("missing");
      setBackendMsg("No URL set");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendMode, tunnelUrl, localUrl, isMyProdDomain]);

  // DEV/PROD badge
  const envLabel = isMyProdDomain
    ? "PROD"
    : backendMode === "local" || isLocalhostUrl(backendUrl)
    ? "DEV"
    : "PROD";

  const envBadgeClass =
    envLabel === "DEV"
      ? "bg-emerald-500/90 text-white border-emerald-200"
      : "bg-indigo-600/90 text-white border-indigo-200";

  // Icon colors
  const backendIconClass =
    backendStatus === "up"
      ? "text-green-600 dark:text-green-300"
      : backendStatus === "down"
      ? "text-red-600 dark:text-red-300"
      : backendStatus === "checking"
      ? "text-yellow-600 dark:text-yellow-300"
      : "text-gray-400 dark:text-gray-500";

  const backendIconTitle =
    permLoading
      ? "Backend: Loading permissions..."
      : !canViewBackend
      ? "Backend: No permission"
      : backendStatus === "up"
      ? "Backend: Online"
      : backendStatus === "down"
      ? "Backend: Offline"
      : backendStatus === "checking"
      ? "Backend: Checking..."
      : "Backend: Missing URL";

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (backendPopoverRef.current && !backendPopoverRef.current.contains(event.target)) {
        setShowBackendPopover(false);
      }
    }

    if (showUserMenu || showBackendPopover) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showUserMenu, showBackendPopover]);

  const iconBtnBase =
    "h-9 w-9 inline-flex items-center justify-center rounded-lg " +
    "transition hover:bg-blue-50 dark:hover:bg-gray-800 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-300";

  return (
    <div className="z-20 flex justify-between items-center px-6 py-0.5 bg-gradient-to-r from-blue-50 via-white to-blue-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 shadow-sm border-b border-blue-100 dark:border-gray-800">
      {/* Left */}
      <div className="min-w-0">
        {/* Breadcrumb */}
        {breadcrumbs?.length > 0 && (
          <div className="flex items-center gap-1 text-[11px] font-medium text-gray-400">
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={`${b.label}-${i}`}>
                {b.to ? (
                  <Link to={b.to} className="hover:text-blue-600 transition">
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-gray-700 dark:text-gray-200">{b.label}</span>
                )}
                {i < breadcrumbs.length - 1 && <span className="mx-1">›</span>}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Title */}
        <div className="mt-0.5 flex items-end gap-3 min-w-0">
          <h1 className="truncate font-extrabold text-[18px] sm:text-[20px] text-blue-700 dark:text-blue-200 tracking-tight">
            {title}
          </h1>
          <span className="hidden sm:inline-block h-[6px] w-10 rounded-full bg-blue-600/30 dark:bg-blue-400/25" />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3 relative">
        <span className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-300 tracking-wide">
          <CalendarDays size={14} className="text-blue-400 dark:text-blue-300" />
          {new Date().toLocaleDateString("en-GB")}
        </span>

        <button title="Notifications" className={`${iconBtnBase} text-blue-700 dark:text-blue-200`} type="button">
          <Bell size={18} />
        </button>

        <button title="Help" className={`${iconBtnBase} text-blue-700 dark:text-blue-200`} type="button">
          <HelpCircle size={18} />
        </button>

        {/* Backend icon + popover */}
        <div className="relative">
          <button
            type="button"
            title={backendIconTitle}
            onClick={() => {
              if (permLoading) return;
              if (!canViewBackend) return;
              setShowBackendPopover((v) => !v);
            }}
            className={`${iconBtnBase} ${backendIconClass} relative`}
          >
            <Server size={18} />

            {/* DEV/PROD badge */}
            <span
              className={[
                "absolute -bottom-1 left-1/2 -translate-x-1/2",
                "px-1.5 py-[1px] rounded-full text-[9px] font-bold",
                "border shadow-sm",
                envBadgeClass,
              ].join(" ")}
            >
              {envLabel}
            </span>

            {/* Status dot */}
            <span
              className={[
                "absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border border-white dark:border-gray-900",
                backendStatus === "up" && "bg-green-500",
                backendStatus === "down" && "bg-red-500",
                backendStatus === "checking" && "bg-yellow-500",
                backendStatus === "missing" && "bg-gray-400",
              ].filter(Boolean).join(" ")}
            />

            {backendStatus === "checking" && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-yellow-400 opacity-70 animate-ping" />
            )}
          </button>

          {showBackendPopover && (
            <div
              ref={backendPopoverRef}
              className="absolute right-0 mt-2 w-80 bg-white border shadow-2xl rounded-2xl z-50 p-4 dark:bg-gray-800 dark:border-gray-700"
            >
              <div className="w-full flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Server size={18} className={backendIconClass} />
                  <div>
                    <div className="text-sm font-semibold text-gray-800 dark:text-white">Backend</div>
                    <div className="text-[10px] text-gray-400">{backendMsg}</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBackendPopover(false)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Close"
                >
                  <X size={16} className="text-gray-500 dark:text-gray-300" />
                </button>
              </div>

              {permLoading ? (
                <div className="mt-3 text-xs text-gray-500 dark:text-gray-300">Loading permissions…</div>
              ) : !canViewBackend ? (
                <div className="mt-3 text-xs text-gray-500 dark:text-gray-300">
                  You don’t have permission to view backend status.
                </div>
              ) : canEditBackend ? (
                <div className="mt-3">
                  {/* Toggle mode only if not prod domain */}
                  {!isMyProdDomain && (
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[11px] text-gray-500 dark:text-gray-300">Backend Mode</div>

                      <div className="relative w-[120px] h-[28px] select-none">
                        <div className="absolute inset-0 rounded-full bg-gray-200 dark:bg-gray-800" />
                        <div
                          className={[
                            "absolute top-[2px] left-[2px] h-[24px] w-[56px] rounded-full",
                            "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md",
                            "transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                            backendMode === "local" ? "translate-x-[60px]" : "translate-x-0",
                          ].join(" ")}
                        />
                        <div className="relative z-10 flex h-full text-[9px] font-bold tracking-wide">
                          <button
                            type="button"
                            onClick={() => {
                              saveBackendMode("tunnel");
                              setBackendMode("tunnel");
                              setBackendUrl(getBackendUrlTunnel());
                            }}
                            className={[
                              "flex-1 flex items-center justify-center rounded-full",
                              backendMode === "tunnel"
                                ? "text-white"
                                : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white",
                            ].join(" ")}
                          >
                            TUNNEL
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              saveBackendMode("local");
                              setBackendMode("local");
                              setBackendUrl(getBackendUrlLocal());
                            }}
                            className={[
                              "flex-1 flex items-center justify-center rounded-full",
                              backendMode === "local"
                                ? "text-white"
                                : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white",
                            ].join(" ")}
                          >
                            LOCAL
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tunnel */}
                  <label className="block text-[11px] text-gray-500 dark:text-gray-300">
                    {isMyProdDomain ? "Production Backend URL" : "Tunnel URL"}
                  </label>
                  <input
                    value={tunnelUrlInput}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTunnelUrlInput(v);
                      setBackendStatus(v ? "checking" : "missing");
                      setBackendMsg(v ? "Not tested (click Test/Save)" : "No URL set");
                    }}
                    placeholder="https://your-backend-domain.com"
                    className={[
                      "w-full mt-1 px-2 py-1 text-xs rounded-lg border",
                      "border-gray-200 dark:border-gray-600",
                      "bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100",
                      "focus:outline-none focus:ring-2 focus:ring-blue-300",
                    ].join(" ")}
                  />

                  <div className="flex gap-2 w-full mt-3">
                    <button
                      className="flex-1 text-xs px-2 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
                      onClick={async () => {
                        const normalized = normalizeUrl(tunnelUrlInput);
                        saveBackendUrlTunnel(normalized);
                        setTunnelUrl(normalized);
                        setTunnelUrlInput(normalized);

                        saveBackendMode("tunnel");
                        setBackendMode("tunnel");
                        setBackendUrl(normalized);

                        const ok = await testBackend(normalized);
                        if (ok) setShowBackendPopover(false);
                      }}
                    >
                      Save
                    </button>

                    <button
                      className="flex-1 text-xs px-2 py-1 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300
                                 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 transition"
                      onClick={() => testBackend(tunnelUrlInput)}
                    >
                      Test
                    </button>

                    <button
                      className="text-xs px-2 py-1 rounded-lg text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 transition"
                      onClick={() => {
                        clearBackendUrlTunnel();
                        setTunnelUrl("");
                        setTunnelUrlInput("");
                        setBackendUrl("");
                        setBackendStatus("missing");
                        setBackendMsg("No URL set");
                      }}
                      title="Clear URL"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Local only if not prod domain */}
                  {!isMyProdDomain && backendMode === "local" && (
                    <div className="mt-3">
                      <label className="block text-[11px] text-gray-500 dark:text-gray-300">Local URL</label>
                      <input
                        value={localUrlInput}
                        onChange={(e) => setLocalUrlInput(e.target.value)}
                        placeholder="http://127.0.0.1:5000"
                        className={[
                          "w-full mt-1 px-2 py-1 text-xs rounded-lg border",
                          "border-gray-200 dark:border-gray-600",
                          "bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100",
                          "focus:outline-none focus:ring-2 focus:ring-blue-300",
                        ].join(" ")}
                      />
                      <div className="flex gap-2 w-full mt-3">
                        <button
                          className="flex-1 text-xs px-2 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
                          onClick={async () => {
                            const normalized = normalizeUrl(localUrlInput);
                            saveBackendUrlLocal(normalized);
                            setLocalUrl(normalized);
                            setLocalUrlInput(normalized);

                            saveBackendMode("local");
                            setBackendMode("local");
                            setBackendUrl(normalized);

                            const ok = await testBackend(normalized);
                            if (ok) setShowBackendPopover(false);
                          }}
                        >
                          Save Local
                        </button>
                        <button
                          className="flex-1 text-xs px-2 py-1 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300
                                     dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 transition"
                          onClick={() => testBackend(localUrlInput)}
                        >
                          Test Local
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-2 text-[10px] text-gray-400">
                    Status becomes <b>Online</b> only if <span className="select-text">{HEALTH_PATH}</span> returns 200/2xx.
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-xs text-gray-500 dark:text-gray-300">
                  You don’t have permission to edit the backend URL.
                  <div className="mt-2">
                    <button
                      type="button"
                      className="text-xs px-3 py-1 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300
                                dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 transition"
                      onClick={() => testBackend(getBackendUrl())}
                    >
                      Refresh Status
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Account icon + dropdown */}
        <div className="relative">
          <button
            title="Account"
            className={`${iconBtnBase} text-blue-700 hover:text-blue-900 dark:text-blue-200`}
            onClick={() => setShowUserMenu((prev) => !prev)}
            type="button"
          >
            <UserCircle size={22} className="text-blue-600 dark:text-blue-200" />
          </button>

          {showUserMenu && (
            <div
              ref={dropdownRef}
              className="absolute right-0 mt-2 w-72 bg-white border shadow-2xl rounded-2xl z-50 p-4 min-w-[200px] flex flex-col items-center dark:bg-gray-800 dark:border-gray-700"
            >
              <div className="w-14 h-14 flex items-center justify-center rounded-full bg-gradient-to-tr from-blue-100 to-blue-200 shadow-inner border-2 border-blue-100 dark:border-gray-600 mb-2">
                <User size={38} className="text-blue-500 dark:text-blue-200" />
              </div>

              <div className="text-[16px] font-bold text-gray-800 dark:text-white leading-tight">
                {user?.name || "User Name"}
              </div>

              <div className="text-[11px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full mb-1 mt-1 truncate w-full text-center select-text dark:bg-blue-900 dark:text-blue-200">
                {user?.email || "email@example.com"}
              </div>

              <div className="flex justify-center items-center gap-2 text-[10px] text-gray-400 dark:text-gray-400 mb-1">
                <span>Role: {role || "viewer"}</span>
                <span className="hidden sm:inline">|</span>
                <span>Org: {ORG_COMP}</span>
              </div>

              <div className="text-[10px] text-green-500 mb-1">Active now</div>

              <div className="w-full border-b my-2 dark:border-gray-600" />

              {/* Tooltip toggle */}
              <div className="flex items-center justify-between w-full px-0 mt-1 mb-2">
                <label
                  htmlFor="tooltip-toggle"
                  className="text-xs text-gray-700 dark:text-gray-200 cursor-pointer select-none"
                >
                  Sidebar Tooltip
                </label>
                <button
                  id="tooltip-toggle"
                  type="button"
                  onClick={() => setShowTooltip((v) => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                    showTooltip ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"
                  } focus:outline-none`}
                >
                  <span className="sr-only">Enable Sidebar Tooltip</span>
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                      showTooltip ? "translate-x-4" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Theme */}
              <div className="flex items-center justify-between w-full px-0 mt-1 mb-2">
                <label className="text-xs text-gray-700 dark:text-gray-200 cursor-pointer select-none">
                  Dark Mode (BETA)
                </label>
                <button
                  onClick={toggleTheme}
                  className={`ml-2 flex items-center px-2 py-1 rounded-lg ${
                    theme === "dark" ? "bg-blue-700 text-white" : "bg-gray-200 text-gray-700"
                  } transition`}
                  type="button"
                >
                  {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
                  <span className="ml-1 text-xs">{theme === "dark" ? "Dark" : "Light"}</span>
                </button>
              </div>

              <div className="w-full border-b my-2 dark:border-gray-600" />

              {/* Logout INSIDE account menu */}
              <div className="w-full flex justify-between items-center mt-1">
                <span className="text-[10px] text-gray-400 dark:text-gray-400">
                  {APP_FULL_NAME}
                </span>
                <button
                  onClick={() => {
                    setRole?.(null);
                    try {
                      localStorage.removeItem(PERM_STORAGE_KEY);
                      localStorage.removeItem(ROLE_STORAGE_KEY);
                    } catch {}
                    navigate("/login");
                  }}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold transition"
                  type="button"
                >
                  <LogOut size={15} /> Logout
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Header;

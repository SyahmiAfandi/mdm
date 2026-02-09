import {
  getBackendUrl,
  saveBackendUrl,
  clearBackendUrl,
  normalizeUrl,
} from "../config/backend";
import React, { useState, useRef, useEffect } from "react";
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

// Theme toggle logic
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

// ✅ Role-based access for backend config (adjust as you like)
const CAN_CONFIG_BACKEND = (role) => {
  const r = String(role || "").toLowerCase();
  return ["admin", "superadmin", "developer"].includes(r);
};

const Header = ({ title = "", breadcrumbs = [] }) => {
  const { user, role } = useUser();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { showTooltip, setShowTooltip } = useTooltip();
  const [theme, toggleTheme] = useTheme();

  // ===== Backend URL + Status =====
  const HEALTH_PATH = "/test";

  // ✅ Canonical/saved backend URL (used for actual requests)
  const [backendUrl, setBackendUrl] = useState(() => getBackendUrl());

  // ✅ Input value shown in popover (raw)
  const [backendUrlInput, setBackendUrlInput] = useState(() => getBackendUrl() || "");

  // ✅ NEW: lock input after Save, unlock after Clear
  const [lockedBackend, setLockedBackend] = useState(() => {
    const u = getBackendUrl();
    return !!u; // locked if there is a saved URL
  });

  // status: "missing" | "checking" | "up" | "down"
  const [backendStatus, setBackendStatus] = useState(backendUrl ? "checking" : "missing");
  const [backendMsg, setBackendMsg] = useState(backendUrl ? "Checking..." : "No URL set");

  // Backend config popover (UNDER backend icon)
  const [showBackendPopover, setShowBackendPopover] = useState(false);
  const backendPopoverRef = useRef(null);

  // Account dropdown ref
  const dropdownRef = useRef(null);

  const isAbsoluteHttpUrl = (url) => /^https?:\/\/.+/i.test(url);

  const testBackend = async (url) => {
    const base = normalizeUrl(url);

    // Prevent relative fetch (would hit frontend origin)
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
    setBackendMsg("Checking...");

    try {
      const res = await fetch(`${base}${HEALTH_PATH}`, {
        method: "GET",
        cache: "no-store",
      });

      if (res.ok) {
        setBackendStatus("up");
        setBackendMsg("Online");
        return true;
      }

      setBackendStatus("down");
      setBackendMsg(`Offline (HTTP ${res.status})`);
      return false;
    } catch (e) {
      setBackendStatus("down");
      setBackendMsg("Offline (network/CORS)");
      return false;
    }
  };

  // Top-right indicator color + tooltip
  const backendIconClass =
    backendStatus === "up"
      ? "text-green-600 dark:text-green-300"
      : backendStatus === "down"
      ? "text-red-600 dark:text-red-300"
      : backendStatus === "checking"
      ? "text-yellow-600 dark:text-yellow-300"
      : "text-gray-400 dark:text-gray-500";

  const backendIconTitle =
    backendStatus === "up"
      ? "Backend: Online"
      : backendStatus === "down"
      ? "Backend: Offline"
      : backendStatus === "checking"
      ? "Backend: Checking..."
      : "Backend: Missing URL";

  // ✅ Auto test ONLY when canonical backendUrl changes
  useEffect(() => {
    if (backendUrl) testBackend(backendUrl);
    else {
      setBackendStatus("missing");
      setBackendMsg("No URL set");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendUrl]);

  // Close account dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }
    if (showUserMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showUserMenu]);

  // Close backend popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (backendPopoverRef.current && !backendPopoverRef.current.contains(event.target)) {
        setShowBackendPopover(false);
      }
    }
    if (showBackendPopover) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showBackendPopover]);

  const handleLogout = () => {
    alert("Logout action here!");
  };

  // ✅ Same height/center alignment for all top-right icons
  const iconBtnBase =
    "h-9 w-9 inline-flex items-center justify-center rounded-lg " +
    "transition hover:bg-blue-50 dark:hover:bg-gray-800 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-300";

  // ✅ Role-based visibility
  const canConfigBackend = CAN_CONFIG_BACKEND(role);

  return (
    <div className="sticky top-0 z-20 flex justify-between items-center px-6 py-2 bg-gradient-to-r from-blue-50 via-white to-blue-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 shadow-sm border-b border-blue-100 dark:border-gray-800">
      {/* Left */}
      <div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg text-blue-700 dark:text-blue-200 tracking-wide">
            {title}
          </span>

          {breadcrumbs.length > 0 && (
            <span className="ml-4 text-xs text-gray-400 dark:text-gray-400">
              {breadcrumbs.map((b, i) => (
                <span key={i}>
                  {b}
                  {i < breadcrumbs.length - 1 && " / "}
                </span>
              ))}
            </span>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3 relative">
        <span className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-300 tracking-wide">
          <CalendarDays size={14} className="text-blue-400 dark:text-blue-300" />
          {new Date().toLocaleDateString("en-GB")}
        </span>

        <button
          title="Notifications"
          className={`${iconBtnBase} text-blue-700 hover:text-blue-900 dark:text-blue-200`}
          type="button"
        >
          <Bell size={18} />
        </button>

        <button
          title="Help"
          className={`${iconBtnBase} text-blue-700 hover:text-blue-900 dark:text-blue-200`}
          type="button"
        >
          <HelpCircle size={18} />
        </button>

        {/* ✅ Backend icon + popover */}
        <div className="relative">
          <button
            type="button"
            title={backendIconTitle}
            onClick={() => setShowBackendPopover((v) => !v)}
            className={`${iconBtnBase} ${backendIconClass}`}
          >
            <Server size={18} />

            {/* Status dot */}
            <span
              className={[
                "absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border border-white dark:border-gray-900",
                backendStatus === "up" && "bg-green-500",
                backendStatus === "down" && "bg-red-500",
                backendStatus === "checking" && "bg-yellow-500",
                backendStatus === "missing" && "bg-gray-400",
              ]
                .filter(Boolean)
                .join(" ")}
            />

            {/* ✅ Animated pulse while checking */}
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
                    <div className="text-sm font-semibold text-gray-800 dark:text-white">
                      Backend
                    </div>
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

              {/* ✅ Show config ONLY for allowed roles */}
              {canConfigBackend ? (
                <div className="mt-3">
                  <label className="block text-[11px] text-gray-500 dark:text-gray-300">
                    Tunnel URL
                  </label>

                  <input
                    value={backendUrlInput}
                    disabled={lockedBackend} // ✅ lock after save
                    onChange={(e) => {
                      if (lockedBackend) return;
                      const v = e.target.value;
                      setBackendUrlInput(v);
                      setBackendStatus(v ? "checking" : "missing");
                      setBackendMsg(v ? "Not tested (click Test/Save)" : "No URL set");
                    }}
                    placeholder="https://xxxx.trycloudflare.com"
                    className={[
                      "w-full mt-1 px-2 py-1 text-xs rounded-lg border",
                      "border-gray-200 dark:border-gray-600",
                      "bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100",
                      "focus:outline-none focus:ring-2 focus:ring-blue-300",
                      lockedBackend && "bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  />

                  <div className="flex gap-2 w-full mt-3">
                    <button
                      className="flex-1 text-xs px-2 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={lockedBackend} // ✅ cannot save if locked
                      onClick={async () => {
                        const normalized = normalizeUrl(backendUrlInput);

                        saveBackendUrl(normalized);
                        setBackendUrl(normalized);
                        setBackendUrlInput(normalized);

                        // ✅ lock after save
                        setLockedBackend(true);

                        const ok = await testBackend(normalized);
                        if (ok) setShowBackendPopover(false);
                      }}
                    >
                      Save
                    </button>

                    <button
                      className="flex-1 text-xs px-2 py-1 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300
                                 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 transition"
                      onClick={() => testBackend(backendUrlInput)}
                    >
                      Test
                    </button>

                    <button
                      className="text-xs px-2 py-1 rounded-lg text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 transition"
                      onClick={() => {
                        clearBackendUrl();
                        setBackendUrl("");
                        setBackendUrlInput("");
                        setBackendStatus("missing");
                        setBackendMsg("No URL set");
                        setLockedBackend(false); // ✅ unlock after clear
                      }}
                      title="Clear URL"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="mt-2 text-[10px] text-gray-400">
                    Status becomes <b>Online</b> only if{" "}
                    <span className="select-text">{HEALTH_PATH}</span> returns HTTP 200/2xx.
                  </div>

                  {lockedBackend && (
                    <div className="mt-2 text-[10px] text-gray-500 dark:text-gray-300">
                      Tunnel URL is locked. Click <b>Clear</b> to edit again.
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3 text-xs text-gray-500 dark:text-gray-300">
                  You don’t have permission to edit the backend URL.
                  <div className="mt-2">
                    <button
                      type="button"
                      className="text-xs px-3 py-1 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300
                                 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 transition"
                      onClick={() => testBackend(backendUrl)}
                    >
                      Refresh Status
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Avatar */}
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
              {/* Avatar and user info */}
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
                <span>Role: {role || "User"}</span>
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
                  tabIndex={0}
                >
                  <span className="sr-only">Enable Sidebar Tooltip</span>
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                      showTooltip ? "translate-x-4" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Theme Switcher */}
              <div className="flex items-center justify-between w-full px-0 mt-1 mb-2">
                <label className="text-xs text-gray-700 dark:text-gray-200 cursor-pointer select-none">
                  Dark Mode (BETA)
                </label>
                <button
                  onClick={toggleTheme}
                  className={`ml-2 flex items-center px-2 py-1 rounded-lg ${
                    theme === "dark" ? "bg-blue-700 text-white" : "bg-gray-200 text-gray-700"
                  } transition`}
                >
                  {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
                  <span className="ml-1 text-xs">{theme === "dark" ? "Dark" : "Light"}</span>
                </button>
              </div>

              {/* Quick Links */}
              <div className="w-full flex flex-col gap-1 mt-2">
                <a
                  href="#"
                  className="flex items-center gap-2 text-xs text-blue-600 hover:underline hover:text-blue-800 dark:text-blue-200"
                >
                  <UserCircle size={15} /> My Profile
                </a>
                <a
                  href="#"
                  className="flex items-center gap-2 text-xs text-gray-500 hover:underline hover:text-blue-600 dark:text-gray-200"
                >
                  <HelpCircle size={15} /> Help Center
                </a>
                <a
                  href="#"
                  className="flex items-center gap-2 text-xs text-gray-400 hover:underline hover:text-blue-600 dark:text-gray-300"
                >
                  <span className="font-bold">?</span> What's New
                </a>
              </div>

              <div className="w-full border-b my-2 dark:border-gray-600" />

              {/* Version & Logout */}
              <div className="w-full flex justify-between items-center mt-1">
                <span className="text-[10px] text-gray-400 dark:text-gray-400">
                  {APP_FULL_NAME}
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold transition"
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

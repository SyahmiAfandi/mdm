// src/components/Header.jsx
import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import {
  ArrowRight,
  CalendarDays,
  Bell,
  CircleCheck,
  Clock3,
  HelpCircle,
  Info,
  UserCircle,
  Moon,
  Sun,
  LogOut,
  TriangleAlert,
  User,
  Server,
  X,
} from "lucide-react";

import { useUser } from "../context/UserContext";
import { useTooltip } from "../context/TooltipContext";
import { normalizePermissionRows } from "../hooks/usePermissions";
import useHeaderNotifications from "../hooks/useHeaderNotifications";
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
  isLocalhostUrl,
  isVercelProdDomain,
  getConfiguredBackendUrl,
} from "../config/backend";

/** storage keys */
const ROLE_STORAGE_KEY = "ff.role";
const PERM_STORAGE_KEY = "ff.perms";
const NOTIFICATION_READ_STORAGE_KEY = "mdm.headerNotifications.read";

const NOTIFICATION_SECTION_ORDER = ["Urgent", "Today", "Earlier"];

const NOTIFICATION_TONES = {
  critical: {
    Icon: TriangleAlert,
    iconClass: "text-rose-600 dark:text-rose-300",
    surfaceClass: "bg-rose-50 border-rose-100 dark:bg-rose-500/10 dark:border-rose-400/20",
    dotClass: "bg-rose-500",
  },
  warning: {
    Icon: TriangleAlert,
    iconClass: "text-amber-600 dark:text-amber-300",
    surfaceClass: "bg-amber-50 border-amber-100 dark:bg-amber-500/10 dark:border-amber-400/20",
    dotClass: "bg-amber-500",
  },
  success: {
    Icon: CircleCheck,
    iconClass: "text-emerald-600 dark:text-emerald-300",
    surfaceClass: "bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-400/20",
    dotClass: "bg-emerald-500",
  },
  reminder: {
    Icon: Clock3,
    iconClass: "text-blue-600 dark:text-blue-300",
    surfaceClass: "bg-blue-50 border-blue-100 dark:bg-blue-500/10 dark:border-blue-400/20",
    dotClass: "bg-blue-500",
  },
  info: {
    Icon: Info,
    iconClass: "text-slate-600 dark:text-slate-300",
    surfaceClass: "bg-slate-100 border-slate-200 dark:bg-slate-700/60 dark:border-slate-600",
    dotClass: "bg-slate-400",
  },
};

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
  const canViewUtilities = can("utilities.view");
  const canViewEmailTracker = can("mdmEmailTracker.view");
  const canViewPromoPeriods = can("promotions.promoPeriod.view");

  // --- UI menus ---
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationReadMap, setNotificationReadMap] = useState(() => {
    try {
      const saved = localStorage.getItem(NOTIFICATION_READ_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const notificationsRef = useRef(null);

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

  const [tunnelUrlInput, setTunnelUrlInput] = useState(() => getBackendUrlTunnel() || getConfiguredBackendUrl());
  const [localUrlInput, setLocalUrlInput] = useState(() => getBackendUrlLocal() || "http://127.0.0.1:5000");

  const [backendUrl, setBackendUrl] = useState(() => getBackendUrl());

  const [backendStatus, setBackendStatus] = useState(backendUrl ? "checking" : "missing");
  const [backendMsg, setBackendMsg] = useState(backendUrl ? "Checking..." : "No URL set");

  const {
    notifications: liveNotifications,
    loading: notificationsLoading,
    error: notificationsError,
  } = useHeaderNotifications({
    user,
    enableUtilities: canViewUtilities,
    enableEmailTracker: canViewEmailTracker,
    enablePromotions: canViewPromoPeriods,
  });

  const isAbsoluteHttpUrl = (url) => /^https?:\/\/.+/i.test(url);

  const notifications = liveNotifications.map((item) => ({
    ...item,
    read: !!notificationReadMap?.[item.id],
  }));

  const unreadCount = notifications.reduce((count, item) => count + (item.read ? 0 : 1), 0);

  const notificationSections = NOTIFICATION_SECTION_ORDER
    .map((section) => ({
      label: section,
      items: notifications.filter((item) => item.section === section),
    }))
    .filter((section) => section.items.length > 0);

  const markNotificationRead = (id) => {
    setNotificationReadMap((current) => ({
      ...current,
      [id]: true,
    }));
  };

  const markAllNotificationsRead = () => {
    setNotificationReadMap((current) => {
      const next = { ...current };
      notifications.forEach((item) => {
        next[item.id] = true;
      });
      return next;
    });
  };

  const openNotification = (item) => {
    markNotificationRead(item.id);
    setShowNotifications(false);
    if (item.route) navigate(item.route);
  };

  useEffect(() => {
    try {
      localStorage.setItem(
        NOTIFICATION_READ_STORAGE_KEY,
        JSON.stringify(notificationReadMap)
      );
    } catch {
      // Ignore storage write failures for notification read state.
    }
  }, [notificationReadMap]);

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
        const { data: snap } = await supabase
          .from("role_permissions")
          .select("permission,allow")
          .eq('role', r);
        const permissions = normalizePermissionRows(snap);
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
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (backendPopoverRef.current && !backendPopoverRef.current.contains(event.target)) {
        setShowBackendPopover(false);
      }
    }

    if (showNotifications || showUserMenu || showBackendPopover) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifications, showUserMenu, showBackendPopover]);

  const iconBtn =
    "h-8 w-8 inline-flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 " +
    "transition hover:bg-slate-100 dark:hover:bg-slate-800 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-200";

  return (
    <div className="shrink-0 flex justify-between items-center px-5 py-2.5 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl border border-white/40 dark:border-slate-800 shadow-sm shadow-slate-200/50 dark:shadow-black/20 transition-all duration-300 z-20 relative">
      {/* ── Left: breadcrumb + title ── */}
      <div className="min-w-0">
        {/* Breadcrumb */}
        {breadcrumbs?.length > 0 && (
          <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400 dark:text-slate-500 mb-0.5">
            {breadcrumbs.map((b, i) => (
              <React.Fragment key={`${b.label}-${i}`}>
                {b.to ? (
                  <Link to={b.to} className="hover:text-blue-500 transition">
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-slate-600 dark:text-slate-300">{b.label}</span>
                )}
                {i < breadcrumbs.length - 1 && <span className="text-slate-300 dark:text-slate-600">/</span>}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className="text-[15px] sm:text-base font-black tracking-tight text-slate-800 dark:text-slate-100 truncate leading-tight mt-0.5">
          {title}
        </h1>
      </div>

      {/* ── Right: actions ── */}
      <div className="flex items-center gap-1 relative">
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 rounded-xl px-3 py-1 mr-1">
          <CalendarDays size={12} className="text-slate-400 dark:text-slate-500" />
          {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
        </div>

        <div className="relative" ref={notificationsRef}>
          <button
            title="Notifications"
            className={`${iconBtn} relative`}
            type="button"
            aria-label="Notifications"
            aria-expanded={showNotifications}
            onClick={() => {
              setShowBackendPopover(false);
              setShowUserMenu(false);
              setShowNotifications((prev) => !prev);
            }}
          >
            <Bell
              size={16}
              className={unreadCount ? "text-slate-700 dark:text-slate-100" : undefined}
            />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-[18px] text-center shadow-sm shadow-rose-500/30">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-[22rem] rounded-3xl border border-slate-200/70 bg-white/95 p-4 shadow-2xl backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-800/95 z-50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      Alerts
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                      Supabase
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                    {notificationsLoading && notifications.length === 0
                      ? "Loading activity..."
                      : unreadCount > 0
                      ? `${unreadCount} unread item${unreadCount > 1 ? "s" : ""}`
                      : "You are all caught up"}
                  </div>
                </div>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="mt-4 max-h-[24rem] space-y-4 overflow-y-auto pr-1">
                {notificationSections.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {notificationsLoading ? "Fetching live alerts from Supabase..." : "No active alerts right now."}
                  </div>
                ) : (
                  notificationSections.map((section) => (
                    <div key={section.label}>
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                        {section.label}
                      </div>

                      <div className="space-y-2">
                        {section.items.map((item) => {
                          const tone = NOTIFICATION_TONES[item.tone] || NOTIFICATION_TONES.info;
                          const ToneIcon = tone.Icon;

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => openNotification(item)}
                              className={[
                                "group flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition",
                                item.read
                                  ? "border-slate-200/70 bg-slate-50/80 hover:bg-slate-100/80 dark:border-slate-700/60 dark:bg-slate-900/40 dark:hover:bg-slate-900/70"
                                  : "border-blue-100 bg-blue-50/70 shadow-sm shadow-blue-100/50 hover:bg-blue-100/70 dark:border-blue-400/20 dark:bg-blue-500/10 dark:hover:bg-blue-500/15",
                              ].join(" ")}
                            >
                              <div
                                className={[
                                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border",
                                  tone.surfaceClass,
                                ].join(" ")}
                              >
                                <ToneIcon size={16} className={tone.iconClass} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                        {item.tag}
                                      </span>
                                      {!item.read && (
                                        <span
                                          className={[
                                            "h-2 w-2 shrink-0 rounded-full",
                                            tone.dotClass,
                                          ].join(" ")}
                                        />
                                      )}
                                    </div>

                                    <div className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                      {item.title}
                                    </div>
                                  </div>

                                  <ArrowRight className="mt-0.5 shrink-0 text-slate-300 transition group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-300" size={14} />
                                </div>

                                <div className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-300">
                                  {item.detail}
                                </div>

                                <div className="mt-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                                  {item.time}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-200/80 pt-3 dark:border-slate-700/60">
                <div className="text-[11px] text-slate-400 dark:text-slate-500">
                  {notificationsError || "Live activity from Supabase"}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowNotifications(false);
                    navigate("/");
                  }}
                  className="text-[11px] font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white"
                >
                  Open dashboard
                </button>
              </div>
            </div>
          )}
        </div>

        <button title="Help" className={iconBtn} type="button">
          <HelpCircle size={16} />
        </button>

        {/* Backend icon + popover */}
        {canViewBackend && (
          <div className="relative">
          <button
            type="button"
            title={backendIconTitle}
            onClick={() => {
              if (permLoading) return;
              if (!canViewBackend) return;
              setShowNotifications(false);
              setShowUserMenu(false);
              setShowBackendPopover((v) => !v);
            }}
            className={`${iconBtn} relative`}
          >
            <Server size={16} className={backendIconClass} />

            {/* DEV/PROD badge */}
            <span
              className={[
                "absolute -bottom-0.5 left-1/2 -translate-x-1/2",
                "px-1 py-[1px] rounded-full text-[8px] font-extrabold",
                "border shadow-sm",
                envBadgeClass,
              ].join(" ")}
            >
              {envLabel}
            </span>

            {/* Status dot */}
            <span
              className={[
                "absolute top-1.5 right-1.5 w-2 h-2 rounded-full border border-white dark:border-slate-900",
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
              className="absolute right-0 mt-2 w-80 bg-white/90 border border-slate-200/60 shadow-2xl rounded-3xl backdrop-blur-xl z-50 p-4 dark:bg-slate-800/90 dark:border-slate-700/60"
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
        )}

        {/* Account icon + dropdown */}
        <div className="relative">
          <button
            title="Account"
            className={`${iconBtn} ml-1`}
            onClick={() => {
              setShowNotifications(false);
              setShowBackendPopover(false);
              setShowUserMenu((prev) => !prev);
            }}
            type="button"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[11px] font-extrabold shadow-sm">
              {user?.name ? user.name.charAt(0).toUpperCase() : <UserCircle size={16} />}
            </div>
          </button>

          {showUserMenu && (
            <div
              ref={dropdownRef}
              className="absolute right-0 mt-2 w-72 bg-white/90 border border-slate-200/60 shadow-2xl rounded-3xl backdrop-blur-xl z-50 p-4 min-w-[200px] flex flex-col items-center dark:bg-slate-800/90 dark:border-slate-700/60"
            >
              <div className="w-14 h-14 flex items-center justify-center rounded-full bg-gradient-to-tr from-blue-100 to-blue-200 shadow-inner border-2 border-blue-100 dark:border-gray-600 mb-2">
                <User size={38} className="text-blue-500 dark:text-blue-200" />
              </div>

              <div className="text-[16px] font-bold text-gray-800 dark:text-white leading-tight">
                {user?.display_name || "User Name"}
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
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${showTooltip ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"
                    } focus:outline-none`}
                >
                  <span className="sr-only">Enable Sidebar Tooltip</span>
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${showTooltip ? "translate-x-4" : "translate-x-1"
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
                  className={`ml-2 flex items-center px-2 py-1 rounded-lg ${theme === "dark" ? "bg-blue-700 text-white" : "bg-gray-200 text-gray-700"
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
                    } catch {
                      // Ignore storage cleanup failures during logout.
                    }
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

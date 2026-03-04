import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, // For Dashboard
  Wrench,          // For Tools
  Briefcase,       // For Utilities
  Database,        // For Master Data
  LineChart,       // For Reports
  Settings,        // For Settings
  MessageSquare,   // For Contact
  LogOut,
  UserCircle,
  User,
} from "lucide-react";
import SidebarLink from "./SidebarLink";
import { useUser } from "../context/UserContext";
import { useTooltip } from "../context/TooltipContext";
import { usePermissions } from "../hooks/usePermissions";

const ROLE_STORAGE_KEY = "ff.role"; // optional (keep if you still store role elsewhere)

/**
 * Sidebar with Firestore-based permissions + debug
 * - Shows debug panel when ?permDebug=1 is in URL OR in dev mode
 * - Console logs permissions after load
 * - Failsafe fallback: if perms doc empty, show based on role
 */
const Sidebar = ({ isOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setRole } = useUser();
  const { showTooltip } = useTooltip();

  // ✅ Firestore permissions hook
  const {
    loading: permLoading,
    can,
    role,
    perms, // { [key]: boolean }
    user: authUser,
  } = usePermissions({
    defaultRole: "viewer",
    roleCollection: "roles",
    roleField: "role",
    rolePermissionsCollection: "rolePermissions",
  });

  // ✅ Debug toggle (URL: ?permDebug=1) OR dev mode
  const debugEnabled = useMemo(() => {
    const qs = new URLSearchParams(location.search);
    const flag = qs.get("permDebug");
    const isDev = import.meta?.env?.DEV;
    return flag === "1" || !!isDev;
  }, [location.search]);

  // 🔒 Suppress hover + transitions briefly on navigation
  const [navigating, setNavigating] = useState(false);
  const hoverTimerRef = useRef(null);

  const handleLinkClick = useCallback(() => {
    setNavigating(true);
  }, []);

  // Clear suppression ~200ms after route change
  useEffect(() => {
    if (!navigating) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setNavigating(false), 200);

    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    };
  }, [location.pathname, navigating]);

  // ✅ Permission debug logs
  useEffect(() => {
    if (permLoading) return;
    console.log("[PERMISSIONS DEBUG]", {
      uid: authUser?.uid,
      role,
      perms,
      keysCount: perms ? Object.keys(perms).length : 0,
    });
  }, [permLoading, role, perms, authUser?.uid]);

  // ✅ Determine which main menu items to show
  const SHOW = useMemo(() => {
    const currentRoleMapSafe = perms || {};
    const permsEmpty = Object.keys(currentRoleMapSafe).length === 0;

    // Failsafe: if perms doc empty/missing, fallback by role
    if (permsEmpty) {
      const isAdmin = role === "admin";
      const isUser = role === "user";

      return {
        dashboard: isAdmin || isUser,
        tools: isAdmin || isUser,
        utilities: isAdmin || isUser,
        reports: isAdmin || isUser,
        masterData: isAdmin,      // ✅ added (admin only)
        settings: isAdmin,        // default settings for admin only
      };
    }

    // Normal gating (permission-based)
    return {
      dashboard: can("dashboard.view"),
      tools: can("tools.view") || can("tools.*"),
      utilities: can("utilities.view") || can("utilities.*"),
      reports: can("reports.view") || can("reports.status.view") || can("reports.*"),
      masterData: can("masterData.view") || can("masterData.*"), // ✅ added
      settings: can("settings.view") || can("settings.*"),
    };
  }, [can, role, perms]);

  // Skeleton (fixed height to avoid layout nudges)
  const SkeletonItem = () => (
    <div className="h-10 mx-2 my-1 rounded-md bg-gray-100 dark:bg-gray-800 animate-pulse" />
  );

  return (
    <aside
      className={`
        fixed top-0 left-0 h-full z-20
        bg-gradient-to-b from-slate-900 to-slate-950 dark:from-slate-950 dark:to-black shadow-2xl shadow-black/50 border-r border-slate-700/50 backdrop-blur-xl
        ${isOpen ? "w-56" : "w-[60px]"} flex flex-col
        transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
        overflow-x-visible
      `}
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-[72px] mb-4 px-3 border-b border-transparent">
        <img
          src={isOpen ? "/ff3.png" : "/ff2.png"}
          alt="Sidebar Logo"
          className={`${isOpen ? "rounded-xl" : "rounded-xl"} transition-all duration-300 bg-slate-800 shadow-md`}
          style={
            isOpen
              ? { width: "100%", maxWidth: 190, height: 46, objectFit: "contain", border: "1px solid rgba(255,255,255,0.05)" }
              : { width: 34, height: 34, objectFit: "contain", border: "1px solid rgba(255,255,255,0.1)" }
          }
        />
      </div>

      {/* 🔎 Debug Panel (only when sidebar open & debug enabled) */}
      {isOpen && debugEnabled && (
        <div className="mx-3 mb-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-gray-800 dark:border-gray-700 p-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-amber-800 dark:text-gray-100">Permissions Debug</div>
            <div className="text-[10px] text-amber-700 dark:text-gray-300">
              {permLoading ? "loading..." : "ready"}
            </div>
          </div>

          <div className="mt-2 space-y-1 text-amber-900 dark:text-gray-200">
            <div>
              <span className="text-amber-700 dark:text-gray-400">UID:</span>{" "}
              <span className="font-mono">{authUser?.uid || "-"}</span>
            </div>
            <div>
              <span className="text-amber-700 dark:text-gray-400">Role:</span>{" "}
              <span className="font-semibold">{role || "-"}</span>
            </div>
            <div>
              <span className="text-amber-700 dark:text-gray-400">Perm keys:</span>{" "}
              <span className="font-semibold">{perms ? Object.keys(perms).length : 0}</span>
            </div>

            <div className="mt-2 text-[11px] text-amber-700 dark:text-gray-400">
              SHOW:
              <span className="ml-2 font-mono text-amber-900 dark:text-gray-200">
                {JSON.stringify(SHOW)}
              </span>
            </div>

            <div className="mt-2 text-[11px] text-amber-700 dark:text-gray-400">
              Tip: open Console and search{" "}
              <span className="font-mono">[PERMISSIONS DEBUG]</span>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className={`relative flex-1 font-medium flex flex-col gap-1.5 ${isOpen ? "px-3" : "px-2"} overflow-y-auto overflow-x-hidden no-scrollbar pt-2`}>
        {/* Invisible overlay to block hover while navigating */}
        {navigating && <div className="absolute inset-0 z-50 pointer-events-auto select-none" />}

        {permLoading ? (
          <>
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
          </>
        ) : (
          <>
            {SHOW.dashboard && (
              <SidebarLink
                to="/"
                label="Dashboard"
                icon={<LayoutDashboard size={20} />}
                isOpen={isOpen}
                showTooltip={showTooltip}
                onClick={handleLinkClick}
                suppressHover={navigating}
                disableTransitions={navigating}
              />
            )}

            {SHOW.tools && (
              <SidebarLink
                to="/tools"
                label="Tools"
                icon={<Wrench size={20} />}
                isOpen={isOpen}
                showTooltip={showTooltip}
                onClick={handleLinkClick}
                suppressHover={navigating}
                disableTransitions={navigating}
                activeMatch={(p) => p.startsWith("/tools") || p.startsWith("/recons") || p.startsWith("/promotion")}
              />
            )}

            {SHOW.utilities && (
              <SidebarLink
                to="/utilities"
                label="Utilities"
                icon={<Briefcase size={20} />}
                isOpen={isOpen}
                showTooltip={showTooltip}
                onClick={handleLinkClick}
                suppressHover={navigating}
                disableTransitions={navigating}
                activeMatch={(p) => p.startsWith("/utilities")} // ✅ keeps highlighted for subpages
              />
            )}

            {/* ✅ NEW: Master Data (Admin) */}
            {SHOW.masterData && (
              <SidebarLink
                to="/master-data"
                label="Master Data"
                icon={<Database size={20} />}
                isOpen={isOpen}
                showTooltip={showTooltip}
                onClick={handleLinkClick}
                suppressHover={navigating}
                disableTransitions={navigating}
                activeMatch={(p) => p.startsWith("/master-data")}
              />
            )}

            {SHOW.reports && (
              <SidebarLink
                to="/reports"
                label="Reports"
                icon={<LineChart size={20} />}
                isOpen={isOpen}
                showTooltip={showTooltip}
                onClick={handleLinkClick}
                suppressHover={navigating}
                disableTransitions={navigating}
                activeMatch={(p) => p.startsWith("/reports")}
              />
            )}

            {SHOW.settings && (
              <SidebarLink
                to="/settings"
                label="Settings"
                icon={<Settings size={20} />}
                isOpen={isOpen}
                showTooltip={showTooltip}
                onClick={handleLinkClick}
                suppressHover={navigating}
                disableTransitions={navigating}
                activeMatch={(p) => p.startsWith("/settings")}
              />
            )}

            <SidebarLink
              to="/contact"
              label="Contact"
              icon={<MessageSquare size={20} />}
              isOpen={isOpen}
              showTooltip={showTooltip}
              onClick={handleLinkClick}
              suppressHover={navigating}
              disableTransitions={navigating}
              activeMatch={(p) => p.startsWith("/contact")}
            />
          </>
        )}
      </nav>

      {/* User Info */}
      <div className={`relative mt-auto border-t border-slate-700/60 pt-3 pb-16 overflow-hidden ${isOpen ? "px-2" : "px-0 flex justify-center"}`}>
        <div
          className={`${isOpen ? "gap-2.5 px-3 py-2 bg-slate-800/80 rounded-2xl flex-row items-center justify-start w-full" : "justify-center w-[38px] h-[38px] rounded-xl flex-col mx-auto"} flex transition-all duration-200 select-none group border border-transparent ${isOpen ? "hover:border-slate-700 hover:shadow-sm" : ""}`}
        >
          <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <User size={15} className="drop-shadow-sm" />
          </div>
          {isOpen && (
            <div className="overflow-hidden min-w-0">
              <p className="text-[12px] font-bold truncate text-slate-100 mb-0.5 leading-tight">
                {user?.name || "User Name"}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] px-1.5 py-[1px] rounded bg-slate-900 border border-slate-700 text-slate-400 font-bold uppercase tracking-widest shadow-inner">
                  {role || "user"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Logout */}
      <div className={`absolute bottom-3 left-0 w-full ${isOpen ? "px-2" : "px-0 flex justify-center"}`}>
        <button
          onClick={() => {
            setRole?.(null);
            try {
              localStorage.removeItem(ROLE_STORAGE_KEY);
            } catch { }
            navigate("/login");
          }}
          className={`
            flex items-center w-full rounded-xl transition-all duration-200
            hover:bg-red-500/10 hover:text-red-400
            text-[12px] font-semibold text-slate-500
            ${isOpen ? "gap-3 px-3 py-2.5" : "justify-center w-[36px] h-[36px] mx-auto"}
            focus:outline-none group
          `}
        >
          <span className="flex justify-center items-center shrink-0">
            <LogOut size={16} className="text-slate-500 group-hover:text-red-500 transition-colors drop-shadow-sm" />
          </span>
          {isOpen && <span className="truncate tracking-wide">LOGOUT</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
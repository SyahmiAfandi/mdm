import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, Sliders, FileText, Settings, Layers, BarChart2, LogOut, UserCircle } from "lucide-react";
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
    // One-time-ish log after load or when role/perms change
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
        settings: isAdmin, // default settings for admin only
      };
    }

    // Normal gating
    return {
      dashboard: can("dashboard.view"),
      tools: can("tools.view") || can("tools.*"),
      utilities: can("utilities.view") || can("utilities.*"),
      reports: can("reports.view") || can("reports.status.view") || can("reports.*"),
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
        bg-white dark:bg-gray-900 shadow-lg dark:shadow-xl border-r dark:border-gray-800
        ${isOpen ? "w-64" : "w-16"} flex flex-col
        transition-[width] duration-300 ease-in-out
        overflow-x-visible
      `}
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-20 mb-2 px-3">
        <img
          src={isOpen ? "/ff3.png" : "/ff2.png"}
          alt="Sidebar Logo"
          className={`${
            isOpen ? "rounded-lg" : "rounded-full"
          } transition-[border-color,box-shadow] duration-150 bg-white dark:bg-gray-200 shadow-sm`}
          style={
            isOpen
              ? { width: "100%", maxWidth: 210, height: 52, objectFit: "contain", border: "0.5px solid #e5e7eb" }
              : { width: 38, height: 38, objectFit: "contain", border: "2px solid #e5e7eb" }
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
      <nav className="relative flex-1 font-medium flex flex-col gap-1 px-1">
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
                icon={<Home size={22} />}
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
                icon={<Sliders size={22} />}
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
                icon={<Layers size={22} />}
                isOpen={isOpen}
                showTooltip={showTooltip}
                onClick={handleLinkClick}
                suppressHover={navigating}
                disableTransitions={navigating}
              />
            )}

            {SHOW.reports && (
              <SidebarLink
                to="/reports"
                label="Reports"
                icon={<BarChart2 size={22} />}
                isOpen={isOpen}
                showTooltip={showTooltip}
                onClick={handleLinkClick}
                suppressHover={navigating}
                disableTransitions={navigating}
              />
            )}

            {SHOW.settings && (
              <SidebarLink
                to="/settings"
                label="Settings"
                icon={<Settings size={22} />}
                isOpen={isOpen}
                showTooltip={showTooltip}
                onClick={handleLinkClick}
                suppressHover={navigating}
                disableTransitions={navigating}
              />
            )}

            <SidebarLink
              to="/contact"
              label="Contact"
              icon={<FileText size={22} />}
              isOpen={isOpen}
              showTooltip={showTooltip}
              onClick={handleLinkClick}
              suppressHover={navigating}
              disableTransitions={navigating}
            />
          </>
        )}
      </nav>

      {/* User Info */}
      <div className="absolute bottom-16 left-0 w-full px-3">
        <div
          className={`${
            isOpen ? "gap-3 px-3 py-2 bg-blue-50 dark:bg-gray-800" : "justify-center w-10 h-10"
          } flex items-center rounded-xl transition-colors duration-150`}
        >
          <UserCircle size={22} className="text-blue-500 dark:text-blue-300" />
          {isOpen && (
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate text-gray-800 dark:text-gray-100">
                {user?.name || "User Name"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || "email@example.com"}</p>
              <p className="text-[11px] text-gray-400 truncate mt-0.5">Role: {role || "-"}</p>
            </div>
          )}
        </div>
      </div>

      {/* Logout */}
      <div className="absolute bottom-4 left-0 w-full px-3">
        <button
          onClick={() => {
            setRole?.(null);
            try {
              localStorage.removeItem(ROLE_STORAGE_KEY);
            } catch {}
            navigate("/login");
          }}
          className={`
            flex items-center w-full rounded-lg transition-colors duration-150
            hover:bg-blue-50 dark:hover:bg-gray-800
            text-sm text-gray-700 dark:text-gray-200
            ${isOpen ? "gap-3 px-3 py-2" : "justify-center w-10 h-10"}
            focus:outline-none
          `}
        >
          <span className="flex justify-center items-center">
            <LogOut size={22} className="text-red-400" />
          </span>
          {isOpen && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

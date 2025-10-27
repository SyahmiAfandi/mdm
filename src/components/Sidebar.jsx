import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Sliders, FileText, Settings, Layers,
  BarChart2, LogOut, UserCircle
} from 'lucide-react';
import SidebarLink from './SidebarLink';
import { useSidebar } from '../context/SidebarContext';
import { useUser } from '../context/UserContext';
import { useTooltip } from '../context/TooltipContext';

const PERM_STORAGE_KEY = 'ff.permissions';
const ROLE_STORAGE_KEY = 'ff.role';

const Sidebar = ({ isOpen }) => {
  const location = useLocation();
  const { role, setRole, user } = useUser();
  const navigate = useNavigate();
  const { showTooltip } = useTooltip();

  // Permission snapshot (synchronous first paint)
  const [permSnapshot, setPermSnapshot] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PERM_STORAGE_KEY);
      setPermSnapshot(raw ? JSON.parse(raw) : {});
    } catch {
      setPermSnapshot({});
    }
    setReady(true);
  }, [role]);

  const SHOW = useMemo(() => {
    const has = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
    const get = (k, fallback = false) =>
      permSnapshot && has(permSnapshot, k) ? !!permSnapshot[k] : fallback;

    const dashboard = get('dashboard.view', false);
    const settings  = get('settings.view',  false);
    const utilities  = get('utilities.view',  false);
    const reports   = has(permSnapshot, 'reports.view')
      ? get('reports.view', false)
      : get('reports.status.view', false);
    const tools = has(permSnapshot, 'tools.view')
      ? get('tools.view', false)
      : (role === 'admin' || role === 'user');

    return { dashboard, settings, reports, tools, utilities };
  }, [permSnapshot, role]);

  // 🔒 Suppress hover + transitions briefly on navigation
  const [navigating, setNavigating] = useState(false);
  const hoverTimerRef = useRef(null);

  const handleLinkClick = useCallback(() => {
    // Start suppression immediately at click
    setNavigating(true);
  }, []);

  // Clear suppression ~200ms after the route actually changed
  useEffect(() => {
    if (!navigating) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setNavigating(false);
    }, 200);
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    };
  }, [location.pathname, navigating]);

  // Skeleton (fixed height to avoid layout nudges)
  const SkeletonItem = () => <div className="h-10 mx-2 my-1 rounded-md bg-gray-100 dark:bg-gray-800 animate-pulse" />;

  return (
    <aside
      className={`
        fixed top-0 left-0 h-full z-20
        bg-white dark:bg-gray-900 shadow-lg dark:shadow-xl border-r dark:border-gray-800
        ${isOpen ? 'w-64' : 'w-16'} flex flex-col
        transition-[width] duration-300 ease-in-out
        overflow-x-visible
      `}
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-20 mb-2 px-3">
        <img
          src={isOpen ? "/ff3.png" : "/ff2.png"}
          alt="Sidebar Logo"
          className={`${isOpen ? 'rounded-lg' : 'rounded-full'} transition-[border-color,box-shadow] duration-150 bg-white dark:bg-gray-200 shadow-sm`}
          style={
            isOpen
              ? { width: "100%", maxWidth: 210, height: 52, objectFit: "contain", border: "0.5px solid #e5e7eb" }
              : { width: 38, height: 38, objectFit: "contain", border: "2px solid #e5e7eb" }
          }
        />
      </div>

      {/* Nav */}
      <nav className="relative flex-1 font-medium flex flex-col gap-1 px-1">
        {/* Invisible overlay to block hover while navigating */}
        {navigating && (
          <div className="absolute inset-0 z-50 pointer-events-auto select-none" />
        )}

        {!ready ? (
          <>
            <SkeletonItem /><SkeletonItem /><SkeletonItem />
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
                activeMatch={(p) =>
                  p.startsWith('/tools') ||
                  p.startsWith('/recons') ||
                  p.startsWith('/promotion')
                }
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
        <div className={`${isOpen ? 'gap-3 px-3 py-2 bg-blue-50 dark:bg-gray-800' : 'justify-center w-10 h-10'} flex items-center rounded-xl transition-colors duration-150`}>
          <UserCircle size={22} className="text-blue-500 dark:text-blue-300" />
          {isOpen && (
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate text-gray-800 dark:text-gray-100">{user?.name || 'User Name'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || 'email@example.com'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Logout */}
      <div className="absolute bottom-4 left-0 w-full px-3">
        <button
          onClick={() => {
            setRole(null);
            try {
              localStorage.removeItem(PERM_STORAGE_KEY);
              localStorage.removeItem(ROLE_STORAGE_KEY);
            } catch {}
            navigate('/login');
          }}
          className={`
            flex items-center w-full rounded-lg transition-colors duration-150
            hover:bg-blue-50 dark:hover:bg-gray-800
            text-sm text-gray-700 dark:text-gray-200
            ${isOpen ? 'gap-3 px-3 py-2' : 'justify-center w-10 h-10'}
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

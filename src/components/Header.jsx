import React, { useState, useRef, useEffect } from "react";
import { CalendarDays, Bell, HelpCircle, UserCircle, Moon, Sun, LogOut, User } from "lucide-react";
import { useUser } from '../context/UserContext';
import { useTooltip } from '../context/TooltipContext';
import { APP_FULL_NAME, ORG_COMP } from '../config';

// Theme toggle logic (should be here or in a separate file)
function useTheme() {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem("theme") || "light"
  );

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return [theme, toggleTheme];
}

const Header = ({ title = "", breadcrumbs = [] }) => {
  const { user, role } = useUser();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { showTooltip, setShowTooltip } = useTooltip();
  const [theme, toggleTheme] = useTheme(); // <-- Only here, inside the component
  const dropdownRef = useRef();

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }
    if (showUserMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showUserMenu]);

  // Add logout logic here, or pass via props/context
  const handleLogout = () => {
    // setUser(null); setRole(null); navigate('/login');
    alert('Logout action here!');
  };

  return (
    <div className="sticky top-0 z-20 flex justify-between items-center px-6 py-2 bg-gradient-to-r from-blue-50 via-white to-blue-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 shadow-sm border-b border-blue-100 dark:border-gray-800">
      {/* Left: Title & Breadcrumbs */}
      <div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg text-blue-700 dark:text-blue-200 tracking-wide">{title}</span>
          {/* Breadcrumbs */}
          {breadcrumbs.length > 0 && (
            <span className="ml-4 text-xs text-gray-400 dark:text-gray-400">
              {breadcrumbs.map((b, i) =>
                <span key={i}>
                  {b}
                  {i < breadcrumbs.length - 1 && " / "}
                </span>
              )}
            </span>
          )}
        </div>
      </div>
      {/* Right: Date, Notif, Help, User */}
      <div className="flex items-center gap-5 relative">
        <span className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-300 tracking-wide">
          <CalendarDays size={14} className="text-blue-400 dark:text-blue-300" />
          {new Date().toLocaleDateString("en-GB")}
        </span>
        <button title="Notifications" className="relative text-blue-700 hover:text-blue-900 dark:text-blue-200">
          <Bell size={18} />
        </button>
        <button title="Help" className="text-blue-700 hover:text-blue-900 dark:text-blue-200">
          <HelpCircle size={18} />
        </button>
        {/* Avatar with Dropdown */}
        <div className="relative">
          <button
            title="Account"
            className="ml-1 flex items-center gap-1 focus:outline-none"
            onClick={() => setShowUserMenu((prev) => !prev)}
          >
            <UserCircle size={28} className="text-blue-600 dark:text-blue-200" />
          </button>
          {showUserMenu && (
            <div
              ref={dropdownRef}
              className="absolute right-0 mt-2 w-64 bg-white border shadow-2xl rounded-2xl z-50 p-4 min-w-[200px] flex flex-col items-center dark:bg-gray-800 dark:border-gray-700"
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
                <label htmlFor="tooltip-toggle" className="text-xs text-gray-700 dark:text-gray-200 cursor-pointer select-none">
                  Sidebar Tooltip
                </label>
                <button
                  id="tooltip-toggle"
                  type="button"
                  onClick={() => setShowTooltip(v => !v)}
                  className={`
                    relative inline-flex h-5 w-9 items-center rounded-full transition
                    ${showTooltip ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}
                    focus:outline-none
                  `}
                  tabIndex={0}
                >
                  <span className="sr-only">Enable Sidebar Tooltip</span>
                  <span
                    className={`
                      inline-block h-4 w-4 transform rounded-full bg-white shadow transition
                      ${showTooltip ? 'translate-x-4' : 'translate-x-1'}
                    `}
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
                  className={`
                    ml-2 flex items-center px-2 py-1 rounded-lg
                    ${theme === 'dark' ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-700'}
                    transition
                  `}
                >
                  {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                  <span className="ml-1 text-xs">{theme === 'dark' ? 'Dark' : 'Light'}</span>
                </button>
              </div>
              
              {/* Quick Links */}
              <div className="w-full flex flex-col gap-1 mt-2">
                <a href="#" className="flex items-center gap-2 text-xs text-blue-600 hover:underline hover:text-blue-800 dark:text-blue-200">
                  <UserCircle size={15} /> My Profile
                </a>
                <a href="#" className="flex items-center gap-2 text-xs text-gray-500 hover:underline hover:text-blue-600 dark:text-gray-200">
                  <HelpCircle size={15} /> Help Center
                </a>
                <a href="#" className="flex items-center gap-2 text-xs text-gray-400 hover:underline hover:text-blue-600 dark:text-gray-300">
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

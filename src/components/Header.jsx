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

const Header = ({ title = "", breadcrumbs = [] }) => {
  const { user, role } = useUser();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { showTooltip, setShowTooltip } = useTooltip();
  const [theme, toggleTheme] = useTheme();
  const dropdownRef = useRef(null);
  const [showBackendConfig, setShowBackendConfig] = useState(false);

  // ===== Backend URL + Status (Tunnel URL) =====
  const HEALTH_PATH = "/test";
  const [backendUrl, setBackendUrl] = useState(() => getBackendUrl());

  // status: "missing" | "checking" | "up" | "down"
  const [backendStatus, setBackendStatus] = useState(backendUrl ? "checking" : "missing");
  const [backendMsg, setBackendMsg] = useState(backendUrl ? "Checking..." : "No URL set");

  const testBackend = async (url) => {
    const base = normalizeUrl(url);
    if (!base) {
      setBackendStatus("missing");
      setBackendMsg("No URL set");
      return false;
    }

    setBackendStatus("checking");
    setBackendMsg("Checking...");

    try {
      const res = await fetch(`${base}${HEALTH_PATH}`, { method: "GET" });
      if (res.ok) {
        setBackendStatus("up");
        setBackendMsg("Online");
        return true;
      }
      setBackendStatus("down");
      setBackendMsg(`Down (HTTP ${res.status})`);
      return false;
    } catch (e) {
      setBackendStatus("down");
      setBackendMsg("Down (network/CORS)");
      return false;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }
    if (showUserMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showUserMenu]);

  // Auto test backend when menu opens
  useEffect(() => {
    if (showUserMenu) testBackend(backendUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showUserMenu]);

  const handleLogout = () => {
    alert("Logout action here!");
  };

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
      <div className="flex items-center gap-5 relative">
        <span className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-300 tracking-wide">
          <CalendarDays size={14} className="text-blue-400 dark:text-blue-300" />
          {new Date().toLocaleDateString("en-GB")}
        </span>

        <button
          title="Notifications"
          className="relative text-blue-700 hover:text-blue-900 dark:text-blue-200"
        >
          <Bell size={18} />
        </button>

        <button
          title="Help"
          className="text-blue-700 hover:text-blue-900 dark:text-blue-200"
        >
          <HelpCircle size={18} />
        </button>

        {/* Avatar */}
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

              {/* Backend Status (Collapsible) */}
              <div className="w-full mt-2">
                <button
                  type="button"
                  onClick={() => setShowBackendConfig((v) => !v)}
                  className="w-full flex items-center justify-between rounded-lg px-2 py-2
                            hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-700 dark:text-gray-200 font-medium">
                      Backend Status
                    </span>
                    <span
                      className={[
                        "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                        backendStatus === "up" &&
                          "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200",
                        backendStatus === "checking" &&
                          "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200",
                        backendStatus === "down" &&
                          "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
                        backendStatus === "missing" &&
                          "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {backendStatus === "up"
                        ? "Added"
                        : backendStatus === "missing"
                        ? "Missing"
                        : backendStatus === "checking"
                        ? "Checking"
                        : "Down"}
                    </span>
                  </div>

                  <span className="text-xs text-gray-400 dark:text-gray-300">
                    {showBackendConfig ? "▾" : "▸"}
                  </span>
                </button>

                <div className="text-[10px] text-gray-400 mt-1 px-2">{backendMsg}</div>

                {/* Collapsible content */}
                {showBackendConfig && (
                  <div className="w-full mt-2 px-2 pb-2">
                    <label className="block text-[11px] text-gray-500 dark:text-gray-300">
                      Tunnel URL
                    </label>

                    <input
                      value={backendUrl}
                      onChange={(e) => setBackendUrl(normalizeUrl(e.target.value))}
                      placeholder="https://xxxx.trycloudflare.com"
                      className="w-full mt-1 px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-600
                                bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100
                                focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />

                    <div className="flex gap-2 w-full mt-2">
                      <button
                        className="flex-1 text-xs px-2 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
                        onClick={async () => {
                          const v = normalizeUrl(backendUrl);
                          saveBackendUrl(v);
                          setBackendUrl(v);

                          const ok = await testBackend(v);

                          if (ok) {
                            setShowBackendConfig(false); // 👈 collapse when online
                          }
                        }}
                      >
                        Save
                      </button>

                      <button
                        className="flex-1 text-xs px-2 py-1 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300
                                  dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 transition"
                        onClick={async () => {
                          await testBackend(backendUrl);
                        }}
                      >
                        Test
                      </button>

                      <button
                        className="text-xs px-2 py-1 rounded-lg text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 transition"
                        onClick={() => {
                          clearBackendUrl();
                          setBackendUrl("");
                          setBackendStatus("missing");
                          setBackendMsg("No URL set");
                          setShowBackendConfig(true); // open it again so user can paste
                        }}
                        title="Clear URL"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="mt-2 text-[10px] text-gray-400">
                      Example: <span className="select-text">https://xxxx.trycloudflare.com</span>
                    </div>
                  </div>
                )}
              </div>


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
                    theme === "dark"
                      ? "bg-blue-700 text-white"
                      : "bg-gray-200 text-gray-700"
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

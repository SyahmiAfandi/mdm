import React, { useMemo, useState, useEffect } from "react";
import { NavLink, useLocation, useResolvedPath } from "react-router-dom";

export default function SidebarLink({
  to,
  label,
  icon,
  isOpen,
  showTooltip = true,
  activeMatch, // optional: string prefix or (pathname)=>boolean

  // optional from Sidebar
  onClick,
  suppressHover = false,
  disableTransitions = false,
}) {
  const { pathname } = useLocation();
  const resolved = useResolvedPath(to);

  const isActiveForPath = useMemo(() => {
    if (typeof activeMatch === "function") return !!activeMatch(pathname);
    if (typeof activeMatch === "string") return pathname.startsWith(activeMatch);
    return to === "/" ? pathname === "/" : pathname.startsWith(to);
  }, [activeMatch, pathname, to]);

  // ✅ freeze active immediately on press (prevents flash during route swap)
  const [freezeActive, setFreezeActive] = useState(false);

  // release shortly after pathname changes
  useEffect(() => {
    if (!freezeActive) return;
    const t = setTimeout(() => setFreezeActive(false), 180);
    return () => clearTimeout(t);
  }, [freezeActive, pathname]);

  const activeVisual = isActiveForPath || freezeActive;

  return (
    <div className="relative">
      <NavLink
        to={to}
        aria-label={label}
        aria-current={activeVisual ? "page" : undefined}
        style={{ WebkitTapHighlightColor: "transparent" }}

        // ✅ prevent mouse focus flash (keyboard still works)
        onMouseDown={(e) => {
          if (e.detail > 0) e.preventDefault();
        }}

        // ✅ freeze BEFORE navigation happens
        onPointerDown={() => {
          setFreezeActive(true);
        }}

        onClick={(e) => {
          // ✅ IMPORTANT: if already active, do NOT navigate again (prevents blink)
          // Works even when activeMatch is used.
          if (isActiveForPath && pathname === resolved.pathname) {
            e.preventDefault();
            return;
          }

          onClick?.(e);
        }}
        className={[
          "relative flex items-center h-10",
          "select-none",
          "outline-none focus:outline-none focus-visible:outline-none",
          "active:bg-transparent active:text-inherit",
          disableTransitions ? "" : "transition-colors duration-150 ease-out",
          "group",

          isOpen
            ? [
                "w-full px-2 rounded-lg",
                activeVisual
                  ? "bg-blue-50 dark:bg-gray-800 text-blue-700 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-200",
                suppressHover ? "" : "hover:bg-gray-100 dark:hover:bg-gray-800",
              ].join(" ")
            : [
                "w-10 h-10 mx-auto justify-center rounded-full",
                activeVisual
                  ? "bg-blue-50 dark:bg-gray-800 text-blue-700 dark:text-blue-300"
                  : "text-gray-700 dark:text-gray-200",
                suppressHover ? "" : "hover:bg-gray-100 dark:hover:bg-gray-800",
              ].join(" "),
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="flex-shrink-0 flex justify-center items-center">
          {icon}
        </span>

        {isOpen && <span className="ml-3 truncate">{label}</span>}

        {/* Tooltip only when collapsed */}
        {!isOpen && showTooltip && (
          <span
            className="
              absolute left-full top-1/2 -translate-y-1/2 ml-3
              whitespace-nowrap bg-gray-900 dark:bg-gray-700 text-white
              text-xs px-2 py-1 rounded shadow-md pointer-events-none z-40
              opacity-0 translate-x-1
              group-hover:opacity-100 group-hover:translate-x-0
              transition-[opacity,transform] duration-150
            "
          >
            {label}
          </span>
        )}
      </NavLink>
    </div>
  );
}

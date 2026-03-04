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
          "relative flex items-center h-[34px] sm:h-[38px]",
          "select-none",
          "outline-none focus:outline-none focus-visible:outline-none",
          "active:bg-transparent active:text-inherit",
          // Only add transition if disableTransitions is false
          disableTransitions ? "" : "transition-all duration-300 ease-out",
          "group",

          isOpen
            ? [
              "w-full px-2.5 rounded-xl",
              activeVisual
                ? "bg-gradient-to-r from-indigo-500/15 to-transparent border-l-2 border-indigo-400 text-indigo-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                : "text-slate-400 border-l-2 border-transparent",
              suppressHover ? "" : "hover:bg-slate-800/50 hover:text-slate-200",
            ].join(" ")
            : [
              "w-[34px] h-[34px] sm:w-[38px] sm:h-[38px] mx-auto justify-center rounded-xl",
              activeVisual
                ? "bg-indigo-500/10 border border-indigo-500/50 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.2)]"
                : "text-slate-400 border border-transparent",
              suppressHover ? "" : "hover:bg-slate-800/50 hover:text-slate-200 hover:border-slate-700",
            ].join(" "),
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className={`flex-shrink-0 flex justify-center items-center transition-transform duration-300 ${activeVisual ? "scale-105 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]" : "group-hover:scale-110"}`}>
          {icon}
        </span>

        {isOpen && (
          <span
            className={`ml-3 truncate tracking-wide transition-all duration-300 ${activeVisual
                ? "font-bold text-white drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]"
                : "font-medium group-hover:font-semibold"
              }`}
          >
            {label}
          </span>
        )}

        {/* Tooltip only when collapsed */}
        {!isOpen && showTooltip && (
          <span
            className="
              absolute left-full top-1/2 -translate-y-1/2 ml-3
              whitespace-nowrap bg-slate-900 dark:bg-slate-700 text-white
              text-[11px] font-semibold px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none z-50
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

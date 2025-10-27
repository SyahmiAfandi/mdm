import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function SidebarLink({
  to,
  label,
  icon,
  isOpen,
  showTooltip = true,
  activeMatch, // optional: string prefix or (pathname)=>boolean
}) {
  const { pathname } = useLocation();
  const [hovered, setHovered] = useState(false);

  // Determine active state
  let isActive = false;
  if (typeof activeMatch === 'function') {
    isActive = !!activeMatch(pathname);
  } else if (typeof activeMatch === 'string') {
    isActive = pathname.startsWith(activeMatch);
  } else {
    isActive = to === '/' ? pathname === '/' : pathname.startsWith(to);
  }

  return (
    <div className="relative">
      <Link
        to={to}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-current={isActive ? 'page' : undefined}
        className={[
          'relative flex items-center h-10',         // fixed height = no jiggle
          'transition-colors duration-150 ease-out', // color only
          isOpen
            ? (isActive
                ? 'w-full px-2 rounded-lg bg-blue-50 dark:bg-gray-800 text-blue-700 dark:text-blue-300'
                : 'w-full px-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200')
            : 'w-10 h-10 mx-auto justify-center rounded-full', // collapsed: the LINK itself is the circle
          (!isOpen && isActive) && 'bg-blue-50 dark:bg-gray-800 text-blue-700 dark:text-blue-300',
          (!isOpen && !isActive) && 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200',
        ].filter(Boolean).join(' ')}
      >
        <span className="flex-shrink-0 flex justify-center items-center">
          {icon}
        </span>
        {isOpen && <span className="ml-3 truncate">{label}</span>}
      </Link>

      {/* Tooltip only when collapsed */}
      {!isOpen && showTooltip && hovered && (
        <span
          className="
            absolute left-full top-1/2 -translate-y-1/2 ml-3
            whitespace-nowrap bg-gray-900 dark:bg-gray-700 text-white
            text-xs px-2 py-1 rounded shadow-md pointer-events-none z-40
          "
        >
          {label}
        </span>
      )}
    </div>
  );
}

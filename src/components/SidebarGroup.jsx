import React from 'react';

const SidebarGroup = ({ label, icon, children, isOpen, onToggle, expanded, childrenOpen, isActive }) => {
  return (
    <div>
      <button
        onClick={onToggle}
        className={`w-full flex items-center rounded transition hover:bg-gray-100 ${
          isActive ? 'bg-blue-100 text-blue-600 font-semibold' : ''
        } ${isOpen ? 'px-3 py-2 gap-3' : 'justify-center w-8 h-8'}`}
      >
        <span className="flex justify-center items-center">{icon}</span>
        {isOpen && <span className="whitespace-nowrap">{label}</span>}
        {isOpen && (
          <span className={`ml-auto transform transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`}>
            ▸
          </span>
        )}
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          childrenOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="ml-4 space-y-0.5">{children}</div>
      </div>
    </div>
  );
};

export default SidebarGroup;
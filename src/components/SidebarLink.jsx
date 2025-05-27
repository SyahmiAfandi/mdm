// components/SidebarLink.js
import React from 'react';
import { Link } from 'react-router-dom';

const SidebarLink = ({ to, label, icon, isOpen, isActive }) => {
  return (
        <Link
        to={to}
        className={`flex items-center ${
            isOpen ? 'gap-3 px-3 py-2' : 'justify-center w-8 h-8'
        } rounded transition-all duration-200 hover:bg-gray-100 ${
            isActive(to) ? 'bg-blue-100 text-blue-600 font-semibold' : ''
        }`}
        >
        <span className="flex justify-center items-center">{icon}</span>
        {isOpen && <span>{label}</span>}
        </Link>
  );
};

export default SidebarLink;

import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Sliders, FileText, Settings, Layers, LogOut, UserCircle } from 'lucide-react';
import SidebarLink from './SidebarLink';
import SidebarGroup from './SidebarGroup';
import { useSidebar } from '../context/SidebarContext';
import { useUser } from '../context/UserContext';

const Sidebar = ({ isOpen }) => {
  const location = useLocation();
  const [toolsOpen, setToolsOpen] = useState(true);
  const { isSidebarOpen } = useSidebar();
  const { role, setRole, user } = useUser();
  const navigate = useNavigate();

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const isToolsActive =
    !isSidebarOpen &&
    (location.pathname.startsWith('/recons') || location.pathname.startsWith('/promotion'));

  return (
    <aside className={`bg-white shadow-md fixed h-full z-20 ${isOpen ? 'w-64' : 'w-16'} transition-all duration-300 p-4`}>
      <h2 className={`text-xl font-bold text-blue-600 mb-6 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
        MDM Tools
      </h2>
      <nav className="text-gray-700 font-medium space-y-2">
        <SidebarLink to="/" label="Home" icon={<Home size={20} />} isOpen={isOpen} isActive={isActive} />

        {(role === 'admin' || role === 'user') && (
        <>
          <SidebarLink
            to="/tools"
            label="Tools"
            icon={<Sliders size={20} />}
            isOpen={isOpen}
            isActive={(path) =>
              location.pathname.startsWith('/tools') ||
              location.pathname.startsWith('/recons') ||
              location.pathname.startsWith('/promotion')
            }
          />
          {/* 
          <SidebarGroup
            label="Tools"
            icon={<Sliders size={20} />}
            isOpen={isOpen}
            expanded={toolsOpen}
            onToggle={() => setToolsOpen(!toolsOpen)}
            childrenOpen={isOpen && toolsOpen}
            isActive={isToolsActive}
          >
            <SidebarLink to="/recons" label="Reconciliation Tools" isOpen={isOpen} isActive={isActive} />
            {role === 'admin' && (
              <SidebarLink to="/promotion" label="Promotion Tools" isOpen={isOpen} isActive={isActive} />
            )}
          </SidebarGroup>
          */}
        </>
      )}

        <SidebarLink to="/utilities" label="Utilities" icon={<Layers size={20} />} isOpen={isOpen} isActive={isActive} />
        {role === 'admin' && (
          <SidebarLink to="/settings" label="Settings" icon={<Settings size={20} />} isOpen={isOpen} isActive={isActive} />
        )}
        <SidebarLink to="/contact" label="About" icon={<FileText size={20} />} isOpen={isOpen} isActive={isActive} />
      </nav>

      {/* User Info */}
      <div className="absolute bottom-16 left-0 w-full px-4 text-gray-700">
        <div className={`flex items-center ${isOpen ? 'gap-3 px-3 py-2' : 'justify-center w-8 h-8'}`}>
          <UserCircle size={20} />
          {isOpen && (
            <div>
              <p className="text-sm font-semibold truncate">{user?.name || 'User Name'}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email || 'email@example.com'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Logout Button */}
      <div className="absolute bottom-4 left-0 w-full px-4">
        <button
          onClick={() => {
            setRole(null);
            navigate('/login');
          }}
          className={`flex items-center w-full rounded transition hover:bg-gray-100 text-sm text-gray-700 ${
            isOpen ? 'gap-3 px-3 py-2' : 'justify-center w-8 h-8'
          }`}
        >
          <span className="flex justify-center items-center">
            <LogOut size={20} />
          </span>
          {isOpen && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

import React from 'react';
import Sidebar from './Sidebar';
import { useSidebar } from '../context/SidebarContext';
import RoleSwitcher from './RoleSwitcher';
import { useUser } from '../context/UserContext';

const DashboardLayout = ({ children }) => {
  const { isSidebarOpen, toggleSidebar } = useSidebar();
  

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar isOpen={isSidebarOpen} />
      <main className={`${isSidebarOpen ? 'ml-64' : 'ml-16'} transition-all duration-300 p-6 w-full`}>
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={toggleSidebar}
            className="text-gray-600 hover:text-gray-800"
          >
            {isSidebarOpen ? '← Collapse Sidebar' : '→ Expand Sidebar'}
          </button>
        </div>
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;

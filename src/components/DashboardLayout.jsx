import React from "react";
import Sidebar from "./Sidebar";
import { useSidebar } from "../context/SidebarContext";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Header from "./Header";

const sidebarWidth = 256;     // must match Sidebar open width (16rem -> ml-64)
const collapsedWidth = 64;    // must match Sidebar collapsed width (4rem -> ml-16)
const btnSize = 20;

const DashboardLayout = ({ children, pageTitle, breadcrumbs }) => {
  const { isSidebarOpen, toggleSidebar } = useSidebar();

  return (
    <div className="flex min-h-screen bg-gray-100 overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} />

      {/* Floating sidebar toggle button */}
      <button
        onClick={toggleSidebar}
        aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        className="
          fixed z-30
          transition-all duration-300
          bg-white shadow-md border border-gray-200
          flex items-center justify-center
          rounded-full
          hover:bg-blue-100 active:bg-blue-200
          focus:outline-none focus:ring-2 focus:ring-blue-300
        "
        style={{
          left: isSidebarOpen ? sidebarWidth - btnSize / 2 : collapsedWidth - btnSize / 2,
          top: "50%",
          transform: "translateY(-50%)",
          width: btnSize,
          height: btnSize,
        }}
      >
        {isSidebarOpen ? (
          <ChevronLeft size={12} className="text-blue-600" />
        ) : (
          <ChevronRight size={12} className="text-blue-600" />
        )}
      </button>

      {/* Content area: allow it to shrink next to the sidebar & never widen the page */}
      <main
        className={`${isSidebarOpen ? "ml-64" : "ml-16"} relative flex-1 min-w-0 overflow-x-hidden transition-all duration-300`}
      >
        {/* Header */}
        <Header title={pageTitle} breadcrumbs={breadcrumbs} />

        {/* Page body (min-w-0 helps nested wide content like tables) */}
        <div className="p-3 min-w-0 page-wrap">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;

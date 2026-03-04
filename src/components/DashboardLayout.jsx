import React from "react";
import Sidebar from "./Sidebar";
import { useSidebar } from "../context/SidebarContext";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Header from "./Header";

const sidebarWidth = 224;     // w-56
const collapsedWidth = 60;    // w-[60px]
const btnSize = 20;

const DashboardLayout = ({ children, pageTitle, breadcrumbs }) => {
  const { isSidebarOpen, toggleSidebar } = useSidebar();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <Sidebar isOpen={isSidebarOpen} />

      <button
        onClick={toggleSidebar}
        aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        className="
          fixed z-30
          transition-[left] duration-300 ease-in-out
          bg-white shadow-md border border-gray-200
          flex items-center justify-center
          rounded-full
          hover:bg-blue-100
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

      <main
        className={`${isSidebarOpen ? "ml-[224px]" : "ml-[60px]"
          } flex-1 min-w-0 h-screen overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]`}
      >
        <div className="flex flex-col h-full min-w-0">
          {/* Header is floating now */}
          <div className="shrink-0 px-4 pt-4 pb-2 z-20">
            <Header title={pageTitle} breadcrumbs={breadcrumbs} />
          </div>

          {/* ✅ Always show scrollbar (prevents sudden scrollbar + blink) */}
          <div className="flex-1 min-w-0 overflow-y-scroll overflow-x-hidden px-4 pb-4 pt-1 page-wrap">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;

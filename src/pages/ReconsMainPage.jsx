import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Settings,
  UploadCloud,
  BarChart3,
  DatabaseZap,
  FileBox,
  Activity,
  ChevronRight,
  MonitorPlay,
  ClipboardList,
  FileSearch,
  LayoutGrid,
  ListFilter,
  CalendarDays,
} from 'lucide-react';

const ReconsMainPage = () => {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleNavigate = (path, label) => {
    navigate(path, { state: { businessType: label } });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: "easeOut"
      }
    }
  };

  const Section = ({ title, description, children, icon: Icon }) => (
    <motion.div
      variants={itemVariants}
      className="flex flex-col flex-1 min-w-0 bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
    >
      <div className="p-5 bg-violet-600 dark:bg-violet-700 flex items-start gap-4">
        <div className="p-2.5 rounded-xl bg-white/20 text-white shadow-sm ring-1 ring-white/30 shrink-0 mt-0.5">
          <Icon size={20} />
        </div>
        <div className="flex flex-col min-w-0">
          <h2 className="text-[17px] font-bold text-white uppercase tracking-tight leading-tight mb-0.5">
            {title}
          </h2>
          <p className="text-[11px] text-violet-100 dark:text-violet-200 font-medium opacity-90 leading-snug">
            {description}
          </p>
        </div>
      </div>
      <div className="flex-1 p-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
        {children}
      </div>
    </motion.div>
  );

  const ReconsCard = ({ label, description, path, icon: Icon, image, hoverImage, disabled = false }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
      <motion.button
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ scale: 1.01, x: 4 }}
        whileTap={{ scale: 0.99 }}
        disabled={disabled}
        onClick={() => !disabled && handleNavigate(path, label)}
        className={`group relative flex items-center gap-4 p-3.5 w-full bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-violet-200 dark:hover:border-violet-500/30 shadow-sm hover:shadow-md transition-all duration-200 text-left overflow-hidden ${disabled ? 'opacity-50 grayscale' : ''}`}
      >
        {image ? (
          <div className="shrink-0 relative w-12 h-12 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700">
            <AnimatePresence mode="wait">
              <motion.img
                key={isHovered && hoverImage ? 'hover' : 'default'}
                src={isHovered && hoverImage ? hoverImage : image}
                alt={label}
                initial={{ opacity: 0.8 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0.8 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full object-cover"
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-violet-600/5 mix-blend-multiply" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-[2px]">
              <Icon size={16} className="drop-shadow-md" />
            </div>
          </div>
        ) : (
          <div className="shrink-0 p-2.5 rounded-xl bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform duration-300 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-700/50">
            <Icon size={18} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-bold text-slate-900 dark:text-slate-100 mb-0.5 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
            {label}
          </h3>
          <p className="text-[10px] text-slate-500 dark:text-slate-500 leading-tight font-medium truncate">
            {description}
          </p>
        </div>

        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronRight size={14} className="text-violet-500" />
        </div>
      </motion.button>
    );
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-2 space-y-6 max-w-[1600px] mx-auto overflow-hidden">
      {/* Header Section - Lilac Theme */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={mounted ? { opacity: 1, y: 0 } : {}}
        className="flex items-end justify-between px-2 shrink-0"
      >
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Reconciliation <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">Hub</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Centralized operations for data matching and analysis.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold text-violet-500/70 dark:text-violet-400/70 uppercase tracking-widest bg-violet-50 dark:bg-violet-900/10 px-3 py-1.5 rounded-full border border-violet-100 dark:border-violet-800/50 shadow-sm">
          <Activity size={12} className="text-violet-500" /> System Active
        </div>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate={mounted ? "visible" : "hidden"}
        className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-0"
      >
        {/* Operations Section */}
        <Section
          title="Operations"
          description="Primary business unit reconciliations"
          icon={Activity}
        >
          <ReconsCard
            label="HPC"
            description="Home and Personal Care matching"
            path="/recons/hpc"
            icon={MonitorPlay}
            image="/images/hpc_bw.jpg"
            hoverImage="/images/hpc_color.jpg"
          />
          <ReconsCard
            label="IC"
            description="Ice Cream business unit tool"
            path="/recons/ic"
            icon={MonitorPlay}
            image="/images/ic_bw.jpg"
            hoverImage="/images/ic_color.jpg"
          />
          <ReconsCard
            label="Custom Reports"
            description="Unique file structure processing"
            path="/recons/custom"
            icon={FileBox}
            image="/images/custom_report.jpg"
            hoverImage="/images/custom_report_color.jpg"
          />
        </Section>

        {/* Configuration & Data Section */}
        <Section
          title="Data & Config"
          description="Manage system parameters"
          icon={DatabaseZap}
        >
          <ReconsCard
            label="Recons Period"
            description="Fiscal and operational periods"
            path="/recons/period"
            icon={Database}
          />
          <ReconsCard
            label="Data Management"
            description="Distributor cell mappings"
            path="/recons/cells"
            icon={LayoutGrid}
          />
          <ReconsCard
            label="Bulk Import"
            description="Large dataset direct upload"
            path="/recons/bulk_import"
            icon={UploadCloud}
          />
          <ReconsCard
            label="Button Mapping"
            description="Map buttons to report types"
            path="/recons/button-mapping"
            icon={LayoutGrid}
          />
          <ReconsCard
            label="Config"
            description="Universal process settings"
            path="/recons/config"
            icon={Settings}
          />

        </Section>

        {/* Insights Section */}
        <Section
          title="Insights"
          description="Tracking and historical analysis"
          icon={BarChart3}
        >
          <ReconsCard
            label="Summary Dashboard"
            description="Visual analytics & results"
            path="/recons/summary"
            icon={BarChart3}
          />
          <ReconsCard
            label="Mismatch Tracker"
            description="Detailed table with editable remarks"
            path="/reports/mismatch-tracker"
            icon={Activity}
          />
          <ReconsCard
            label="Mismatch List Report"
            description="Quick-copy distributor codes & names"
            path="/reports/mismatch-list"
            icon={ListFilter}
          />
          <ReconsCard
            label="Export Reports"
            description="Downloadable Excel & PDF files"
            path="/recons/export"
            icon={FileSearch}
            color="orange"
          />
          <ReconsCard
            label="Recon Schedule Report"
            description="Yearly schedule with recon status per period"
            path="/reports/recon-schedule"
            icon={CalendarDays}
          />
          <ReconsCard
            label="Audit History"
            description="Historical logs & changes"
            path="/recons/audit"
            icon={ClipboardList}
          />
        </Section>
      </motion.div>
    </div>
  );
};

export default ReconsMainPage;
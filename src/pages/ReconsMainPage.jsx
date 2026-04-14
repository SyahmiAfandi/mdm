import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Database,
  Settings,
  UploadCloud,
  BarChart3,
  Activity,
  ClipboardList,
  FileSearch,
  LayoutGrid,
  CalendarDays,
  Sparkles,
  Droplets,
  IceCream,
  FileCog,
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
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.4, ease: "easeOut" }
    }
  };

  // ── HERO CARD for Operations ──
  const OperationCard = ({ label, description, path, icon: Icon, image, span2 = false }) => {
    return (
      <motion.button
        variants={itemVariants}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => handleNavigate(path, label)}
        className={`group relative flex flex-col justify-between p-4 xl:p-5 rounded-2xl overflow-hidden shadow-md hover:shadow-xl hover:shadow-indigo-500/20 transition-all duration-300 text-left bg-slate-900 ${span2 ? 'sm:col-span-2' : ''}`}
      >
        <img src={image} alt={label} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a0044] via-[#2e096f]/60 to-transparent mix-blend-multiply" />
        
        <div className={`relative z-10 flex ${span2 ? 'flex-row items-center gap-3' : 'flex-col items-start gap-3'} mb-2`}>
          <div className="p-2 rounded-xl bg-white/10 backdrop-blur-md text-white/90 ring-1 ring-white/30 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            <Icon size={20} strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-black text-white tracking-tight drop-shadow-md">
              {label}
            </h3>
            {span2 && (
              <p className="text-[13px] text-violet-100 mt-0.5 drop-shadow">{description}</p>
            )}
          </div>
        </div>

        {!span2 && (
          <p className="relative z-10 text-[13px] text-violet-100 mt-auto drop-shadow line-clamp-2">{description}</p>
        )}
      </motion.button>
    );
  };

  // ── MINIMAL LIST CARD for Config & Insights ──
  const ListCard = ({ label, path, icon: Icon }) => {
    return (
      <motion.button
        variants={itemVariants}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => handleNavigate(path, label)}
        className="flex items-center gap-2 px-3 py-1.5 w-full bg-white hover:bg-slate-50 border border-slate-100 hover:border-slate-300 rounded-lg shadow-sm hover:shadow transition-all duration-200 text-left"
      >
        <div className="text-slate-500 shrink-0">
          <Icon size={14} strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[12px] font-semibold text-slate-700 truncate">
            {label}
          </h3>
        </div>
      </motion.button>
    );
  };

  return (
    <div className="h-[calc(100vh-110px)] w-full flex flex-col overflow-hidden">
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full h-full bg-white rounded-3xl shadow-lg border border-slate-100 flex flex-col relative overflow-hidden"
      >
        {/* Left purple border accent */}
        <div className="absolute top-0 left-0 bottom-0 w-2.5 bg-violet-600 rounded-l-3xl" />
        
        <div className="flex-1 flex flex-col p-4 md:p-6 lg:p-8 pl-8 md:pl-10 lg:pl-12 min-h-0">
          
          {/* ── HEADER ── */}
          <div className="flex items-center justify-between shrink-0 mb-4 lg:mb-6">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-indigo-500" />
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-700 to-indigo-600">
                Reconciliation Hub
              </h1>
            </div>
            <div className="inline-flex items-center gap-1.5 text-[10px] md:text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 md:py-1.5 rounded-full border border-emerald-200 shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              System Active
            </div>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate={mounted ? "visible" : "hidden"}
            className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 min-h-0"
          >
            {/* ── LEFT COLUMN: OPERATIONS ── */}
             <div className="lg:col-span-7 xl:col-span-8 flex flex-col min-h-0">
              <h2 className="text-sm font-bold text-slate-800 mb-3 shrink-0 uppercase tracking-widest">Operations</h2>
              
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4 min-h-0">
                <OperationCard
                  label="HPC"
                  description="Home and Personal Care matching workflows"
                  path="/recons/hpc"
                  icon={Droplets}
                  image="/images/recons_hpc.png"
                />
                <OperationCard
                  label="IC"
                  description="Ice Cream business unit reconciliation tool"
                  path="/recons/ic"
                  icon={IceCream} 
                  image="/images/recons_ic.png"
                />
                <OperationCard
                  label="Custom Reports"
                  description="Process unique and non-standard file structures directly"
                  path="/recons/custom"
                  icon={FileCog}
                  span2={true}
                  image="/images/recons_custom.png"
                />
              </div>
            </div>

            {/* ── RIGHT COLUMN: SECONDARY ── */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4 lg:gap-6 lg:pl-8 lg:border-l border-slate-100 min-h-0 overflow-y-auto custom-scrollbar pr-2">
              
              {/* Data & Config */}
              <div className="flex flex-col shrink-0">
                <h2 className="text-sm font-bold text-slate-800 mb-2.5 uppercase tracking-widest">Data & Config</h2>
                <div className="flex flex-col gap-1.5">
                  <ListCard label="Recons Period" path="/recons/period" icon={CalendarDays} />
                  <ListCard label="Data Management" path="/recons/cells" icon={Database} />
                  <ListCard label="Bulk Import" path="/recons/bulk_import" icon={UploadCloud} />
                  <ListCard label="Button Mapping" path="/recons/button-mapping" icon={LayoutGrid} />
                  <ListCard label="Configuration" path="/recons/config" icon={Settings} />
                </div>
              </div>

              {/* Insights */}
              <div className="flex flex-col shrink-0 pb-2">
                <h2 className="text-sm font-bold text-slate-800 mb-2.5 mt-2 uppercase tracking-widest">Insights</h2>
                <div className="flex flex-col gap-1.5">
                  <ListCard label="Summary Dashboard" path="/recons/summary" icon={BarChart3} />
                  <ListCard label="Mismatch Tracker" path="/reports/mismatch-tracker" icon={Activity} />
                  <ListCard label="Status Report" path="/reports/matrix_recons" icon={FileSearch} />
                  <ListCard label="Schedule Tracker" path="/reports/recon-schedule" icon={CalendarDays} />
                  <ListCard label="Audit History" path="/recons/audit" icon={ClipboardList} />
                </div>
              </div>

            </div>

          </motion.div>
        
        </div>
      </motion.div>
    </div>
  );
};

export default ReconsMainPage;
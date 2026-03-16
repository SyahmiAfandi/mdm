import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, ListFilter, CalendarClock, PackageOpen, ChevronRight, Settings2, Undo2, Sparkles } from 'lucide-react';

const ConfigCard = ({ label, description, path, icon: Icon, colorClass, handleNavigate }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => handleNavigate(path, label)}
      className="group flex flex-col items-center gap-2.5 p-4 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md rounded-xl border border-slate-200/60 dark:border-slate-800/60 hover:border-rose-300 dark:hover:border-rose-500/50 shadow-sm hover:shadow-lg transition-all text-center w-full relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-rose-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className={`p-2.5 rounded-xl ${colorClass} shrink-0 relative z-10 shadow-sm group-hover:shadow-md transition-all group-hover:scale-105`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 relative z-10">
        <h4 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors text-sm">
          {label}
        </h4>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-[160px] mx-auto">
          {description}
        </p>
      </div>
      
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-rose-50/10 dark:to-rose-900/5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.button>
  );
};

const SectionHeader = ({ title, subtitle }) => (
  <div className="flex flex-col items-center mb-6 w-full relative">
    <div className="flex items-center w-full gap-3 sm:gap-6">
      <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-slate-200 dark:to-slate-800" />
      <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight text-center whitespace-nowrap px-1">
        {title}
      </h2>
      <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-slate-200 dark:via-slate-800 to-slate-200 dark:to-slate-800" />
    </div>
    {subtitle && (
      <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-2">
        {subtitle}
      </p>
    )}
  </div>
);

export default function PromoConfigPage() {
  const navigate = useNavigate();

  const handleNavigate = (path, label) => {
    navigate(path, { state: { promoMode: label } });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { y: 10, opacity: 0 },
    visible: {
      y: 0, opacity: 1,
      transition: { duration: 0.3, ease: "easeOut" }
    }
  };

  return (
    <div className="w-full min-w-0 px-4 sm:px-6 pb-8 flex flex-col relative overflow-hidden h-full max-h-[calc(100vh-100px)] lg:overflow-y-auto custom-scrollbar">
      {/* Background Decorative Blobs */}
      <div className="absolute top-10 -left-10 w-64 h-64 bg-rose-200/10 dark:bg-rose-900/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 -right-10 w-80 h-80 bg-blue-200/10 dark:bg-blue-900/5 rounded-full blur-3xl pointer-events-none" />

      {/* ── Compact Hero Header ── */}
      <div className="relative overflow-hidden rounded-2xl mb-8 shrink-0 bg-gradient-to-br from-rose-700 via-rose-600 to-pink-600 shadow-md shadow-rose-200/20 dark:shadow-rose-900/10 px-6 py-4">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-xl pointer-events-none" />
        
        <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/30 flex items-center justify-center shadow-lg backdrop-blur-md shrink-0">
              <Settings2 size={24} className="text-white" />
            </div>
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 mb-0.5">
                <Sparkles size={10} className="text-rose-200 animate-pulse" />
                <span className="text-rose-100 text-[8px] font-bold tracking-[0.2em] uppercase">Control Center</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">
                Promotions
              </h1>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02, x: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/promotions')}
            className="group flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 hover:bg-white/25 text-white transition-all backdrop-blur-md font-bold text-xs shadow-md"
          >
            <Undo2 size={14} className="group-hover:-translate-x-1 transition-transform" />
            Back to Hub
          </motion.button>
        </div>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-10 relative z-10"
      >
        {/* ── Section 1: Master Data Configuration ── */}
        <section className="flex flex-col items-center">
          <SectionHeader 
            title="Promo Master Data" 
            subtitle="Core Parameter Configuration" 
          />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            <motion.div variants={itemVariants}>
              <ConfigCard
                label="Region & Distributor"
                description="Manage region mappings for distributors."
                path="/promotions/region-distributor"
                icon={MapPin}
                colorClass="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                handleNavigate={handleNavigate}
              />
            </motion.div>

            <motion.div variants={itemVariants}>
              <ConfigCard
                label="Promo Criteria"
                description="Set up rules and promotional mechanisms."
                path="/promotions/promo-criteria"
                icon={ListFilter}
                colorClass="bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                handleNavigate={handleNavigate}
              />
            </motion.div>

            <motion.div variants={itemVariants}>
              <ConfigCard
                label="Promo Period"
                description="Define valid date ranges and periods."
                path="/promotions/promo-period"
                icon={CalendarClock}
                colorClass="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                handleNavigate={handleNavigate}
              />
            </motion.div>

            <motion.div variants={itemVariants}>
              <ConfigCard
                label="Promo Item"
                description="Map Master Items and view products."
                path="/promotions/promo-item"
                icon={PackageOpen}
                colorClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                handleNavigate={handleNavigate}
              />
            </motion.div>
          </div>
        </section>

        {/* ── Section 2: Data Mapping & Relationships ── */}
        <section className="flex flex-col items-center">
          <SectionHeader 
            title="Promo Data Mapping" 
            subtitle="Logic & Relationship Management" 
          />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            <motion.div variants={itemVariants}>
              <ConfigCard
                label="Region & Criteria Mapping"
                description="Map Region DT codes to Criteria Values."
                path="/promotions/region-criteria-mapping"
                icon={MapPin}
                colorClass="bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
                handleNavigate={handleNavigate}
              />
            </motion.div>
          </div>
        </section>
      </motion.div>
    </div>
  );
}

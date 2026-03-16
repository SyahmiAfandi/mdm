import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, MonitorPlay, ChevronRight, Settings2, Undo2, ArrowRight, MapPin, ListFilter, CalendarClock, PackageOpen, ChevronDown, ChevronUp } from 'lucide-react';

export default function PromoMainPage() {
  const navigate = useNavigate();

  const handleNavigate = (path, label) => {
    navigate(path, { state: { promoMode: label } });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0, opacity: 1,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  const PromoCard = ({ label, description, path, image, hoverImage }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
      <motion.button
        variants={itemVariants}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ scale: 1.02, y: -4 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => handleNavigate(path, label)}
        className="group relative flex flex-col items-center justify-center p-6 sm:p-8 w-full max-w-sm mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-500/50 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden"
      >
        {/* Glow effect matching Recons/MasterData premium UI */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute inset-0 bg-rose-50/30 dark:bg-rose-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="relative w-36 h-36 mb-6 rounded-2xl overflow-hidden shadow-md border border-slate-100 dark:border-slate-700 bg-slate-50">
          <AnimatePresence mode="wait">
            <motion.img
              key={isHovered ? 'hover' : 'default'}
              src={isHovered ? hoverImage : image}
              alt={label}
              initial={{ opacity: 0.6, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0.6, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full object-cover"
            />
          </AnimatePresence>
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <MonitorPlay size={32} className="text-white drop-shadow-md" />
          </div>
        </div>

        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
          {label}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center leading-relaxed">
          {description}
        </p>

        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all">
          <div className="p-2 rounded-full bg-rose-100 text-rose-600">
            <ChevronRight size={18} />
          </div>
        </div>
      </motion.button>
    );
  };

  const FlipPromoCard = ({ label, description, image, hoverImage }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isFlipped, setIsFlipped] = useState(false);

    return (
      <motion.div variants={itemVariants} className="relative w-full max-w-sm mx-auto h-[380px]" style={{ perspective: "1000px" }}>
        <div
          className="w-full h-full relative transition-transform duration-700 ease-in-out"
          style={{ 
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
            transformStyle: "preserve-3d"
          }}
        >
          <button
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => setIsFlipped(true)}
            className={`absolute inset-0 group flex flex-col items-center justify-center p-6 sm:p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-500/50 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden ${isFlipped ? 'pointer-events-none' : ''}`}
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute inset-0 bg-rose-50/30 dark:bg-rose-900/10 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative w-36 h-36 mb-6 rounded-2xl overflow-hidden shadow-md border border-slate-100 dark:border-slate-700 bg-slate-50">
              <AnimatePresence mode="wait">
                <motion.img
                  key={isHovered ? 'hover' : 'default'}
                  src={isHovered ? hoverImage : image}
                  alt={label}
                  initial={{ opacity: 0.6, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0.6, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="w-full h-full object-cover"
                />
              </AnimatePresence>
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <MonitorPlay size={32} className="text-white drop-shadow-md" />
              </div>
            </div>

            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
              {label}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center leading-relaxed">
              {description}
            </p>

            <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all">
              <div className="p-2 rounded-full bg-rose-100 text-rose-600">
                <ChevronRight size={18} />
              </div>
            </div>
          </button>

          {/* BACK */}
          <div
            className={`absolute inset-0 flex flex-col p-6 sm:p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 shadow-xl overflow-hidden ${!isFlipped ? 'pointer-events-none' : ''}`}
            style={{ 
              transform: "rotateY(180deg)",
              backfaceVisibility: "hidden",
            }}
          >
            <div className="flex flex-col h-full justify-between relative z-10">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                  <MonitorPlay className="w-5 h-5 text-rose-500" />
                  Select Campaign Type
                </h3>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => handleNavigate("/promotions/auto-ufs", "UFS Promotions")}
                    className="group flex items-center justify-between p-4 rounded-xl border-2 border-slate-100 hover:border-rose-400 hover:bg-rose-50 transition-all text-left"
                  >
                    <div>
                      <div className="font-bold text-slate-800 group-hover:text-rose-700">UFS Promotions</div>
                      <div className="text-xs text-slate-500 mt-1">Generate Unilever Food Solutions campaigns.</div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-rose-500 transition-colors" />
                  </button>

                  <button
                    onClick={() => handleNavigate("/promotions/auto-IC", "IC Promotions")}
                    className="group flex items-center justify-between p-4 rounded-xl border-2 border-slate-100 hover:border-pink-400 hover:bg-pink-50 transition-all text-left"
                  >
                    <div>
                      <div className="font-bold text-slate-800 group-hover:text-pink-700">IC Promotions</div>
                      <div className="text-xs text-slate-500 mt-1">Generate Ice Cream campaigns.</div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-pink-500 transition-colors" />
                  </button>
                </div>
              </div>

              <button
                onClick={() => setIsFlipped(false)}
                className="self-start mt-6 inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Undo2 className="w-4 h-4" />
                Back
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="w-full min-w-0 px-3 sm:px-5 pb-3 flex flex-col">
      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden rounded-2xl mb-8 shrink-0 bg-gradient-to-r from-rose-700 via-rose-600 to-pink-600 shadow-md shadow-rose-200/50 px-5 py-3.5">
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="absolute -bottom-16 right-1/4 w-40 h-40 rounded-full bg-pink-400/20 blur-2xl pointer-events-none" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner backdrop-blur-sm shrink-0">
              <Settings2 size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight mb-0.5">
                Promotions Hub
              </h1>
              <p className="text-rose-100 text-xs sm:text-sm max-w-xl leading-relaxed">
                Choose how you want to configure and match your promotions.
              </p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05, rotate: 90 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/promotions/config')}
            className="p-2.5 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 text-white transition-colors group relative"
            title="Configuration"
          >
            <Settings2 size={24} />
            <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Open Settings
            </span>
          </motion.button>
        </div>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col justify-center bg-transparent rounded-2xl pb-8"
      >
        <div className="w-full flex justify-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:gap-12 px-4">

            <PromoCard
              label="Manual Entry"
              description="Manually process, map, and review individual promotion datasets."
              path="/in-progress"
              image="/images/promo_manual_bw.png"
              hoverImage="/images/promo_manual_color.png"
            />

            <FlipPromoCard
              label="Auto Generate Promotion"
              description="Automated system for generating and matching campaign datasets."
              image="/images/promo_auto_bw.png"
              hoverImage="/images/promo_auto_color.png"
            />

          </div>
        </div>

      </motion.div>
    </div>
  );
}

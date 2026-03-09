import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, MonitorPlay, ChevronRight, Settings2 } from 'lucide-react';

export default function PromoMainPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

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

  return (
    <div className="absolute inset-0 pt-[104px] pb-6 px-5 sm:px-6 max-w-[1200px] mx-auto flex flex-col">
      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden rounded-2xl mb-8 shrink-0 bg-gradient-to-r from-rose-700 via-rose-600 to-pink-600 shadow-md shadow-rose-200/50 px-6 py-8">
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="absolute -bottom-16 right-1/4 w-40 h-40 rounded-full bg-pink-400/20 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col items-center text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner backdrop-blur-sm">
              <Settings2 size={20} className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
            Promotions Hub
          </h1>
          <p className="text-rose-100 text-sm max-w-lg leading-relaxed">
            Choose how you want to configure and match your promotions.
          </p>
        </div>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate={mounted ? "visible" : "hidden"}
        className="flex-1 flex flex-col justify-center min-h-0 bg-transparent rounded-2xl pb-8"
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

            <PromoCard
              label="Auto-IC Match"
              description="Automated system for matching and generating Ice Cream campaigns."
              path="/promotions/auto-IC"
              image="/images/promo_auto_bw.png"
              hoverImage="/images/promo_auto_color.png"
            />

          </div>
        </div>
      </motion.div>
    </div>
  );
}

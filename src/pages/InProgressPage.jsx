import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Hammer, Sparkles, ArrowLeft } from 'lucide-react';

export default function InProgressPage() {
  const navigate = useNavigate();

  return (
    <div className="absolute inset-0 pt-[104px] pb-6 px-5 sm:px-6 bg-slate-50 flex items-center justify-center overflow-hidden">

      {/* Decorative background elements */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-amber-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-200/20 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-md w-full text-center relative z-10"
      >
        {/* Animated Icon Group */}
        <div className="relative w-32 h-32 mx-auto mb-8">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="absolute inset-0 bg-white rounded-3xl shadow-xl shadow-amber-500/10 border border-amber-100 flex items-center justify-center transform rotate-3"
          >
            <Hammer className="w-14 h-14 text-amber-500" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0.5, scale: 0.8 }}
            animate={{ opacity: [0.5, 1, 0.5], scale: [0.8, 1.1, 0.8] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="absolute -top-3 -right-3 bg-white p-2 rounded-xl shadow-lg border border-slate-100"
          >
            <Sparkles className="w-6 h-6 text-blue-500" />
          </motion.div>
        </div>

        {/* Text Content */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
            Coming Soon
          </h1>
          <p className="text-slate-500 text-sm sm:text-base leading-relaxed mb-8 max-w-[280px] sm:max-w-sm mx-auto">
            We are currently crafting something amazing for you. This feature will be available in an upcoming update!
          </p>
        </motion.div>

        {/* Action Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <button
            onClick={() => navigate(-1)}
            className="group inline-flex items-center justify-center gap-2.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-indigo-600 px-6 py-3.5 rounded-xl font-bold font-sm shadow-sm hover:shadow border border-slate-200 hover:border-indigo-100 transition-all w-full sm:w-auto min-w-[200px]"
          >
            <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 group-hover:-translate-x-1 transition-transform" />
            Go Back
          </button>
        </motion.div>

      </motion.div>
    </div>
  );
}

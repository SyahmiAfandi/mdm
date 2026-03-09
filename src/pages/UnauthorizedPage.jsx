import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldX, Home } from 'lucide-react';
import { motion } from 'framer-motion';

export default function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className="absolute inset-0 pt-[64px] pb-6 px-5 sm:px-6 bg-slate-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="max-w-md w-full text-center"
      >
        <div className="relative mb-8 inline-block">
          <div className="absolute inset-0 bg-red-100 blur-2xl rounded-full opacity-60"></div>
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 bg-white border border-red-100 shadow-xl shadow-red-500/10 rounded-3xl flex items-center justify-center mx-auto transform -rotate-6">
            <ShieldX className="w-12 h-12 sm:w-14 sm:h-14 text-red-500" />
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
          Access Denied
        </h1>
        <p className="text-slate-500 text-sm sm:text-base leading-relaxed mb-8 max-w-sm mx-auto">
          You don't have the necessary permissions to view this page. Please contact your administrator if you believe this is an error.
        </p>

        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/')}
          className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3.5 rounded-xl font-bold font-sm shadow-md transition-colors w-full sm:w-auto min-w-[200px]"
        >
          <Home className="w-4 h-4" />
          Return to Home
        </motion.button>
      </motion.div>
    </div>
  );
}

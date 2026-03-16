import React from 'react';
import { motion, MotionConfig, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Mail,
  CalendarDays,
  Columns,
  Sparkles,
  ArrowRight,
  DatabaseZap
} from 'lucide-react';

const utilities = [
  {
    title: 'MDM Email Tracker',
    description: 'Track, assign, and manage incoming MDM emails to ensure clear ownership and timely resolution.',
    path: '/utilities/emailtracker',
    icon: Mail,
    color: 'from-blue-500 to-indigo-600'
  },
  {
    title: 'Manual Recons Entry',
    description: 'Manually input reconciliation data for edge cases not covered by automated matching.',
    path: '/utilities/manualrecons',
    icon: Wrench,
    color: 'from-amber-400 to-orange-500'
  },
  {
    title: 'Date Converter',
    description: 'Convert date formats (e.g. MM/DD/YYYY → DD/MM/YYYY) quickly for standard reporting.',
    path: '/utilities/date-converter',
    icon: CalendarDays,
    color: 'from-sky-400 to-blue-500'
  },
  {
    title: 'Data Cleaner',
    description: 'Remove empty rows, standardize column formats, and trim whitespaces from messy raw data.',
    path: '/in-progress',
    icon: Sparkles,
    color: 'from-fuchsia-500 to-pink-600'
  },
  {
    title: 'Column Mapper',
    description: 'Map diverse columns from uploaded files to the required strict template structure.',
    path: '/in-progress',
    icon: Columns,
    color: 'from-violet-500 to-purple-600'
  },
];

/** ANIMATION VARIANTS */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.15, duration: 0.3 }
  },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
};

export default function UtilitiesPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  return (
    <MotionConfig reducedMotion={reduceMotion ? 'user' : 'never'}>
      {/* PERFECT FIT CONTAINER */}
      <div className="w-full min-w-0 px-3 sm:px-5 pb-3 flex flex-col">

        {/* ── Hero Banner ── */}
        <div className="relative overflow-hidden rounded-2xl mb-4 shrink-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 shadow-md shadow-emerald-200/50 px-5 py-3.5">
          {/* Decorative shapes */}
          <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="absolute -bottom-12 right-1/4 w-32 h-32 rounded-full bg-cyan-400/20 blur-2xl pointer-events-none" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shadow-inner">
                <Wrench size={18} className="text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Utilities Hub
              </h1>
            </div>
            <p className="text-emerald-50 text-xs sm:text-sm max-w-xl leading-relaxed">
              A collection of helper tools designed to clean data, map columns, track emails, and simplify manual entry tasks for the MDM team.
            </p>
          </div>
        </div>

        {/* ── Content Area ── */}
        <div className="flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 pb-2">

          <div className="flex items-center gap-3 mb-4 shrink-0">
            <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-teal-400 to-emerald-600" />
            <div>
              <h2 className="text-base font-bold text-gray-800 tracking-tight">
                Available Tools
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">Select a utility to launch it in your browser.</p>
            </div>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="pr-3 pb-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {utilities.map((tool, index) => {
                const Icon = tool.icon;
                return (
                  <motion.div
                    key={index}
                    variants={cardVariants}
                    whileHover={{ y: -3, boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}
                    onClick={() => navigate(tool.path)}
                    className={`group relative border border-gray-100 rounded-2xl shadow-sm bg-white overflow-hidden ${tool.path !== '#' ? 'cursor-pointer hover:border-teal-200' : 'cursor-not-allowed opacity-80'} transition-all duration-300 flex flex-col h-[160px]`}
                  >
                    <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${tool.color}`} />

                    <div className="p-4 flex flex-col h-full">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center shadow-sm text-white`}>
                          <Icon size={22} className="opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
                        </div>
                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-teal-50 transition-colors">
                          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 transition-colors -translate-x-0.5 group-hover:translate-x-0" />
                        </div>
                      </div>

                      <div className="mt-auto">
                        <h3 className="text-sm font-bold text-gray-900 leading-snug mb-1.5 group-hover:text-teal-700 transition-colors">{tool.title}</h3>
                        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                          {tool.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

        </div>
      </div>
    </MotionConfig>
  );
}
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sliders, Gift, Plus, ArrowRight, AppWindow } from 'lucide-react';
import { motion, MotionConfig, useReducedMotion } from 'framer-motion';

/** ANIMATION VARIANTS */
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

export default function ToolsSelectionPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const tools = [
    {
      title: 'Reconciliation Tools',
      description: 'Access and manage reconciliation reports, schedule imports, and analyze data matching.',
      icon: Sliders,
      path: '/recons',
      color: 'from-blue-500 to-indigo-600'
    },
    {
      title: 'Promotion Tools',
      description: 'Manage promotion datasets, configure auto-IC rules, and execute campaign matching.',
      icon: Gift,
      path: '/promotions',
      color: 'from-rose-400 to-pink-500'
    },
    {
      title: 'Add New Tool',
      description: 'Create and integrate a new tool module tailored to specific business requirements.',
      icon: Plus,
      path: '#',
      color: 'from-slate-400 to-slate-500'
    },
  ];

  return (
    <MotionConfig reducedMotion={reduceMotion ? 'user' : 'never'}>
      {/* PERFECT FIT CONTAINER */}
      <div className="absolute inset-0 pt-[104px] pb-6 px-5 sm:px-6 max-w-[1400px] mx-auto flex flex-col">

        {/* ── Hero Banner ── */}
        <div className="relative overflow-hidden rounded-2xl mb-6 shrink-0 bg-gradient-to-r from-blue-800 via-indigo-900 to-slate-900 shadow-md shadow-indigo-200/50 px-6 py-8">
          {/* Decorative shapes */}
          <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/5 blur-xl pointer-events-none" />
          <div className="absolute -bottom-16 right-1/4 w-40 h-40 rounded-full bg-indigo-500/20 blur-2xl pointer-events-none" />

          <div className="relative flex flex-col items-center text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner backdrop-blur-sm">
                <AppWindow size={20} className="text-white" />
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
              Select a Workspace
            </h1>
            <p className="text-indigo-100 text-sm max-w-lg leading-relaxed">
              Choose a module below to access its specialized tools, dashboards, and settings.
            </p>
          </div>
        </div>

        {/* ── Content Area ── */}
        <div className="flex-1 flex flex-col justify-center min-h-0 bg-transparent rounded-2xl pb-2">

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="w-full max-w-5xl mx-auto overflow-y-auto custom-scrollbar px-2 py-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tools.map((tool, index) => {
                const Icon = tool.icon;
                return (
                  <motion.div
                    key={index}
                    variants={cardVariants}
                    whileHover={{ y: -4, boxShadow: '0 12px 30px rgba(0,0,0,0.08)' }}
                    onClick={() => tool.path !== '#' && navigate(tool.path)}
                    className={`group relative border border-gray-100 rounded-3xl shadow-sm bg-white overflow-hidden ${tool.path !== '#' ? 'cursor-pointer hover:border-indigo-200' : 'cursor-not-allowed opacity-80'} transition-all duration-300 flex flex-col h-[220px]`}
                  >
                    <div className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${tool.color}`} />

                    <div className="p-6 flex flex-col h-full bg-gradient-to-b from-white to-slate-50/50">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className={`shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br ${tool.color} flex items-center justify-center shadow-md text-white`}>
                          <Icon size={26} className="opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-transform duration-300" />
                        </div>
                        <div className={`w-8 h-8 rounded-full ${tool.path !== '#' ? 'bg-indigo-50 group-hover:bg-indigo-100' : 'bg-slate-50'} flex items-center justify-center transition-colors`}>
                          <ArrowRight className={`w-4 h-4 ${tool.path !== '#' ? 'text-indigo-400 group-hover:text-indigo-600 -translate-x-0.5 group-hover:translate-x-0' : 'text-slate-300'} transition-all`} />
                        </div>
                      </div>

                      <div className="mt-auto">
                        <h3 className="text-lg font-bold text-gray-900 leading-tight mb-2 group-hover:text-indigo-800 transition-colors">{tool.title}</h3>
                        <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
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

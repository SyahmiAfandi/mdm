import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import {
  Sun, Shield, ShieldCheck, Key, Database, LogOut, Settings,
  Users, UserPlus, Fingerprint, Clock, UploadCloud, DownloadCloud, Settings2
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { motion, MotionConfig, useReducedMotion } from 'framer-motion';

function SettingsPage() {
  const { user, role } = useUser();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } }
  };

  const buttonVariants = {
    hover: { y: -2, transition: { duration: 0.2 } },
    tap: { scale: 0.98 }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <MotionConfig reducedMotion={reduceMotion ? 'user' : 'never'}>
      <Toaster position="top-right" />

      {/* PERFECT FIT CONTAINER */}
      <div className="absolute inset-0 pt-[104px] pb-6 px-5 sm:px-6 max-w-[1200px] mx-auto flex flex-col">

        {/* ── Hero Banner ── */}
        <div className="relative overflow-hidden rounded-2xl mb-6 shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 shadow-md shadow-slate-200/50 px-6 py-5">
          <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-indigo-500/10 blur-xl pointer-events-none" />
          <div className="absolute -bottom-12 right-1/4 w-32 h-32 rounded-full bg-blue-400/10 blur-2xl pointer-events-none" />

          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shadow-inner backdrop-blur-sm shrink-0">
              <Settings2 size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Account Settings</h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-0.5">Manage your profile, preferences, and security configurations.</p>
            </div>
          </div>
        </div>

        {/* ── Content Area ── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6"
        >

          {/* LEFT COLUMN (Profile & Security) */}
          <div className="lg:col-span-5 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2 pb-2">

            {/* Profile Card */}
            <motion.section variants={cardVariants} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12">
                <ShieldCheck size={100} />
              </div>

              <div className="flex items-center gap-3 mb-5 relative z-10 w-full border-b border-slate-50 pb-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Shield size={18} />
                </div>
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">User Profile</h2>
              </div>

              <div className="flex items-center gap-5 mb-5 relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-md shadow-indigo-200 shrink-0 border-2 border-white ring-2 ring-indigo-50">
                  {getInitials(user?.name)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 leading-tight truncate">{user?.name || 'User Name'}</h3>
                  <div className="mt-1 inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                    {role || 'USER'}
                  </div>
                </div>
              </div>

              <div className="relative z-10 bg-slate-50 rounded-xl p-3 border border-slate-100">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
                <div className="text-slate-700 text-xs font-semibold truncate">
                  {user?.email || 'email@example.com'}
                </div>
              </div>
            </motion.section>

            {/* Security Card */}
            <motion.section variants={cardVariants} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 relative">
              <div className="flex items-center gap-3 mb-4 border-b border-slate-50 pb-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Key size={18} />
                </div>
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Security</h2>
              </div>

              <div className="flex flex-col gap-2.5">
                <motion.button variants={buttonVariants} whileHover="hover" whileTap="tap" className="group flex items-center justify-between bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 px-4 py-3 rounded-xl transition-all shadow-sm hover:shadow">
                  <span className="font-semibold text-xs">Change Password</span>
                  <Key size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                </motion.button>
                <motion.button variants={buttonVariants} whileHover="hover" whileTap="tap" className="group flex items-center justify-between bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 px-4 py-3 rounded-xl transition-all shadow-sm hover:shadow">
                  <span className="font-semibold text-xs text-left leading-tight">Two-Factor Authentication</span>
                  <span className="text-[9px] bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Coming Soon</span>
                </motion.button>
              </div>
            </motion.section>
          </div>


          {/* RIGHT COLUMN (Preferences & Data & Admin) */}
          <div className="lg:col-span-7 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2 pb-2">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Preferences Card */}
              <motion.section variants={cardVariants} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-4 border-b border-slate-50 pb-3">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                    <Settings size={18} />
                  </div>
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Preferences</h2>
                </div>

                <div className="space-y-3 opacity-50 select-none relative rounded-xl bg-slate-50 p-4 border border-dashed border-slate-200 h-28 flex flex-col justify-center">
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <span className="bg-slate-800 text-amber-300 text-[10px] font-bold px-3 py-1 rounded-full shadow-lg border border-slate-700 uppercase tracking-widest">Dev Preview Only</span>
                  </div>
                  <div className="blur-[2px] space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Sun size={14} />
                        <span className="text-xs font-semibold">Dark Base Theme</span>
                      </div>
                      <div className="w-9 h-5 bg-slate-200 rounded-full border border-slate-300"></div>
                    </div>
                    <div className="w-full bg-slate-200 h-8 rounded-lg border border-slate-300"></div>
                  </div>
                </div>
              </motion.section>

              {/* Data Management Card */}
              <motion.section variants={cardVariants} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 relative">
                <div className="flex items-center gap-3 mb-4 border-b border-slate-50 pb-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Database size={18} />
                  </div>
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Account Data</h2>
                </div>

                <div className="flex flex-col gap-2.5">
                  <motion.button variants={buttonVariants} whileHover="hover" whileTap="tap" className="group w-full flex items-center justify-between bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 text-slate-700 hover:text-blue-700 px-4 py-3 rounded-xl transition-all shadow-sm hover:shadow">
                    <span className="font-semibold text-xs text-left leading-tight">Export JSON Archive</span>
                    <DownloadCloud size={16} className="text-slate-400 group-hover:text-blue-500" />
                  </motion.button>
                  <motion.button variants={buttonVariants} whileHover="hover" whileTap="tap" className="group w-full flex items-center justify-between bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-700 hover:text-red-700 px-4 py-3 rounded-xl transition-all shadow-sm hover:shadow">
                    <span className="font-semibold text-xs">Reset Preferences</span>
                    <LogOut size={14} className="text-slate-400 group-hover:text-red-500" />
                  </motion.button>
                </div>
              </motion.section>
            </div>

            {/* Admin Panel (Conditional) */}
            {role === 'admin' && (
              <motion.section variants={cardVariants} className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <ShieldCheck size={140} className="text-indigo-400" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent pointer-events-none" />

                <div className="flex items-center gap-3 mb-5 relative z-10 border-b border-slate-800 pb-3">
                  <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/30">
                    <Fingerprint size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-widest">Admin Control Center</h2>
                    <p className="text-indigo-400/80 text-[10px] uppercase font-bold tracking-widest mt-0.5">Authorised Personnel Only</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
                  <motion.button
                    variants={buttonVariants}
                    whileHover="hover"
                    whileTap="tap"
                    onClick={() => navigate('/settings/admin/register-pic')}
                    className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-xl transition-all shadow-lg shadow-indigo-500/20 border border-indigo-400/30"
                  >
                    <UserPlus size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-center line-clamp-1 w-full">New Account</span>
                  </motion.button>

                  {[
                    { label: 'Directory', icon: Users, path: '/settings/admin/users', color: 'text-indigo-300', bg: 'hover:bg-indigo-500/10 hover:border-indigo-500/30' },
                    { label: 'Permissions', icon: Fingerprint, path: '/settings/admin/permission', color: 'text-emerald-400', bg: 'hover:bg-emerald-500/10 hover:border-emerald-500/30' },
                    { label: 'Licenses', icon: Clock, path: '/settings/admin/licenses', color: 'text-amber-400', bg: 'hover:bg-amber-500/10 hover:border-amber-500/30' },
                  ].map((item, idx) => (
                    <motion.button
                      key={idx}
                      variants={buttonVariants}
                      whileHover="hover"
                      whileTap="tap"
                      onClick={() => item.path && navigate(item.path)}
                      className={`flex flex-col items-center justify-center gap-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 p-4 rounded-xl transition-all ${item.bg}`}
                    >
                      <item.icon size={20} className={item.color} />
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider truncate w-full text-center">{item.label}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.section>
            )}

          </div>

        </motion.div>
      </div>
    </MotionConfig>
  );
}

export default SettingsPage;

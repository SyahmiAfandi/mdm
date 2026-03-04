import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import {
  Sun, Shield, ShieldCheck, Key, Database, LogOut, Settings,
  Users, UserPlus, Fingerprint, Clock, UploadCloud, DownloadCloud, Type
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { motion } from 'framer-motion';

function SettingsPage() {
  const { user, role } = useUser();
  const navigate = useNavigate();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1, y: 0,
      transition: { duration: 0.4, ease: 'easeOut' }
    }
  };

  const buttonVariants = {
    hover: { scale: 1.02, transition: { duration: 0.2 } },
    tap: { scale: 0.98 }
  };

  // Generate Initials
  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <>
      <Toaster position="top-right" />
      <div className="max-w-6xl mx-auto p-4 md:p-6 h-full flex flex-col overflow-hidden">

        {/* Page Header - Compact */}
        <div className="mb-4">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Account Settings</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Manage profile, preferences, and security.</p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1"
        >

          {/* LEFT COLUMN (Profile & Security) */}
          <div className="lg:col-span-5 space-y-4">

            {/* 1. Profile Card - Tightened */}
            <motion.section variants={cardVariants} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                <ShieldCheck size={80} />
              </div>

              <div className="flex items-center gap-2 mb-4 relative z-10">
                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <Shield size={18} />
                </div>
                <h2 className="text-md font-bold text-slate-800 dark:text-white">User Profile</h2>
              </div>

              <div className="flex items-center gap-4 mb-4 relative z-10">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-lg font-bold shadow-lg">
                  {getInitials(user?.name)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{user?.name || 'User Name'}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">{role || 'USER'}</p>
                </div>
              </div>

              <div className="relative z-10">
                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
                <div className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl px-3 py-2 text-xs font-medium truncate">
                  {user?.email || 'email@example.com'}
                </div>
              </div>
            </motion.section>

            {/* 2. Security Card - Tightened */}
            <motion.section variants={cardVariants} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 relative">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <Key size={18} />
                </div>
                <h2 className="text-md font-bold text-slate-800 dark:text-white">Security</h2>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <motion.button variants={buttonVariants} whileHover="hover" whileTap="tap" className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2.5 rounded-xl transition-colors">
                  <span className="font-semibold text-xs">Change Password</span>
                  <Key size={14} className="text-slate-400" />
                </motion.button>
                <motion.button variants={buttonVariants} whileHover="hover" whileTap="tap" className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2.5 rounded-xl transition-colors">
                  <span className="font-semibold text-xs text-left leading-tight">Two-Factor Auth</span>
                  <span className="text-[9px] bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400 px-2 py-0.5 rounded-full font-bold uppercase">Soon</span>
                </motion.button>
              </div>
            </motion.section>

          </div>


          {/* RIGHT COLUMN (Preferences & Data & Admin) */}
          <div className="lg:col-span-7 space-y-4">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 3. Preferences Card */}
              <motion.section variants={cardVariants} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
                    <Settings size={18} />
                  </div>
                  <h2 className="text-md font-bold text-slate-800 dark:text-white">Preferences</h2>
                </div>

                <div className="space-y-3 opacity-60 pointer-events-none relative rounded-xl bg-slate-50/50 dark:bg-slate-800/30 p-3 border border-dashed border-slate-200 dark:border-slate-700 h-24 flex flex-col justify-center">
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <span className="bg-slate-800 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg scale-90">Developer Preview</span>
                  </div>
                  <div className="blur-[1px] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <Sun size={14} />
                        <span className="text-xs font-medium">Dark Mode Appearance</span>
                      </div>
                      <div className="w-8 h-4 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-6 rounded-lg"></div>
                  </div>
                </div>
              </motion.section>

              {/* 4. Data Management Card */}
              <motion.section variants={cardVariants} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 relative">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Database size={18} />
                  </div>
                  <h2 className="text-md font-bold text-slate-800 dark:text-white">Account Data</h2>
                </div>

                <div className="space-y-2">
                  <motion.button variants={buttonVariants} whileHover="hover" whileTap="tap" className="w-full flex items-center justify-between bg-blue-50/50 dark:bg-blue-500/10 hover:bg-blue-100/50 border border-blue-100 dark:border-blue-500/30 text-blue-700 dark:text-blue-400 px-3 py-2.5 rounded-xl transition-colors">
                    <span className="font-semibold text-xs text-left leading-tight">Export JSON Archive</span>
                    <DownloadCloud size={16} />
                  </motion.button>
                  <motion.button variants={buttonVariants} whileHover="hover" whileTap="tap" className="w-full flex items-center justify-between bg-red-50/50 dark:bg-red-500/10 hover:bg-red-100/50 border border-red-100 dark:border-red-500/30 text-red-700 dark:text-red-400 px-3 py-2.5 rounded-xl transition-colors">
                    <span className="font-semibold text-xs">Reset All Preferences</span>
                    <LogOut size={14} />
                  </motion.button>
                </div>
              </motion.section>
            </div>

            {/* 5. Admin Panel (Conditional) - Horizontalized */}
            {role === 'admin' && (
              <motion.section variants={cardVariants} className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-black rounded-2xl shadow-xl border border-slate-700/50 p-4 relative overflow-hidden">
                <div className="absolute -top-6 -right-6 opacity-10 pointer-events-none">
                  <ShieldCheck size={120} className="text-indigo-400" />
                </div>

                <div className="flex items-center gap-2.5 mb-4 relative z-10">
                  <div className="p-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg border border-indigo-500/30">
                    <Fingerprint size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-wide">Admin Control</h2>
                    <p className="text-indigo-300/80 text-[10px] uppercase font-bold tracking-widest">Authorized Access Only</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 relative z-10">
                  <motion.button variants={buttonVariants} whileHover="hover" whileTap="tap" onClick={() => navigate('/settings/admin/register-pic')} className="col-span-2 md:col-span-1 flex flex-col items-center justify-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-3 rounded-xl transition-all shadow-md">
                    <UserPlus size={18} />
                    <span className="text-[10px] font-bold uppercase leading-tight text-center">New Account</span>
                  </motion.button>

                  {[
                    { label: 'Directory', icon: Users, path: '/settings/admin/users', color: 'text-indigo-400' },
                    { label: 'Permissions', icon: Fingerprint, path: '/settings/admin/permission', color: 'text-emerald-400' },
                    { label: 'Licenses', icon: Clock, path: '/settings/admin/licenses', color: 'text-amber-400' },
                    { label: 'Quotas', icon: UploadCloud, path: null, color: 'text-cyan-400' }
                  ].map((item, idx) => (
                    <motion.button
                      key={idx}
                      variants={buttonVariants}
                      whileHover="hover"
                      whileTap="tap"
                      onClick={() => item.path && navigate(item.path)}
                      className="flex flex-col items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 p-2.5 rounded-xl transition-colors"
                    >
                      <item.icon size={16} className={item.color} />
                      <span className="text-[9px] font-bold text-slate-300 uppercase truncate w-full text-center">{item.label}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.section>
            )}

          </div>

        </motion.div>
      </div>
    </>
  );
}

export default SettingsPage;

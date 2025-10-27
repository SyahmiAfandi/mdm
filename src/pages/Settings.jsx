import React from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useUser } from '../context/UserContext';
import { Sun, Shield } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { APP_FULL_NAME } from '../config';

function SettingsPage() {
  const { user, role } = useUser();
  const navigate = useNavigate();

  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i = 0) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.2,
        duration: 0.4,
        ease: 'easeOut'
      }
    })
  };

  const buttonVariants = {
    hover: { scale: 1.05 },
    tap: { scale: 0.95 }
  };

  return (
    <DashboardLayout pageTitle={APP_FULL_NAME} breadcrumbs={["Settings"]}>
      <Toaster position="top-right" />
      <div className="max-w-4xl mx-auto p-6 space-y-10">
        {[...Array(5)].map((_, i) => (
          <motion.section
            key={i}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={sectionVariants}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          >
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              {i === 0 && <><Shield size={20} /> User Profile</>}
              {i === 1 && <><Sun size={20} /> Preferences (Disabled)</>}
              {i === 2 && <>Security</>}
              {i === 3 && <>Data Management</>}
              {i === 4 && role === 'admin' && <>Admin Controls</>}
            </h2>

            {i === 0 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Name</label>
                  <input
                    type="text"
                    value={user?.name || ''}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md p-2"
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Email</label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md p-2"
                    disabled
                  />
                </div>
              </div>
            )}

            {i === 1 && (
              <div className="space-y-4 opacity-50 pointer-events-none">
                <div className="flex items-center justify-between">
                  <label className="text-gray-700 dark:text-gray-200">Dark Mode</label>
                  <input type="checkbox" className="toggle toggle-sm" disabled />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Language</label>
                  <select className="mt-1 block w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md p-2" disabled>
                    <option>English</option>
                    <option>Bahasa Melayu</option>
                  </select>
                </div>
              </div>
            )}

            {i === 2 && (
              <div className="space-y-4">
                <motion.button variants={buttonVariants} whileHover="hover" whileTap="tap" className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white px-4 py-2 rounded">
                  Change Password
                </motion.button>
                <motion.button variants={buttonVariants} whileHover="hover" whileTap="tap" className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-white px-4 py-2 rounded">
                  Enable 2FA (Coming Soon)
                </motion.button>
              </div>
            )}

            {i === 3 && (
              <div className="space-y-4">
                <motion.button variants={buttonVariants} whileHover="hover" whileTap="tap" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  Export My Data
                </motion.button>
                <motion.button variants={buttonVariants} whileHover="hover" whileTap="tap" className="bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 px-4 py-2 rounded hover:bg-red-200 dark:hover:bg-red-800">
                  Reset My Settings
                </motion.button>
              </div>
            )}

            {i === 4 && role === 'admin' && (
              <div className="space-y-4">
                <motion.button
                  variants={buttonVariants}
                  whileHover="hover"
                  whileTap="tap"
                  onClick={() => navigate('/settings/admin/users')}
                  className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2 rounded text-gray-800 dark:text-white"
                >
                  Manage Users
                </motion.button>
                <motion.button
                  variants={buttonVariants}
                  whileHover="hover"
                  whileTap="tap"
                  onClick={() => navigate('/settings/admin/permission')}
                  className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2 rounded text-gray-800 dark:text-white"
                >
                  Configure Roles & Permissions
                </motion.button>
                <motion.button
                  variants={buttonVariants}
                  whileHover="hover"
                  whileTap="tap"
                  onClick={() => navigate('/settings/admin/licenses')}
                  className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2 rounded text-gray-800 dark:text-white"
                >
                  Check License Expiry
                </motion.button>
                <motion.button
                  variants={buttonVariants}
                  whileHover="hover"
                  whileTap="tap"
                  className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-4 py-2 rounded text-gray-800 dark:text-white"
                >
                  Adjust File Upload Quota
                </motion.button>
              </div>
            )}
          </motion.section>
        ))}
      </div>
    </DashboardLayout>
  );
}

export default SettingsPage;

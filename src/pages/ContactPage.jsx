import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { motion } from 'framer-motion';
import { Mail, Headset } from 'lucide-react';
import { APP_FULL_NAME } from '../config';

function ContactPage() {
  return (
    <DashboardLayout pageTitle={APP_FULL_NAME} breadcrumbs={["Contact"]}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="p-8"
      >
        <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden md:flex">
          {/* Left Side */}
          <div className="md:w-1/2 p-8 flex flex-col justify-center items-end border-r border-gray-200 bg-gradient-to-br from-blue-100 to-blue-200">
            <div className="text-right">
              <h2 className="text-2xl font-bold text-blue-900 flex items-center justify-end gap-2">
                <Headset className="w-6 h-6" /> Contact Us
              </h2>
              <p className="text-gray-700 mt-2 text-sm">Need help? We're here for you.</p>
            </div>
          </div>

          {/* Right Side */}
          <div className="md:w-1/2 p-8 flex flex-col justify-center items-start bg-white">
            <div>
              <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
                <Mail className="w-6 h-6" /> Support
              </h2>
              <p className="text-gray-700 mt-2 text-sm">
                Email us: <a href="mailto:syahmi.afandi@unilever.com" className="text-blue-600 hover:underline">syahmi.afandi@unilever.com</a>
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}

export default ContactPage;
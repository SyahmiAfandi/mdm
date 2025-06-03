import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const reports = [
  {
    title: 'Reconciliation Report',
    description: 'Summary of mismatches between OSDP and PBI files with download option.',
    path: '/reports/summary_recons'
  },
  {
    title: 'Promotion Report',
    description: 'Generate promotion templates from predefined data.',
    path: '/reports/promotion'
  },
  {
    title: 'Error Log',
    description: 'Track upload issues and format inconsistencies.',
    path: '/reports/error-log'
  },
];

function ReportsPage() {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="p-6"
      >
        <h1 className="text-2xl font-bold mb-4">Reports</h1>
        <div className="grid md:grid-cols-2 gap-4">
          {reports.map((report, index) => (
            <motion.div
              key={index}
              whileHover={{ scale: 1.02 }}
              className="border p-4 rounded-xl shadow bg-white"
            >
              <h2 className="text-lg font-semibold">{report.title}</h2>
              <p className="text-sm text-gray-600">{report.description}</p>
              <button
                className="mt-3 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                onClick={() => navigate(report.path)}
              >
                View Report
              </button>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </DashboardLayout>
  );
}

export default ReportsPage;

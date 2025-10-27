import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { APP_FULL_NAME } from '../config';

const utilities = [
  {
    title: 'Date Converter',
    description: 'Convert date format (e.g. MM/DD/YYYY → DD/MM/YYYY)',
  },
  {
    title: 'Data Cleaner',
    description: 'Remove empty rows, standardize column format and trim whitespaces.',
  },
  {
    title: 'Column Mapper',
    description: 'Map columns from uploaded files to required template structure.',
  },
  {
    title: 'Google Sheets Sync',
    description: 'Push updated data to connected Google Sheets documents.',
  },
];


function UtilitiesPage() {

  const navigate = useNavigate();

  return (
    <DashboardLayout pageTitle={APP_FULL_NAME} breadcrumbs={["Utilities"]}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="p-6"
      >
        <h1 className="text-2xl font-bold mb-4">Utilities</h1>
        <div className="grid md:grid-cols-2 gap-4">
          {utilities.map((tool, index) => (
            <motion.div
              key={index}
              whileHover={{ scale: 1.02 }}
              className="border p-4 rounded-xl shadow bg-white"
            >
              <h2 className="text-lg font-semibold">{tool.title}</h2>
              <p className="text-sm text-gray-600">{tool.description}</p>
              <button
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={() => {
                  if (tool.title === 'Date Converter') navigate('/utilities/date-converter');
                  else if (tool.title === 'Data Cleaner') navigate('/utilities/data-cleaner');
                  else if (tool.title === 'Column Mapper') navigate('/utilities/column-mapper');
                  else if (tool.title === 'Google Sheets Sync') navigate('/utilities/sheets-sync');
                }}
              >
                Launch Tool
              </button>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </DashboardLayout>
  );
}

export default UtilitiesPage;
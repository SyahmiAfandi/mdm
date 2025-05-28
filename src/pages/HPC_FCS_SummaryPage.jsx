import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';

function ReconciliationSummary() {
  const navigate = useNavigate();
  const [osdpData, setOsdpData] = useState([]);
  const [pbiData, setPbiData] = useState([]);
  const [source, setSource] = useState('OSDP');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const location = useLocation();
  const fromButton = location.state?.fromButton || sessionStorage.getItem('fromButton') || 'N/A';
  const businessType = location.state?.businessType || sessionStorage.getItem('businessType') || 'N/A';
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowConfirmModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const osdp = JSON.parse(sessionStorage.getItem('sortedData')) || [];
    const pbi = JSON.parse(sessionStorage.getItem('sortedDataPBI')) || [];

    fetch(`${BACKEND_URL}/reconcile_all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ osdp_data: osdp, pbi_data: pbi })
    })
      .then(res => res.json())
      .then(res => {
        if (res.summary_osdp) setOsdpData(res.summary_osdp);
        if (res.summary_pbi) setPbiData(res.summary_pbi);
        sessionStorage.setItem('reconcile_all_result', JSON.stringify(res));
      })
      .catch(err => {
        console.error('Error fetching summary:', err);
        alert('Failed to load reconciliation summary.');
      });
  }, []);

  const displayedData = source === 'OSDP' ? osdpData : pbiData;
  const totalMatch = displayedData.filter(row => row.Status === 'Match').length;
  const totalMismatch = displayedData.filter(row => row.Status === 'Mismatch').length;
  const noMismatchInBoth = osdpData.every(row => row.Status === 'Match') && pbiData.every(row => row.Status === 'Match');

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowConfirmModal(true)}
          className="px-4 py-2 bg-gray-700 text-white text-sm rounded hover:bg-gray-800 transition"
        >
          Back to Main
        </motion.button>

        <motion.div className="border border-gray-300 bg-gray-50 rounded-md px-4 py-2 flex gap-6 items-center text-sm mt-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-600">Business Type:</span>
            <span className="inline-block px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 font-semibold">
              {businessType}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-600">Report Type:</span>
            <span className="inline-block px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 font-semibold">
              {fromButton}
            </span>
          </div>
        </motion.div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/recons/hpc_fcs/result')}
          disabled={noMismatchInBoth}
          className={`px-4 py-2 text-white text-sm rounded ${noMismatchInBoth ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}
        >
          Go to Result
        </motion.button>
      </div>

      <div className="max-w-7xl mx-auto p-6 relative">
        <h2 className="text-2xl font-bold text-center mb-6">Reconciliation Summary</h2>

        <div className="flex justify-center gap-6 mb-6">
          <div className="bg-green-100 text-green-800 w-48 h-24 px-6 py-4 rounded shadow flex flex-col justify-center">
            <p className="text-sm font-semibold text-center">Total Match</p>
            <p className="text-xl font-bold text-center">{totalMatch}</p>
          </div>
          <div className="bg-red-100 text-red-800 w-48 h-24 px-6 py-4 rounded shadow flex flex-col justify-center">
            <p className="text-sm font-semibold text-center">Total Mismatch</p>
            <p className="text-xl font-bold text-center">{totalMismatch}</p>
          </div>
        </div>

        <div className="flex justify-center mb-6">
          <div className="relative bg-gray-100 rounded-full flex p-1 gap-1 w-fit shadow-inner">
            {['OSDP', 'PBI'].map(tab => (
              <button
                key={tab}
                onClick={() => setSource(tab)}
                className={`relative z-10 w-24 h-8 text-sm font-semibold rounded-full transition-colors duration-200 ${source === tab ? 'text-white' : 'text-gray-700'}`}
              >
                {source === tab && (
                  <motion.div
                    layoutId="pill-indicator"
                    className="absolute inset-0 bg-blue-600 rounded-full z-0"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-auto border-collapse text-sm border border-gray-400">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-4 py-2 text-left">Distributor</th>
                <th className="border px-4 py-2 text-left">Distributor Name</th>
                <th className="border px-4 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayedData.map((row, index) => (
                <tr
                  key={index}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() =>
                    navigate('/result', {
                      state: {
                        distributor: row.Distributor,
                        distributorName: row['Distributor Name'],
                        source,
                      },
                    })
                  }
                >
                  <td className="border px-4 py-2">{row.Distributor}</td>
                  <td className="border px-4 py-2">{row['Distributor Name']}</td>
                  <td className={`border px-4 py-2 text-center font-semibold ${row.Status === 'Match' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{row.Status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showConfirmModal && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-md flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowConfirmModal(false)}
          >
            <motion.div
              className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md mx-4 text-center relative"
              initial={{ y: 30, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 30, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-gray-800">Leave this page?</h3>
              <p className="text-sm text-gray-600 mt-2 px-2">
                Are you sure you want to go back to the Reconciliation Main page? Any unsaved progress will be lost.
              </p>
              <div className="flex justify-center gap-4 mt-6">
                <button
                  onClick={() => navigate('/recons')}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  ✅ Yes, leave
                </button>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
                >
                  ❌ Stay here
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

export default ReconciliationSummary;

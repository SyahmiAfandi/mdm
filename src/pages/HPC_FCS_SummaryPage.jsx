import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { saveAs } from 'file-saver';
import { DownloadIcon } from 'lucide-react'; // or another icon of your choice
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react'; // spinner icon
import { ChevronDownIcon } from 'lucide-react';

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
  const [exporting, setExporting] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportYear, setExportYear] = useState('2025');
  const [exportMonth, setExportMonth] = useState('January');
  const creator = localStorage.getItem('username') || 'Auto Generated';

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

  const handleExportExcel = async () => {
    setExporting(true);
    const dataToExport = source === 'OSDP' ? osdpData : pbiData;

    const toastId = toast.loading('Exporting report...');

    try {
      const response = await fetch(`${BACKEND_URL}/export_summary_excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: dataToExport,
          report_type: source
        })
      });

      if (!response.ok) throw new Error('Failed to export');

      const blob = await response.blob();
      saveAs(blob, `Reconciliation_Summary_${source}.xlsx`);

      toast.success('Report exported successfully!', { id: toastId });
    } catch (error) {
      toast.error('Failed to export report.', { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  const handleExportToDatabase = async () => {
    const dataToExport = source === 'OSDP' ? osdpData : pbiData;
    const toastId = toast.loading('Exporting to database...');

    try {
      const response = await fetch(`${BACKEND_URL}/export_to_sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: exportYear,
          month: exportMonth,
          businessType,
          reportType: fromButton,
          records: dataToExport,
          source,
          pic: creator,
        })
      });

      if (!response.ok) throw new Error('Failed to export to Google Sheets');

      toast.success('Successfully exported to Report Database!', { id: toastId });
    } catch (err) {
      toast.error('Failed to export to Report Database.', { id: toastId });
    } finally {
      setShowExportModal(false);
    }
  };


  return (
    <DashboardLayout>
      <div className="grid grid-cols-3 items-center mb-6">
        {/* Left buttons */}
        <div className="flex gap-2 justify-start relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowConfirmModal(true)}
            className="px-4 py-2 bg-gray-700 text-white text-sm rounded hover:bg-gray-800 transition"
          >
            Back to Main
          </motion.button>
        <motion.div
          className="relative"
          onMouseLeave={() => setShowExportOptions(false)} // 👈 keeps dropdown open while inside
        >
          <button
            onClick={() => setShowExportOptions((prev) => !prev)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
          >
            <DownloadIcon size={16} /> Export <ChevronDownIcon size={14} />
          </button>

          {showExportOptions && (
            <div className="absolute z-20 mt-1 w-48 bg-white rounded shadow border">
              <button
                onClick={() => {
                  setShowExportOptions(false);
                  handleExportExcel();
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
              >
                To Excel File
              </button>
              <button
                onClick={() => {
                  setShowExportOptions(false);
                  setShowExportModal(true);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
              >
                To Report Database
              </button>
            </div>
          )}
        </motion.div>

      </div>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowExportModal(false)}
          >
            <motion.div
              className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md mx-4"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-4">Export to Report Database</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <select
                  value={exportYear}
                  onChange={(e) => setExportYear(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  {['2024', '2025', '2026'].map((yr) => (
                    <option key={yr}>{yr}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                <select
                  value={exportMonth}
                  onChange={(e) => setExportMonth(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExportToDatabase}
                  className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 text-white"
                >
                  Export
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

        {/* Centered box (naturally centered in column 2) */}
        <div className="flex justify-center">
          <motion.div className="border border-gray-300 bg-gray-50 rounded-md px-4 py-2 flex gap-6 items-center text-sm">
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
        </div>

        {/* Right button pinned to end */}
        <div className="flex justify-end">
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

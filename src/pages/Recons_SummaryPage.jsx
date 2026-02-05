import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { saveAs } from 'file-saver';
import { DownloadIcon, Loader2, ChevronDownIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { APP_FULL_NAME } from '../config';
import { getBackendUrl } from "../config/backend";

const monthNames = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// Get last month (if Jan, should go to Dec last year)
function getDefaultMonthYear() {
  const now = new Date();
  let month = now.getMonth(); // JS: 0=Jan, ..., 11=Dec
  let year = now.getFullYear();
  if (month === 0) {
    month = 11;
    year = year - 1;
  } else {
    month = month - 1;
  }
  return {
    defaultMonth: monthNames[month],
    defaultYear: String(year)
  };
}

function ReconciliationSummary() {
  const navigate = useNavigate();
  const location = useLocation();

  // --- Place this at the top ---
  const resultId = location.state?.result_id || sessionStorage.getItem('reconcileResultId');

  // --- All hooks ---
  const [osdpData, setOsdpData] = useState([]);
  const [pbiData, setPbiData] = useState([]);
  const [fullResult, setFullResult] = useState(null);
  const [source, setSource] = useState('OSDP');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const fromButton = location.state?.fromButton || sessionStorage.getItem('fromButton') || 'N/A';
  const businessType = location.state?.businessType || sessionStorage.getItem('businessType') || 'N/A';
  const [exporting, setExporting] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const { defaultMonth, defaultYear } = getDefaultMonthYear();
  const [exportYear, setExportYear] = useState(defaultYear);
  const [exportMonth, setExportMonth] = useState(defaultMonth);
  const creator = localStorage.getItem('username') || 'Auto Generated';
  const [loading, setLoading] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const backendUrl = getBackendUrl();
  const requireBackend = () => {
    if (!backendUrl) {
      toast.error("Backend URL not set. Please set Tunnel URL in Header.");
      throw new Error("Backend URL not set");
    }
    return backendUrl;
  };

  // --- Early navigation effect, NO return! ---
  useEffect(() => {
    if (!resultId) {
      toast.error("No reconciliation result found. Please upload and process files first.");
      navigate('/recons/hpc_fcs');
    }
  }, [resultId, navigate]);

  // --- Data fetching effect ---
  useEffect(() => {
    if (!resultId) return; // Only fetch if resultId exists
    setLoading(true);
    fetch(`${requireBackend()}/get_reconcile_summary?result_id=${resultId}`)
      .then(res => res.json())
      .then(data => {
        setOsdpData(data.summary_osdp || []);
        setPbiData(data.summary_pbi || []);
        setFullResult(data);
        sessionStorage.setItem('keyColumns', JSON.stringify(data.key_columns || []));
      })
      .catch(err => {
        console.error('Error fetching summary:', err);
        toast.error('Failed to load reconciliation summary.');
      })
      .finally(() => setLoading(false));
  }, [resultId]);

  // --- Hover logic for dropdown ---
  useEffect(() => {
    if (!showExportOptions) return;
    if (!isHovering) {
      const timeout = setTimeout(() => setShowExportOptions(false), 100);
      return () => clearTimeout(timeout);
    }
  }, [isHovering, showExportOptions]);

  // --- Export handlers ---
  const handleExportExcel = async () => {
    setExporting(true);
    const dataToExport = source === 'OSDP' ? osdpData : pbiData;
    const toastId = toast.loading('Exporting report...');
    try {
      const response = await fetch(`${requireBackend()}/export_summary_excel`, {
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
      const response = await fetch(`${requireBackend()}/export_to_sheets`, {
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

  // NEW: CSV DSS (calls /export_combined_csv and downloads the CSV)
  const handleExportCsvDss = async () => {
    setExporting(true);
    const toastId = toast.loading('Generating CSV DSS...');
    try {
      const url = `${requireBackend()}/export_combined_csv`;
      const fd = new FormData();
      // Provide result_id so backend can rebuild the CSV for this reconciliation
      fd.append('result_id', resultId);

      const resp = await fetch(url, {
        method: 'POST',
        body: fd,
      });

      if (!resp.ok) {
        const msg = `Failed to generate CSV (HTTP ${resp.status})`;
        throw new Error(msg);
      }

      const blob = await resp.blob();
      const fname = `combined_export_${businessType}_${fromButton}.csv`.replace(/\s+/g, '_');
      saveAs(blob, fname);

      toast.success('CSV DSS generated!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate CSV DSS.', { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  // --- Early return after all hooks, for safety ---
  if (!resultId) {
    return (
      <DashboardLayout pageTitle={APP_FULL_NAME}>
        <div className="w-full h-[60vh] flex items-center justify-center">
          <div className="text-red-600 font-semibold text-lg">
            No reconciliation result found. Please upload and process files first.
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // --- Displayed data ---
  const displayedData = source === 'OSDP' ? osdpData : pbiData;
  const totalMatch = displayedData.filter(row => row.Status === 'Match').length;
  const totalMismatch = displayedData.filter(row => row.Status === 'Mismatch').length;
  const noMismatchInBoth = osdpData.every(row => row.Status === 'Match') && pbiData.every(row => row.Status === 'Match');

  if (loading) {
    return (
      <DashboardLayout pageTitle={APP_FULL_NAME} breadcrumbs={["Tools","Reconciliation Tools",businessType,fromButton,"Reconciliation Summary"]}>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="animate-spin h-10 w-10 text-blue-600 mb-4" />
          <div className="text-blue-800 font-medium text-lg">Processing reconciliation summary, please wait...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout pageTitle={APP_FULL_NAME} breadcrumbs={["Tools","Reconciliation Tools",businessType,fromButton,"Reconciliation Summary"]}>
      <div className="grid grid-cols-3 items-center mb-6">
        <div className="flex gap-2 justify-start relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowConfirmModal(true)}
            className="px-4 py-2 bg-gray-700 text-white text-sm rounded hover:bg-gray-800 transition"
          >
            Back to Main
          </motion.button>
          <div className="relative">
            <button
              onClick={() => {
                setShowExportOptions((prev) => !prev);
                setIsHovering(true); // keep open briefly
              }}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
            >
              <DownloadIcon size={16} /> Export <ChevronDownIcon size={14} />
            </button>
            {showExportOptions && (
              <div
                className="absolute z-20 mt-1 w-56 bg-white rounded shadow border"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
              >
                <button
                  onClick={() => {
                    setShowExportOptions(false);
                    handleExportExcel();
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                  disabled={exporting}
                >
                  To Excel File
                </button>
                <button
                  onClick={() => {
                    setShowExportOptions(false);
                    setShowExportModal(true);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                  disabled={exporting}
                >
                  To Report Database
                </button>
                {/* NEW: CSV DSS */}
                <button
                  onClick={() => {
                    setShowExportOptions(false);
                    handleExportCsvDss();
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                  disabled={exporting}
                >
                  CSV DSS
                </button>
              </div>
            )}
          </div>
        </div>

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

        <div className="flex justify-end">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const keyColumns = fullResult?.key_columns || JSON.parse(sessionStorage.getItem('keyColumns') || '[]');
              navigate('/recons/result', {
                state: {
                  result_id: resultId,
                  key_columns: keyColumns,
                  fromButton,
                  businessType
                }
              });
            }}
            disabled={noMismatchInBoth || !osdpData.length || !pbiData.length}
            className={`px-4 py-2 text-white text-sm rounded ${noMismatchInBoth ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}
          >
            Go to Result
          </motion.button>
        </div>
      </div>

      {/* Simple summary display */}
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
                <tr key={index} className="hover:bg-gray-50 cursor-pointer">
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

      <AnimatePresence>
        {showExportModal && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full"
              initial={{ scale: 0.95, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-3 text-gray-800">Export to Report Database</h3>
              <div className="flex flex-col gap-3 mb-5">
                <div>
                  <label className="block text-sm mb-1">Year:</label>
                  <select value={exportYear} onChange={e => setExportYear(e.target.value)} className="border rounded px-2 py-1 w-full">
                    {['2026','2025', '2024', '2023'].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Month:</label>
                  <select value={exportMonth} onChange={e => setExportMonth(e.target.value)} className="border rounded px-2 py-1 w-full">
                    {monthNames.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >Cancel</button>
                <button
                  onClick={handleExportToDatabase}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >Export</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

export default ReconciliationSummary;

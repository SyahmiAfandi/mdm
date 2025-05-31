import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, FileSpreadsheet, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

function ReconciliationPage() {
  const [reconciliationResult, setReconciliationResult] = useState([]);
  const [activeTab, setActiveTab] = useState('Missing in OSDP');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState({ excel: null, csv: null });
  const navigate = useNavigate();
  const location = useLocation();
  const businessType = sessionStorage.getItem('businessType') || 'N/A';
  const reportType = location.state?.fromButton || sessionStorage.getItem('fromButton') || 'N/A';
  const { distributor, distributorName, source } = location.state || {};
  const creator = localStorage.getItem('username') || 'Auto Generated';

  useEffect(() => {
    const stored = JSON.parse(sessionStorage.getItem('reconcile_all_result')) || {};
    const result = stored.reconciliation_result || [];
    setReconciliationResult(result);
    if (result.length === 0) {
      alert('Missing reconciliation result. Please upload and process files again.');
      navigate('/');
    }
  }, [navigate]);

  const filteredResults = reconciliationResult.filter(row =>
    distributor ? row.Distributor === distributor : row['Mismatch Type'] === activeTab
  );

  const renderDifferences = (differences) => (
    <div className="overflow-x-auto mt-2">
      <table className="w-full border border-gray-400 border-collapse text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-2 py-1 text-left">Field</th>
            <th className="border px-2 py-1 text-center" style={{ width: '100px' }}>OSDP</th>
            <th className="border px-2 py-1 text-center" style={{ width: '100px' }}>PBI</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(differences).map(([field, value], idx) => (
            <tr key={`${field}-${idx}`} className="hover:bg-yellow-50">
              <td className="border px-2 py-1 text-left text-sm break-words">{field}</td>
              <td className="border px-2 py-1 text-center text-sm truncate">{value.OSDP?.toString() || ''}</td>
              <td className="border px-2 py-1 text-center text-sm truncate">{value.PBI?.toString() || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const handleExportCSV = (mode) => {
    setExporting(prev => ({ ...prev, csv: mode }));

    // Let the UI update and show spinner first
    setTimeout(() => {
      try {
        const data = mode === 'all' ? reconciliationResult : filteredResults;
        const flattened = [];

        data.forEach(row => {
          if (row['Mismatch Type'] === 'Value mismatch' && row.Differences) {
            Object.entries(row.Differences).forEach(([field, values]) => {
              flattened.push({
                Distributor: row.Distributor,
                'Distributor Name': row['Distributor Name'],
                'Sales Route': row['Sales Route'],
                'Mismatch Type': row['Mismatch Type'],
                Field: field,
                OSDP: values.OSDP,
                PBI: values.PBI
              });
            });
          } else {
            flattened.push({
              Distributor: row.Distributor,
              'Distributor Name': row['Distributor Name'],
              'Sales Route': row['Sales Route'],
              'Mismatch Type': row['Mismatch Type'],
              Field: '',
              OSDP: '',
              PBI: row.Details || `Only in ${row['Mismatch Type'].includes('OSDP') ? 'PBI' : 'OSDP'}`
            });
          }
        });

        const ws = XLSX.utils.json_to_sheet(flattened);
        const csv = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Reconciliation_${mode}.csv`;
        link.click();

        toast.success('CSV export complete!');
        setShowExportModal(false);
      } catch (err) {
        toast.error('Failed to export CSV.');
      } finally {
        setExporting(prev => ({ ...prev, csv: null }));
      }
    }, 800); // small delay to allow render
  }


  const handleExportExcel = async (mode) => {
    const dataToExport = mode === 'all' ? reconciliationResult : filteredResults;
    setExporting(prev => ({ ...prev, excel: mode }));
    const toastId = toast.loading('Exporting Excel...');

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || "http://localhost:5000"}/export_result_excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: dataToExport,
          mode,
          businessType,
          reportType, // <- corrected here
          creator
        })
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Reconciliation_${mode}.xlsx`;
      link.click();

      toast.success('Exported successfully!', { id: toastId });
      setShowExportModal(false);
    } catch (err) {
      toast.error('Failed to export Excel.', { id: toastId });
    } finally {
      setExporting(prev => ({ ...prev, excel: null }));
    }
  };


  return (
    <DashboardLayout>
      <div className="p-4 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Reconciliation Result</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowExportModal(true)}
              className="w-40 h-10 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-700 transition"
            >
              Export Report
            </button>

            <button
              onClick={() => navigate('/recons/hpc_fcs/summary', {
                state: {
                  fromButton: location.state?.fromButton || sessionStorage.getItem('fromButton'),
                  businessType: sessionStorage.getItem('businessType')
                }
              })}
              className="w-40 h-10 bg-gray-700 text-white text-sm font-semibold rounded hover:bg-gray-600 transition"
            >
              ← Back to Summary
            </button>
          </div>
        </div>

        {distributor && (
          <h3 className="text-lg font-semibold mb-4">
            Showing results for Distributor: {distributor} ({distributorName}) - Source: {source}
          </h3>
        )}

        <div className="flex justify-center mb-8 gap-4">
          {['Missing in OSDP', 'Missing in PBI', 'Value mismatch'].map(type => (
            <button
              key={type}
              className={`px-6 py-2 rounded-lg shadow-md transition duration-200 ${
                activeTab === type
                  ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white scale-105 font-bold'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
              onClick={() => setActiveTab(type)}
            >
              {type}
            </button>
          ))}
        </div>

        {filteredResults.length === 0 ? (
          <div className="w-full flex justify-center items-center min-h-[150px]">
            <p className="text-green-600 font-medium text-center text-lg">
              No {activeTab.toLowerCase()} records found.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-md shadow-sm">
            <table className="min-w-full text-sm border-collapse border border-gray-500">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-4 py-2 text-center">Distributor</th>
                  <th className="border px-4 py-2 text-center">Distributor Name</th>
                  <th className="border px-4 py-2 text-center">Sales Route</th>
                  <th className="border px-4 py-2 text-center">Mismatch Type</th>
                  <th className="border px-4 py-2 text-center">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`${row['Mismatch Type'] === 'Value mismatch' ? 'bg-red-100' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-red-200`}
                  >
                    <td className="border text-center px-4 py-2">{row.Distributor}</td>
                    <td className="border text-center px-4 py-2">{row['Distributor Name']}</td>
                    <td className="border text-center px-4 py-2">{row['Sales Route']}</td>
                    <td className="border text-center px-4 py-2">{row['Mismatch Type']}</td>
                    <td className="border text-center px-4 py-2">
                      {row['Mismatch Type'] === 'Value mismatch' && row.Differences
                        ? renderDifferences(row.Differences)
                        : (
                          <span className="text-sm text-gray-600">
                            This record is only in <strong>{row['Mismatch Type'].includes('OSDP') ? 'PBI' : 'OSDP'}</strong>
                          </span>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AnimatePresence>
            {showExportModal && (
              <motion.div
                className={`fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70 ${
                  exporting.csv || exporting.excel ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  if (!exporting.csv && !exporting.excel) {
                    setShowExportModal(false);
                  }
                }}
              >
                <motion.div
                  className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-md mx-4 text-center"
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 30, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-2xl font-semibold text-gray-800 mb-6">Export Reports</h3>

                  <div className="space-y-6">
                    {/* CSV Section */}
                    <div>
                      <p className="text-sm font-semibold text-left mb-3 text-gray-700 flex items-center gap-2">
                        <FileText size={18} /> Export in CSV:
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        {/* CSV - Current Tab */}
                        <button
                          onClick={() => handleExportCSV('current')}
                          disabled={exporting.csv !== null || exporting.excel !== null}
                          className={`w-full px-4 py-2 rounded-md ${
                            (exporting.csv !== null && exporting.csv !== 'current') || exporting.excel !== null
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-green-600 hover:bg-green-700'
                          } text-white transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium`}
                        >
                          {exporting.csv === 'current' ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                          Current Tab
                        </button>

                        {/* CSV - All Tab */}
                        <button
                          onClick={() => handleExportCSV('all')}
                          disabled={exporting.csv !== null || exporting.excel !== null}
                          className={`w-full px-4 py-2 rounded-md ${
                            (exporting.csv !== null && exporting.csv !== 'all') || exporting.excel !== null
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700'
                          } text-white transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium`}
                        >
                          {exporting.csv === 'all' ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                          All Tab
                        </button>
                      </div>
                    </div>

                    <hr className="border-gray-200" />

                    {/* Excel Section */}
                    <div>
                      <p className="text-sm font-semibold text-left mb-3 text-gray-700 flex items-center gap-2">
                        <FileSpreadsheet size={18} /> Export in Excel:
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Excel - Current Tab */}
                        <button
                          onClick={() => handleExportExcel('current')}
                          disabled={exporting.excel !== null || exporting.csv !== null}
                          className={`w-full px-4 py-2 rounded-md ${
                            (exporting.excel !== null && exporting.excel !== 'current') || exporting.csv !== null
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-green-600 hover:bg-green-700'
                          } text-white transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium`}
                        >
                          {exporting.excel === 'current' ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                          Current Tab
                        </button>

                        {/* Excel - All Tab */}
                        <button
                          onClick={() => handleExportExcel('all')}
                          disabled={exporting.excel !== null || exporting.csv !== null}
                          className={`w-full px-4 py-2 rounded-md ${
                            (exporting.excel !== null && exporting.excel !== 'all') || exporting.csv !== null
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700'
                          } text-white transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium`}
                        >
                          {exporting.excel === 'all' ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                          All Tab
                        </button>
                      </div>
                    </div>


                  </div>
                </motion.div>
              </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

export default ReconciliationPage;

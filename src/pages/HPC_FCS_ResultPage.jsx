import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';

function ReconciliationPage() {
  const [reconciliationResult, setReconciliationResult] = useState([]);
  const [activeTab, setActiveTab] = useState('Missing in OSDP');
  const [showExportModal, setShowExportModal] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { distributor, distributorName, source } = location.state || {};

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
            <th className="border px-2 py-1 text-center">OSDP</th>
            <th className="border px-2 py-1 text-center">PBI</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(differences).map(([field, value], idx) => (
            <tr key={`${field}-${idx}`}>
              <td className="border px-2 py-1 text-left">{field}</td>
              <td className="border px-2 py-1 text-center">{value.OSDP?.toString() || ''}</td>
              <td className="border px-2 py-1 text-center">{value.PBI?.toString() || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const handleExportCSV = (mode) => {
    let data = [];
    if (mode === 'all') {
      data = reconciliationResult;
    } else {
      data = filteredResults;
    }

    const flattened = [];
    data.forEach(row => {
      if (row['Mismatch Type'] === 'Value mismatch' && row.Differences) {
        const diffs = row.Differences;
        for (const [field, values] of Object.entries(diffs)) {
          flattened.push({
            Distributor: row.Distributor,
            'Distributor Name': row['Distributor Name'],
            'Sales Route': row['Sales Route'],
            'Mismatch Type': row['Mismatch Type'],
            Field: field,
            OSDP: values.OSDP,
            PBI: values.PBI
          });
        }
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
    setShowExportModal(false);
  };

  return (
    <DashboardLayout>
      <div className="p-4 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Reconciliation Result</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowExportModal(true)} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Export Report</button>
            <button
              onClick={() => navigate('/recons/hpc_fcs/summary', {
                state: {
                  fromButton: location.state?.fromButton || sessionStorage.getItem('fromButton'),
                  businessType: sessionStorage.getItem('businessType')
                }
              })}
              className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
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
                className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowExportModal(false)}
              >
                <motion.div
                  className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md mx-4 text-center"
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 30, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-xl font-semibold mb-4">Export Reports (CSV)</h3>
                  <div className="flex justify-center gap-4">
                    <button onClick={() => handleExportCSV('all')} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Export All</button>
                    <button onClick={() => handleExportCSV('current')} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Export This Tab</button>
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

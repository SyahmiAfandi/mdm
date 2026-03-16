import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  FileSpreadsheet, 
  Download, 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle, 
  Database, 
  Layers,
  CheckCircle2,
  XCircle,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getBackendUrl } from "../config/backend";

const TAB_CONFIG = [
  { id: 'Missing in OSDP', label: 'Missing in OSDP', icon: XCircle, color: 'text-orange-500' },
  { id: 'Missing in PBI', label: 'Missing in PBI', icon: AlertCircle, color: 'text-rose-500' },
  { id: 'Value mismatch', label: 'Value Mismatch', icon: Layers, color: 'text-amber-500' }
];

function ReconciliationPage() {
  const [activeTab, setActiveTab] = useState('Missing in OSDP');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState({ excel: null, csv: null });
  const [allRows, setAllRows] = useState([]);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(15); 
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const resultId = location.state?.result_id || sessionStorage.getItem('reconcileResultId');
  const keyColumns = useMemo(() => {
    return location.state?.key_columns || JSON.parse(sessionStorage.getItem('keyColumns') || '["Distributor","Sales Route"]');
  }, [location.state?.key_columns]);
  
  const businessType = location.state?.businessType || 'N/A';
  const reportType = location.state?.fromButton || 'N/A';
  const creator = localStorage.getItem('username') || 'Auto Generated';
  const { distributor, distributorName } = location.state || {};

  const backendUrl = getBackendUrl();
  const requireBackend = () => {
    if (!backendUrl) {
      toast.error("Backend URL not set. Please set Tunnel URL in Header.");
      throw new Error("Backend URL not set");
    }
    return backendUrl;
  };

  // Fetch results
  useEffect(() => {
    if (!resultId) {
      toast.error('No reconciliation result found. Please process files first.');
      return;
    }
    setLoading(true);

    try {
      fetch(`${requireBackend()}/get_reconcile_page?result_id=${resultId}&page=1&size=1000000`)
        .then(res => res.json())
        .then(data => {
          setAllRows(data.rows || []);
          setPage(1);
        })
        .catch(() => toast.error('Failed to fetch reconciliation results.'))
        .finally(() => setLoading(false));
    } catch (e) {
      setLoading(false);
    }
  }, [resultId]);

  // Derived Stats
  const stats = useMemo(() => {
    return {
      total: allRows.length,
      missingOSDP: allRows.filter(r => r['Mismatch Type'] === 'Missing in OSDP').length,
      missingPBI: allRows.filter(r => r['Mismatch Type'] === 'Missing in PBI').length,
      valueMismatch: allRows.filter(r => r['Mismatch Type'] === 'Value mismatch').length,
    };
  }, [allRows]);

  // Filtering
  const filteredRows = useMemo(() => {
    if (distributor) {
      return allRows.filter(row => row.Distributor === distributor);
    }
    return allRows.filter(row => row['Mismatch Type'] === activeTab);
  }, [allRows, activeTab, distributor]);

  // Combine Value Mismatch data if there are same key columns
  const groupedRows = useMemo(() => {
    if (activeTab !== 'Value mismatch') return filteredRows;

    const map = new Map();
    filteredRows.forEach(row => {
      // Create a unique key from all keyColumns
      const key = keyColumns.map(col => row[col]).join('|');
      if (map.has(key)) {
        const existing = map.get(key);
        existing.Differences = { ...existing.Differences, ...row.Differences };
      } else {
        // deep clone to avoid mutating standard rows
        map.set(key, { ...row, Differences: { ...row.Differences } });
      }
    });
    return Array.from(map.values());
  }, [filteredRows, activeTab, keyColumns]);

  // Pagination
  const totalPages = Math.ceil(groupedRows.length / size);
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * size;
    return groupedRows.slice(start, start + size);
  }, [groupedRows, page, size]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, distributor]);

  // Export handlers
  const handleExportCSV = (mode) => {
    setExporting(prev => ({ ...prev, csv: mode }));
    const toastId = toast.loading('Exporting CSV...');
    setTimeout(() => {
      try {
        const data = mode === 'all' ? allRows : groupedRows; // we use groupedRows for current tab
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
        toast.success('CSV export complete!', { id: toastId });
        setShowExportModal(false);
      } catch (err) {
        toast.error('Failed to export CSV.', { id: toastId });
      } finally {
        setExporting(prev => ({ ...prev, csv: null }));
      }
    }, 500);
  };

  const handleExportExcel = async (mode) => {
    setExporting(prev => ({ ...prev, excel: mode }));
    const toastId = toast.loading('Generating Excel Report...');
    try {
      // Re-group 'all' data just for excel if mode == 'all'
      let dataToExport = mode === 'all' ? allRows : groupedRows;
      
      const response = await fetch(`${requireBackend()}/export_result_excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: dataToExport,
          mode,
          businessType,
          reportType,
          creator
        })
      });

      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Reconciliation_${mode}.xlsx`;
      link.click();
      toast.success('Excel Report exported!', { id: toastId });
      setShowExportModal(false);
    } catch (err) {
      toast.error('Failed to export Excel.', { id: toastId });
    } finally {
      setExporting(prev => ({ ...prev, excel: null }));
    }
  };

  const renderDifferences = (differences) => (
    <div className="flex flex-col gap-1.5 min-w-[320px]">
      {Object.entries(differences).map(([field, value], idx) => (
        <div key={`${field}-${idx}`} className="flex items-center justify-between text-xs bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-200">
          <span className="font-semibold text-gray-700 truncate pr-3" title={field}>{field}</span>
          <div className="flex items-center gap-2 shrink-0">
             <div className="flex flex-col items-center">
                 <span className="text-[9px] font-extrabold text-gray-400 uppercase leading-none mb-0.5">OSDP</span>
                 <span className="font-bold text-rose-600 bg-white px-2 py-0.5 rounded shadow-sm border border-rose-100 min-w-[60px] text-center">{value.OSDP?.toString() || '-'}</span>
             </div>
             <div className="mt-3">
               <ArrowRight className="w-3 h-3 text-gray-400" />
             </div>
             <div className="flex flex-col items-center">
                 <span className="text-[9px] font-extrabold text-gray-400 uppercase leading-none mb-0.5">Power BI</span>
                 <span className="font-bold text-blue-600 bg-white px-2 py-0.5 rounded shadow-sm border border-blue-100 min-w-[60px] text-center">{value.PBI?.toString() || '-'}</span>
             </div>
          </div>
        </div>
      ))}
    </div>
  );

  if (!resultId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="bg-red-50 p-6 rounded-full mb-6">
          <XCircle className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">No Results Found</h2>
        <p className="text-gray-600 mb-8 max-w-sm">Please upload and process files from the summary page to view the reconciliation result.</p>
        <button
          onClick={() => navigate('/recons/summary')}
          className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Summary
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Compact Header */}
      <div className="bg-white border-b border-gray-200 py-3 px-6 mb-6 shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg hidden sm:block">
               <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">
                <span>{businessType}</span>
                <ChevronRight className="w-3 h-3 text-gray-300" />
                <span>{reportType}</span>
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                Reconciliation Results
                {distributor && <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Dist: {distributor}</span>}
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
             <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" /> Export
              </button>
              <button
                onClick={() => navigate('/recons/summary', { 
                  state: { result_id: resultId, key_columns: keyColumns, businessType } 
                })}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white text-gray-700 border border-gray-300 text-xs sm:text-sm font-bold rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Tab Navigation & Pagination Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 bg-white p-2 sm:p-3 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-hide">
            {TAB_CONFIG.map(({ id, label, icon: Icon, color, bg }) => {
              // Recalculate badge logic (could use stats.missingOSDP instead but length avoids mismatch if we filter by distributor)
              const tabCount = id === 'Missing in OSDP' ? stats.missingOSDP : id === 'Missing in PBI' ? stats.missingPBI : stats.valueMismatch;
              const countToDisplay = distributor ? filteredRows.length : tabCount; // Approximation if distributor is selected but we just want overall stat

              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`relative px-3 sm:px-4 py-2 text-sm font-bold flex items-center gap-2 rounded-lg transition-all whitespace-nowrap ${
                    activeTab === id ? 'bg-gray-900 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${activeTab === id ? 'text-gray-300' : color}`} />
                  <span>{label}</span>
                  <span className={`px-2 rounded border text-[10px] font-black ${
                    activeTab === id ? 'bg-gray-800 border-gray-700 text-gray-100' : 'bg-white border-gray-200 text-gray-500'
                  }`}>
                    {id === 'Missing in OSDP' ? stats.missingOSDP : id === 'Missing in PBI' ? stats.missingPBI : stats.valueMismatch}
                  </span>
                </button>
              );
            })}
          </div>

          {!loading && totalPages > 1 && (
            <div className="flex items-center gap-2 sm:gap-4 shrink-0 px-2 sm:px-4">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider hidden sm:inline">Page</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 sm:p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-1 min-w-[60px] justify-center bg-gray-50 px-3 py-1 rounded-md border border-gray-200 text-sm">
                  <span className="font-bold text-gray-900">{page}</span>
                  <span className="text-gray-400">/</span>
                  <span className="font-bold text-gray-500">{totalPages}</span>
                </div>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1 sm:p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden min-h-[500px] shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
              <h3 className="text-lg font-bold text-gray-800 mb-1">Loading Results...</h3>
              <p className="text-gray-500 text-sm">Fetching and processing data</p>
            </div>
          ) : groupedRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 text-center">
              <div className="bg-green-50 p-4 rounded-full mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-1">Perfect Match!</h3>
              <p className="text-gray-500 text-sm">There are no {activeTab.toLowerCase()} records to display.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-white border-b border-gray-200 text-xs font-black text-gray-400 uppercase tracking-widest sticky top-0 z-10">
                    <th className="px-5 py-4 bg-white/90 backdrop-blur-sm shadow-sm sticky left-0 z-20">Distributor Info</th>
                    {keyColumns.filter(c => !['Distributor', 'Distributor Name'].includes(c)).map(col => (
                      <th key={col} className="px-5 py-4 bg-white/90 backdrop-blur-sm text-center shadow-sm">{col}</th>
                    ))}
                    <th className="px-5 py-4 bg-white/90 backdrop-blur-sm text-right shadow-sm w-full md:w-auto">Match Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-sm text-gray-700">
                  <AnimatePresence mode="popLayout">
                    {paginatedRows.map((row, idx) => (
                      <motion.tr
                        key={`${activeTab}-${idx}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                        className="hover:bg-blue-50/40 transition-colors"
                      >
                        <td className="px-5 py-3 sticky left-0 bg-white group-hover:bg-blue-50/40 border-r border-transparent">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900">{row['Distributor']}</span>
                            <span className="text-[11px] text-gray-500 truncate max-w-[200px]">{row['Distributor Name']}</span>
                          </div>
                        </td>
                        {keyColumns.filter(c => !['Distributor', 'Distributor Name'].includes(c)).map(col => (
                          <td key={col} className="px-5 py-3 text-center">
                            {row[col] || '-'}
                          </td>
                        ))}
                        <td className="px-5 py-3 text-right group">
                          <div className="flex justify-end relative">
                            {row['Mismatch Type'] === 'Value mismatch' && row.Differences ? (
                              renderDifferences(row.Differences)
                            ) : (
                              <div className="inline-flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                                <span className="text-[11px] font-bold text-gray-500 uppercase">
                                  Missing in {row['Mismatch Type'].includes('OSDP') ? 'OSDP' : 'Power BI'}
                                </span>
                                <div className={`w-2 h-2 rounded-full ${row['Mismatch Type'].includes('OSDP') ? 'bg-orange-500' : 'bg-rose-500'}`}></div>
                              </div>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !exporting.excel && !exporting.csv && setShowExportModal(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-gray-50 border-b border-gray-100 p-5">
                <h3 className="text-xl font-bold text-gray-900">Export Results</h3>
                <p className="text-sm text-gray-500 mt-1">Download your reconciliation data.</p>
              </div>
              
              <div className="p-5 space-y-5">
                {/* CSV Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-700 font-bold text-sm">
                    <FileText size={16} className="text-green-600" /> CSV Format
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <ExportButton 
                      label="Current Tab" 
                      onClick={() => handleExportCSV('current')} 
                      loading={exporting.csv === 'current'} 
                      disabled={!!exporting.csv || !!exporting.excel}
                      color="green"
                    />
                    <ExportButton 
                      label="All Data" 
                      onClick={() => handleExportCSV('all')} 
                      loading={exporting.csv === 'all'} 
                      disabled={!!exporting.csv || !!exporting.excel}
                      color="green"
                      secondary
                    />
                  </div>
                </div>

                <div className="h-px bg-gray-100" />

                {/* Excel Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                    <FileSpreadsheet size={16} className="text-blue-600" /> Excel Spreadsheet
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <ExportButton 
                      label="Current Tab" 
                      onClick={() => handleExportExcel('current')} 
                      loading={exporting.excel === 'current'} 
                      disabled={!!exporting.csv || !!exporting.excel}
                      color="blue"
                    />
                    <ExportButton 
                      label="All Data" 
                      onClick={() => handleExportExcel('all')} 
                      loading={exporting.excel === 'all'} 
                      disabled={!!exporting.csv || !!exporting.excel}
                      color="blue"
                      secondary
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white p-3 flex justify-end px-5 pb-5">
                <button
                  onClick={() => setShowExportModal(false)}
                  disabled={!!exporting.csv || !!exporting.excel}
                  className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExportButton({ label, onClick, loading, disabled, color, secondary }) {
  const styles = {
    green: secondary 
      ? "bg-white text-green-700 border-gray-200 hover:border-green-300 hover:bg-green-50" 
      : "bg-green-600 border-green-600 text-white hover:bg-green-700",
    blue: secondary 
      ? "bg-white text-blue-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50" 
      : "bg-blue-600 border-blue-600 text-white hover:bg-blue-700"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-10 flex items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all border ${styles[color]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : label}
    </button>
  );
}

export default ReconciliationPage;

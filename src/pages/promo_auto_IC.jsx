import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, RotateCcw, FileDown, ArrowLeft, CheckCircle2, AlertCircle, FileSpreadsheet, Activity, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { usePermissions } from '../hooks/usePermissions';

function AutoGenerateMonthlyICPromotion() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  const [isExporting, setIsExporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [logStatus, setLogStatus] = useState({ type: 'info', message: 'Ready for import. Please upload your Monthly IC Promotion source file.' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [summaryPreview, setSummaryPreview] = useState([]); // preview ic_main_out from backend
  const [mounted, setMounted] = useState(false);

  const { can, role } = usePermissions();

  const canEdit = can("tools.promotions.edit") || can("tools.*") || role === "admin";

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleBrowseClick = () => {
    if (!canEdit) return toast.error("No permission to edit promotions");
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleExport = async () => {
    if (!canEdit) return toast.error("No permission to edit promotions");
    try {
      setIsExporting(true);
      setLogStatus({ type: 'loading', message: 'Preparing IC Promo Template for download...' });

      const res = await fetch(`${BACKEND_URL}/api/promotions/auto/export`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Export failed (${res.status}).`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'IC_Promo_Template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setLogStatus({ type: 'success', message: 'IC Promo Template exported successfully.' });
    } catch (error) {
      console.error(error);
      setLogStatus({ type: 'error', message: `Export error: ${error.message || 'Unexpected error.'}` });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setSummaryPreview([]);
    setLogStatus({ type: 'success', message: `File selected: ${file.name}. Ready to process.` });
  };

  const handleReset = () => {
    setSelectedFile(null);
    setSummaryPreview([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setLogStatus({ type: 'info', message: 'Workspace reset. No file imported.' });
    setIsProcessing(false);
  };

  const handleGenerateExport = async () => {
    if (!canEdit) return toast.error("No permission to edit promotions");

    if (!selectedFile) {
      setLogStatus({ type: 'error', message: 'Please import a file before generating the promotion.' });
      return;
    }

    try {
      setIsProcessing(true);
      setLogStatus({ type: 'loading', message: `Uploading and processing "${selectedFile.name}"...` });

      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch(`${BACKEND_URL}/api/promotions/auto/import`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error (${res.status})`);
      }

      const data = await res.json();
      console.log("✅ Backend response:", data);
      setSummaryPreview(data.summary_preview || []);
      setLogStatus({
        type: 'success',
        message: `Processed successfully. ${data.summary_rows || 0} promotions generated and stored.`
      });
    } catch (error) {
      console.error(error);
      setLogStatus({ type: 'error', message: `Failed to process file: ${error.message || 'Unexpected error.'}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReturn = () => {
    navigate('/promotions');
  };

  const formatDate = (val) => {
    if (!val) return "";
    const d = new Date(val);
    if (isNaN(d)) return val;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.5, ease: "easeOut" } }
  };

  const StatusIcon = () => {
    if (logStatus.type === 'loading' || isProcessing || isExporting) {
      return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />;
    }
    if (logStatus.type === 'success') {
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    }
    if (logStatus.type === 'error') {
      return <AlertCircle className="w-4 h-4 text-rose-500" />;
    }
    return <FileSpreadsheet className="w-4 h-4 text-violet-500" />;
  };

  return (
    <div className="min-h-[calc(100vh-75px)] flex flex-col p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto overflow-hidden bg-slate-50/50">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={mounted ? { opacity: 1, y: 0 } : {}}
        className="flex flex-col md:flex-row md:items-end justify-between mb-6 shrink-0 gap-4"
      >
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            Auto Generate: <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">IC Promotion</span>
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Automated processing and generation of Monthly IC Promotions templates.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Mode:{" "}
            <span className="font-semibold text-slate-700">
              {canEdit ? "Editable" : "Read only"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-violet-600 uppercase tracking-widest bg-violet-50 px-4 py-2 rounded-full border border-violet-100 shadow-sm self-start md:self-auto">
          <Activity size={14} className="text-violet-500" /> Auto-IC Engine Active
        </div>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate={mounted ? "visible" : "hidden"}
        className="flex-1 flex flex-col gap-6 w-full min-h-0"
      >
        {/* Main Workspace Card */}
        <motion.div
          variants={itemVariants}
          className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-0"
        >
          {/* Status Bar Header */}
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 transition-colors duration-300">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl bg-white shadow-sm border ${logStatus.type === 'error' ? 'border-rose-100' :
                logStatus.type === 'success' ? 'border-emerald-100' :
                  logStatus.type === 'loading' ? 'border-blue-100' : 'border-violet-100'
                }`}>
                <StatusIcon />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">System Status</span>
                <span className={`text-sm font-medium ${logStatus.type === 'error' ? 'text-rose-600' :
                  logStatus.type === 'success' ? 'text-emerald-700' :
                    logStatus.type === 'loading' ? 'text-blue-700' : 'text-slate-700'
                  }`}>
                  {logStatus.message}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedFile && !isProcessing && (
                <span className="inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-sm">
                  <CheckCircle2 size={12} className="mr-1.5" /> File Ready
                </span>
              )}
              {isProcessing && (
                <span className="inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 shadow-sm">
                  <Activity size={12} className="mr-1.5 animate-pulse" /> Processing...
                </span>
              )}
            </div>
          </div>

          {/* Preview Area Table */}
          <div className="flex-1 overflow-auto bg-white relative custom-scrollbar">
            {summaryPreview.length > 0 ? (
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-white/95 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
                  <tr>
                    {["No", "SchemeID", "SchemePromotionNumber", "SchemeDescription", "PeriodFrom", "PeriodTo"].map((header, i) => (
                      <th
                        key={header}
                        className={`px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 ${i === 0 ? 'pl-6' : ''}`}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <AnimatePresence>
                    {summaryPreview.map((row, idx) => (
                      <motion.tr
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(idx * 0.05, 0.5) }} // Cap delay
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        {[
                          row.No,
                          row.SchemeID,
                          row.SchemePromotionNumber,
                          row.SchemeDescription,
                          formatDate(row.PeriodFrom),
                          formatDate(row.PeriodTo),
                        ].map((value, colIdx) => (
                          <td
                            key={colIdx}
                            className={`px-4 py-3 text-slate-700 group-hover:text-slate-900 ${colIdx === 0 ? 'pl-6 font-medium text-slate-400' : ''} ${colIdx === 3 ? 'max-w-xs truncate' : ''}`}
                            title={colIdx === 3 ? value : undefined}
                          >
                            {value ?? "-"}
                          </td>
                        ))}
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 ring-8 ring-slate-50/50">
                  <FileSpreadsheet className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-1">No Data Preview</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Import an Excel source file and hit generate to view the promotion breakdown here.
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Action Controls Panel */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col xl:flex-row items-center justify-between gap-4 shrink-0"
        >
          {/* Main Actions */}
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            {/* Import File Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleBrowseClick}
              disabled={!canEdit || isProcessing}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              <span>Import Source</span>
            </motion.button>
            <input
              type="file"
              accept=".xlsx,.xls"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Generate Button */}
            <motion.button
              whileHover={!canEdit || !selectedFile || isProcessing ? {} : { scale: 1.02, boxShadow: "0 4px 12px rgba(124, 58, 237, 0.2)" }}
              whileTap={!canEdit || !selectedFile || isProcessing ? {} : { scale: 0.98 }}
              onClick={handleGenerateExport}
              disabled={!canEdit || !selectedFile || isProcessing}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold shadow-sm transition-all duration-200 ${!selectedFile || isProcessing || !canEdit
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : 'bg-violet-600 hover:bg-violet-700 text-white border border-violet-600 hover:border-violet-700'
                }`}
            >
              {isProcessing ? (
                <Activity className="w-4 h-4 animate-pulse" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              <span>{isProcessing ? 'Processing Data...' : 'Generate Promos'}</span>
            </motion.button>

            {/* Export Template Button */}
            <motion.button
              whileHover={!canEdit || isProcessing || isExporting ? {} : { scale: 1.02 }}
              whileTap={!canEdit || isProcessing || isExporting ? {} : { scale: 0.98 }}
              onClick={handleExport}
              disabled={!canEdit || isProcessing || isExporting}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-emerald-600/20"
            >
              <CheckCircle2 className={`w-4 h-4 ${isExporting ? 'animate-pulse' : ''}`} />
              <span>{isExporting ? 'Exporting...' : 'Export Template'}</span>
            </motion.button>

            {/* Reset Button */}
            <motion.button
              whileHover={{ scale: 1.02, rotate: -5 }}
              whileTap={{ scale: 0.98, rotate: -15 }}
              onClick={handleReset}
              disabled={!canEdit || isProcessing}
              className="flex items-center justify-center p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50 shadow-sm"
              title="Reset Workspace"
            >
              <RotateCcw className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Navigation */}
          <motion.button
            whileHover={{ scale: 1.02, x: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleReturn}
            disabled={isProcessing}
            className="w-full xl:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-semibold transition-all shadow-sm group disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Return to Hub</span>
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default AutoGenerateMonthlyICPromotion;

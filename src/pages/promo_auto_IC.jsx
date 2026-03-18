import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Database,
  FileDown,
  FileSpreadsheet,
  Filter,
  Info,
  Layout,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  Undo2,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { usePermissions } from '../hooks/usePermissions';
import {
  processMonthlyIcPromotion,
  buildIcTemplate,
  exportToExcel
} from './promoAutoIcUtils';

const STATUS_STYLES = {
  info: {
    card: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
    icon: 'text-slate-500 dark:text-slate-300'
  },
  loading: {
    card: 'border-sky-200 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/30',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200',
    icon: 'text-sky-600 dark:text-sky-300'
  },
  success: {
    card: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
    icon: 'text-emerald-600 dark:text-emerald-300'
  },
  error: {
    card: 'border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200',
    icon: 'text-rose-600 dark:text-rose-300'
  }
};

function AutoGenerateMonthlyICPromotion() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [isExporting, setIsExporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [logStatus, setLogStatus] = useState({
    type: 'info',
    message: 'Upload your IC source file to begin.'
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [summaryPreview, setSummaryPreview] = useState([]);
  const [icMain, setIcMain] = useState(null);
  const [icSku, setIcSku] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [hasExported, setHasExported] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { can, role } = usePermissions();
  const canEdit = can("tools.promotions.edit") || can("tools.*") || role === "admin";

  const hasProcessedData = Boolean(icMain && icSku);
  const filteredPreview = summaryPreview.filter(row => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (row.SchemeID || '').toLowerCase().includes(q) ||
      (row.SchemePromotionNumber || '').toLowerCase().includes(q) ||
      (row.SchemeDescription || '').toLowerCase().includes(q)
    );
  });
  const previewCount = summaryPreview.length;
  const filteredCount = filteredPreview.length;
  const statusStyle = STATUS_STYLES[logStatus.type] || STATUS_STYLES.info;

  const workflowSteps = [
    {
      step: '1',
      title: 'Upload file',
      description: selectedFile ? selectedFile.name : 'Choose the monthly IC workbook.',
      state: selectedFile ? 'done' : 'current'
    },
    {
      step: '2',
      title: 'Process preview',
      description: hasProcessedData
        ? `${previewCount} promotions ready for review.`
        : selectedFile
          ? 'Run the processor to build IC Main and IC SKU.'
          : 'Waiting for a source file.',
      state: hasProcessedData ? 'done' : selectedFile ? 'current' : 'pending'
    },
    {
      step: '3',
      title: 'Download template',
      description: hasExported
        ? 'The IC template was exported successfully.'
        : hasProcessedData
          ? 'Template is ready to download.'
          : 'Export unlocks after processing.',
      state: hasExported ? 'done' : hasProcessedData ? 'current' : 'pending'
    }
  ];

  const applySelectedFile = (file) => {
    if (!file) return;

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error('Only .xlsx or .xls files are supported.');
      return;
    }

    setSelectedFile(file);
    setSummaryPreview([]);
    setIcMain(null);
    setIcSku(null);
    setHasExported(false);
    setLogStatus({
      type: 'success',
      message: `File selected: ${file.name}. Click "Process File" to build the preview.`
    });
  };

  const handleBrowseClick = () => {
    if (!canEdit) {
      toast.error('No permission to edit promotions');
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    applySelectedFile(e.target.files?.[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!canEdit || isProcessing) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!canEdit || isProcessing) return;
    applySelectedFile(e.dataTransfer.files?.[0]);
  };

  const handleGenerateExport = async () => {
    if (!canEdit) return toast.error('No permission to edit promotions');

    if (!selectedFile) {
      setLogStatus({
        type: 'error',
        message: 'Please upload a file before processing.'
      });
      return;
    }

    try {
      setIsProcessing(true);
      setHasExported(false);
      setLogStatus({
        type: 'loading',
        message: `Processing "${selectedFile.name}"...`
      });

      const { icMain: main, icSku: sku, icMainOut } = await processMonthlyIcPromotion(selectedFile);

      setIcMain(main);
      setIcSku(sku);
      setSummaryPreview(icMainOut || []);
      setLogStatus({
        type: 'success',
        message: `Processing complete. ${icMainOut.length || 0} promotions are ready for export.`
      });
      toast.success('Processing complete!');
    } catch (error) {
      console.error(error);
      setLogStatus({
        type: 'error',
        message: `Processing failed: ${error.message}`
      });
      toast.error('Processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async () => {
    if (!canEdit) return toast.error('No permission to edit promotions');
    if (!icMain || !icSku) {
      toast.error('No processed data to export. Please process the file first.');
      return;
    }

    try {
      setIsExporting(true);
      setLogStatus({
        type: 'loading',
        message: 'Building IC template for download...'
      });

      const templateData = buildIcTemplate(icMain, icSku);
      exportToExcel(templateData);

      setHasExported(true);
      setLogStatus({
        type: 'success',
        message: 'IC Promo template exported successfully.'
      });
      toast.success('Template exported!');
    } catch (error) {
      console.error(error);
      setLogStatus({
        type: 'error',
        message: `Export failed: ${error.message}`
      });
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setSummaryPreview([]);
    setIcMain(null);
    setIcSku(null);
    setIsProcessing(false);
    setIsExporting(false);
    setHasExported(false);
    setIsDragOver(false);
    setLogStatus({
      type: 'info',
      message: 'Workspace reset. Upload a new IC file to begin again.'
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReturn = () => {
    navigate('/promotions');
  };

  const renderStatusIcon = () => {
    if (logStatus.type === 'loading' || isProcessing || isExporting) {
      return <Activity className={`h-5 w-5 animate-pulse ${statusStyle.icon}`} />;
    }
    if (logStatus.type === 'success') {
      return <CheckCircle2 className={`h-5 w-5 ${statusStyle.icon}`} />;
    }
    if (logStatus.type === 'error') {
      return <AlertCircle className={`h-5 w-5 ${statusStyle.icon}`} />;
    }
    return <FileSpreadsheet className={`h-5 w-5 ${statusStyle.icon}`} />;
  };

  return (
    <div className="w-full h-[calc(100vh-140px)] px-5 pb-5 flex flex-col gap-6 overflow-hidden">
      {/* Reduced Height Premium Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative shrink-0 overflow-hidden rounded-[32px] bg-slate-900 px-8 py-5 text-white shadow-2xl dark:bg-slate-950/80 backdrop-blur-xl border border-slate-800/50"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/10 via-transparent to-emerald-500/10 opacity-50" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-5">
            <button
              onClick={handleReturn}
              className="group flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 transition-all hover:bg-white/10 hover:scale-105 active:scale-95 border border-white/10"
            >
              <ArrowLeft size={18} className="text-slate-300 transition-transform group-hover:-translate-x-0.5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-black tracking-tight flex items-center gap-3">
                  <span className="bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent uppercase">Auto IC Engine</span>
                  <span className="rounded-lg bg-sky-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-sky-400 border border-sky-500/10">V2.1</span>
                </h1>
              </div>
              <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-slate-500">Automated Generation</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {[
              { label: 'Access', val: canEdit ? 'Editor' : 'Viewer', icon: ShieldCheck, color: 'sky' },
              { label: 'Preview', val: `${summaryPreview.length || 0} SKU`, icon: Database, color: 'emerald' },
              { label: 'System', val: 'Online', icon: Activity, color: 'amber' }
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-end gap-0.5 px-4 py-1.5 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-1.5 opacity-50">
                  <stat.icon size={10} className={`text-${stat.color}-400`} />
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{stat.label}</span>
                </div>
                <div className="text-[11px] font-black text-white">{stat.val}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <div className="flex-1 grid grid-cols-1 gap-6 min-h-0 lg:grid-cols-[1fr,340px]">
        {/* Main Preview Area */}
        <div className="flex min-h-0 flex-col rounded-[32px] border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900/30 backdrop-blur-md overflow-hidden transition-all duration-500">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-8 py-5 dark:border-slate-800/50 dark:bg-slate-900/40">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500 shadow-sm">
                <Database size={20} />
              </div>
              <div>
                <h2 className="text-base font-black tracking-tight text-slate-900 dark:text-white">Preview Output</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${selectedFile ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {selectedFile ? 'Data Loaded' : 'Awaiting Source'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-sky-500 transition-colors">
                  <Search size={14} />
                </div>
                <input
                  type="text"
                  placeholder="Quick search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 w-64 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-xs font-semibold text-slate-700 transition-all focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 shadow-sm"
                />
              </div>
              
              <div className="h-10 px-4 rounded-xl border border-slate-200 bg-white flex items-center gap-2 dark:border-slate-800 dark:bg-slate-950 shadow-sm">
                <Filter size={14} className="text-slate-400" />
                <span className="text-xs font-black text-slate-600 dark:text-slate-400">{filteredPreview.length} Results</span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-slate-50/30 dark:bg-slate-950/20">
            {filteredPreview.length > 0 ? (
              <div className="min-w-[820px]">
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur-md dark:bg-slate-950/95">
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      {['No', 'Scheme ID', 'Promotion Number', 'Description', 'Period From', 'Period To'].map((header, index) => (
                        <th
                          key={header}
                          className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ${
                            index === 0 ? 'w-20 text-center' : ''
                          }`}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {filteredPreview.map((row, idx) => (
                      <tr
                        key={`${row.SchemeID || 'scheme'}-${idx}`}
                        className="group bg-white/50 transition-all hover:bg-sky-50/50 dark:bg-transparent dark:hover:bg-slate-900/40"
                      >
                        <td className="px-6 py-4 text-center">
                          <span className="text-xs font-black text-slate-400 dark:text-slate-600 group-hover:text-sky-500 transition-colors">
                            {row.No || idx + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[10px] font-black text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                            {row.SchemeID || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            {row.SchemePromotionNumber || '-'}
                          </div>
                        </td>
                        <td className="max-w-md px-6 py-4">
                          <div className="truncate text-xs font-semibold text-slate-600 dark:text-slate-400" title={row.SchemeDescription}>
                            {row.SchemeDescription || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                            <CalendarClock size={14} className="text-sky-500/50" />
                            {formatDate(row.PeriodFrom)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                            <CalendarClock size={14} className="text-emerald-500/50" />
                            {formatDate(row.PeriodTo)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-12 text-center">
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mb-8 relative"
                >
                  <div className="absolute inset-0 bg-sky-500/10 blur-3xl rounded-full" />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-[32px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-sky-500 shadow-xl">
                    <FileSpreadsheet size={32} />
                  </div>
                </motion.div>
                
                <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  {searchQuery ? 'No Results Found' : 'Ready to Process'}
                </h3>
                <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium font-bold">
                  {searchQuery 
                    ? "We couldn't find any promotions matching your search. Try a different query." 
                    : "Upload your monthly IC workbook to generate a preview and export the final template."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Sidebar */}
        <div className="flex flex-col gap-5 min-h-0">
          <div className="flex-1 flex flex-col min-h-0 rounded-[32px] border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden">
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Workspace
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-between gap-3">
              {/* Upload Section */}
              <button
                onClick={handleBrowseClick}
                disabled={!canEdit || isProcessing}
                className={`group relative w-full rounded-[24px] border-2 border-dashed p-4 transition-all duration-300 ${
                  isDragOver
                    ? 'border-sky-400 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/40'
                    : 'border-slate-200 bg-slate-50/50 hover:border-sky-300 hover:bg-sky-50/50 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:border-sky-800'
                } disabled:cursor-not-allowed disabled:opacity-60 overflow-hidden shrink-0`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative flex flex-col items-center text-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-sky-500 shadow-md group-hover:scale-105 transition-transform duration-300">
                    <Upload size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-slate-900 dark:text-white">
                      {selectedFile ? 'Change Source' : 'Upload Source'}
                    </div>
                    <div className="mt-0.5 text-[9px] font-bold text-slate-500 truncate max-w-full italic px-2">
                      {selectedFile ? selectedFile.name : 'XLSX or XLS'}
                    </div>
                  </div>
                </div>
              </button>

              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />

              {/* Primary Actions Section */}
              <div className="space-y-2.5">
                <button
                  onClick={handleGenerateExport}
                  disabled={!canEdit || !selectedFile || isProcessing}
                  className="group relative flex w-full items-center justify-between overflow-hidden rounded-[20px] bg-slate-900 px-4 py-3 text-left text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-sky-500 dark:hover:bg-sky-400 dark:disabled:bg-slate-800/50 shadow-lg shadow-sky-500/10"
                >
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 border border-white/10 group-hover:bg-white/20 transition-colors">
                      {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-0.5">Process</div>
                      <div className="text-[8px] font-bold text-white/50 uppercase tracking-tighter line-clamp-1">Build Promotion Preview</div>
                    </div>
                  </div>
                  <ArrowRight size={14} className="relative z-10 mr-1 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={handleExport}
                  disabled={!canEdit || !hasProcessedData || isProcessing || isExporting}
                  className="group relative flex w-full items-center justify-between overflow-hidden rounded-[20px] bg-emerald-500 px-4 py-3 text-left text-white transition-all hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-800/30 dark:disabled:text-slate-600 shadow-lg shadow-emerald-500/20"
                >
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 border border-white/10 group-hover:bg-white/20 transition-colors">
                      {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-0.5">Export</div>
                      <div className="text-[8px] font-bold text-white/60 uppercase tracking-tighter line-clamp-1">Download Final Template</div>
                    </div>
                  </div>
                  <ArrowRight size={14} className="relative z-10 mr-1 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* Secondary Utilities Section */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={handleReset}
                  disabled={!canEdit || isProcessing}
                  className="group flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:text-white"
                >
                  <RotateCcw size={12} className="group-hover:-rotate-45 transition-transform" /> Reset
                </button>
                <button
                  onClick={() => window.open('/sample_ic.xlsx', '_blank')}
                  className="group flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-[9px] font-black uppercase tracking-widest text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:text-white"
                >
                  <FileDown size={12} className="group-hover:translate-y-0.5 transition-transform" /> Sample
                </button>
              </div>
            </div>
          </div>

          <div className={`shrink-0 rounded-3xl border p-5 shadow-lg transition-all duration-500 ${statusStyle.card}`}>
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-md">
                {renderStatusIcon()}
              </div>
              <div className="min-w-0">
                <div className={`inline-flex rounded-lg px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${statusStyle.badge}`}>
                  {logStatus.type}
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-600 dark:text-slate-300 font-bold">
                  {logStatus.message}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoGenerateMonthlyICPromotion;


function formatDate(value) {
  if (!value) return '-';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '-';
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) return trimmed;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatFileSize(size) {
  if (!size && size !== 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

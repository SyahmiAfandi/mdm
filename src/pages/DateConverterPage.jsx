import React, { useState, useCallback } from 'react';
import axios from 'axios';
import DashboardLayout from '../components/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Loader2, 
  Calendar, 
  UploadCloud, 
  FileCheck, 
  History, 
  Download, 
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Trash2,
  CalendarDays
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import toast, { Toaster } from 'react-hot-toast';

const DateConverterPage = () => {
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [selectedCols, setSelectedCols] = useState([]);
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [convertedFileUrl, setConvertedFileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [history, setHistory] = useState([]);

  const onDrop = useCallback(async (acceptedFiles) => {
    const f = acceptedFiles[0];
    if (!f) return;

    setFile(f);
    setColumns([]);
    setSelectedCols([]);
    setConvertedFileUrl('');
    setDetecting(true);

    const formData = new FormData();
    formData.append('file', f);

    try {
      const response = await axios.post('http://localhost:5000/get_columns', formData);
      setColumns(response.data.columns);
      toast.success('File uploaded and columns detected!');
    } catch (err) {
      toast.error('Failed to detect columns.');
      console.error(err);
    } finally {
      setDetecting(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    multiple: false
  });

  const toggleColumn = (col) => {
    setSelectedCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const handleClear = () => {
    setFile(null);
    setColumns([]);
    setSelectedCols([]);
    setConvertedFileUrl('');
  };

  const handleConvert = async () => {
    if (!file || selectedCols.length === 0) return;
    
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('columns', JSON.stringify(selectedCols));
    formData.append('format', dateFormat);

    try {
      const response = await axios.post('http://localhost:5000/convert_date', formData, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      setConvertedFileUrl(url);
      setHistory((prev) => [{ 
        name: file.name, 
        format: dateFormat, 
        time: new Date().toLocaleTimeString(),
        date: new Date().toLocaleDateString()
      }, ...prev]);
      toast.success('Conversion successful!');
    } catch (err) {
      toast.error('Conversion failed.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-4">
      <Toaster position="top-right" />
      
      {/* Header aligned with Admin style */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 px-6 py-5 shadow-lg relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-emerald-500/5 opacity-50" />
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between relative z-10">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-200/80 mb-1.5">Utilities / Engine</div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Calendar className="text-blue-400" size={24} />
              Date Format Converter
            </h2>
            <p className="mt-0.5 text-xs text-slate-300">
              Automated engine to transform column dates into uniform system formats.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-[58px] px-4 flex flex-col justify-center rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-blue-200/60 leading-none mb-1.5">Module</div>
              <div className="text-sm font-black text-white leading-none">Format Engine</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Interface Area */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* File Upload Section */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden relative"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <UploadCloud size={18} className="text-indigo-500" /> 1. Upload Source File
              </h3>
              {file && (
                <button 
                  onClick={handleClear}
                  className="p-1 px-2 text-[10px] font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Trash2 size={12} /> Clear Current
                </button>
              )}
            </div>

            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer ${
                isDragActive 
                  ? 'bg-blue-50/50 border-blue-500 ring-4 ring-blue-500/10' 
                  : 'bg-slate-50/50 border-slate-200 dark:border-slate-800 hover:border-indigo-400 hover:bg-slate-50'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center justify-center gap-3">
                <div className={`p-4 rounded-full transition-transform duration-500 ${isDragActive ? 'scale-110 bg-blue-500 text-white' : 'bg-white dark:bg-slate-950 text-slate-400 shadow-sm'}`}>
                  {detecting ? <Loader2 size={32} className="animate-spin" /> : <UploadCloud size={32} />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    {file ? file.name : (isDragActive ? 'Drop your file here...' : 'Drags & drop file or click to browse')}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400 font-medium">Supports .csv and .xlsx spreadsheets</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Configuration Area */}
          <AnimatePresence>
            {columns.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden"
              >
                <div className="space-y-6">
                  {/* Column Picker */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-4">
                      <CheckCircle2 size={18} className="text-emerald-500" /> 2. Map Date Columns
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {columns.map((col) => (
                        <button
                          key={col}
                          onClick={() => toggleColumn(col)}
                          className={`group relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                            selectedCols.includes(col)
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 ring-2 ring-indigo-600 ring-offset-2 dark:ring-offset-slate-900'
                              : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-transparent hover:border-indigo-200 hover:bg-slate-200'
                          }`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full transition-colors ${selectedCols.includes(col) ? 'bg-white animate-pulse' : 'bg-slate-300'}`} />
                          {col}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Format Engine */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">
                        <CalendarDays size={12} /> Target Format
                      </label>
                      <select
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-bold transition-all focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950/50 dark:focus:border-indigo-500"
                        value={dateFormat}
                        onChange={(e) => setDateFormat(e.target.value)}
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY (Standard)</option>
                        <option value="DD/MM/YYYY HH:mm:ss">Full Timestamp (24h)</option>
                        <option value="YYYY-MM-DD">ISO 8601 (YYYY-MM-DD)</option>
                        <option value="MM/DD/YYYY">US Format (MM/DD/YYYY)</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-end">
                      <button
                        onClick={handleConvert}
                        disabled={loading || selectedCols.length === 0}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                      >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                        {loading ? "Converting..." : "Run Conversion"}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Download Center */}
          <AnimatePresence>
            {convertedFileUrl && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-5 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-white/20 backdrop-blur-md">
                    <FileCheck size={24} />
                  </div>
                  <div>
                    <div className="text-sm font-black uppercase tracking-widest leading-none">Job Ready</div>
                    <p className="mt-1 text-[11px] text-indigo-100 font-bold">Successfully converted to {dateFormat}</p>
                  </div>
                </div>
                <a
                  href={convertedFileUrl}
                  download={`converted_${file?.name}`}
                  className="px-6 py-2.5 bg-white text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:bg-slate-50 hover:scale-105 active:scale-95 shadow-lg flex items-center gap-2"
                >
                  <Download size={16} /> Download Result
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Info & Side Panel */}
        <div className="space-y-4">
          {/* History Panel */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                <History size={14} className="text-indigo-500" /> Session Jobs
              </h3>
              <div className="h-5 w-5 flex items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {history.length}
              </div>
            </div>
            
            <div className="p-4 space-y-3 min-h-[300px] max-h-[600px] overflow-y-auto">
              {history.length > 0 ? (
                history.map((h, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={i} 
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 flex flex-col gap-2 group hover:border-indigo-200 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate text-xs font-bold text-slate-700 dark:text-slate-300">
                        {h.name}
                      </div>
                      <div className="shrink-0 text-[10px] font-medium text-slate-400 group-hover:text-indigo-400 transition-colors">
                        {h.time}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="px-1.5 py-0.5 rounded-md bg-white border border-slate-100 text-[9px] font-black uppercase tracking-widest text-indigo-500 dark:bg-slate-900 dark:border-slate-700">
                        {h.format}
                      </div>
                      <div className="text-[9px] font-bold text-slate-400">
                        {h.date}
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50 grayscale">
                  <div className="p-4 rounded-full bg-slate-50 dark:bg-slate-800 mb-3">
                    <History size={24} className="text-slate-300" />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400">No recent activity detected.</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-5 shadow-sm dark:border-indigo-900/20 dark:bg-indigo-950/10">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-indigo-100 text-indigo-500 shadow-sm dark:bg-slate-900 dark:border-indigo-900/30">
                <AlertCircle size={20} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 leading-none">System Info</div>
                <p className="mt-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-tight">
                  Files are processed locally and securely. Output files are cleared on session end.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DateConverterPage;

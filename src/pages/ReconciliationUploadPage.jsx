import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { BriefcaseIcon, DocumentTextIcon } from '@heroicons/react/24/solid';




function ReconciliationUploadPage() {
  const [files, setFiles] = useState([]);
  const [files1, setFilesPBI] = useState([]);
  const [showFilesOSDP, setShowFilesOSDP] = useState(true);
  const [showFilesPBI, setShowFilesPBI] = useState(true);
  const [dragActiveOSDP, setDragActiveOSDP] = useState(false);
  const [dragActivePBI, setDragActivePBI] = useState(false);
  const [droppedFilesOSDP, setDroppedFilesOSDP] = useState(0);
  const [droppedFilesPBI, setDroppedFilesPBI] = useState(0);
  const [sortedData, setSortedData] = useState([]);
  const [summaryData, setSummaryData] = useState([]);
  const [sortedDataPBI, setSortedDataPBI] = useState([]);
  const [summaryDataPBI, setSummaryDataPBI] = useState([]);
  const [error, setError] = useState(null);
  const [errorPBI, setErrorPBI] = useState(null);
  const [loadingOSDP, setLoadingOSDP] = useState(false);
  const [loadingPBI, setLoadingPBI] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const fromButton = location.state?.fromButton || '';
  const businessType = location.state?.businessType || sessionStorage.getItem('businessType') || 'N/A';
    const uploadEndpointOSDP = location.state?.uploadEndpointOSDP || '/upload_FCSHPC_OSDP';
    const uploadEndpointPBI = location.state?.uploadEndpointPBI || '/upload_FCSHPC_PBI';
    const nextPath = location.state?.nextPath || '/recons/hpc_fcs/summary';
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  

  const osdpInputRef = useRef();
  const pbiInputRef = useRef();

  const summaryColumns = ['Distributor', 'Distributor Name', 'Total Data'];

  const mergeUniqueFiles = (existing, incoming) => {
    const existingNames = new Set(existing.map(file => file.name));
    const uniqueNew = Array.from(incoming).filter(file => !existingNames.has(file.name));
    return [...existing, ...uniqueNew];
  };

  const handleRemoveFile = (index, isPBI = false) => {
    if (isPBI) {
      const updated = [...files1];
      updated.splice(index, 1);
      setFilesPBI(updated);
      setDroppedFilesPBI(updated.length);
    } else {
      const updated = [...files];
      updated.splice(index, 1);
      setFiles(updated);
      setDroppedFilesOSDP(updated.length);
    }
  };

  const handleFileChange = (e) => {
    const filesArray = Array.from(e.target.files);
    const invalid = filesArray.filter(file => !isExcelFile(file));
    if (invalid.length > 0) {
      toast.error('One or more files are not supported.\n(.xlsx or .xls only)');
      return;
    }
    const updated = mergeUniqueFiles(files, e.target.files);
    setFiles(updated);
    setDroppedFilesOSDP(updated.length);
  };


  const handleFileChangePBI = (e) => {
    const filesArray = Array.from(e.target.files);
    const invalid = filesArray.filter(file => !isExcelFile(file));
    if (invalid.length > 0) {
      toast.error('One or more files are not supported.\n(.xlsx or .xls only)');
      return;
    }
    const updated = mergeUniqueFiles(files1, e.target.files);
    setFilesPBI(updated);
    setDroppedFilesPBI(updated.length);
  };



  const handleDropOSDP = (e) => {
    e.preventDefault();
    setDragActiveOSDP(false);
    const dropped = Array.from(e.dataTransfer.files);
    const invalid = dropped.filter(file => !isExcelFile(file));
    if (invalid.length > 0) {
      toast.error('One or more files are not supported.\n(.xlsx or .xls only)');
      return;
    }
    const updated = mergeUniqueFiles(files, e.dataTransfer.files);
    setFiles(updated);
    setDroppedFilesOSDP(updated.length);
  };


  const handleDropPBI = (e) => {
    e.preventDefault();
    setDragActivePBI(false);
    const dropped = Array.from(e.dataTransfer.files);
    const invalid = dropped.filter(file => !isExcelFile(file));
    if (invalid.length > 0) {
      toast.error('One or more files are not supported.\n(.xlsx or .xls only)');
      return;
    }
    const updated = mergeUniqueFiles(files1, e.dataTransfer.files);
    setFilesPBI(updated);
    setDroppedFilesPBI(updated.length);
  };



  const handleClear = async () => {
    await axios.post(`${BACKEND_URL}/clear`);
    setSortedData([]);
    setSummaryData([]);
    setFiles([]);
    setDroppedFilesOSDP(0);
    if (osdpInputRef.current) osdpInputRef.current.value = '';
    sessionStorage.removeItem('sortedData');
    sessionStorage.removeItem('summaryData');
  };

  const handleClearPBI = async () => {
    await axios.post(`${BACKEND_URL}/clear_pbi`);
    setSortedDataPBI([]);
    setSummaryDataPBI([]);
    setFilesPBI([]);
    setDroppedFilesPBI(0);
    if (pbiInputRef.current) pbiInputRef.current.value = '';
    sessionStorage.removeItem('sortedDataPBI');
    sessionStorage.removeItem('summaryDataPBI');
  };

  const Spinner = () => (
    <div className="flex items-center gap-2 text-blue-600 mt-2">
      <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
      Uploading...
    </div>
  );

  const renderFileList = (fileArray, isPBI = false) => {
    const show = isPBI ? showFilesPBI : showFilesOSDP;
    const toggle = () => isPBI ? setShowFilesPBI(!showFilesPBI) : setShowFilesOSDP(!showFilesOSDP);
    return (
      <div>
        <motion.button
          onClick={toggle}
          whileTap={{ scale: 0.95 }}
          className="text-blue-600 text-xs font-medium mb-1 flex items-center gap-1"
        >
          {show ? 'Hide Files ▴' : 'Show Files ▾'}
        </motion.button>
        <AnimatePresence>
          {show && (
            <motion.ul
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs text-gray-700 list-disc ml-5 overflow-hidden"
            >
              {fileArray.map((file, idx) => (
                <li key={idx} className="flex items-center justify-between">
                  {file.name}
                  <button
                    onClick={() => handleRemoveFile(idx, isPBI)}
                    className="ml-2 text-red-500 hover:text-red-700 text-xs"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    );
  };


  const handleUploadOSDP = async () => {
    if (!files.length) return alert("Please choose at least one file.");
    setLoadingOSDP(true);
    setError(null);
    const formData = new FormData();
    Array.from(files).forEach(file => formData.append('files', file));
    try {
      const endpoint = location.state?.uploadEndpointOSDP || '/upload_FCSHPC_OSDP';
      const res = await axios.post(`${BACKEND_URL}${endpoint}`, formData);
      const { sorted_data, summary_data } = res.data || {};
      if (sorted_data && summary_data) {
        setSortedData(sorted_data);
        setSummaryData(summary_data);
        sessionStorage.setItem('sortedData', JSON.stringify(sorted_data));
        sessionStorage.setItem('summaryData', JSON.stringify(summary_data));
      } else {
        throw new Error("Invalid data format");
      }
    } catch (err) {
      setError("Upload failed.");
      setSortedData([]);
      setSummaryData([]);
    } finally {
      setLoadingOSDP(false);
    }
  };

  const handleUploadPBI = async () => {
    if (!files1.length) return alert("Please choose at least one file.");
    setLoadingPBI(true);
    setErrorPBI(null);
    const formData = new FormData();
    Array.from(files1).forEach(file => formData.append('files1', file));
    try {
      const endpoint = location.state?.uploadEndpointPBI || '/upload_FCSHPC_PBI ';
      const res = await axios.post(`${BACKEND_URL}${endpoint}`, formData);
      const { sorted_data_PBI, summary_data_PBI } = res.data || {};
      if (sorted_data_PBI && summary_data_PBI) {
        setSortedDataPBI(sorted_data_PBI);
        setSummaryDataPBI(summary_data_PBI);
        sessionStorage.setItem('sortedDataPBI', JSON.stringify(sorted_data_PBI));
        sessionStorage.setItem('summaryDataPBI', JSON.stringify(summary_data_PBI));
      } else {
        throw new Error("Invalid data format");
      }
    } catch (err) {
      setErrorPBI("Upload failed.");
      setSortedDataPBI([]);
      setSummaryDataPBI([]);
    } finally {
      setLoadingPBI(false);
    }
  };

const DropOverlay = ({ active }) => (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-blue-100 bg-opacity-40 flex items-center justify-center pointer-events-none"
        >
          <p className="text-blue-700 font-semibold">Drop files here...</p>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const isExcelFile = (file) =>
  file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

  useEffect(() => {
    if (fromButton) {
      sessionStorage.setItem('fromButton', fromButton);
    }
  }, [fromButton]);

  return (
    <DashboardLayout>
      {/* Navigation Buttons */}
        <div className=" flex justify-between items-center mb-6">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/recons/hpc')}
            className="px-4 py-2 bg-gray-700 text-white text-sm rounded hover:bg-gray-800 transition"
          >
            ← Back
          </motion.button>

          {/* Text at center */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
            className="border border-gray-300 bg-gray-50 rounded-md px-4 py-2 flex gap-6 items-center text-sm"
          >
            <div className="flex items-center gap-2">
              <BriefcaseIcon className="w-3.5 h-3.5 text-green-700" />
              <span className="font-medium text-gray-600">Business Type:</span>
              <span className="inline-block px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 font-semibold">
                {businessType}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <DocumentTextIcon className="w-3.5 h-3.5 text-blue-700" />
              <span className="font-medium text-gray-600">Report Type:</span>
              <span className="inline-block px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 font-semibold">
                {fromButton}
              </span>
            </div>
          </motion.div>




          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() =>
              navigate('/recons/hpc_fcs/summary', {
                state: {
                  sortedData,
                  sortedDataPBI,
                  fromButton,
                  businessType
                }
              })
            }
            className={`px-4 py-2 text-white text-sm rounded ${summaryData.length === 0 || summaryDataPBI.length === 0 ? 'bg-gray-500 cursor-not-allowed' : 'bg-gray-800 hover:bg-gray-600'}`}
            disabled={summaryData.length === 0 || summaryDataPBI.length === 0}
          >
            Next →
          </motion.button>
        </div>
      <div className="p-8 relative min-h-[calc(100vh-88px)] pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* OSDP Upload Section */}
          <motion.div
            initial={{ scale: 1 }}
            animate={dragActiveOSDP ? { scale: 1.02, boxShadow: '0 0 0.5rem rgba(59,130,246,0.5)' } : { scale: 1, boxShadow: 'none' }}
            transition={{ duration: 0.2 }}
            className="relative p-5 border border-gray-400 rounded shadow-md bg-white"
            onDragOver={(e) => { e.preventDefault(); setDragActiveOSDP(true); }}
            onDragLeave={() => setDragActiveOSDP(false)}
            onDrop={handleDropOSDP}
          >
            <DropOverlay active={dragActiveOSDP} />
            <h2 className="text-xl font-semibold mb-4">Upload OSDP Files</h2>
            <input ref={osdpInputRef} type="file" multiple accept=".xlsx,.xls" onChange={handleFileChange} className="block w-full text-sm mb-2" />
            {droppedFilesOSDP > 0 ? (
              <p className="text-green-600 text-sm mb-2">{droppedFilesOSDP} file(s) dropped here</p>
            ) : (
              <p className="text-sm text-gray-500 mb-2">Or drop files here</p>
            )}
            <AnimatePresence>
              {files.length > 0 && (
                <motion.div
                  key="osdp-filelist"
                  initial={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {renderFileList(files, false)}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {(files.length > 0 || droppedFilesOSDP > 0) && (
                <motion.div
                  key="osdp-buttons"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-wrap gap-2 mt-4"
                >
                  <button
                    onClick={handleUploadOSDP}
                    disabled={loadingOSDP}
                    className={`px-4 py-2 rounded text-white ${loadingOSDP ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}
                  >
                    {loadingOSDP ? 'Uploading...' : 'Upload'}
                  </button>
                  <button
                    onClick={handleClear}
                    disabled={loadingOSDP}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-500"
                  >
                    Clear Data
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {loadingOSDP && <Spinner />}
            {error && <p className="text-red-600 mt-2">{error}</p>}
            {summaryData.length > 0 && (
              <div>
                <h3 className="font-bold mt-6 mb-2">Summary Data</h3>
                <table className="w-full table-auto border mt-5 text-sm">
                  <thead>
                    <tr>{summaryColumns.map((key, i) => <th key={i} className="border px-2 py-1">{key}</th>)}</tr>
                  </thead>
                  <tbody>
                    {summaryData.map((row, i) => (
                      <tr key={i}>{summaryColumns.map((key, j) => <td key={j} className="border px-2 py-1">{row[key]}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
                {/*<button onClick={() => navigate('/detailed-view', { state: { sortedData } })} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-500">View Detailed Data</button>*/}
              </div>
            )}
          </motion.div>

          {/* PBI Upload Section */}
          <motion.div
            initial={{ scale: 1 }}
            animate={dragActivePBI ? { scale: 1.02, boxShadow: '0 0 0.5rem rgba(59,130,246,0.5)' } : { scale: 1, boxShadow: 'none' }}
            transition={{ duration: 0.2 }}
            className="relative p-5 border border-gray-400 rounded shadow-md bg-white"
            onDragOver={(e) => { e.preventDefault(); setDragActivePBI(true); }}
            onDragLeave={() => setDragActivePBI(false)}
            onDrop={handleDropPBI}
          >
            <DropOverlay active={dragActivePBI} />
            <h2 className="text-xl font-semibold mb-4">Upload Power BI Files</h2>
            <input ref={pbiInputRef} type="file" multiple accept=".xlsx,.xls" onChange={handleFileChangePBI} className="block w-full text-sm mb-2" />
            {droppedFilesPBI > 0 ? (
              <p className="text-green-600 text-sm mb-2">{droppedFilesPBI} file(s) dropped here</p>
            ) : (
              <p className="text-sm text-gray-500 mb-2">Or drop files here</p>
            )}
            <AnimatePresence>
            {files1.length > 0 && (
              <motion.div
                key="pbi-filelist"
                initial={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {renderFileList(files1, true)}
              </motion.div>
            )}
          </AnimatePresence>

            <AnimatePresence>
              {(files1.length > 0 || droppedFilesPBI > 0) && (
                <motion.div
                  key="pbi-buttons"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-wrap gap-2 mt-4"
                >
                  <button
                    onClick={handleUploadPBI}
                    disabled={loadingPBI}
                    className={`px-4 py-2 rounded text-white ${loadingPBI ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}
                  >
                    {loadingPBI ? 'Uploading...' : 'Upload'}
                  </button>
                  <button
                    onClick={handleClearPBI}
                    disabled={loadingPBI}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-500"
                  >
                    Clear Data
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {loadingPBI && <Spinner />}
            {errorPBI && <p className="text-red-600 mt-2">{errorPBI}</p>}
            {summaryDataPBI.length > 0 && (
              <div>
                <h3 className="font-bold mt-6 mb-2">Summary Data</h3>
                <table className="w-full table-auto border mt-5 text-sm">
                  <thead>
                    <tr>{summaryColumns.map((key, i) => <th key={i} className="border px-2 py-1">{key}</th>)}</tr>
                  </thead>
                  <tbody>
                    {summaryDataPBI.map((row, i) => (
                      <tr key={i}>{summaryColumns.map((key, j) => <td key={j} className="border px-2 py-1">{row[key]}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </div>
        
      </div>
    </DashboardLayout>
  );
}

export default ReconciliationUploadPage;
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
  const [summaryData, setSummaryData] = useState([]);
  const [summaryDataPBI, setSummaryDataPBI] = useState([]);
  const [error, setError] = useState(null);
  const [errorPBI, setErrorPBI] = useState(null);
  const [loadingOSDP, setLoadingOSDP] = useState(false);
  const [loadingPBI, setLoadingPBI] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const fromButton = location.state?.fromButton || '';
  const businessType = location.state?.businessType || 'N/A';
  const uploadEndpointOSDP = location.state?.uploadEndpointOSDP || '';
  const uploadEndpointPBI = location.state?.uploadEndpointPBI || '';
  const backPath = location.state?.backPath || '/recons/hpc';
  const nextPath = location.state?.nextPath || '/recons/hpc_fcs/summary';

  const osdpInputRef = useRef();
  const pbiInputRef = useRef();

  const summaryColumns = ['Distributor', 'Distributor Name', 'Total Data'];

  const mergeUniqueFiles = (existing, incoming) => {
    const existingNames = new Set(existing.map(file => file.name));
    return [...existing, ...Array.from(incoming).filter(file => !existingNames.has(file.name))];
  };

  const isExcelFile = file => file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

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

  const renderFileList = (fileArray, isPBI = false) => {
    const show = isPBI ? showFilesPBI : showFilesOSDP;
    const toggle = () => isPBI ? setShowFilesPBI(!show) : setShowFilesOSDP(!show);
    return (
      <div>
        <motion.button onClick={toggle} whileTap={{ scale: 0.95 }} className="text-blue-600 text-xs font-medium mb-1 flex items-center gap-1">
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
                  <button onClick={() => handleRemoveFile(idx, isPBI)} className="ml-2 text-red-500 hover:text-red-700 text-xs">✕</button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const handleRemoveFile = (index, isPBI = false) => {
    const updated = isPBI ? [...files1] : [...files];
    updated.splice(index, 1);
    isPBI ? setFilesPBI(updated) : setFiles(updated);
  };

  const handleFileChange = (e, isPBI = false) => {
    const fileArray = Array.from(e.target.files);
    const invalid = fileArray.filter(file => !isExcelFile(file));
    if (invalid.length > 0) return toast.error('Only .xlsx/.xls files are supported');
    const updated = mergeUniqueFiles(isPBI ? files1 : files, fileArray);
    isPBI ? setFilesPBI(updated) : setFiles(updated);
  };

  const handleDrop = (e, isPBI = false) => {
    e.preventDefault();
    isPBI ? setDragActivePBI(false) : setDragActiveOSDP(false);
    const dropped = Array.from(e.dataTransfer.files);
    const invalid = dropped.filter(file => !isExcelFile(file));
    if (invalid.length > 0) return toast.error('Only .xlsx/.xls files are supported');
    const updated = mergeUniqueFiles(isPBI ? files1 : files, dropped);
    isPBI ? setFilesPBI(updated) : setFiles(updated);
  };

  const handleClear = async (isPBI = false) => {
    const url = isPBI ? '/clear_pbi' : '/clear';
    await axios.post(`http://localhost:5000${url}`);
    isPBI ? setFilesPBI([]) : setFiles([]);
    isPBI ? setSummaryDataPBI([]) : setSummaryData([]);
    if ((isPBI ? pbiInputRef : osdpInputRef).current) (isPBI ? pbiInputRef : osdpInputRef).current.value = '';
    sessionStorage.removeItem(isPBI ? 'sortedDataPBI' : 'sortedData');
    sessionStorage.removeItem(isPBI ? 'summaryDataPBI' : 'summaryData');
  };

  const handleUpload = async (isPBI = false) => {
    const url = isPBI ? uploadEndpointPBI : uploadEndpointOSDP;
    const filesToUpload = isPBI ? files1 : files;
    if (!filesToUpload.length) return alert("Please choose at least one file.");

    isPBI ? setLoadingPBI(true) : setLoadingOSDP(true);
    const formData = new FormData();
    filesToUpload.forEach(file => formData.append(isPBI ? 'files1' : 'files', file));
    try {
      const res = await axios.post(`http://localhost:5000${url}`, formData);
      const sortedKey = isPBI ? 'sorted_data_PBI' : 'sorted_data';
      const summaryKey = isPBI ? 'summary_data_PBI' : 'summary_data';
      const sorted = res.data?.[sortedKey] || [];
      const summary = res.data?.[summaryKey] || [];
      isPBI ? setSummaryDataPBI(summary) : setSummaryData(summary);
      sessionStorage.setItem(isPBI ? 'sortedDataPBI' : 'sortedData', JSON.stringify(sorted));
      sessionStorage.setItem(isPBI ? 'summaryDataPBI' : 'summaryData', JSON.stringify(summary));
    } catch (err) {
      isPBI ? setErrorPBI('Upload failed.') : setError('Upload failed.');
    } finally {
      isPBI ? setLoadingPBI(false) : setLoadingOSDP(false);
    }
  };

  useEffect(() => {
    if (fromButton) sessionStorage.setItem('fromButton', fromButton);
  }, [fromButton]);

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => navigate(backPath)} className="px-4 py-2 bg-gray-700 text-white text-sm rounded hover:bg-gray-800 transition">
          ← Back
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
          className="border border-gray-300 bg-gray-50 rounded-md px-4 py-2 flex gap-6 items-center text-sm"
        >
          <div className="flex items-center gap-2">
            <BriefcaseIcon className="w-3.5 h-3.5 text-green-700" />
            <span className="font-medium text-gray-600">Business Type:</span>
            <span className="inline-block px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 font-semibold">{businessType}</span>
          </div>
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="w-3.5 h-3.5 text-blue-700" />
            <span className="font-medium text-gray-600">Report Type:</span>
            <span className="inline-block px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 font-semibold">{fromButton}</span>
          </div>
        </motion.div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate(nextPath, { state: { fromButton, businessType } })}
          className={`px-4 py-2 text-white text-sm rounded ${summaryData.length === 0 || summaryDataPBI.length === 0 ? 'bg-gray-500 cursor-not-allowed' : 'bg-gray-800 hover:bg-gray-600'}`}
          disabled={summaryData.length === 0 || summaryDataPBI.length === 0}
        >
          Next →
        </motion.button>
      </div>

      <div className="p-8 relative min-h-[calc(100vh-88px)] pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[false, true].map(isPBI => (
            <motion.div
              key={isPBI ? 'pbi' : 'osdp'}
              initial={{ scale: 1 }}
              animate={(isPBI ? dragActivePBI : dragActiveOSDP) ? { scale: 1.02, boxShadow: '0 0 0.5rem rgba(59,130,246,0.5)' } : { scale: 1, boxShadow: 'none' }}
              transition={{ duration: 0.2 }}
              className="relative p-5 border border-gray-400 rounded shadow-md bg-white"
              onDragOver={e => { e.preventDefault(); isPBI ? setDragActivePBI(true) : setDragActiveOSDP(true); }}
              onDragLeave={() => isPBI ? setDragActivePBI(false) : setDragActiveOSDP(false)}
              onDrop={e => handleDrop(e, isPBI)}
            >
              <DropOverlay active={isPBI ? dragActivePBI : dragActiveOSDP} />
              <h2 className="text-xl font-semibold mb-4">Upload {isPBI ? 'Power BI' : 'OSDP'} Files</h2>
              <input ref={isPBI ? pbiInputRef : osdpInputRef} type="file" multiple accept=".xlsx,.xls" onChange={e => handleFileChange(e, isPBI)} className="block w-full text-sm mb-2" />
              {renderFileList(isPBI ? files1 : files, isPBI)}

              {(isPBI ? files1.length : files.length) > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  <button onClick={() => handleUpload(isPBI)} disabled={isPBI ? loadingPBI : loadingOSDP} className={`px-4 py-2 rounded text-white ${isPBI ? loadingPBI : loadingOSDP ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-500'}`}>Upload</button>
                  <button onClick={() => handleClear(isPBI)} disabled={isPBI ? loadingPBI : loadingOSDP} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-500">Clear Data</button>
                </div>
              )}

              {(isPBI ? loadingPBI : loadingOSDP) && (
                <div className="flex items-center gap-2 text-blue-600 mt-2">
                  <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Uploading...
                </div>
              )}
              {(isPBI ? errorPBI : error) && <p className="text-red-600 mt-2">{isPBI ? errorPBI : error}</p>}
              {(isPBI ? summaryDataPBI : summaryData).length > 0 && (
                <div>
                  <h3 className="font-bold mt-6 mb-2">Summary Data</h3>
                  <table className="w-full table-auto border mt-5 text-sm">
                    <thead>
                      <tr>{summaryColumns.map((key, i) => <th key={i} className="border px-2 py-1">{key}</th>)}</tr>
                    </thead>
                    <tbody>
                      {(isPBI ? summaryDataPBI : summaryData).map((row, i) => (
                        <tr key={i}>{summaryColumns.map((key, j) => <td key={j} className="border px-2 py-1">{row[key]}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default ReconciliationUploadPage;
// AutoGenerateMonthlyICPromotion.jsx

import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { Upload, RotateCcw, FileDown, ArrowLeft } from 'lucide-react';
import { APP_FULL_NAME } from '../config';

function AutoGenerateMonthlyICPromotion() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const [isExporting, setIsExporting] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [logMessage, setLogMessage] = useState(
    'No file imported. Please upload your Monthly IC Promotion source file.'
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [summaryPreview, setSummaryPreview] = useState([]); // preview ic_main_out from backend

  const handleBrowseClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleExport = async () => {
  try {
    setIsExporting(true);
    setLogMessage('Preparing IC Promo Template for download...');

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

    setLogMessage('IC Promo Template exported successfully.');
  } catch (error) {
    console.error(error);
    setLogMessage(`Export error: ${error.message || 'Unexpected error.'}`);
  } finally {
    setIsExporting(false);
  }
};


  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setSummaryPreview([]);
    setLogMessage(`File selected: ${file.name}. Click "Generate & Export" to process.`);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setSummaryPreview([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setLogMessage('Form reset. No file imported.');
    setIsProcessing(false);
  };

  const handleGenerateExport = async () => {
    if (!selectedFile) {
      setLogMessage('Please import a file before generating the promotion.');
      return;
    }

    try {
      setIsProcessing(true);
      setLogMessage(`Uploading and processing "${selectedFile.name}"...`);

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
      console.log("✅ Backend response:", data); // <---- add this
      // data.summary_preview / data.summary_rows from backend
      setSummaryPreview(data.summary_preview || []);
      setLogMessage(
        `Processed successfully. ${data.summary_rows || 0} promotions ready in temporary database.`
      );
    } catch (error) {
      console.error(error);
      setLogMessage(
        `Failed to process file: ${error.message || 'Unexpected error.'}`
      );
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
    if (isNaN(d)) return val; // keep text if not a valid date
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <DashboardLayout
      pageTitle={APP_FULL_NAME}  breadcrumbs={['Tools', 'Promotions', 'Auto Generate (IC Promotions)']}>
      <div className="flex flex-col min-h-[calc(100vh-75px)] px-6 pt-6 pb-4">
        {/* Title */}
        <h1 className="text-3xl font-semibold text-gray-900 mb-4">
          Auto Generate: Monthly IC Promotion
        </h1>

        {/* Main Workspace Box */}
        <div className="flex-1 border border-gray-300 rounded-md bg-white shadow-sm mb-6">
          <div className="h-full w-full flex flex-col justify-between">
            {/* Preview area (optional simple table) */}
            <div className="flex-1 overflow-auto p-4">
              {summaryPreview.length > 0 ? (
                <table className="min-w-full text-xs border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {["No", "SchemeID", "SchemePromotionNumber", "SchemeDescription", "PeriodFrom", "PeriodTo"].map((header) => (
                        <th
                          key={header}
                          className="px-2 py-1 text-left font-semibold border-b border-gray-200"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summaryPreview.map((row, idx) => (
                      <tr key={idx} className="even:bg-gray-50">
                        {[
                          row.No,
                          row.SchemeID,
                          row.SchemePromotionNumber,
                          row.SchemeDescription,
                          formatDate(row.PeriodFrom),
                          formatDate(row.PeriodTo),
                        ].map((value, colIdx) => (
                          <td key={colIdx} className="px-2 py-1 border-b border-gray-100">
                            {value ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-300 text-sm">
                  Auto-generated promotions summary will appear here after processing.
                </div>
              )}
            </div>

            {/* Status bar */}
            <div className="px-4 py-3 text-xs text-gray-600 border-t border-gray-100 bg-gray-50 flex items-center">
              <span>{logMessage}</span>
              {selectedFile && !isProcessing && (
                <span className="ml-2 inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                  Ready to generate
                </span>
              )}
              {isProcessing && (
                <span className="ml-2 inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  Processing...
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="flex items-center justify-between">
          {/* Left buttons group */}
          <div className="flex items-center gap-4">
            {/* Import File */}
            <button
              onClick={handleBrowseClick}
              className="flex items-center gap-2 px-6 py-3 border border-gray-400 rounded-md bg-white hover:bg-gray-50 active:scale-[0.98] transition text-sm"
              disabled={isProcessing}
            >
              <Upload className="w-4 h-4" />
              <span>Import File</span>
            </button>

            <input
              type="file"
              accept=".xlsx,.xls"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Generate & Export (actually: generate + store in pandas) */}
            <button
              onClick={handleGenerateExport}
              className="flex items-center gap-2 px-6 py-3 rounded-md bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-sm transition text-sm disabled:opacity-60"
              disabled={!selectedFile || isProcessing}
            >
              <FileDown className="w-4 h-4" />
              <span>
                {isProcessing ? 'Processing...' : 'Generate & Store Temp'}
              </span>
            </button>

            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-6 py-3 rounded-md bg-green-600 text-white hover:bg-green-700 active:scale-[0.98] shadow-sm transition text-sm disabled:opacity-60"
              disabled={isProcessing || isExporting}
            >
              <FileDown className="w-4 h-4" />
              <span>{isExporting ? 'Exporting...' : 'Export IC Template'}</span>
            </button>

            {/* Reset */}
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-8 py-3 rounded-md bg-gray-100 hover:bg-gray-200 border border-gray-300 active:scale-[0.98] transition text-sm"
              disabled={isProcessing}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
          </div>

          {/* Return button on right */}
          <button
            onClick={handleReturn}
            className="flex items-center gap-2 px-8 py-3 rounded-md bg-gray-100 hover:bg-gray-200 border border-gray-300 active:scale-[0.98] transition text-sm"
            disabled={isProcessing}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return</span>
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default AutoGenerateMonthlyICPromotion;

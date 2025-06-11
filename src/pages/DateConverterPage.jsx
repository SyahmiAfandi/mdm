import React, { useState, useCallback } from 'react';
import axios from 'axios';
import DashboardLayout from '../components/DashboardLayout';
import Button from '../components/ui/Button';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import toast, { Toaster } from 'react-hot-toast';

const DateConverterPage = () => {
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [selectedCols, setSelectedCols] = useState([]);
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [convertedFileUrl, setConvertedFileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const onDrop = useCallback(async (acceptedFiles) => {
    const f = acceptedFiles[0];
    setFile(f);
    setColumns([]);
    setSelectedCols([]);
    setConvertedFileUrl('');

    const formData = new FormData();
    formData.append('file', f);

    try {
      const response = await axios.post('http://localhost:5000/get_columns', formData);
      setColumns(response.data.columns);
      toast.success('File uploaded and columns detected!');
    } catch (err) {
      toast.error('Failed to detect columns.');
      console.error(err);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: '.csv,.xlsx' });

  const toggleColumn = (col) => {
    setSelectedCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const handleConvert = async () => {
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
      setHistory((prev) => [...prev, { name: file.name, format: dateFormat, time: new Date().toLocaleString() }]);
      toast.success('Conversion successful!');
    } catch (err) {
      toast.error('Conversion failed.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <Toaster position="top-right" />
      <motion.div
        className="p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl font-bold mb-2">🗓️ Date Converter</h2>
        <p className="text-sm text-gray-600 mb-6">Convert specific columns to your preferred date format</p>

        {/* 🔽 Drag-and-drop area */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-6 text-center mb-6 transition ${
            isDragActive ? 'bg-blue-50 border-blue-500' : 'bg-white'
          }`}
        >
          <input {...getInputProps()} />
          <p className="text-sm text-gray-600">
            {isDragActive ? 'Drop your file here...' : 'Drag & drop a .csv or .xlsx file here, or click to select'}
          </p>
        </div>

        {file && (
          <p className="mb-4 text-sm text-gray-700">
            📄 <strong>Uploaded:</strong> {file.name}
          </p>
        )}

        {columns.length > 0 && (
          <motion.div className="mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="font-semibold mb-2">✅ Select Date Columns:</p>
            <div className="flex flex-wrap gap-2">
              {columns.map((col) => (
                <button
                  key={col}
                  onClick={() => toggleColumn(col)}
                  className={`px-3 py-1 rounded-xl border text-sm transition-all duration-200 ${
                    selectedCols.includes(col)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-800 hover:bg-blue-100'
                  }`}
                >
                  {col}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        <div className="mb-6">
          <label className="font-semibold mr-2">🕒 Output Format:</label>
          <select
            className="border rounded px-2 py-1"
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value)}
          >
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="DD/MM/YYYY HH:mm:ss">DD/MM/YYYY HH:mm:ss</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>

        <div className="mb-6">
          <Button
            onClick={handleConvert}
            disabled={!file || selectedCols.length === 0 || loading}
            className="flex items-center gap-2"
          >
            {loading && <Loader2 className="animate-spin w-4 h-4" />}
            {loading ? 'Converting...' : 'Convert & Download'}
          </Button>
        </div>

        {convertedFileUrl && (
          <motion.a
            href={convertedFileUrl}
            download="converted.xlsx"
            className="text-blue-600 underline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            📥 Download Converted File
          </motion.a>
        )}

        {/* 📜 Conversion History */}
        {history.length > 0 && (
          <div className="mt-10">
            <h3 className="text-lg font-semibold mb-2">🧾 Conversion History</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border rounded">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-4 py-2 text-left">File Name</th>
                    <th className="border px-4 py-2 text-left">Format</th>
                    <th className="border px-4 py-2 text-left">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-4 py-2">{h.name}</td>
                      <td className="px-4 py-2">{h.format}</td>
                      <td className="px-4 py-2">{h.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
};

export default DateConverterPage;

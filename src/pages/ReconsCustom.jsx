import React, { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { APP_FULL_NAME } from '../config';

const stepTitles = [
  'Import Source Data',
  'Import Comparison Data',
  'Match Columns',
  'View Reconciliation Results'
];

function CustomReconcilePage() {
  const [step, setStep] = useState(0);

  // State for both reports
  const [file1, setFile1] = useState(null);
  const [cleanedData1, setCleanedData1] = useState(null);

  const [file2, setFile2] = useState(null);
  const [cleanedData2, setCleanedData2] = useState(null);

  // Mapping and results
  const [columnMap, setColumnMap] = useState({});
  const [result, setResult] = useState(null);

  const handleFile1Change = (e) => setFile1(e.target.files[0]);
  const handleFile2Change = (e) => setFile2(e.target.files[0]);
  const handleClean1 = () => {
    setCleanedData1({ cleaned: true, name: file1.name });
    setStep(step + 1);
  };
  const handleClean2 = () => {
    setCleanedData2({ cleaned: true, name: file2.name });
    setStep(step + 1);
  };

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <div>
            <div className="mb-4 text-lg font-semibold">
              Step 1: Upload & Review Source Report
            </div>
            <div className="mb-2 text-gray-600">
              Select the first file to reconcile as your source data. Review and clean the data if needed before continuing.
            </div>
            <input type="file" accept=".xlsx,.csv" onChange={handleFile1Change} />
            {file1 && (
              <div className="mt-2">
                Selected file: <strong>{file1.name}</strong>
                <div className="mt-2 text-gray-500">
                  Preview and clean your data below (remove blank rows, fix headers, etc).
                </div>
              </div>
            )}
            <button
              disabled={!file1}
              className="mt-6 px-6 py-2 rounded bg-blue-600 text-white font-bold shadow"
              onClick={handleClean1}
            >
              Continue to Comparison Report
            </button>
          </div>
        );
      case 1:
        return (
          <div>
            <div className="mb-4 text-lg font-semibold">
              Step 2: Upload & Review Comparison Report
            </div>
            <div className="mb-2 text-gray-600">
              Select the second file as your comparison data. Review and clean the data if needed before continuing.
            </div>
            <input type="file" accept=".xlsx,.csv" onChange={handleFile2Change} />
            {file2 && (
              <div className="mt-2">
                Selected file: <strong>{file2.name}</strong>
                <div className="mt-2 text-gray-500">
                  Preview and clean your data below (remove blank rows, fix headers, etc).
                </div>
              </div>
            )}
            <button
              className="mr-2 mt-6 px-4 py-2 rounded bg-gray-400 text-white"
              onClick={() => setStep(0)}
            >Back to Source Report</button>
            <button
              disabled={!file2}
              className="mt-6 px-6 py-2 rounded bg-blue-600 text-white font-bold shadow"
              onClick={handleClean2}
            >
              Continue to Column Matching
            </button>
          </div>
        );
      case 2:
        return (
          <div>
            <div className="mb-4 text-lg font-semibold">
              Step 3: Match Columns
            </div>
            <div className="mb-2 text-gray-600">
              Map columns from both reports to align the data for reconciliation.
            </div>
            <div>[Column mapping UI here]</div>
            <button
              className="mr-2 mt-6 px-4 py-2 rounded bg-gray-400 text-white"
              onClick={() => setStep(1)}
            >Back to Comparison Report</button>
            <button
              className="mt-6 px-6 py-2 rounded bg-blue-600 text-white font-bold shadow"
              onClick={() => setStep(3)}
            >
              Continue to Results
            </button>
          </div>
        );
      case 3:
        return (
          <div>
            <div className="mb-4 text-lg font-semibold">
              Step 4: View Reconciliation Results
            </div>
            <div className="mb-2 text-gray-600">
              Review matched and unmatched records below.
            </div>
            <div>[Show matches, mismatches here]</div>
            <button
              className="mr-2 mt-6 px-4 py-2 rounded bg-gray-400 text-white"
              onClick={() => setStep(2)}
            >Back to Column Matching</button>
            <button
              className="mt-6 px-6 py-2 rounded bg-green-600 text-white font-bold shadow"
              onClick={() => window.location.reload()}
            >Restart</button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <DashboardLayout pageTitle={APP_FULL_NAME} breadcrumbs={["Tools","Reconciliation Tools","Custom Reports"]}>
    <div className="max-w-3xl mx-auto py-10 px-4">
      {/* Stepper */}
      <div className="flex justify-between mb-8">
        {stepTitles.map((title, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center">
            <div className={`w-8 h-8 flex items-center justify-center rounded-full border-2 
              ${step === idx 
                ? 'bg-blue-600 text-white border-blue-600'
                : step > idx 
                  ? 'bg-blue-100 text-blue-700 border-blue-600'
                  : 'bg-white border-gray-300 text-gray-400'}`}>
              {idx + 1}
            </div>
            <div className={`text-xs mt-2 text-center 
              ${step === idx ? 'text-blue-600 font-bold'
                : step > idx ? 'text-blue-400'
                : 'text-gray-400'}`}>
              {title}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-white shadow p-8 min-h-[250px]">
        {renderStepContent()}
      </div>
    </div>
    </DashboardLayout>
  );
}

export default CustomReconcilePage;

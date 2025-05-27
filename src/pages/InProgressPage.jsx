import React from 'react';
import { useNavigate } from 'react-router-dom';

function InProgressPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center p-6">
      <h1 className="text-4xl font-bold text-gray-800 mb-4">🚧 Page in Progress</h1>
      <p className="text-gray-600 text-lg mb-6">
        This function or page is still under development. Please check back soon.
      </p>
      <button
        onClick={() => navigate(-1)}
        className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition"
      >
        ← Go Back
      </button>
    </div>
  );
}

export default InProgressPage;

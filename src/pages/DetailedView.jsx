import React, { useEffect, useState, Suspense, lazy } from 'react';
import axios from 'axios';
import { 
  Link,
  BrowserRouter as Router, 
  Routes, 
  Route, 
  useNavigate,
  useLocation 
} from 'react-router-dom';

// Detailed View Page Component
function DetailedView() {
  const navigate = useNavigate();
  const location = useLocation();
  const columnOrder = ['Distributor', 'Distributor Name', 'Sales Route', 'No Of Active Shop in PJP Covered', 'ECO Actual', '% ECO'];

  // Get data from navigation state or sessionStorage
  const [sortedData] = useState(() => {
    const navData = location.state?.sortedData;
    const savedData = sessionStorage.getItem('sortedData');
    return navData || (savedData ? JSON.parse(savedData) : []);
  });

  return (
    <div style={{ padding: '20px' }}>
      <h2>Detailed Data View</h2>
      <button 
        onClick={() => navigate('/upload', { state: { sortedData } })}
        style={{ marginBottom: '20px' }}
      >
        Back to Summary
      </button>
      
      {sortedData.length > 0 ? (
        <table border="1" cellPadding="10">
          <thead>
            <tr>
              {columnOrder.map((key, i) => (
                <th key={i}>{key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, i) => (
              <tr key={i}>
                {columnOrder.map((key, j) => (
                  <td key={j}>{row[key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No detailed data available. Please upload files first.</p>
      )}
    </div>
  );
}

export default DetailedView;
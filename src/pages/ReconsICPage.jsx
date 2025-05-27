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

//Recons Reports IC
function ReconsICPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  const topButtons = [
    { label: 'Daily Sales Summary', path: '/dss' },
    { label: 'EFOS Outlet', path: '/sales-summary' },
    { label: 'EFOS Salesman', path: '/coverage-map' },
  ];

  const bottomButtons = [
    { label: 'FCS IC', path: '/distributor' },
    { label: 'IC IQ Performance', path: '/reports' },
  ];

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="page-wrapper">
      <button className="back-button" onClick={() => navigate('/recons')}>
        ← Back
      </button>

      <div className="page-content">
        <h2>Reconciliation Tools</h2>
        <p>Please choose type of reports that want to be reconcile:</p>

        <div className="button-section">
          <div className="top-button-grid">
            {topButtons.map((btn, i) => (
              <button
                key={i}
                className={`gray-button ${mounted ? 'fade-up' : ''}`}
                style={{ animationDelay: `${i * 0.1}s` }}
                onClick={() => navigate(btn.path)}
              >
                <span className="label">{btn.label}</span>
              </button>
            ))}
          </div>

          <div className="bottom-button-row">
            {bottomButtons.map((btn, i) => (
              <button
                key={i}
                className={`gray-button ${mounted ? 'fade-up' : ''}`}
                style={{ animationDelay: `${(topButtons.length + i) * 0.1}s` }}
                onClick={() => navigate(btn.path)}
              >
                <span className="label">{btn.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .page-wrapper {
          padding: 20px;
          position: relative;
          height: calc(100vh - 80px);
          box-sizing: border-box;
        }

        .back-button {
          position: fixed;
          bottom: 20px;
          left: 20px;
          padding: 10px 20px;
          font-size: 16px;
          background-color: #444;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.3s ease;
          z-index: 1000;
        }

        .back-button:hover {
          background-color: #222;
        }

        .page-content {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 30px;
        }

        h2 {
          margin-bottom: 8px;
        }

        p {
          margin-bottom: 20px;
        }

        .button-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .top-button-grid {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 16px;
        }

        .bottom-button-row {
          display: flex;
          justify-content: center;
          gap: 16px;
        }

        .gray-button {
          width: 180px;
          height: 100px;
          font-size: 18px;
          padding: 12px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(145deg, #cfcfcf, #e6e6e6);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 6px 14px rgba(0,0,0,0.12);
          transition: transform 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease;
          opacity: 0;
          transform: translateY(30px);
          animation: fadeUp 0.6s forwards ease-in-out;
        }

        .gray-button:hover {
          background: linear-gradient(145deg, #f0f0f0, #d8d8d8);
          transform: translateY(-5px) scale(1.03);
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.2);
        }

        .label {
          color: #333;
          font-weight: bold;
          font-size: 18px;
          transition: transform 0.3s ease;
        }

        .gray-button:hover .label {
          transform: scale(1.05);
        }

        @keyframes fadeUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 768px) {
          .top-button-grid,
          .bottom-button-row {
            flex-direction: column;
            align-items: center;
          }

          .gray-button {
            width: 90%;
            max-width: 300px;
          }
        }
      `}</style>
    </div>
  );
}

export default ReconsICPage;
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMediaQuery } from 'react-responsive';


// Soft pastel color gradients for each button
const BUTTON_COLORS = [
  'from-rose-200 to-rose-100',     // Daily Sales Summary
  'from-sky-200 to-blue-100',      // EFOS Outlet
  'from-emerald-100 to-teal-100',  // EFOS Salesman
  'from-amber-100 to-yellow-100',  // FCS IC
  'from-indigo-100 to-purple-100', // IC IQ Performance
  'from-orange-100 to-orange-50',  // Raw Data Invoice Level
];

function ReconsICPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState(null);
  const isMobile = useMediaQuery({ query: '(max-width: 768px)' });
  const location = useLocation();
  const businessType = location.state?.businessType || sessionStorage.getItem('businessType') || 'N/A';

  const buttons = [
    {
      label: 'Daily Sales Summary',
      path: '/recons/upload',
      color: BUTTON_COLORS[0],
      state: {
        fromButton: 'Daily Sales Summary',
        businessType,
        uploadEndpointOSDP: '/upload_ICDSS_OSDP',
        uploadEndpointPBI: '/upload_ICDSS_PBI',
        backPath: '/recons/ic',
        nextPath: '/recons/summary',
      },
    },
    {
      label: 'EFOS Outlet',
      path: '/recons/upload',
      color: BUTTON_COLORS[1],
      state: {
        fromButton: 'EFOS Outlet',
        businessType,
        uploadEndpointOSDP: '/upload_ICEFOSOUTLET_OSDP',
        uploadEndpointPBI: '/upload_ICEFOSOUTLET_PBI',
        backPath: '/recons/ic',
        nextPath: '/recons/summary',
      },
    },
    {
      label: 'EFOS Salesman',
      path: '/recons/upload',
      color: BUTTON_COLORS[2],
      state: {
        fromButton: 'EFOS Salesman',
        businessType,
        uploadEndpointOSDP: '/upload_ICEFOSSALES_OSDP',
        uploadEndpointPBI: '/upload_ICEFOSSALES_PBI',
        backPath: '/recons/ic',
        nextPath: '/recons/summary',
      },
    },
    {
      label: 'FCS IC',
      path: '/recons/upload',
      color: BUTTON_COLORS[3],
      state: {
        fromButton: 'FCS IC',
        businessType,
        uploadEndpointOSDP: '/upload_FCSIC_OSDP',
        uploadEndpointPBI: '/upload_FCSIC_PBI',
        backPath: '/recons/ic',
        nextPath: '/recons/summary',
      },
    },
    {
      label: 'IC IQ Performance',
      path: '/recons/upload',
      color: BUTTON_COLORS[4],
      state: {
        fromButton: 'IC IQ Performance',
        businessType,
        uploadEndpointOSDP: '/upload_ICIQ_OSDP',
        uploadEndpointPBI: '/upload_ICIQ_PBI',
        backPath: '/recons/ic',
        nextPath: '/recons/summary',
      },
    },
    {
      label: 'Raw Data Invoice Level',
      path: '/recons/upload',
      color: BUTTON_COLORS[5],
      state: {
        fromButton: 'Raw Data Invoice Level',
        businessType,
        uploadEndpointOSDP: '/upload_HPCRAWDATA_OSDP',
        uploadEndpointPBI: '/upload_HPCRAWDATA_PBI',
        backPath: '/recons/ic',
        nextPath: '/recons/ic_fcs/summary',
      },
    },
  ];

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (location.state?.businessType) {
      sessionStorage.setItem('businessType', location.state.businessType);
    }
  }, [location.state?.businessType]);

  const handleNavigate = (button) => {
    setLoadingLabel(button.label);
    setTimeout(() => {
      navigate(button.path, {
        state: {
          fromButton: button.label,
          businessType: businessType,
          ...(button.state || {}),
        },
      });
    }, 500);
  };

  const renderButton = (btn, i) => (
    <motion.div
      key={i}
      initial={{ opacity: 0, y: 30 }}
      animate={mounted ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: i * 0.08, duration: 0.4, ease: 'easeOut' }}
      className="flex justify-center"
    >
      <button
        onClick={() => handleNavigate(btn)}
        disabled={loadingLabel !== null}
        className={`
          w-full h-20 md:w-60 text-base md:text-lg font-semibold
          border-none rounded-xl bg-gradient-to-br ${btn.color}
          cursor-pointer flex flex-col items-center justify-center
          shadow-sm transition-all duration-200 ease-in-out
          hover:from-white hover:to-white hover:scale-[1.03] hover:shadow-md
          disabled:opacity-70
        `}
        style={{
          minWidth: isMobile ? '90%' : undefined,
          margin: isMobile ? '0 auto' : undefined,
        }}
      >
        {loadingLabel === btn.label ? (
          <div className="flex items-center gap-2">
            <svg
              className="animate-spin h-5 w-5 text-blue-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>{btn.label}</span>
          </div>
        ) : (
          <span>{btn.label}</span>
        )}
      </button>
    </motion.div>
  );

  return (
      <div className="p-5 min-h-[calc(100vh-96px)] overflow-hidden flex flex-col items-center justify-start relative">
        {/* Back Button */}
        <div className="absolute top-0 left-0 z-10">
          <button
            onClick={() => navigate('/recons')}
            className="px-4 py-2 bg-gray-700 text-white text-sm rounded hover:bg-gray-800 transition"
          >
            ← Back
          </button>
        </div>
        {/* Title and subtitle */}
        <div className="text-center flex flex-col items-center pt-6 px-4 w-full">
          <h2 className="text-2xl font-bold mb-2">Reconciliation Tools</h2>
          <p className="mb-7 text-center max-w-md text-gray-600">
            Please choose the type of report you want to reconcile:
          </p>
          {/* Centered grid for all buttons */}
          <div className="w-full max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3 justify-items-center">
            {buttons.map(renderButton)}
          </div>
        </div>
      </div>
  );
}

export default ReconsICPage;

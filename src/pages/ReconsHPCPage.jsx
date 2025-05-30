import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { motion } from 'framer-motion';
import { useMediaQuery } from 'react-responsive';

function ReconsHPCPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState(null);
  const isMobile = useMediaQuery({ query: '(max-width: 768px)' });
  const location = useLocation();
  const businessType = location.state?.businessType || sessionStorage.getItem('businessType') || 'N/A';

  const topButtons = [
    {
      label: 'Daily Sales Summary',
      path: '/in-progress',
    },
    {
      label: 'EFOS Outlet',
      path: '/in-progress',
    },
    {
      label: 'EFOS Salesman',
      path: '/recons/upload',
      state: {
        fromButton: 'EFOS Salesman',
        businessType,
        uploadEndpointOSDP: '/upload_HPCEFOSSALES_OSDP',
        uploadEndpointPBI: '/upload_HPCEFOSSALES_PBI',
        backPath: '/recons/hpc',
        nextPath: '/recons/hpc_fcs/summary',
      },
    },
    {
      label: 'FCS HPC',
      path: '/recons/upload',
      state: {
        fromButton: 'FCS HPC',
        businessType,
        uploadEndpointOSDP: '/upload_FCSHPC_OSDP',
        uploadEndpointPBI: '/upload_FCSHPC_PBI',
        backPath: '/recons/hpc',
        nextPath: '/recons/hpc_fcs/summary',
      },
    },
  ];

  const bottomButtons = [
    { label: 'IQ Performance Outlet', path: '/in-progress' },
    { 
      label: 'IQ Performance Salesman', 
      path: '/recons/upload',
      state: {
        fromButton: 'IQ Performance Salesman',
        businessType,
        uploadEndpointOSDP: '/upload_HPCIQSALES_OSDP',
        uploadEndpointPBI: '/upload_HPCIQSALES_PBI',
        backPath: '/recons/hpc',
        nextPath: '/recons/hpc_fcs/summary',
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
          ...(button.state || {})
        }
      });
    }, 500);
  };

  const renderButtons = (buttons) => {
    const renderButtonContent = (btn) => (
      loadingLabel === btn.label ? (
        <div className="flex items-center gap-2">
          <svg
            className="animate-spin h-5 w-5 text-blue-500"
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
          <span className="text-sm">{btn.label}</span>
        </div>
      ) : (
        <span className="text-gray-800 font-bold text-lg transition-transform duration-300 ease-in-out hover:scale-105">
          {btn.label}
        </span>
      )
    );

    if (isMobile) {
      return (
        <div className="flex flex-col items-center gap-4 w-full">
          {buttons.map((btn, i) => (
            <motion.div
              key={i}
              className="w-full px-4"
              initial={{ opacity: 0, y: 30 }}
              animate={mounted ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1, duration: 0.5, ease: 'easeOut' }}
            >
              <button
                onClick={() => handleNavigate(btn)}
                disabled={loadingLabel !== null}
                className="w-full h-20 text-lg p-3 border-none rounded-xl bg-gradient-to-br from-gray-300 to-gray-200 cursor-pointer flex items-center justify-center shadow-md transition-all duration-300 ease-in-out hover:from-gray-100 hover:to-gray-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl disabled:opacity-70"
              >
                {renderButtonContent(btn)}
              </button>
            </motion.div>
          ))}
        </div>
      );
    }

    const rows = [];
    let i = 0;
    const totalButtons = buttons.length;
    while (i < totalButtons) {
      const remaining = totalButtons - i;
      const take = remaining >= 4 ? 4 : remaining;
      rows.push(buttons.slice(i, i + take));
      i += take;
    }

    return (
      <div className="flex flex-col items-center gap-4 w-full">
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={`flex justify-center flex-wrap gap-4 w-full ${row.length < 4 ? 'justify-center' : ''}`}
          >
            {row.map((btn, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                animate={mounted ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.1, duration: 0.5, ease: 'easeOut' }}
              >
                <button
                  onClick={() => handleNavigate(btn)}
                  disabled={loadingLabel !== null}
                  className="w-44 h-24 text-lg p-3 border-none rounded-xl bg-gradient-to-br from-gray-300 to-gray-200 cursor-pointer flex flex-col items-center justify-center shadow-md transition-all duration-300 ease-in-out hover:from-gray-100 hover:to-gray-300 hover:-translate-y-1 hover:scale-105 hover:shadow-xl disabled:opacity-70"
                >
                  {renderButtonContent(btn)}
                </button>
              </motion.div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="p-5 min-h-[calc(100vh-96px)] overflow-hidden flex flex-col items-center justify-start relative">
        <div className="absolute top-0 left-0 z-10">
          <button
            onClick={() => navigate('/recons')}
            className="px-4 py-2 bg-gray-700 text-white text-sm rounded hover:bg-gray-800 transition"
          >
            ← Back
          </button>
        </div>

        <div className="text-center flex flex-col items-center pt-6 px-4 w-full">
          <h2 className="text-2xl font-bold mb-2">Reconciliation Tools</h2>
          <p className="mb-5 text-center max-w-md text-gray-600">
            Please choose the type of report you want to reconcile:
          </p>

          <div className="w-full max-w-5xl mx-auto space-y-6">
            {renderButtons([...topButtons, ...bottomButtons])}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default ReconsHPCPage;
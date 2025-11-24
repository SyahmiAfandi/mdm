import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { motion } from 'framer-motion';
import { APP_FULL_NAME } from '../config';

function ReconsMainPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [loadingPath, setLoadingPath] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const buttons = [
    {
      label: 'HPC',
      path: '/recons/hpc',
      img: '/images/hpc_bw.jpg',
      hoverImg: '/images/hpc_color.jpg',
    },
    {
      label: 'IC',
      path: '/recons/ic',
      img: '/images/ic_bw.jpg',
      hoverImg: '/images/ic_color.jpg',
    },
  ];

  const buttonVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.15, duration: 0.5, ease: 'easeOut' }
    })
  };

  const handleNavigate = (path, label) => {
    setLoadingPath(path);
    setTimeout(() => navigate(path, { state: { businessType: label } }), 300);
  };

  // Custom Reports Button Config
  const customReportBtn = {
    label: 'Custom Reports',
    path: '/recons/custom',
    img: '/images/custom_report.jpg',
    hoverImg: '/images/custom_report_color.jpg'
  };

  return (
    <DashboardLayout pageTitle={APP_FULL_NAME} breadcrumbs={["Tools","Reconciliation Tools"]}>
      <div className="min-h-[calc(100vh-75px)] flex flex-col items-center justify-start pt-10 overflow-hidden">
        <div className="text-center mb-6 w-full">
          <h2 className="text-3xl font-bold mb-2">Reconciliation Tools</h2>
          <p className="text-gray-700 text-sm">Please choose Business Type:</p>
        </div>

        <div className="flex justify-center w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {buttons.map((btn, i) => (
              <motion.button
                key={i}
                custom={i}
                initial="hidden"
                animate={mounted ? 'visible' : 'hidden'}
                variants={buttonVariants}
                disabled={loadingPath !== null}
                onClick={() => handleNavigate(btn.path, btn.label)}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.97 }}
                className="relative w-[260px] h-[130px] text-lg font-bold rounded-xl shadow-md flex items-center justify-center transition-all duration-150 overflow-hidden bg-cover bg-center grayscale hover:grayscale-0 hover:shadow-xl"
                style={{ backgroundImage: `url('${btn.img}')` }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundImage = `url('${btn.hoverImg}')`}
                onMouseLeave={(e) => e.currentTarget.style.backgroundImage = `url('${btn.img}')`}
              >
                <div className="flex items-center gap-2">
                  {loadingPath === btn.path && (
                    <div className="w-5 h-5 border-4 border-t-transparent border-white rounded-full animate-spin"></div>
                  )}
                  <span className="text-white text-2xl font-bold opacity-85 drop-shadow-md hover:opacity-100 hover:-translate-y-1 transition duration-300">
                    {btn.label}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        <p className="my-6 text-gray-500 font-semibold text-center text-sm">
          Or, use the option below to reconcile a custom report:
        </p>

        <div className="flex justify-center w-full">
          <motion.button
            custom={2}
            initial="hidden"
            animate={mounted ? 'visible' : 'hidden'}
            variants={buttonVariants}
            disabled={loadingPath !== null}
            onClick={() => handleNavigate(customReportBtn.path, customReportBtn.label)}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.97 }}
            className="relative w-[260px] h-[130px] text-lg font-bold rounded-xl shadow-md flex items-center justify-center transition-all duration-300 overflow-hidden bg-cover bg-center grayscale hover:grayscale-0 hover:shadow-xl"
            style={{ backgroundImage: `url('${customReportBtn.img}')` }}
            onMouseEnter={customReportBtn.hoverImg ? (e) => e.currentTarget.style.backgroundImage = `url('${customReportBtn.hoverImg}')` : undefined}
            onMouseLeave={(e) => e.currentTarget.style.backgroundImage = `url('${customReportBtn.img}')`}
          >
            <div className="flex items-center gap-2">
              {loadingPath === customReportBtn.path && (
                <div className="w-5 h-5 border-4 border-t-transparent border-white rounded-full animate-spin"></div>
              )}
              <span className="text-white text-2xl font-bold opacity-85 drop-shadow-md hover:opacity-100 hover:-translate-y-1 transition duration-300">
                {customReportBtn.label}
              </span>
            </div>
          </motion.button>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default ReconsMainPage;

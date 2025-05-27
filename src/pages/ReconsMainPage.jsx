import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { motion } from 'framer-motion';

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

  return (
    <DashboardLayout>
      <div className="w-full max-w-7xl mx-auto px-4 py-6 text-center overflow-hidden">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">Reconciliation Tools</h2>
          <p className="text-gray-700">Please choose Business Type:</p>
        </div>

        <div className="flex flex-wrap justify-center gap-6">
          {buttons.map((btn, i) => (
            <motion.button
              key={i}
              custom={i}
              initial="hidden"
              animate={mounted ? 'visible' : 'hidden'}
              variants={buttonVariants}
              disabled={loadingPath !== null}
              onClick={() => handleNavigate(btn.path, btn.label)}
              className="relative w-[280px] h-[160px] text-lg font-bold rounded-xl shadow-md flex items-center justify-center transition-all duration-300 overflow-hidden bg-cover bg-center grayscale hover:grayscale-0 hover:scale-105 hover:shadow-xl"
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
    </DashboardLayout>
  );
}

export default ReconsMainPage;

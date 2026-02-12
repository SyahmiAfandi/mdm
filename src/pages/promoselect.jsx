// PromotionsSelectionPage.jsx

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { APP_FULL_NAME } from '../config';

function PromotionsSelectionPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [loadingPath, setLoadingPath] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const buttons = [
    {
      path: '/',
      img: '/images/promo_manual_bw.png',
      hoverImg: '/images/promo_manual_color.png',
    },
    {
      path: '/promoautoIC',
      img: '/images/promo_auto_bw.png',
      hoverImg: '/images/promo_auto_color.png',
    },
  ];

  const buttonVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.15, duration: 0.5, ease: 'easeOut' },
    }),
  };

  const handleNavigate = (path, label) => {
    setLoadingPath(path);
    setTimeout(() => {
      navigate(path, { state: { promoMode: label } });
    }, 300);
  };

  return (
    <>
      <div className="min-h-[calc(100vh-75px)] flex flex-col items-center justify-start pt-10 overflow-hidden">
        {/* Header */}
        <div className="text-center mb-6 w-full">
          <h2 className="text-3xl font-bold mb-2">Promotions Selection</h2>
          <p className="text-gray-700 text-sm">
            Choose how you want to configure your promotions in {APP_FULL_NAME}.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex justify-center w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {buttons.map((btn, i) => (
              <motion.button
                key={btn.label}
                custom={i}
                initial="hidden"
                animate={mounted ? 'visible' : 'hidden'}
                variants={buttonVariants}
                disabled={loadingPath !== null}
                onClick={() => handleNavigate(btn.path, btn.label)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="relative w-[250px] h-[250px] rounded-2xl shadow-md flex flex-col items-center justify-center transition-all duration-100 overflow-hidden bg-cover bg-center grayscale hover:grayscale-0 hover:shadow-2xl group"
                style={{ backgroundImage: `url('${btn.img}')` }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundImage = `url('${btn.hoverImg}')`)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundImage = `url('${btn.img}')`)
                }
              >
                <div className="flex flex-col items-center gap-2 px-4 text-center">
                  {loadingPath === btn.path && (
                    <div className="w-6 h-6 border-4 border-t-transparent border-white rounded-full animate-spin" />
                  )}
                  <span className="text-white text-2xl font-extrabold drop-shadow-md tracking-wide">
                    {btn.label}
                  </span>
                  <span className="text-white text-xs font-medium opacity-90 drop-shadow-md">
                    {btn.subLabel}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Helper Text */}
        <p className="mt-8 text-gray-500 text-xs text-center max-w-xl">
          You can switch between <span className="font-semibold">Manual</span> and
          <span className="font-semibold"> Auto Generate</span> modes anytime to
          match your promotion strategy and workflow.
        </p>
      </div>
    </>
  );
}

export default PromotionsSelectionPage;

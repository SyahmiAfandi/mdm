import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sliders, Gift, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ToolCard = ({ title, description, icon, onClick, delay }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ type: 'spring', stiffness: 80, damping: 18, delay }}
      className="w-[clamp(200px,22vw,320px)]"
    >
      <button
        onClick={onClick}
        className="
          group w-full bg-white rounded-xl shadow-md 
          hover:shadow-xl transition-shadow 
          p-4 flex flex-col items-center 
          text-center gap-4 border border-transparent 
          hover:border-blue-300 focus:outline-none
          cursor-pointer
          active:scale-[0.98]
        "
        type="button"
      >
        <motion.div
          whileHover={{ scale: 1.1, rotate: 6 }}
          className="p-2 rounded-full bg-blue-100 text-blue-600 mb-3 transition-all"
        >
          {icon}
        </motion.div>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="text-base text-gray-600">{description}</p>
      </button>
    </motion.div>
  );
};

const ToolsSelectionPage = () => {
  const navigate = useNavigate();

  const tools = [
    {
      title: 'Reconciliation Tools',
      description: 'Access and manage reconciliation reports and uploads.',
      icon: <Sliders size={36} />,
      onClick: () => navigate('/recons'),
    },
    {
      title: 'Promotion Tools',
      description: 'Manage promotion datasets and campaign matching.',
      icon: <Gift size={36} />,
      onClick: () => navigate('/promotions'),
    },
    {
      title: 'Add New Tool',
      description: 'Create and integrate a new tool module to the system.',
      icon: <Plus size={36} />,
      onClick: () => navigate('#'),
    },
  ];

  return (
      <div className="relative py-0 px-2 sm:px-8 h-[calc(100vh-100px)] bg-gray-50 transition-all duration-300">
        <div className="max-w-6xl mx-auto h-full flex flex-col">
          {/* Sticky header */}
          <motion.div
            className="sticky top-0 z-10 bg-gray-50 pt-8 pb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-3xl font-bold text-center">Select a Tool</h1>
          </motion.div>

          {/* Responsive tool grid, centered */}
          <div className="flex justify-center w-full">
            <div
              className="
                grid
                grid-cols-1
                sm:grid-cols-2
                md:grid-cols-3
                gap-x-6 gap-y-4
                pb-8
              "
            >
              <AnimatePresence>
                {tools.map((tool, index) => (
                  <ToolCard key={index} {...tool} delay={index * 0.15} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
  );
};

export default ToolsSelectionPage;

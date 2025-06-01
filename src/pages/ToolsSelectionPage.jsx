import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Sliders, Gift, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';

const ToolCard = ({ title, description, icon, onClick, delay }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="w-full sm:w-80"
    >
      <div
        onClick={onClick}
        className="cursor-pointer rounded-2xl shadow-md hover:shadow-lg p-6 bg-white transition"
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className="p-4 rounded-full bg-blue-100 text-blue-600">
            {icon}
          </div>
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
    </motion.div>
  );
};

const ToolsSelectionPage = () => {
  const navigate = useNavigate();

  const tools = [
    {
      title: 'Reconciliation Tools',
      description: 'Access and manage reconciliation reports and uploads.',
      icon: <Sliders size={28} />,
      onClick: () => navigate('/recons'),
    },
    {
      title: 'Promotion Tools',
      description: 'Manage promotion datasets and campaign matching.',
      icon: <Gift size={28} />,
      onClick: () => navigate('#'),
    },
    {
      title: 'Add New Tool',
      description: 'Create and integrate a new tool module to the system.',
      icon: <Plus size={28} />,
      onClick: () => navigate('#'),
    },
  ];

  return (
    <DashboardLayout>
    <motion.div
      className="p-8 min-h-screen bg-gray-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-5xl mx-auto">
        <motion.h1
          className="text-3xl font-bold text-center mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Select a Tool
        </motion.h1>

        <div className="flex flex-wrap justify-center gap-8">
          {tools.map((tool, index) => (
            <ToolCard key={index} {...tool} delay={index * 0.15} />
          ))}
        </div>
      </div>
    </motion.div>
    </DashboardLayout>
  );
};

export default ToolsSelectionPage;

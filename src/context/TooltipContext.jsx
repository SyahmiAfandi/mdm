import React, { createContext, useContext, useState, useEffect } from 'react';

const TooltipContext = createContext();

export const TooltipProvider = ({ children }) => {
  // Load from localStorage (default to true)
  const [showTooltip, setShowTooltip] = useState(() => {
    const saved = localStorage.getItem('showTooltip');
    return saved === null ? true : JSON.parse(saved);
  });

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem('showTooltip', JSON.stringify(showTooltip));
  }, [showTooltip]);

  return (
    <TooltipContext.Provider value={{ showTooltip, setShowTooltip }}>
      {children}
    </TooltipContext.Provider>
  );
};

export const useTooltip = () => useContext(TooltipContext);

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';

import { SidebarProvider } from './context/SidebarContext';
import { UserProvider } from './context/UserContext';
import { TooltipProvider } from './context/TooltipContext';

import { Toaster } from 'react-hot-toast';
import { HashRouter, BrowserRouter } from 'react-router-dom';

// Use HashRouter in packaged Electron (file://), BrowserRouter in dev (http://)
const isFile = window.location.protocol === 'file:';
const Router = isFile ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
      <UserProvider>
        <TooltipProvider>
          <SidebarProvider>
            <App />
            <Toaster
              position="top-center"
              reverseOrder={false}
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#1f2937', // gray-800
                  color: '#fff',
                  fontSize: '14px',
                },
                success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } }, // green-500
                error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } }, // red-500
              }}
            />
          </SidebarProvider>
        </TooltipProvider>
      </UserProvider>
  </React.StrictMode>
);

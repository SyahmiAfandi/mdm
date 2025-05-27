import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { SidebarProvider } from './context/SidebarContext';
import { UserProvider } from './context/UserContext';
import { Toaster } from 'react-hot-toast'; // ✅ Add this

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UserProvider>
      <SidebarProvider>
        <App />
        <Toaster
          position="top-center"
          reverseOrder={false}
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1f2937', // Tailwind's gray-800
              color: '#fff',
              fontSize: '14px',
            },
            success: {
              iconTheme: {
                primary: '#22c55e', // Tailwind's green-500
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444', // Tailwind's red-500
                secondary: '#fff',
              },
            },
          }}
        />
      </SidebarProvider>
    </UserProvider>
  </React.StrictMode>
);

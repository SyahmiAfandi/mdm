import React, { useEffect, useState, Suspense, lazy } from 'react';
import axios from 'axios';
import { 
  Link,
  BrowserRouter as Router, 
  Routes, 
  Route, 
  useNavigate,
  useLocation 
} from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';

//Contact page
function ContactPage() {
  return (
    <DashboardLayout>
    <div style={{ padding: '40px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'stretch',
        height: '300px', // adjust as needed
        border: '1px solid #ccc',
        borderRadius: '10px',
        overflow: 'hidden',
        boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
      }}>
        {/* Left Side */}
        <div style={{
          flex: 1,
          padding: '20px',
          textAlign: 'right',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}>
          <div>
            <h2>Contact Us</h2>
            <p>Need help? We're here for you.</p>
          </div>
        </div>

        {/* Divider */}
        <div style={{
          width: '1px',
          backgroundColor: 'light-grey',
          height: '100%',
        }} />

        {/* Right Side */}
        <div style={{
          flex: 1,
          padding: '20px',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
        }}>
          <div>
            <h2>Support</h2>
            <p>Email us: <a href="mailto syahmi.afandi@unilever.com">syahmi.afandi@unilever.com</a></p>
          </div>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}

export default ContactPage;
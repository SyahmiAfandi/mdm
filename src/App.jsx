import React, { useEffect, useState, Suspense, lazy } from 'react';
import { 
  Link,
  BrowserRouter as Router, 
  Routes, 
  Route, 
  useNavigate,
  useLocation 
} from 'react-router-dom';
//import Navbar from './components/NavBar';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import ToolsSelectionPage from './pages/ToolsSelectionPage';

//-----------------------------------------------------------------------------------------//

//Home Page
const HomePage = lazy(() => import('./pages/HomePage'));

const ToolSelection = lazy(() => import('./pages/ToolsSelectionPage'));
//Tools -Reconciliation
//Level 1
const ReconsMainPage = lazy(() => import('./pages/ReconsMainPage'));// Level 1 - Main Page Recons
//Level 2
const ReconsHPCPage = lazy(() => import('./pages/ReconsHPCPage'));// Level 2 - HPC Page Recons
const ReconsICPage = lazy(() => import('./pages/ReconsICPage'));//Level 2 - IC Page Recons
//Level 3
const DetailedView = lazy(() => import('./pages/DetailedView'));
const ReconciliationUploadPage = lazy(() => import('./pages/ReconciliationUploadPage'));//test combine upload page
//Level 4
const HPC_FCS_ResultPage = lazy(() => import('./pages/HPC_FCS_ResultPage.jsx'));
const HPC_FCS_SummaryPage = lazy(() => import('./pages/HPC_FCS_SummaryPage.jsx'));

//Settings
const Settings = lazy(() => import('./pages/Settings'));
const AdminManageControl = lazy(() => import('./pages/AdminUsersPage.jsx'));
const AdminLicenses = lazy(() => import('./pages/LicenseExpiryPage.jsx'));

//About
const ContactPage = lazy(() => import('./pages/ContactPage'));

//In progress
const InProgressPage = lazy(() => import( './pages/InProgressPage'));

//--------------------------------------------------------------------------------------------//

// Main App Component with Router
function App() {
  return (
      <Router>
        <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/tools" element={<ToolSelection />} />
          <Route path="/recons" element={<ProtectedRoute><ReconsMainPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><AdminManageControl /></ProtectedRoute>} />
          <Route path="/admin/licenses" element={<ProtectedRoute><AdminLicenses /></ProtectedRoute>} />
          <Route path="/recons/hpc" element={<ProtectedRoute><ReconsHPCPage /></ProtectedRoute>} />
          <Route path="/recons/hpc_fcs/summary" element={<ProtectedRoute><HPC_FCS_SummaryPage /></ProtectedRoute>} />
          <Route path="/recons/hpc_fcs/result" element={<ProtectedRoute><HPC_FCS_ResultPage /></ProtectedRoute>} />
          <Route path="/in-progress" element={<ProtectedRoute><InProgressPage  /></ProtectedRoute>} />
          <Route path="/recons/upload" element={<ProtectedRoute><ReconciliationUploadPage  /></ProtectedRoute>} />
          <Route path="/recons/ic" element={<ReconsICPage />} />
          <Route path="/detailed-view" element={<DetailedView />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Routes>
        </Suspense>
    </Router>
  );
}

export default App;
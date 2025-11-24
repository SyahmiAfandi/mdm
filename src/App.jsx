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
const ChatPage = lazy(() => import('./pages/ChatPage'));
const UtilitiesDate = lazy(() => import('./pages/DateConverterPage'));

const ToolSelection = lazy(() => import('./pages/ToolsSelectionPage'));
const UtilitiesSelection = lazy(() => import('./pages/UtilitiesPage'));
const ReportSelection = lazy(() => import('./pages/ReportsPage'));
const ReportSummary = lazy(() => import('./pages/ReportSummaryPage'));
const MismatchTrackerReport = lazy(() => import('./pages/MismatchTrackerReport'));
const MatrixReconsReport = lazy(() => import('./pages/ReconciliationMatrix'));
const DSSreport = lazy(() => import('./pages/DailySalesSummary'));

//Tools - Promotions
const PromoSelection = lazy(() => import('./pages/promoselect'));
const PromoAutoIC = lazy(() => import('./pages/promo_auto_IC'));
//Tools -Reconciliation
const ReconsMainPage = lazy(() => import('./pages/ReconsMainPage'));// Level 1 - Main Page Recons
const ReconsHPCPage = lazy(() => import('./pages/ReconsHPCPage'));// Level 2 - HPC Page Recons
const ReconsICPage = lazy(() => import('./pages/ReconsICPage'));//Level 2 - IC Page Recons
const DetailedView = lazy(() => import('./pages/DetailedView'));
const ReconciliationUploadPage = lazy(() => import('./pages/ReconciliationUploadPage'));//test combine upload page
const Recons_ResultPage = lazy(() => import('./pages/Recons_ResultPage.jsx'));
const Recons_SummaryPage = lazy(() => import('./pages/Recons_SummaryPage.jsx'));
const ReconsCustom = lazy(() => import('./pages/ReconsCustom.jsx'));
//Settings
const Settings = lazy(() => import('./pages/Settings'));
const AdminManageControl = lazy(() => import('./pages/AdminUsersPage.jsx'));
const AdminLicenses = lazy(() => import('./pages/LicenseExpiryPage.jsx'));
const RolePermission = lazy(() => import('./pages/RolesPermissionsPage.jsx'));

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
          <Route path="/promotions" element={<ProtectedRoute><PromoSelection /></ProtectedRoute>} />
          <Route path="/promoautoIC" element={<ProtectedRoute><PromoAutoIC /></ProtectedRoute>} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/utilities" element={<UtilitiesSelection />} />
          <Route path="/reports" element={<ReportSelection />} />
          <Route path="/reports/summary_recons" element={<ReportSummary />} />
          <Route path="/reports/mismatch-tracker" element={<MismatchTrackerReport />} />
          <Route path="/reports/matrix_recons" element={<MatrixReconsReport />} />
          <Route path="/reports/DSS" element={<DSSreport />} />
          <Route path="/recons" element={<ProtectedRoute><ReconsMainPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/settings/admin/users" element={<ProtectedRoute><AdminManageControl /></ProtectedRoute>} />
          <Route path="/settings/admin/licenses" element={<ProtectedRoute><AdminLicenses /></ProtectedRoute>} />
          <Route path="/recons/hpc" element={<ProtectedRoute><ReconsHPCPage /></ProtectedRoute>} />
          <Route path="/recons/summary" element={<ProtectedRoute><Recons_SummaryPage /></ProtectedRoute>} />
          <Route path="/recons/result" element={<ProtectedRoute><Recons_ResultPage /></ProtectedRoute>} />
          <Route path="/in-progress" element={<ProtectedRoute><InProgressPage  /></ProtectedRoute>} />
          <Route path="/recons/upload" element={<ProtectedRoute><ReconciliationUploadPage  /></ProtectedRoute>} />
          <Route path="/recons/ic" element={<ReconsICPage />} />
          <Route path="/recons/custom" element={<ReconsCustom />} />
          <Route path="/detailed-view" element={<DetailedView />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/utilities/date-converter" element={<UtilitiesDate />} />
          <Route path="/settings/admin/permission" element={<RolePermission />} />
        </Routes>
        </Suspense>
    </Router>
  );
}

export default App;
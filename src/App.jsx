import React, { Suspense, lazy, useEffect, useMemo } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { motion } from "framer-motion";

import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./components/DashboardLayout";
import { PAGE_META } from "./config/pageMeta";

// -------------------- Lazy pages --------------------
const HomePage = lazy(() => import("./pages/HomePage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const UtilitiesDate = lazy(() => import("./pages/DateConverterPage"));

const ToolSelection = lazy(() => import("./pages/ToolsSelectionPage"));
const UtilitiesSelection = lazy(() => import("./pages/UtilitiesPage"));
const ReportSelection = lazy(() => import("./pages/ReportsPage"));
const ReportSummary = lazy(() => import("./pages/ReportSummaryPage"));
const MismatchTrackerReport = lazy(() => import("./pages/MismatchTrackerReport"));
const MatrixReconsReport = lazy(() => import("./pages/ReconciliationMatrix"));
const DSSreport = lazy(() => import("./pages/DailySalesSummary"));

// Tools - Promotions
const PromoSelection = lazy(() => import("./pages/promoselect"));
const PromoAutoIC = lazy(() => import("./pages/promo_auto_IC"));

// Tools - Reconciliation
const ReconsMainPage = lazy(() => import("./pages/ReconsMainPage"));
const ReconsHPCPage = lazy(() => import("./pages/ReconsHPCPage"));
const ReconsICPage = lazy(() => import("./pages/ReconsICPage"));
const DetailedView = lazy(() => import("./pages/DetailedView"));
const ReconciliationUploadPage = lazy(() => import("./pages/ReconciliationUploadPage"));
const Recons_ResultPage = lazy(() => import("./pages/Recons_ResultPage.jsx"));
const Recons_SummaryPage = lazy(() => import("./pages/Recons_SummaryPage.jsx"));
const ReconsCustom = lazy(() => import("./pages/ReconsCustom.jsx"));

// Settings
const Settings = lazy(() => import("./pages/Settings"));
const AdminManageControl = lazy(() => import("./pages/AdminUsersPage.jsx"));
const AdminLicenses = lazy(() => import("./pages/LicenseExpiryPage.jsx"));
const RolePermission = lazy(() => import("./pages/RolesPermissionsPage.jsx"));

// Utilities
const EmailTracker = lazy(() => import("./pages/Utilities-EmailTracker.jsx"));

// About
const ContactPage = lazy(() => import("./pages/ContactPage"));

// In progress
const InProgressPage = lazy(() => import("./pages/InProgressPage"));

// -------------------- Fallback (inside content only) --------------------
function PageFallback() {
  return (
    <div className="p-3">
      <div className="h-10 w-48 rounded-md bg-gray-200 animate-pulse" />
      <div className="mt-3 h-28 rounded-xl bg-gray-200 animate-pulse" />
      <div className="mt-3 h-28 rounded-xl bg-gray-200 animate-pulse" />
    </div>
  );
}

// -------------------- Meta helpers --------------------
function resolveMeta(pathname) {
  const found = PAGE_META.find((r) => r.match?.test?.(pathname));
  return (
    found || {
      title: "",
      breadcrumbs: [],
    }
  );
}

function autoBreadcrumbs(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  const crumbs = [{ label: "Home", to: "/" }];

  let path = "";
  parts.forEach((p) => {
    path += `/${p}`;
    crumbs.push({
      label: p.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      to: path,
    });
  });

  return crumbs;
}

// if some of your PAGE_META breadcrumbs are still string[],
// normalize them into {label,to?}
function normalizeCrumbs(crumbs) {
  if (!Array.isArray(crumbs)) return [];
  if (crumbs.length === 0) return [];

  // already object form
  if (typeof crumbs[0] === "object" && crumbs[0] !== null) return crumbs;

  // string[] form -> convert to non-clickable labels except Home
  const out = [];
  for (let i = 0; i < crumbs.length; i++) {
    const label = String(crumbs[i]);
    if (i === 0 && label.toLowerCase() === "home") out.push({ label: "Home", to: "/" });
    else out.push({ label });
  }
  return out;
}

// -------------------- Persistent layout wrapper --------------------
function LayoutWithHeader() {
  const location = useLocation();
  const pathname = location.pathname;

  const meta = useMemo(() => resolveMeta(pathname), [pathname]);

  // Step 2: Use meta breadcrumbs if exist, else auto-generate
  const breadcrumbs = useMemo(() => {
    const normalized = normalizeCrumbs(meta.breadcrumbs);
    return normalized.length ? normalized : autoBreadcrumbs(pathname);
  }, [meta.breadcrumbs, pathname]);

  // Step 3: Sync browser tab title
  useEffect(() => {
    if (meta.title) {
      document.title = `${meta.title} • MDM Tools`;
    } else {
      document.title = "MDM Tools";
    }
  }, [meta.title]);

  return (
    <DashboardLayout pageTitle={meta.title} breadcrumbs={breadcrumbs}>
      <Suspense fallback={<PageFallback />}>
        {/* Step 4: Animate ONLY page content */}
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <Outlet />
        </motion.div>
      </Suspense>
    </DashboardLayout>
  );
}

// -------------------- App --------------------
export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected + persistent layout */}
        <Route
          element={
            <ProtectedRoute>
              <LayoutWithHeader />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<HomePage />} />

          <Route path="/tools" element={<ToolSelection />} />
          <Route path="/promotions" element={<PromoSelection />} />
          <Route path="/promoautoIC" element={<PromoAutoIC />} />
          <Route path="/chat" element={<ChatPage />} />

          <Route path="/utilities" element={<UtilitiesSelection />} />
          <Route path="/utilities/emailtracker" element={<EmailTracker />} />
          <Route path="/utilities/date-converter" element={<UtilitiesDate />} />

          <Route path="/reports" element={<ReportSelection />} />
          <Route path="/reports/summary_recons" element={<ReportSummary />} />
          <Route path="/reports/mismatch-tracker" element={<MismatchTrackerReport />} />
          <Route path="/reports/matrix_recons" element={<MatrixReconsReport />} />
          <Route path="/reports/DSS" element={<DSSreport />} />

          <Route path="/recons" element={<ReconsMainPage />} />
          <Route path="/recons/hpc" element={<ReconsHPCPage />} />
          <Route path="/recons/ic" element={<ReconsICPage />} />
          <Route path="/recons/custom" element={<ReconsCustom />} />
          <Route path="/recons/summary" element={<Recons_SummaryPage />} />
          <Route path="/recons/result" element={<Recons_ResultPage />} />
          <Route path="/recons/upload" element={<ReconciliationUploadPage />} />

          <Route path="/detailed-view" element={<DetailedView />} />
          <Route path="/in-progress" element={<InProgressPage />} />

          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/admin/users" element={<AdminManageControl />} />
          <Route path="/settings/admin/licenses" element={<AdminLicenses />} />
          <Route path="/settings/admin/permission" element={<RolePermission />} />

          <Route path="/contact" element={<ContactPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

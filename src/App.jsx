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
import RequirePermission from "./components/RequirePermission";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import { PAGE_META } from "./config/pageMeta";
import ReconsPeriodsPage from "./pages/Tools/Reconciliation/Data/ReconsPeriodsPage.jsx";

// -------------------- Lazy pages --------------------
const HomePage = lazy(() => import("./pages/HomePage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const UtilitiesDate = lazy(() => import("./pages/DateConverterPage"));

const ToolSelection = lazy(() => import("./pages/ToolsSelectionPage"));


// Tools - Promotions
const PromoMainPage = lazy(() => import("./pages/PromoMainPage"));
const PromoConfigPage = lazy(() => import("./pages/Promotions/PromoConfigPage.jsx"));
const PromoAutoIC = lazy(() => import("./pages/promo_auto_IC"));
const UFSPromoListPage = lazy(() => import("./pages/Promotions/UFSPromoListPage.jsx"));
const UFSPromoGeneratePage = lazy(() => import("./pages/Promotions/UFSPromoGeneratePage.jsx"));
const UFSPromoControlsPage = lazy(() => import("./pages/Promotions/UFSPromoControlsPage.jsx"));
const PromoRegionDistributorPage = lazy(() => import("./pages/Promotions/PromoRegionDistributorPage.jsx"));
const PromoItemConfigPage = lazy(() => import("./pages/Promotions/PromoItemConfigPage.jsx"));
const PromoPeriodPage = lazy(() => import("./pages/Promotions/PromoPeriodPage.jsx"));
const PromoCriteriaPage = lazy(() => import("./pages/Promotions/PromoCriteriaPage.jsx"));
const PromoRegionCriteriaMappingPage = lazy(() => import("./pages/Promotions/PromoRegionCriteriaMappingPage.jsx"));

// Tools - Reconciliation
const ReconsMainPage = lazy(() => import("./pages/ReconsMainPage"));
const ReconsHPCPage = lazy(() => import("./pages/ReconsHPCPage"));
const ReconsICPage = lazy(() => import("./pages/ReconsICPage"));
const DetailedView = lazy(() => import("./pages/DetailedView"));
const ReconciliationUploadPage = lazy(() => import("./pages/ReconciliationUploadPage"));
const Recons_ResultPage = lazy(() => import("./pages/Recons_ResultPage.jsx"));
const Recons_SummaryPage = lazy(() => import("./pages/Recons_SummaryPage.jsx"));
const ReconsCustom = lazy(() => import("./pages/ReconsCustom.jsx"));
const ReconsCellsPage = lazy(() => import("./pages/Tools/Reconciliation/Data/reconCellsPage.jsx"));
const PeriodReconsPage = lazy(() => import("./pages/Tools/Reconciliation/Data/ReconsPeriodsPage.jsx"));
const ReconsConfigPage = lazy(() => import("./pages/Tools/Reconciliation/Data/reconsConfigPage.jsx"));
const ReconsBulkImportPage = lazy(() => import("./pages/Tools/Reconciliation/Data/BulkReconCellsImportPage.jsx"));

//Master Data
const MasterDataPage = lazy(() => import("./pages/MasterData/MasterDataHome.jsx"));
const MasterDistributorPage = lazy(() => import("./pages/MasterData/MasterDistributorPage.jsx"));
const MasterCountryPage = lazy(() => import("./pages/MasterData/MasterCountryPage.jsx"));
const MasterBusinessPage = lazy(() => import("./pages/MasterData/MasterBusinessPage.jsx"));
const MasterReportTypePage = lazy(() => import("./pages/MasterData/MasterReportTypePage.jsx"));
const MasterYearPage = lazy(() => import("./pages/MasterData/MasterYearPage.jsx"));
const MasterBusinessReportTypeMapPage = lazy(() => import("./pages/MasterData/MasterBusinessReportTypeMapPage.jsx"));
const ReconsButtonMappingPage = lazy(() => import("./pages/MasterData/ReconsButtonMappingPage.jsx"));
const MasterSkuPage = lazy(() => import("./pages/MasterData/MasterSkuPage.jsx"));


//Reports
const ReportSelection = lazy(() => import("./pages/Reports/ReportMainPage"));
const ReportSummary = lazy(() => import("./pages/ReportSummaryPage"));
const MismatchTrackerReport = lazy(() => import("./pages/MismatchTrackerReport"));
const MismatchListReport = lazy(() => import("./pages/Reports/MismatchListReport"));
const MatrixReconsReport = lazy(() => import("./pages/Reports/ReconciliationMatrix"));
const DSSreport = lazy(() => import("./pages/DailySalesSummary"));
const ReconScheduleReport = lazy(() => import("./pages/Reports/ReconScheduleReport"));

// Settings
const Settings = lazy(() => import("./pages/Settings"));

//Admin Control
const AdminManageControl = lazy(() => import("./pages/AdminUsersPage.jsx"));
const AdminLicenses = lazy(() => import("./pages/LicenseExpiryPage.jsx"));
const RolePermission = lazy(() => import("./pages/RolesPermissionsPage.jsx"));
const RegisterPICPage = lazy(() => import("./pages/Admin-RegisterPICPage.jsx"));

// Utilities
const UtilitiesSelection = lazy(() => import("./pages/Utilities/UtilitiesHomePage.jsx"));
const EmailTracker = lazy(() => import("./pages/Utilities/EmailTracker.jsx"));
const EmailBulkUpload = lazy(() => import("./pages/Utilities/EmailTrackerBulkImport.jsx"));
const ManualReconsEntry = lazy(() => import("./pages/Utilities/ManualReconsEntry.jsx"));


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
  const MotionDiv = motion.div;

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
        <MotionDiv
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <Outlet />
        </MotionDiv>
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

          {/* Tools */}
          <Route element={<RequirePermission perm="tools.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/tools" element={<ToolSelection />} />
          </Route>

          {/* Promotions */}
          <Route element={<RequirePermission perm="tools.promotions.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/promotions" element={<PromoMainPage />} />
            <Route path="/promotions/config" element={<PromoConfigPage />} />
            <Route path="/promotions/auto-IC" element={<PromoAutoIC />} />
            <Route path="/promotions/auto-ufs" element={<UFSPromoListPage />} />
            <Route path="/promotions/auto-ufs/add" element={<UFSPromoGeneratePage />} />
            <Route path="/promotions/auto-ufs/controls" element={<UFSPromoControlsPage />} />
          </Route>
          <Route element={<RequirePermission perm="promotions.regionDistributor.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/promotions/region-distributor" element={<PromoRegionDistributorPage />} />
          </Route>
          <Route element={<RequirePermission perm="promotions.promoItem.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/promotions/promo-item" element={<PromoItemConfigPage />} />
          </Route>
          <Route element={<RequirePermission perm="promotions.promoPeriod.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/promotions/promo-period" element={<PromoPeriodPage />} />
          </Route>
          <Route element={<RequirePermission perm="promotions.promoCriteria.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/promotions/promo-criteria" element={<PromoCriteriaPage />} />
          </Route>
          <Route element={<RequirePermission perm="promotions.regionCriteriaMapping.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/promotions/region-criteria-mapping" element={<PromoRegionCriteriaMappingPage />} />
          </Route>

          <Route path="/chat" element={<ChatPage />} />

          {/* Utilities */}
          <Route element={<RequirePermission perm="utilities.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/utilities" element={<UtilitiesSelection />} />
          </Route>
          <Route element={<RequirePermission perm="mdmEmailTracker.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/utilities/emailtracker" element={<EmailTracker />} />
            <Route path="/utilities/emailtracker/bulk-import" element={<EmailBulkUpload />} />
          </Route>
          <Route element={<RequirePermission perm="utilities.manualRecons.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/utilities/manualrecons" element={<ManualReconsEntry />} />
          </Route>
          <Route element={<RequirePermission perm="utilities.dateConverter.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/utilities/date-converter" element={<UtilitiesDate />} />
          </Route>

          {/* Reports */}
          <Route element={<RequirePermission perm="reports.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/reports" element={<ReportSelection />} />
          </Route>
          <Route element={<RequirePermission perm="reports.summaryRecons.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/reports/summary_recons" element={<ReportSummary />} />
          </Route>
          <Route element={<RequirePermission perm="mismatch.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/reports/mismatch-tracker" element={<MismatchTrackerReport />} />
          </Route>
          <Route element={<RequirePermission perm="reports.mismatchList.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/reports/mismatch-list" element={<MismatchListReport />} />
          </Route>
          <Route element={<RequirePermission perm="reports.matrixRecons.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/reports/matrix_recons" element={<MatrixReconsReport />} />
          </Route>
          <Route element={<RequirePermission perm="reports.dss.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/reports/DSS" element={<DSSreport />} />
          </Route>
          <Route element={<RequirePermission perm="reports.reconSchedule.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/reports/recon-schedule" element={<ReconScheduleReport />} />
          </Route>

          {/* Reconciliation (Tools) */}
          <Route element={<RequirePermission perm="tools.reconciliation.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/recons" element={<ReconsMainPage />} />
            <Route path="/recons/hpc" element={<ReconsHPCPage />} />
            <Route path="/recons/ic" element={<ReconsICPage />} />
            <Route path="/recons/custom" element={<ReconsCustom />} />
            <Route path="/recons/summary" element={<Recons_SummaryPage />} />
            <Route path="/recons/result" element={<Recons_ResultPage />} />
            <Route path="/recons/upload" element={<ReconciliationUploadPage />} />

            <Route path="/recons/period" element={<PeriodReconsPage />} />
            <Route path="/recons/cells" element={<ReconsCellsPage />} />
            <Route path="/recons/config" element={<ReconsConfigPage />} />
            <Route path="/recons/bulk_import" element={<ReconsBulkImportPage />} />
          </Route>

          <Route element={<RequirePermission perm="tools.detailedView.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/detailed-view" element={<DetailedView />} />
          </Route>
          <Route path="/in-progress" element={<InProgressPage />} />

          {/* Master Data */}
          <Route element={<RequirePermission perm="masterData.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/master-data" element={<MasterDataPage />} />
          </Route>
          <Route element={<RequirePermission perm="masterData.distributors.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/master-data/distributors" element={<MasterDistributorPage />} />
          </Route>
          <Route element={<RequirePermission perm="masterData.countries.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/master-data/countries" element={<MasterCountryPage />} />
          </Route>
          <Route element={<RequirePermission perm="masterData.business.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/master-data/business" element={<MasterBusinessPage />} />
          </Route>
          <Route element={<RequirePermission perm="masterData.reportTypes.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/master-data/report-types" element={<MasterReportTypePage />} />
          </Route>
          <Route element={<RequirePermission perm="masterData.years.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/master-data/years" element={<MasterYearPage />} />
          </Route>
          <Route element={<RequirePermission perm="masterData.sku.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/master-data/sku" element={<MasterSkuPage />} />
          </Route>
          <Route element={<RequirePermission perm="masterData.mapping.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/master-data/map-report-business" element={<MasterBusinessReportTypeMapPage />} />
          </Route>
          <Route element={<RequirePermission perm="masterData.reconsButtonMapping.view" fallback={<UnauthorizedPage />} />}>
            <Route path="/recons/button-mapping" element={<ReconsButtonMappingPage />} />
          </Route>


          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/admin/users" element={<AdminManageControl />} />
          <Route path="/settings/admin/licenses" element={<AdminLicenses />} />
          <Route path="/settings/admin/permission" element={<RolePermission />} />
          <Route path="/settings/admin/register-pic" element={<RegisterPICPage />} />

          <Route path="/contact" element={<ContactPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

import React, { useMemo, useState } from 'react';
import { motion, MotionConfig, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from "../hooks/usePermissions";
import {
  FileBarChart2,
  Lock,
  Search,
  ChevronRight,
} from 'lucide-react';

const STATUS_KEY = "reports.status.view";
const STATUS_PATH = "/reports/matrix_recons";

// Shared icon for all reports
const ReportIcon = FileBarChart2;

/** DATA ------------------------------------------------------------------ */
const generalReports = [
  {
    title: 'Reconciliation Summary Report',
    description: 'Visualize reconciliation data with summary charts and trends of matched/mismatched records.',
    path: '/reports/summary_recons',
  },
  {
    title: 'Reconciliation Status Report',
    description: 'Check reconciliation report status by year, month, and business type.',
    path: STATUS_PATH,
    gated: true,
  },
  {
    title: 'Mismatch Tracker Report',
    description: 'View a detailed list of all records with “Mismatch” status only, for follow-up action.',
    path: '/reports/mismatch-tracker',
  },
];

const requestReports = [
  {
    title: 'Daily Sales Summary Report',
    description: 'View daily sales performance and summary for all distributors.',
    path: '/reports/DSS',
  },
  {
    title: 'Recons Tracker Report',
    description: 'Monitor and track the status of each distributor’s reconciliation report.',
    path: '/reports/mismatch-tracker',
  },
  {
    title: 'Recons Summary Report',
    description: 'Get an overview of reconciliation progress across all distributors.',
    path: '#',
  },
];

/** ANIMATION ------------------------------------------------------------- */
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } }
};

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: (customDelay = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.24, delay: customDelay }
  })
};

/** SMALL UTILS ----------------------------------------------------------- */
// Compact, tag-like badges with light background & dark text
const sectionStyles = {
  general: {
    badge: 'bg-blue-100 text-blue-800 border border-blue-200',
    iconBg: 'bg-blue-100',
  },
  request: {
    badge: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    iconBg: 'bg-yellow-100',
  },
};

/** COMPONENTS ------------------------------------------------------------ */
function SectionBadge({ label, className = '' }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] leading-none font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function SkeletonCard({ accent, badgeClass, badgeLabel }) {
  return (
    <motion.div
      variants={cardVariants}
      className="relative border p-4 rounded-2xl shadow bg-white min-h-[148px]"
      aria-hidden="true"
    >
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-xl animate-pulse ${accent}`} />
        <div className="flex-1">
          {/* Title row with badge right (compact) */}
          <div className="flex items-center justify-between mb-2">
            <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
            <div className={`h-4 w-14 rounded-full ${badgeClass} animate-pulse`} />
          </div>
          <div className="h-3 w-full bg-gray-200 rounded mb-1 animate-pulse" />
          <div className="h-3 w-5/6 bg-gray-200 rounded mb-3 animate-pulse" />
          <div className="h-9 w-32 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}

function ReportCard({
  title,
  description,
  onClick,
  locked = false,
  accent,
  badgeLabel,
  badgeClass,
}) {
  return (
    <motion.div
      custom={0}
      variants={cardVariants}
      whileHover={{ scale: 1.015 }}
      className="group relative border p-4 rounded-2xl shadow bg-white min-h-[148px]
        focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-offset-2 focus-within:ring-offset-white"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`shrink-0 rounded-xl border p-2 ${accent}`}>
          <ReportIcon className="opacity-90 text-current" size={24} aria-hidden="true" />
        </div>

        {/* Title + badge row */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold leading-snug truncate">{title}</h3>
            <div className="ml-auto flex items-center gap-2">
              {/* badge on same line, right side */}
              <SectionBadge label={badgeLabel} className={badgeClass} />
              {locked && (
                <span className="rounded-full bg-gray-100 border text-gray-500 p-1.5">
                  <Lock size={14} aria-hidden="true" />
                </span>
              )}
            </div>
          </div>

          <p className="text-sm text-gray-600 mt-1">{description}</p>

          <div className="mt-3">
            <button
              type="button"
              onClick={onClick}
              disabled={locked}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg
                transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500
                ${locked
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              aria-disabled={locked}
              aria-label={locked ? `${title} (locked)` : `Open ${title}`}
            >
              View Report
              {!locked && <ChevronRight size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {/* Whole card clickable */}
      {!locked && (
        <button
          type="button"
          className="absolute inset-0 rounded-2xl focus:outline-none"
          onClick={onClick}
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
    </motion.div>
  );
}

/** PAGE ------------------------------------------------------------------ */
export default function ReportsPage() {
  const navigate = useNavigate();
  const { loading: permsLoading, can } = usePermissions();
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");

  const canSeeStatusReport = !permsLoading && can(STATUS_KEY) === true;

  const filterList = (list) =>
    list.filter(
      (r) =>
        r.title.toLowerCase().includes(query.toLowerCase()) ||
        r.description.toLowerCase().includes(query.toLowerCase())
    );

  const filteredGeneral = useMemo(() => filterList(generalReports), [query]);
  const filteredRequest = useMemo(() => filterList(requestReports), [query]);

  const KEEP_SPACER = false;

  return (
      <MotionConfig reducedMotion={reduceMotion ? "user" : "never"}>
        <div className="p-6">
          {/* Header */}
          <header className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Reports</h1>
              <p className="text-sm text-gray-600">
                Browse insights and operational reports. Use the search to quickly find a report.
              </p>
            </div>

            <label
              htmlFor="report-search"
              className="relative flex items-center gap-2 px-3 py-2 rounded-xl border bg-white w-full sm:w-72"
            >
              <Search size={16} className="text-gray-500" aria-hidden="true" />
              <input
                id="report-search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search reports…"
                className="w-full outline-none text-sm placeholder:text-gray-400"
              />
            </label>
          </header>

          {/* GENERAL REPORTS */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-2 border-l-4 border-blue-600 pl-3 bg-blue-50 py-1 rounded">
              General Reports
            </h2>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid gap-4 grid-cols-1 md:grid-cols-2"
            >
              {filteredGeneral.map((report, index) => {
                const { title, description, path, gated } = report;
                const isGated = gated === true && path === STATUS_PATH;

                if (isGated && permsLoading) {
                  return (
                    <SkeletonCard
                      key={`skeleton-${index}`}
                      accent={sectionStyles.general.iconBg}
                      badgeClass={sectionStyles.general.badge}
                      badgeLabel="General"
                    />
                  );
                }

                if (isGated && !canSeeStatusReport) {
                  return KEEP_SPACER ? (
                    <motion.div
                      key={`spacer-${index}`}
                      variants={cardVariants}
                      className="invisible border p-4 rounded-2xl shadow bg-white min-h-[148px]"
                    />
                  ) : null;
                }

                return (
                  <ReportCard
                    key={index}
                    title={title}
                    description={description}
                    accent={sectionStyles.general.iconBg}
                    badgeClass={sectionStyles.general.badge}
                    badgeLabel="General"
                    locked={false}
                    onClick={() => navigate(path)}
                  />
                );
              })}
            </motion.div>
          </section>

          {/* REQUEST REPORTS */}
          <section>
            <h2 className="text-lg font-semibold mb-2 border-l-4 border-yellow-600 pl-3 bg-yellow-50 py-1 rounded">
              Request Reports
            </h2>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid gap-4 grid-cols-1 md:grid-cols-2"
            >
              {filteredRequest.map((report, index) => {
                const { title, description, path } = report;
                return (
                  <ReportCard
                    key={index}
                    title={title}
                    description={description}
                    accent={sectionStyles.request.iconBg}
                    badgeClass={sectionStyles.request.badge}
                    badgeLabel="Request"
                    onClick={() => navigate(path)}
                  />
                );
              })}
            </motion.div>
          </section>
        </div>
      </MotionConfig>
  );
}

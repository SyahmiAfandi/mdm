import React, { useMemo, useState } from 'react';
import { motion, MotionConfig, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from "../../hooks/usePermissions";
import {
    FileBarChart2,
    Lock,
    Search,
    ChevronRight,
    BarChart3,
    X,
    FileSearch,
    TrendingUp,
    ClipboardList,
    ListFilter,
} from 'lucide-react';

const STATUS_KEY = "reports.status.view";
const STATUS_PATH = "/reports/matrix_recons";

/** DATA ------------------------------------------------------------------ */
const generalReports = [
    {
        title: 'Reconciliation Summary Report',
        description: 'Visualize reconciliation data with summary charts and trends of matched/mismatched records.',
        path: '/reports/summary_recons',
        icon: TrendingUp,
    },
    {
        title: 'Mismatch Tracker Report',
        description: 'View a detailed list of all records with "Mismatch" status only, for follow-up action.',
        path: '/reports/mismatch-tracker',
        icon: FileSearch,
    },
];

const requestReports = [
    {
        title: 'Daily Sales Summary Report',
        description: 'View daily sales performance and summary for all distributors.',
        path: '/reports/DSS',
        icon: BarChart3,
    },
    {
        title: 'Recons Tracker Report',
        description: "Monitor and track the status of each distributor's reconciliation report.",
        path: '/reports/recon-schedule',
        icon: ClipboardList,
    },
    {
        title: 'Reconciliation Status Report',
        description: 'Get an overview of reconciliation progress across all distributors.',
        path: STATUS_PATH,
        gated: true,
        icon: FileBarChart2,
    },
];

/** ANIMATION ------------------------------------------------------------- */
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.07, delayChildren: 0.15, duration: 0.3 }
    },
};

const cardVariants = {
    hidden: { opacity: 0, scale: 0.97 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
    },
};

/** SECTION STYLES -------------------------------------------------------- */
const sectionStyles = {
    general: {
        badge: 'bg-blue-100 text-blue-700 border border-blue-200',
        iconBg: 'from-blue-500 to-indigo-500',
        iconText: 'text-white',
        accentBar: 'bg-blue-500',
        ctaBg: 'bg-blue-600 hover:bg-blue-700',
        ringFocus: 'focus-within:ring-blue-400',
        glow: 'group-hover:shadow-blue-100',
    },
    request: {
        badge: 'bg-amber-100 text-amber-700 border border-amber-200',
        iconBg: 'from-amber-400 to-orange-500',
        iconText: 'text-white',
        accentBar: 'bg-amber-500',
        ctaBg: 'bg-amber-500 hover:bg-amber-600',
        ringFocus: 'focus-within:ring-amber-400',
        glow: 'group-hover:shadow-amber-100',
    },
};

/** COMPONENTS ------------------------------------------------------------ */

function SectionHeader({ label, count, accentBar, badge }) {
    return (
        <div className="flex items-center gap-3 mb-3">
            <div className={`w-1 h-5 rounded-full ${accentBar}`} />
            <h2 className="text-sm font-bold text-gray-800 tracking-tight">{label}</h2>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge}`}>
                {count} report{count !== 1 ? 's' : ''}
            </span>
        </div>
    );
}

function SkeletonCard() {
    return (
        <motion.div
            variants={cardVariants}
            className="relative border border-gray-100 p-5 rounded-2xl shadow-sm bg-white min-h-[160px] animate-pulse"
            aria-hidden="true"
        >
            <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-xl bg-gray-200 shrink-0" />
                <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="h-4 w-44 bg-gray-200 rounded" />
                        <div className="h-5 w-16 bg-gray-100 rounded-full" />
                    </div>
                    <div className="h-3 w-full bg-gray-100 rounded" />
                    <div className="h-3 w-4/5 bg-gray-100 rounded" />
                    <div className="mt-4 h-8 w-28 bg-gray-200 rounded-lg" />
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
    styles,
    badgeLabel,
    ReportIcon = FileBarChart2,
}) {
    return (
        <motion.div
            variants={cardVariants}
            whileHover={locked ? {} : { y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
            className={`group relative border border-gray-100 rounded-2xl shadow-sm bg-white overflow-hidden
        focus-within:ring-2 focus-within:ring-offset-2 ${styles.ringFocus} transition-shadow duration-200`}
        >
            {/* Top accent stripe */}
            <div className={`h-0.5 w-full bg-gradient-to-r ${styles.iconBg}`} />

            <div className="p-4">
                <div className="flex items-start gap-3">
                    {/* Gradient Icon */}
                    <div className={`shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${styles.iconBg} flex items-center justify-center shadow-sm`}>
                        <ReportIcon className={styles.iconText} size={18} aria-hidden="true" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-0.5">
                            <h3 className="text-sm font-semibold text-gray-900 leading-snug">{title}</h3>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${styles.badge}`}>
                                    {badgeLabel}
                                </span>
                                {locked && (
                                    <span className="rounded-full bg-gray-100 border border-gray-200 text-gray-400 p-1" title="Access restricted">
                                        <Lock size={12} aria-hidden="true" />
                                    </span>
                                )}
                            </div>
                        </div>

                        <p className="text-xs text-gray-500 leading-relaxed">{description}</p>

                        <div className="mt-2.5">
                            <button
                                type="button"
                                onClick={onClick}
                                disabled={locked}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg text-white
                  transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1
                  ${locked
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : `${styles.ctaBg} active:scale-95 shadow-sm`
                                    }`}
                                aria-disabled={locked}
                                aria-label={locked ? `${title} (restricted)` : `Open ${title}`}
                            >
                                {locked ? 'Restricted' : 'View Report'}
                                {!locked && <ChevronRight size={14} aria-hidden="true" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Whole-card click overlay (not locked only) */}
            {!locked && (
                <button
                    type="button"
                    className="absolute inset-0 rounded-2xl focus:outline-none"
                    onClick={onClick}
                    tabIndex={-1}
                    aria-hidden="true"
                />
            )}

            {/* Locked overlay */}
            {locked && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-2xl flex items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center gap-1 text-gray-400">
                        <Lock size={22} />
                        <span className="text-[10px] font-semibold">Access Restricted</span>
                    </div>
                </div>
            )}
        </motion.div>
    );
}

function EmptyState({ query }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="col-span-full flex flex-col items-center justify-center py-12 text-center"
        >
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                <FileSearch size={22} className="text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">No reports found</p>
            <p className="text-xs text-gray-400 mt-1">
                No results for <span className="font-medium text-gray-600">"{query}"</span>. Try a different term.
            </p>
        </motion.div>
    );
}

/** PAGE ------------------------------------------------------------------ */
export default function ReportMainPage() {
    const navigate = useNavigate();
    const { loading: permsLoading, can } = usePermissions();
    const reduceMotion = useReducedMotion();
    const [query, setQuery] = useState('');

    const canSeeStatusReport = !permsLoading && can(STATUS_KEY) === true;

    const filterList = (list) =>
        list.filter(
            (r) =>
                r.title.toLowerCase().includes(query.toLowerCase()) ||
                r.description.toLowerCase().includes(query.toLowerCase())
        );

    const filteredGeneral = useMemo(() => filterList(generalReports), [query]);
    const filteredRequest = useMemo(() => filterList(requestReports), [query]);

    const totalResults = filteredGeneral.length + filteredRequest.length;

    return (
        <MotionConfig reducedMotion={reduceMotion ? 'user' : 'never'}>
            <div className="w-full min-w-0 px-3 sm:px-5 pb-3 flex flex-col">

                {/* ── Hero Banner ── */}
                <div className="relative overflow-hidden rounded-2xl mb-4 shrink-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 shadow-md shadow-blue-200 px-5 py-3 sm:py-4">
                    {/* Decorative circles */}
                    <div className="pointer-events-none absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/10" />
                    <div className="pointer-events-none absolute -bottom-12 right-24 w-28 h-28 rounded-full bg-white/10" />
                    <div className="pointer-events-none absolute top-2 right-48 w-10 h-10 rounded-full bg-white/10" />

                    <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-8 h-8 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center">
                                    <FileBarChart2 size={17} className="text-white" />
                                </div>
                                <h1 className="text-xl font-extrabold text-white tracking-tight">
                                    Reports
                                </h1>
                                <span className="inline-flex items-center rounded-full bg-white/20 text-white px-2 py-0.5 text-[10px] font-bold tracking-wide border border-white/30">
                                    MDM
                                </span>
                            </div>
                            <p className="text-blue-100 text-xs sm:text-sm max-w-sm">
                                Browse operational insights and analytics reports. Use the search to quickly find what you need.
                            </p>
                        </div>

                        {/* Search bar inside banner */}
                        <label
                            htmlFor="report-search"
                            className="relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/15 border border-white/25 backdrop-blur-sm w-full sm:w-64 cursor-text"
                        >
                            <Search size={15} className="text-white/70 shrink-0" aria-hidden="true" />
                            <input
                                id="report-search"
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search reports…"
                                className="w-full bg-transparent outline-none text-sm text-white placeholder:text-white/50 font-medium"
                            />
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => setQuery('')}
                                    className="text-white/60 hover:text-white/90 transition-colors"
                                    aria-label="Clear search"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </label>
                    </div>

                    {/* Search result hint */}
                    {query && (
                        <div className="relative mt-3 text-[11px] text-blue-100 font-medium">
                            {totalResults > 0
                                ? `${totalResults} result${totalResults !== 1 ? 's' : ''} for "${query}"`
                                : `No results for "${query}"`}
                        </div>
                    )}
                </div>

                {/* ── 2-Column Reports Grid ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    {/* ── General Reports (Left Column) ── */}
                    <div className="flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <SectionHeader
                            label="General Reports"
                            count={filteredGeneral.length}
                            accentBar={sectionStyles.general.accentBar}
                            badge={sectionStyles.general.badge}
                        />

                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="pr-2 space-y-3"
                        >
                            {filteredGeneral.length === 0 && query ? (
                                <EmptyState query={query} />
                            ) : (
                                filteredGeneral.map((report, index) => {
                                    const { title, description, path, gated, icon: ReportIcon } = report;
                                    const isGated = gated === true && path === STATUS_PATH;

                                    if (isGated && permsLoading) {
                                        return <SkeletonCard key={`skeleton-${index}`} />;
                                    }

                                    const isLocked = isGated && !canSeeStatusReport;

                                    return (
                                        <ReportCard
                                            key={index}
                                            title={title}
                                            description={description}
                                            styles={sectionStyles.general}
                                            badgeLabel="General"
                                            locked={isLocked}
                                            ReportIcon={ReportIcon || FileBarChart2}
                                            onClick={() => !isLocked && navigate(path)}
                                        />
                                    );
                                })
                            )}
                        </motion.div>
                    </div>

                    {/* ── Request Reports (Right Column) ── */}
                    <div className="flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                        <SectionHeader
                            label="Request Reports"
                            count={filteredRequest.length}
                            accentBar={sectionStyles.request.accentBar}
                            badge={sectionStyles.request.badge}
                        />

                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="pr-2 space-y-3"
                        >
                            {filteredRequest.length === 0 && query ? (
                                <EmptyState query={query} />
                            ) : (
                                filteredRequest.map((report, index) => {
                                    const { title, description, path, icon: ReportIcon } = report;
                                    return (
                                        <ReportCard
                                            key={index}
                                            title={title}
                                            description={description}
                                            styles={sectionStyles.request}
                                            badgeLabel="Request"
                                            ReportIcon={ReportIcon || FileBarChart2}
                                            onClick={() => navigate(path)}
                                        />
                                    );
                                })
                            )}
                        </motion.div>
                    </div>
                </div>

            </div>
        </MotionConfig>
    );
}

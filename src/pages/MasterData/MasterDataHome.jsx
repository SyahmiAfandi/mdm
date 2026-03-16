import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../supabaseClient";

import { usePermissions } from "../../hooks/usePermissions";
import { motion, MotionConfig, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  Database,
  Building2,
  Globe,
  Layers,
  ClipboardList,
  GitMerge,
  Shield,
  ArrowRight,
  ShieldCheck,
  Package,
  Lock,
  Sparkles,
  Boxes,
} from "lucide-react";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

/** ANIMATION VARIANTS */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.15, duration: 0.3 }
  },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
};

/** COMPONENTS */
function StatCard({ label, value, loading, icon: Icon, colorClass }) {
  return (
    <div className="flex items-center gap-3 bg-white/15 backdrop-blur-md border border-white/20 rounded-xl px-4 py-2.5">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-white/20 ${colorClass}`}>
        <Icon size={16} className="text-white" />
      </div>
      <div>
        <div className="text-[10px] font-medium text-white/70 uppercase tracking-widest">{label}</div>
        <div className="text-sm font-bold text-white leading-tight">
          {loading ? "..." : value}
        </div>
      </div>
    </div>
  );
}

function Badge({ tone = "success", children }) {
  const cls =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold"
      : tone === "warn"
        ? "bg-amber-50 text-amber-700 border-amber-200 font-bold"
        : "bg-gray-100 text-gray-500 border-gray-200 font-semibold";

  return (
    <span className={classNames("text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0", cls)}>
      {children}
    </span>
  );
}

function SectionHeader({ label, desc, count, iconBg }) {
  return (
    <div className="flex items-center gap-3 mb-3 shrink-0">
      <div className={`w-1.5 h-5 rounded-full bg-gradient-to-b ${iconBg}`} />
      <div>
        <h2 className="text-base font-bold text-gray-800 tracking-tight flex items-center gap-2">
          {label}
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-[10px] text-slate-500 border border-slate-200">
            {count}
          </span>
        </h2>
        {desc && <p className="text-[11px] text-gray-500 mt-0.5">{desc}</p>}
      </div>
    </div>
  );
}

function InfoCard({ title, desc, to, icon, status = "ready", disabled, iconColor }) {
  const isComingSoon = status === "coming";
  const isDisabled = disabled || isComingSoon;

  const cardContent = (
    <motion.div
      variants={cardVariants}
      whileHover={isDisabled ? {} : { y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}
      className={classNames(
        "group relative border border-gray-100 rounded-2xl shadow-sm bg-white overflow-hidden transition-all duration-200",
        isDisabled ? "opacity-60 grayscale-[30%] cursor-not-allowed" : "cursor-pointer",
        !isDisabled && "hover:border-blue-100"
      )}
    >
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${iconColor}`} />

      <div className="p-3.5 sm:p-4 flex items-start gap-3">
        <div className={`shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${iconColor} flex items-center justify-center shadow-sm text-white`}>
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-sm font-bold text-gray-900 leading-snug truncate">{title}</h3>
            {isComingSoon ? (
              <Badge tone="default">Coming Soon</Badge>
            ) : isDisabled ? (
              <Badge tone="default">Locked</Badge>
            ) : (
              <Badge tone="success">Ready</Badge>
            )}
          </div>

          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{desc}</p>

          <div className="mt-2.5 flex items-center font-semibold text-xs">
            {isDisabled ? (
              <span className="flex items-center gap-1.5 text-slate-400">
                <Lock className="w-3.5 h-3.5" /> Locked
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-600 group-hover:text-blue-600 transition-colors">
                Open Module <ArrowRight className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );

  if (isDisabled) return cardContent;

  return (
    <Link to={to} className="block focus:outline-none focus:ring-2 rounded-2xl ring-blue-400 ring-offset-1">
      {cardContent}
    </Link>
  );
}


export default function MasterDataHome() {
  const { can, role } = usePermissions();

  const reduceMotion = useReducedMotion();
  const canViewMaster = can("masterData.view") || can("masterData.*");

  const [loadingCounts, setLoadingCounts] = useState(true);
  const [distCount, setDistCount] = useState(0);
  const [activeDistCount, setActiveDistCount] = useState(0);

  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        setLoadingCounts(true);
        const [{ count: totalCount, error: totalError }, { count: activeCount, error: activeError }] = await Promise.all([
          supabase.from("master_distributors").select("id", { count: "exact", head: true }),
          supabase.from("master_distributors").select("id", { count: "exact", head: true }).eq("active", true),
        ]);

        if (totalError) throw totalError;
        if (activeError) throw activeError;

        if (!alive) return;
        setDistCount(totalCount || 0);
        setActiveDistCount(activeCount || 0);
      } catch {
      } finally {
        if (alive) setLoadingCounts(false);
      }
    }

    if (canViewMaster) run();
    return () => { alive = false; };
  }, [canViewMaster]);

  const mainDataItems = useMemo(
    () => [
      {
        key: "distributors",
        title: "Distributors",
        desc: "Distributor code & name used for autosuggest and validations.",
        to: "/master-data/distributors",
        icon: <Building2 className="w-5 h-5" />,
        status: "ready",
        color: "from-blue-500 to-indigo-600"
      },
      {
        key: "countries",
        title: "Countries",
        desc: "Country list for forms and reporting filters.",
        to: "/master-data/countries",
        icon: <Globe className="w-5 h-5" />,
        status: "ready",
        color: "from-sky-400 to-blue-500"
      },
      {
        key: "business",
        title: "Business Types",
        desc: "Maintain allowed business types (HPC / IC).",
        to: "/master-data/business",
        icon: <Layers className="w-5 h-5" />,
        status: "ready",
        color: "from-violet-500 to-purple-600"
      },
      {
        key: "report-types",
        title: "Report Types",
        desc: "Maintain report type master list used in mapping & manual entry.",
        to: "/master-data/report-types",
        icon: <ClipboardList className="w-5 h-5" />,
        status: "ready",
        color: "from-indigo-400 to-indigo-600"
      },
      {
        key: "years",
        title: "Years",
        desc: "Maintain year list for dropdowns and reporting filters.",
        to: "/master-data/years",
        icon: <CalendarDays className="w-5 h-5" />,
        status: "ready",
        color: "from-fuchsia-500 to-pink-600"
      },
      {
        key: "sku",
        title: "SKU Master",
        desc: "Maintain SKU list for promotions use and others.",
        to: "/master-data/sku",
        icon: <Package className="w-5 h-5" />,
        status: "ready",
        color: "from-teal-500 to-emerald-500"
      },
    ],
    []
  );

  const mappingItems = useMemo(
    () => [
      {
        key: "map-report-business",
        title: "Business Type Mapping",
        desc: "Control which report types are available under each business type.",
        to: "/master-data/map-report-business",
        icon: <GitMerge className="w-5 h-5" />,
        status: "ready",
        color: "from-amber-400 to-orange-500"
      },
    ],
    []
  );

  if (!canViewMaster) {
    return (
      <div className="max-w-3xl mx-auto p-6 mt-10">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">Access Restricted</div>
              <div className="mt-1 text-sm text-gray-500 leading-relaxed">
                You don't have permission to view Master Data settings. Please contact your administrator if you believe this is an error.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion={reduceMotion ? 'user' : 'never'}>
      {/* PERFECT FIT CONTAINER */}
      <div className="w-full min-w-0 px-3 sm:px-5 pb-3 flex flex-col">

        {/* ── Hero Banner ── */}
        <div className="relative overflow-hidden rounded-2xl mb-4 shrink-0 bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-700 shadow-md shadow-blue-200 px-5 py-3.5">
          {/* Decorative shapes */}
          <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="absolute -bottom-12 right-1/4 w-32 h-32 rounded-full bg-indigo-400/20 blur-2xl pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center shadow-inner shrink-0">
                <Database size={20} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                    Master Data
                  </h1>
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-100 bg-black/20 px-2 py-0.5 rounded-full border border-white/10">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> {role || "-"}
                  </div>
                </div>
                <p className="text-indigo-100 text-xs sm:text-sm max-w-xl leading-relaxed mt-0.5">
                  Centrally manage reference lists, mapping rules, and core configurations used across the MDM application.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <StatCard
                label="Total Dist"
                value={distCount}
                loading={loadingCounts}
                icon={Building2}
                colorClass="text-indigo-100"
              />
              <StatCard
                label="Active Dist"
                value={activeDistCount}
                loading={loadingCounts}
                icon={Sparkles}
                colorClass="text-emerald-300"
              />
            </div>
          </div>
        </div>

        {/* ── 2-Column Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Reference Data Column */}
          <div className="flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 pb-2">
            <SectionHeader
              label="Reference Data"
              desc="Maintain single-source-of-truth master lists."
              count={mainDataItems.length}
              iconBg="from-blue-500 to-indigo-500"
            />

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="pr-2 pb-3 space-y-3"
            >
              {mainDataItems.map(({ key, ...item }) => (
                <InfoCard
                  key={key}
                  {...item}
                  iconColor={item.color}
                />
              ))}
            </motion.div>
          </div>

          {/* Mappings & Rules Column */}
          <div className="flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 pb-2">
            <SectionHeader
              label="Mappings & Rules"
              desc="Configure relationships between data entities."
              count={mappingItems.length}
              iconBg="from-amber-400 to-orange-500"
            />

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="pr-2 pb-3 space-y-3"
            >
              {mappingItems.map(({ key, ...item }) => (
                <InfoCard
                  key={key}
                  {...item}
                  iconColor={item.color}
                />
              ))}
            </motion.div>
          </div>

        </div>
      </div>
    </MotionConfig>
  );
}

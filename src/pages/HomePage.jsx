// src/pages/HomePage.jsx
import React, { useMemo, useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  UploadCloud,
  BarChart2,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Link as LinkIcon,
  ShieldCheck,
  Info,
  Mail,
  FileSpreadsheet,
  Clock3,
  ArrowRight,
  ArrowLeft,
  Check,
  Settings,
  ClipboardList,
} from "lucide-react";

import { supabase } from "../supabaseClient";

import useReconsProgress from "../hooks/useReconsProgress";
import useEmailTrackerSummaryCounts from "../hooks/useEmailTrackerSummaryCounts";
import useReportExtractionSummaryCounts from "../hooks/useReportExtractionSummaryCounts";
import { usePermissions } from "../hooks/usePermissions";
import { useUser } from "../context/UserContext";
import { getBackendUrl } from "../config/backend";

/**
 * HomePage — Responsive Dashboard (desktop + mobile)
 * Fixes:
 *  - Email tracker "loading/failed loop" caused by re-subscribing onSnapshot due to refresh function identity changes
 *  - Prevents overlapping health polls + reduces UI flicker
 */

const GAS_HEALTH_URL = import.meta.env.VITE_GAS_HEALTH_URL;
const FLASK_HEALTH_URL = import.meta.env.VITE_FLASK_HEALTH_URL || `${getBackendUrl()}/test`;
const HEALTH_POLL_MS = 60000;
const HOME_RECENT_KEY = "home_recent_links_v1";
const RECONS_MONTH_OPTIONS = [
  { value: "", label: "All months" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function getDefaultReconsFilter() {
  const now = new Date();
  let defaultYear = now.getFullYear();
  let prevMonthIndex = now.getMonth() - 1;

  if (prevMonthIndex < 0) {
    prevMonthIndex = 11;
    defaultYear -= 1;
  }

  return {
    defaultYear,
    defaultMonth: String(prevMonthIndex + 1),
  };
}

function buildReconsHint(year, month) {
  if (!year) return "";
  const monthLabel = RECONS_MONTH_OPTIONS.find((m) => m.value === String(month))?.label || "";
  return `Filter: ${year}${month ? ` • ${monthLabel}` : ""}`;
}

function loadRecentLaunches() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(HOME_RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item.href === "string" && typeof item.title === "string")
      .slice(0, 5);
  } catch {
    return [];
  }
}

function saveRecentLaunches(items) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(HOME_RECENT_KEY, JSON.stringify(items));
  } catch {
    // ignore local storage write issues
  }
}

function formatRoleLabel(role) {
  return String(role || "user")
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatRelativeTime(isoString) {
  const timestamp = new Date(isoString).getTime();
  if (!Number.isFinite(timestamp)) return "Just now";

  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(timestamp).toLocaleDateString([], {
    day: "2-digit",
    month: "short",
  });
}

function FlipReconsCard() {
  const { defaultYear, defaultMonth } = getDefaultReconsFilter();
  const [yearsLoading, setYearsLoading] = useState(true);
  const [masterYears, setMasterYears] = useState([]);
  const didInitRef = useRef(false);
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);
  const [draftYear, setDraftYear] = useState(defaultYear);
  const [draftMonth, setDraftMonth] = useState(defaultMonth);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadYears() {
      try {
        setYearsLoading(true);

        const { data, error } = await supabase
          .from("master_years")
          .select("*")
          .order("year", { ascending: false });

        if (error) throw error;

        const years = data
          .filter((r) => r && r.active !== false)
          .map((r) => Number(r.year))
          .filter((y) => Number.isFinite(y));

        if (!alive) return;

        setMasterYears(years);

        if (!didInitRef.current && years.length) {
          didInitRef.current = true;
          setYear(years[0]);
          setDraftYear(years[0]);
        }
      } catch (e) {
        console.error("loadYears:", e);
      } finally {
        if (alive) setYearsLoading(false);
      }
    }

    loadYears();
    return () => {
      alive = false;
    };
  }, []);

  const reconsProgress = useReconsProgress({
    year,
    month: month === "" ? undefined : Number(month),
  });

  const yearOptions = useMemo(() => {
    if (masterYears.length) return masterYears;
    return Array.from({ length: 5 }, (_, i) => defaultYear - 2 + i);
  }, [masterYears, defaultYear]);

  const cardSubtitle = reconsProgress.loading
    ? "Loading..."
    : reconsProgress.hasData
      ? "Latest run"
      : "No data yet";

  function openSettings() {
    setDraftYear(year);
    setDraftMonth(month);
    setFlipped(true);
  }

  function applyFilter() {
    setYear(Number(draftYear));
    setMonth(draftMonth);
    setFlipped(false);
  }

  return (
    <div className="relative [perspective:1200px] h-full">
      <div
        className={[
          "relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d]",
          flipped ? "[transform:rotateY(180deg)]" : "",
        ].join(" ")}
      >
        <div className={`absolute inset-0 h-full [backface-visibility:hidden] ${flipped ? "pointer-events-none z-0 hidden sm:block" : "z-10"}`} style={{ WebkitBackfaceVisibility: "hidden" }}>
          <ReconsDashboardCard
            className="h-full"
            title="Recons Progress"
            subtitle={cardSubtitle}
            icon={<FileSpreadsheet size={18} />}
            percent={reconsProgress.percentDone}
            hint={buildReconsHint(year, month)}
            footer={
              <div className="grid grid-cols-2 gap-2 mt-2">
                <TinyPill
                  icon={FileSpreadsheet}
                  label="Processed"
                  value={reconsProgress.processed}
                  sub={`/ ${reconsProgress.total}`}
                  tone="blue"
                />
                <TinyPill icon={AlertTriangle} label="Mismatch" value={reconsProgress.mismatches} tone="red" />
                <TinyPill icon={CheckCircle2} label="Matched" value={reconsProgress.matched} tone="green" />
                <TinyPill icon={Clock3} label="Last Run" value={reconsProgress.lastRunLabel} tone="gray" />
              </div>
            }
            cta={{ href: "/reports/matrix_recons", label: "Open Report" }}
            actionLeft={
              <button
                type="button"
                onClick={openSettings}
                className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg ring-1 ring-emerald-200/50 dark:ring-emerald-800/50 bg-white dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all text-xs font-bold text-emerald-600 dark:text-emerald-400 shadow-sm active:scale-95"
                title="Filter"
              >
                <Settings size={14} /> Filter
              </button>
            }
          />
        </div>

        <div className={`absolute inset-0 h-full w-full [backface-visibility:hidden] [transform:rotateY(180deg)] ${flipped ? "z-10" : "pointer-events-none z-0 hidden sm:block"}`} style={{ WebkitBackfaceVisibility: "hidden" }}>
          <div className="bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-100 dark:ring-gray-700 rounded-2xl p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                <Settings size={14} className="text-blue-500" /> Recons Filters
              </div>

              <button
                type="button"
                onClick={() => setFlipped(false)}
                className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition"
              >
                <ArrowLeft size={14} /> Back
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  Year (from Master Data)
                </label>

                <select
                  value={draftYear}
                  onChange={(e) => setDraftYear(e.target.value)}
                  disabled={yearsLoading}
                  className="w-full rounded-xl px-3 py-2 bg-white dark:bg-gray-900/30 ring-1 ring-gray-200 dark:ring-gray-700 text-sm text-gray-800 dark:text-gray-100 disabled:opacity-60"
                >
                  {yearsLoading ? (
                    <option value={draftYear}>Loading...</option>
                  ) : (
                    yearOptions.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                  Month
                </label>
                <select
                  value={draftMonth}
                  onChange={(e) => setDraftMonth(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 bg-white dark:bg-gray-900/30 ring-1 ring-gray-200 dark:ring-gray-700 text-sm text-gray-800 dark:text-gray-100"
                >
                  {RECONS_MONTH_OPTIONS.map((m) => (
                    <option key={m.value || "all"} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <div className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                  Tip: leave "All months" to view the full year summary.
                </div>
              </div>

              <button
                type="button"
                onClick={applyFilter}
                className="inline-flex items-center justify-center gap-1 rounded-xl px-3 py-2 bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition active:scale-[0.98]"
              >
                <Check size={15} /> Apply
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="invisible h-auto opacity-0 pointer-events-none">
        <ReconsDashboardCard
          title="Recons Progress"
          subtitle={cardSubtitle}
          icon={<FileSpreadsheet size={18} />}
          percent={reconsProgress.percentDone}
          hint={buildReconsHint(year, month)}
          footer={
            <div className="grid grid-cols-2 gap-2 mt-2">
              <TinyPill
                icon={FileSpreadsheet}
                label="Processed"
                value={reconsProgress.processed}
                sub={`/ ${reconsProgress.total}`}
                tone="blue"
              />
              <TinyPill icon={AlertTriangle} label="Mismatch" value={reconsProgress.mismatches} tone="red" />
              <TinyPill icon={CheckCircle2} label="Matched" value={reconsProgress.matched} tone="green" />
              <TinyPill icon={Clock3} label="Last Run" value={reconsProgress.lastRunLabel} tone="gray" />
            </div>
          }
          cta={{ href: "/reports/matrix_recons", label: "Open Report" }}
        />
      </div>
    </div>
  );
}

function HomePage() {
  const { can, loading: permissionsLoading, role: permissionRole } = usePermissions();
  const { user, role: userRole } = useUser();
  const [liveNow, setLiveNow] = useState(() => new Date());
  const [recentLaunches, setRecentLaunches] = useState(() => loadRecentLaunches());
  const lastSync = useMemo(
    () =>
      liveNow.toLocaleString([], {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    [liveNow]
  );

  // ---- System Health local state ----
  const [apiStatus, setApiStatus] = useState("Loading...");
  const [dbStatus, setDbStatus] = useState("Loading...");
  const [apiHint, setApiHint] = useState("");
  const [dbHint, setDbHint] = useState("");
  const [apiLatency, setApiLatency] = useState(null);
  const [dbLatency, setDbLatency] = useState(null);
  const [storageStatus, setStorageStatus] = useState("Loading...");
  const [storageHint, setStorageHint] = useState("");
  const [healthCheckedAt, setHealthCheckedAt] = useState(null);
  const [healthRefreshing, setHealthRefreshing] = useState(false);

  const abortRef = useRef(null);
  const runHealthCheckRef = useRef(async () => { });

  // ✅ prevent overlapping health polls + reduce UI flicker
  const inFlightRef = useRef(false);
  const lastHealthRef = useRef({ api: null, db: null });

  /* Write to Supabase */
  async function writeHealthDoc(docId, payload, sourceOverride) {
    try {
      await supabase.from("health").upsert(
        {
          id: docId,
          status: payload.status ?? "Unknown",
          latencyMs: payload.latencyMs ?? null,
          checkedAt: new Date().toISOString(),
          hint: payload.hint ?? null,
          source: sourceOverride ?? payload.source ?? "Unknown",
          url: payload.url ?? null,
          updatedAtStr: payload.updatedAt ?? new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    } catch (e) {
      console.warn("Health doc update failed:", e);
    }
  }

  /*--------------FLIP CARD-------------------- */
  function LegacyFlipReconsCard() {
    const now = new Date();

    // ✅ previous month properly
    let defaultYear = now.getFullYear();
    let prevMonthIndex = now.getMonth() - 1;
    if (prevMonthIndex < 0) {
      prevMonthIndex = 11;
      defaultYear -= 1;
    }
    const defaultMonth = prevMonthIndex + 1; // 1..12

    // ✅ master years state
    const [yearsLoading, setYearsLoading] = useState(true);
    const [masterYears, setMasterYears] = useState([]);
    const didInitRef = useRef(false);

    // ✅ Applied filter (used for fetching)
    const [year, setYear] = useState(defaultYear);
    const [month, setMonth] = useState(String(defaultMonth));

    const [draftYear, setDraftYear] = useState(defaultYear);
    const [draftMonth, setDraftMonth] = useState(String(defaultMonth));

    const [flipped, setFlipped] = useState(false);

    // ✅ Fetch years from master_years (active only)
    useEffect(() => {
      let alive = true;

      async function loadYears() {
        try {
          setYearsLoading(true);

          const { data, error } = await supabase
            .from("master_years")
            .select("*")
            .order("year", { ascending: false });

          if (error) throw error;

          const years = data
            .filter((r) => r && r.active !== false)
            .map((r) => Number(r.year))
            .filter((y) => Number.isFinite(y));

          if (!alive) return;

          setMasterYears(years);

          if (!didInitRef.current && years.length) {
            didInitRef.current = true;
            setYear(years[0]);
            setDraftYear(years[0]);
          }
        } catch (e) {
          console.error("loadYears:", e);
        } finally {
          if (alive) setYearsLoading(false);
        }
      }

      loadYears();
      return () => {
        alive = false;
      };
    }, []);

    const reconsProgress = useReconsProgress({
      year,
      month: month === "" ? undefined : Number(month),
    });

    const yearOptions = useMemo(() => {
      if (masterYears.length) return masterYears;
      return Array.from({ length: 5 }, (_, i) => defaultYear - 2 + i);
    }, [masterYears, defaultYear]);

    const monthOptions = useMemo(
      () => [
        { value: "", label: "All months" },
        { value: "1", label: "January" },
        { value: "2", label: "February" },
        { value: "3", label: "March" },
        { value: "4", label: "April" },
        { value: "5", label: "May" },
        { value: "6", label: "June" },
        { value: "7", label: "July" },
        { value: "8", label: "August" },
        { value: "9", label: "September" },
        { value: "10", label: "October" },
        { value: "11", label: "November" },
        { value: "12", label: "December" },
      ],
      []
    );

    function openSettings() {
      setDraftYear(year);
      setDraftMonth(month);
      setFlipped(true);
    }

    function applyFilter() {
      setYear(Number(draftYear));
      setMonth(draftMonth);
      setFlipped(false);
    }

    return (
      <div className="relative [perspective:1200px] h-full">
        <div
          className={[
            "relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d]",
            flipped ? "[transform:rotateY(180deg)]" : "",
          ].join(" ")}
        >
          {/* FRONT */}
          <div className={`absolute inset-0 h-full [backface-visibility:hidden] ${flipped ? "pointer-events-none z-0 hidden sm:block" : "z-10"}`} style={{ WebkitBackfaceVisibility: 'hidden' }}>
            <ReconsDashboardCard
              className="h-full"
              title="Recons Progress"
              subtitle={
                reconsProgress.loading
                  ? "Loading..."
                  : reconsProgress.hasData
                    ? "Latest run"
                    : "No data yet"
              }
              icon={<FileSpreadsheet size={18} />}
              percent={reconsProgress.percentDone}
              hint={
                year
                  ? `Filter: ${year}${month
                    ? ` • ${monthOptions.find((m) => m.value === String(month))?.label || ""
                    }`
                    : ""
                  }`
                  : ""
              }
              footer={
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <TinyPill
                    icon={FileSpreadsheet}
                    label="Processed"
                    value={reconsProgress.processed}
                    sub={`/ ${reconsProgress.total}`}
                    tone="blue"
                  />
                  <TinyPill icon={AlertTriangle} label="Mismatch" value={reconsProgress.mismatches} tone="red" />
                  <TinyPill icon={CheckCircle2} label="Matched" value={reconsProgress.matched} tone="green" />
                  <TinyPill icon={Clock3} label="Last Run" value={reconsProgress.lastRunLabel} tone="gray" />
                </div>
              }

              cta={{ href: "/reports/matrix_recons", label: "Open Report" }}
              actionLeft={
                <button
                  type="button"
                  onClick={openSettings}
                  className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg ring-1 ring-emerald-200/50 dark:ring-emerald-800/50 bg-white dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all text-xs font-bold text-emerald-600 dark:text-emerald-400 shadow-sm active:scale-95"
                  title="Filter"
                >
                  <Settings size={14} /> Filter
                </button>
              }
            />
          </div>

          {/* BACK: Filters */}
          <div className={`absolute inset-0 h-full w-full [backface-visibility:hidden] [transform:rotateY(180deg)] ${flipped ? "z-10" : "pointer-events-none z-0 hidden sm:block"}`} style={{ WebkitBackfaceVisibility: 'hidden' }}>
            <div className="bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-100 dark:ring-gray-700 rounded-2xl p-4 h-full flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  <Settings size={14} className="text-blue-500" /> Recons Filters
                </div>

                <button
                  type="button"
                  onClick={() => setFlipped(false)}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition"
                >
                  <ArrowLeft size={14} /> Back
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Year (from Master Data)
                  </label>

                  <select
                    value={draftYear}
                    onChange={(e) => setDraftYear(e.target.value)}
                    disabled={yearsLoading}
                    className="w-full rounded-xl px-3 py-2 bg-white dark:bg-gray-900/30 ring-1 ring-gray-200 dark:ring-gray-700 text-sm text-gray-800 dark:text-gray-100 disabled:opacity-60"
                  >
                    {yearsLoading ? (
                      <option value={draftYear}>Loading…</option>
                    ) : (
                      yearOptions.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                    Month
                  </label>
                  <select
                    value={draftMonth}
                    onChange={(e) => setDraftMonth(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 bg-white dark:bg-gray-900/30 ring-1 ring-gray-200 dark:ring-gray-700 text-sm text-gray-800 dark:text-gray-100"
                  >
                    {monthOptions.map((m) => (
                      <option key={m.value || "all"} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <div className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                    Tip: leave "All months" to view the full year summary.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={applyFilter}
                  className="inline-flex items-center justify-center gap-1 rounded-xl px-3 py-2 bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition active:scale-[0.98]"
                >
                  <Check size={15} /> Apply
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* keeps height stable during flip */}
        <div className="invisible h-auto opacity-0 pointer-events-none">
          <ReconsDashboardCard
            title="Recons Progress"
            subtitle={
              reconsProgress.loading
                ? "Loading..."
                : reconsProgress.hasData
                  ? "Latest run"
                  : "No data yet"
            }
            icon={<FileSpreadsheet size={18} />}
            percent={reconsProgress.percentDone}
            hint={
              year
                ? `Filter: ${year}${month
                  ? ` • ${monthOptions.find((m) => m.value === String(month))?.label || ""
                  }`
                  : ""
                }`
                : ""
            }
            footer={
              <div className="grid grid-cols-2 gap-2 mt-2">
                <TinyPill
                  icon={FileSpreadsheet}
                  label="Processed"
                  value={reconsProgress.processed}
                  sub={`/ ${reconsProgress.total}`}
                  tone="blue"
                />
                <TinyPill icon={AlertTriangle} label="Mismatch" value={reconsProgress.mismatches} tone="red" />
                <TinyPill icon={CheckCircle2} label="Matched" value={reconsProgress.matched} tone="green" />
                <TinyPill icon={Clock3} label="Last Run" value={reconsProgress.lastRunLabel} tone="gray" />
              </div>
            }
            cta={{ href: "/reports/matrix_recons", label: "Open Report" }}
          />
        </div>
      </div>
    );
  }

  /* ---- Fetchers ---- */
  async function fetchApiHealth(signal) {
    const res = await fetch(FLASK_HEALTH_URL, { signal, cache: "no-store" });
    if (!res.ok) throw new Error(`API HTTP ${res.status}`);
    const data = await res.json();
    const norm = normalizeHealthPayload(data, FLASK_HEALTH_URL);
    norm.source = "Flask";
    return norm;
  }

  async function fetchSupabaseHealth() {
    const startedAt = performance.now();
    const { error } = await supabase
      .from("health")
      .select("id")
      .limit(1);

    if (error) throw error;

    return {
      status: "UP",
      hint: "Database connection healthy",
      latencyMs: Math.round(performance.now() - startedAt),
      updatedAt: new Date().toISOString(),
      url: "supabase",
      source: "Supabase",
    };
  }

  // ✅ Health poll with guard (no overlapping) + no flicker
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    const hydrate = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setHealthRefreshing(true);

      try {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          setApiStatus("OFFLINE");
          setDbStatus("OFFLINE");
          setApiHint("No internet connection");
          setDbHint("No internet connection");
          setStorageHint("No internet connection");
          setApiLatency(null);
          setDbLatency(null);
          setStorageStatus("OFFLINE");
          return;
        }

        const [api, db, storageRes] = await Promise.allSettled([
          fetchApiHealth(controller.signal),
          fetchSupabaseHealth(),
          supabase.rpc('get_db_size')
        ]);

        const apply = async (key, result, setStatus, setHint, setLatency, docId, fallbackUrl, source) => {
          let next =
            result.status === "fulfilled"
              ? result.value
              : { status: "DOWN", hint: String(result.reason || ""), latencyMs: null, url: fallbackUrl, source };

          const prev = lastHealthRef.current[key];
          const changed =
            !prev ||
            prev.status !== next.status ||
            (prev.hint || "") !== (next.hint || "") ||
            (prev.latencyMs ?? null) !== (next.latencyMs ?? null);

          if (changed) {
            setStatus(next.status);
            setHint(next.hint || "");
            setLatency(next.latencyMs ?? null);
            await writeHealthDoc(docId, next, source);

            lastHealthRef.current[key] = {
              status: next.status,
              hint: next.hint || "",
              latencyMs: next.latencyMs ?? null,
            };
          }
        };

        await apply("api", api, setApiStatus, setApiHint, setApiLatency, "apiService", FLASK_HEALTH_URL, "Flask");
        await apply("db", db, setDbStatus, setDbHint, setDbLatency, "supabaseDb", "supabase", "Supabase");

        if (storageRes.status === "fulfilled") {
          const { data, error } = storageRes.value;
          if (error) {
             setStorageStatus("SETUP NEEDED");
             setStorageHint(error.code === 'PGRST202' ? "Run get_db_size SQL setup" : error.message);
          } else if (data) {
             const left = data.left_mb;
             const percent = data.percent_used;
             setStorageStatus(percent >= 90 ? "WARNING" : "UP");
             setStorageHint(`${left} MB left (${(100 - percent).toFixed(1)}% free)`);
          } else {
             setStorageStatus("N/A");
             setStorageHint("No data");
          }
        } else {
          setStorageStatus("DOWN");
          setStorageHint(String(storageRes.reason || "Check failed"));
        }
      } catch (err) {
        setApiStatus("DOWN");
        setDbStatus("DOWN");
        setStorageStatus("DOWN");
        setApiHint(String(err));
        setDbHint(String(err));
        setStorageHint(String(err));
        setApiLatency(null);
        setDbLatency(null);
      } finally {
        setHealthCheckedAt(new Date());
        setHealthRefreshing(false);
        inFlightRef.current = false;
      }
    };

    runHealthCheckRef.current = hydrate;
    hydrate();
    const t = setInterval(hydrate, HEALTH_POLL_MS);

    return () => {
      clearInterval(t);
      controller.abort();
    };
  }, []); // keep []

  // ✅ Summaries
  const emailSummary = useEmailTrackerSummaryCounts();
  const extractionSummary = useReportExtractionSummaryCounts();

  // ✅ Fix: subscribe once, avoid infinite resubscribe loop
  const refreshRef = useRef(() => { });
  useEffect(() => {
    refreshRef.current = () => {
      emailSummary.refresh();
      extractionSummary.refresh();
    };
  }, [emailSummary, extractionSummary]);

  useEffect(() => {
    let channel;
    try {
      channel = supabase
        .channel('home-stats-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'stats_ping',
            filter: 'id=eq.email_tasks'
          },
          () => refreshRef.current?.()
        )
        .subscribe((status, err) => {
          if (err) {
            // stats_ping table may not exist yet — silently ignore
            console.warn('[home] stats_ping subscription error:', err?.message || err);
          }
        });
    } catch (e) {
      console.warn('[home] Failed to connect to stats_ping realtime:', e);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const emailHint = useMemo(() => {
    if (!emailSummary.error) return "";
    return String(emailSummary.error).slice(0, 160);
  }, [emailSummary.error]);



  const displayName = useMemo(() => {
    const name = user?.name?.trim();
    if (name) return name;
    if (user?.email) return user.email.split("@")[0];
    return "MDM Team";
  }, [user]);

  const roleLabel = useMemo(
    () => formatRoleLabel(permissionRole || userRole || "user"),
    [permissionRole, userRole]
  );

  const apiHealthy = useMemo(() => isHealthUp(apiStatus), [apiStatus]);
  const dbHealthy = useMemo(() => isHealthUp(dbStatus), [dbStatus]);
  const platformHealthSummary = useMemo(() => {
    if (apiHealthy && dbHealthy) {
      return {
        label: "All systems operational",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50",
      };
    }

    if (apiHealthy || dbHealthy) {
      return {
        label: "Partial outage",
        className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50",
      };
    }

    return {
      label: "Services unavailable",
      className: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/50",
    };
  }, [apiHealthy, dbHealthy]);

  const lastCheckedLabel = useMemo(() => {
    if (!healthCheckedAt) return "Checking...";
    return healthCheckedAt.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [healthCheckedAt]);

  const quickActions = useMemo(() => {
    const items = [
      {
        href: "/recons/upload",
        title: "Upload OSDP & PBI",
        desc: "Start reconciliation intake",
        icon: UploadCloud,
        color: "blue",
        perm: "tools.reconciliation.view",
        section: "Reconciliation",
      },
      {
        href: "/reports/summary_recons",
        title: "Summary Reports",
        desc: "Review matched vs mismatch totals",
        icon: BarChart2,
        color: "violet",
        perm: "reports.view",
        section: "Reports",
      },
      {
        href: "/reports/matrix_recons",
        title: "Recons Matrix",
        desc: "Track by period and distributor",
        icon: RefreshCw,
        color: "emerald",
        perm: "reports.matrixRecons.view",
        section: "Reports",
      },
      {
        href: "/promotions",
        title: "Promotion Tools",
        desc: "Manual entry, Auto IC and controls",
        icon: FileText,
        color: "amber",
        perm: "tools.promotions.view",
        section: "Promotions",
      },
      {
        href: "/utilities/emailtracker",
        title: "Email Tracker",
        desc: "Follow up operational requests",
        icon: Mail,
        color: "blue",
        perm: "mdmEmailTracker.view",
        section: "Utilities",
      },
      {
        href: "/utilities/date-converter",
        title: "Date Converter",
        desc: "Normalize document and Excel dates",
        icon: Clock3,
        color: "violet",
        perm: "utilities.dateConverter.view",
        section: "Utilities",
      },
    ];

    return items.filter((item) => !item.perm || can(item.perm)).slice(0, 6);
  }, [can]);


  useEffect(() => {
    const timerId = window.setInterval(() => {
      setLiveNow(new Date());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, []);

  return (
    <div className="w-full h-full flex flex-col min-w-0 pb-1 overflow-hidden">

      {/* ── Header Banner ── */}
      <div className="shrink-0 relative overflow-hidden rounded-xl mb-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md px-4 py-2.5 sm:py-3">
        {/* decorative circles */}
        <div className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-8 right-20 w-16 h-16 rounded-full bg-white/10" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                MDM Operations Dashboard
              </h1>
              <span className="inline-flex items-center rounded-full bg-white/20 text-white px-1.5 py-0.5 text-[9px] font-bold tracking-wide border border-white/30">
                v3.0
              </span>
            </div>
            <p className="text-blue-100 text-[11px] sm:text-xs">
              Real-time visibility into email, reconciliation &amp; system health.
            </p>
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-center bg-white/15 rounded-full px-2.5 py-1 border border-white/20 shrink-0">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
            </span>
            <span className="text-[10px] font-semibold text-white/90">Live · {lastSync}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 gap-2.5">

        {/* ── Row 1: 3 summary cards ── */}
        <div className="shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">

        {/* Email Tracker */}
        <SummaryCardCompact
          title="Email Tracker"
          subtitle={emailSummary.loading ? "Loading..." : emailSummary.error ? "Failed" : "Live overview"}
          icon={<Mail size={16} />}
          accent="blue"
          percent={emailSummary.percentComplete}
          hint={emailHint}
          footer={
            <div className="grid grid-cols-2 gap-2 mt-0.5">
              <TinyPill icon={AlertTriangle} label="New" value={emailSummary.counts.new} tone="red" />
              <TinyPill icon={Clock3} label="In Progress" value={emailSummary.counts.inProgress} tone="amber" />
              <TinyPill icon={CheckCircle2} label="Done" value={emailSummary.counts.complete} tone="green" />
              <TinyPill icon={Mail} label="Total" value={emailSummary.counts.total} tone="gray" />
            </div>
          }
          cta={{ href: "/utilities/emailtracker", label: "Open Tracker" }}
        />

        {/* Recons Progress (flip card) */}
        <FlipReconsCard />

        {/* Service Health */}
        <DashCard
          title="Service Health"
          icon={<ShieldCheck size={15} />}
          iconColor="text-emerald-600 dark:text-emerald-400"
          iconBg="bg-emerald-50 dark:bg-emerald-900/30"
          footer={
            <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-gray-400 dark:text-gray-500">
              <span className="inline-flex items-center gap-1">
                <Clock3 size={10} /> Last checked {lastCheckedLabel}
              </span>
              <span className="inline-flex items-center gap-1">
                <Info size={10} /> Auto-refresh every {Math.round(HEALTH_POLL_MS / 1000)}s
              </span>
            </div>
          }
        >
          <div className="space-y-1.5 mt-2">
            <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${platformHealthSummary.className}`}>
                {platformHealthSummary.label}
              </span>
              <button
                type="button"
                onClick={() => runHealthCheckRef.current?.()}
                disabled={healthRefreshing}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <RefreshCw size={12} className={healthRefreshing ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
            <HealthRowCompact label="Backend API" status={apiStatus} hint={apiHint} latency={apiLatency} />
            <HealthRowCompact label="Database" status={dbStatus} hint={dbHint} latency={dbLatency} />
            <HealthRowCompact label="DB Storage" status={storageStatus} hint={storageHint} />
          </div>
        </DashCard>
      </div>

        {/* ── Row 2: Report Extraction + Quick Actions ── */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-2.5">

        {/* Report Extraction */}
        <div className="lg:col-span-1 h-full border border-gray-100 dark:border-gray-800 rounded-[20px] bg-white dark:bg-gray-800 shadow-sm">
          <ReportExtractionSummaryCard 
            summary={extractionSummary} 
            cta={{ href: "/utilities/report-extraction-tracker", label: "Open Tracking Board" }} 
          />
        </div>

        {/* Quick Actions – spans 2 widths */}
        <DashCard
          className="lg:col-span-2"
          title="Quick Actions"
          icon={<ExternalLink size={15} />}
          iconColor="text-indigo-600 dark:text-indigo-400"
          iconBg="bg-indigo-50 dark:bg-indigo-900/30"
          footer={
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 text-[11px] text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
              <span>
                {permissionsLoading
                  ? "Checking access to your modules..."
                  : quickActions.length
                    ? `${quickActions.length} shortcuts prepared for ${roleLabel}.`
                    : "No quick actions are available for this role yet."}
              </span>
              {can("tools.view") && (
                <Link
                  to="/tools"
                  onClick={() =>
                    rememberLaunch({
                      href: "/tools",
                      title: "Tools Hub",
                      desc: "Browse every operational module",
                      perm: "tools.view",
                      section: "Navigation",
                    })
                  }
                  className="inline-flex items-center gap-1 font-semibold text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Open tools hub <ArrowRight size={12} />
                </Link>
              )}
            </div>
          }
        >
          <div className="mt-3">
            {permissionsLoading && !quickActions.length ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-4 py-5 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/20 dark:text-gray-400">
                Loading the best shortcuts for your role...
              </div>
            ) : quickActions.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {quickActions.map((item) => (
                  <ShortcutTile
                    key={item.href}
                    href={item.href}
                    title={item.title}
                    desc={item.desc}
                    icon={<item.icon size={18} />}
                    color={item.color}
                    onClick={() => rememberLaunch(item)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-4 py-5 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/20 dark:text-gray-400">
                Your current access does not expose shortcut tiles yet.
              </div>
            )}
          </div>
        </DashCard>

        </div>
      </div>
    </div>
  );
}

/* ------------------------- Helpers ------------------------- */

function normalizeHealthPayload(data, url) {
  if (Array.isArray(data)) {
    const row = data[0] || {};
    const status = row.status || row.Status || "Unknown";
    const hint = row.hint || row.Hint || "";
    const latencyMs = row.latencyMs ?? null;
    const updatedAt = row.updatedAt ?? new Date().toISOString();
    return { status: String(status), hint: String(hint), latencyMs, updatedAt, url };
  }
  const status = data?.status ?? "Unknown";
  const hint = data?.hint ?? "";
  const latencyMs = data?.latencyMs ?? null;
  const updatedAt = data?.updatedAt ?? new Date().toISOString();
  return { status: String(status), hint: String(hint), latencyMs, updatedAt, url };
}

/* ─── SummaryCardCompact ─── */

function isHealthUp(status) {
  const normalized = String(status || "").toLowerCase();
  return normalized === "up" || normalized.includes("operational");
}

function SummaryCardCompact({ title, subtitle, icon, accent = "blue", percent = 0, footer, hint, cta, className = "" }) {
  const accentMap = {
    blue: { iconBg: "bg-blue-100 dark:bg-blue-900/40", iconText: "text-blue-600 dark:text-blue-300", bar: "bg-blue-500", barBg: "bg-blue-100 dark:bg-blue-900/30", pct: "text-blue-600 dark:text-blue-400", link: "text-blue-600 dark:text-blue-400 hover:text-blue-800" },
    emerald: { iconBg: "bg-emerald-100 dark:bg-emerald-900/40", iconText: "text-emerald-600 dark:text-emerald-300", bar: "bg-emerald-500", barBg: "bg-emerald-100 dark:bg-emerald-900/30", pct: "text-emerald-600 dark:text-emerald-400", link: "text-emerald-600 dark:text-emerald-400 hover:text-emerald-800" },
  };
  const a = accentMap[accent] || accentMap.blue;
  return (
    <div className={["bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm hover:shadow-md transition-shadow duration-200 p-3.5 sm:p-4 flex flex-col", className].join(" ")}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${a.iconBg} ${a.iconText}`}>{icon}</div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{title}</div>
            <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{subtitle}</div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-xl font-black ${a.pct}`}>{Math.round(percent)}%</div>
          <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">done</div>
        </div>
      </div>
      <div className={`w-full h-2 rounded-full ${a.barBg} overflow-hidden mb-3`}>
        <div className={`h-full rounded-full ${a.bar} transition-all duration-700`} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
      {footer && <div className="flex-1 mb-2">{footer}</div>}
      {hint && <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-1">{hint}</p>}
      {cta?.href && (
        <div className="mt-auto pt-2.5 border-t border-gray-100 dark:border-gray-700/60">
          <Link to={cta.href} className={`inline-flex items-center gap-1 text-xs font-semibold transition-colors ${a.link}`}>
            {cta.label} <ArrowRight size={12} />
          </Link>
        </div>
      )}
    </div>
  );
}

/* ─── ReconsDashboardCard (New Radial Style) ─── */
function ReconsDashboardCard({ title, subtitle, icon, percent = 0, footer, hint, cta, actionLeft, className = "" }) {
  const circleRadius = 28;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - (Math.max(0, Math.min(100, percent)) / 100) * circumference;

  return (
    <div className={["bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm hover:shadow-md transition-all duration-300 p-4 sm:p-5 flex flex-col relative overflow-hidden group", className].join(" ")}>
      {/* Background glow */}
      <div className="absolute -right-6 -top-6 w-32 h-32 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-500 pointer-events-none" />

      <div className="flex items-start justify-between mb-2 relative z-10">
        <div className="flex flex-col min-w-0 pr-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300`}>{icon}</div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{title}</div>
              <div className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{subtitle}</div>
            </div>
          </div>
          {hint && <div className="ml-12 text-[10px] font-semibold text-emerald-700 bg-emerald-50/80 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 rounded mt-1.5 inline-block border border-emerald-100 dark:border-emerald-800/50">{hint}</div>}
        </div>

        {/* Radial Progress */}
        <div className="relative flex items-center justify-center w-16 h-16 shrink-0 mr-1 mt-1">
          <svg className="w-full h-full transform -rotate-90 drop-shadow-sm" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r={circleRadius} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-gray-100 dark:text-gray-700" />
            <circle
              cx="32"
              cy="32"
              r={circleRadius}
              stroke="currentColor"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="text-emerald-500 dark:text-emerald-400 transition-all duration-1000 ease-out"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-0.5">
            <span className="text-sm font-black text-gray-800 dark:text-gray-100">{Math.round(percent)}<span className="text-[10px]">%</span></span>
          </div>
        </div>
      </div>

      <div className="flex-1 relative z-10 w-full mt-1 mb-1">
        {footer}
      </div>

      {cta?.href && (
        <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700/60 relative z-10 flex justify-between items-center">
          <div className="shrink-0 flex items-center">
            {actionLeft ? actionLeft : <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest hidden sm:block">Reconciliation</span>}
          </div>
          <Link to={cta.href} className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 px-3 py-1.5 rounded-lg active:scale-95 ml-auto">
            {cta.label} <ArrowRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}

function TinyPill({ icon: Icon, label, value, sub, tone = "gray" }) {
  const t = {
    blue: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900/50",
    green: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900/50",
    amber: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/50",
    red: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-900/50",
    gray: "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-gray-700",
  };
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl border ${t[tone] || t.gray}`}>
      <Icon size={12} className="shrink-0" />
      <div className="leading-tight">
        <div className="text-[8px] font-semibold uppercase tracking-wide opacity-70">{label}</div>
        <div className="text-[11px] font-bold">{value}{sub && <span className="ml-0.5 text-[9px] opacity-60">{sub}</span>}</div>
      </div>
    </div>
  );
}

/* ─── DashCard ─── */
function DashCard({ title, icon, iconColor = "text-gray-500 dark:text-gray-400", iconBg = "bg-gray-100 dark:bg-gray-700", children, footer, className = "" }) {
  return (
    <div className={["bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm p-3.5 sm:p-4 flex flex-col h-full", className].join(" ")}>
      <div className="flex items-center gap-2.5 mb-2.5 shrink-0">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}>{icon}</div>
        <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">{title}</h2>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>{children}</div>
      {footer && <div className="mt-auto shrink-0 pt-2">{footer}</div>}
    </div>
  );
}

/* ─── VersionPill (used in header banner) ─── */
function VersionPill({ version }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/20 border border-white/30 text-white px-2 py-0.5 text-[10px] font-bold tracking-wide">{version}</span>
  );
}

/* ─── Card & SectionTitleCompact kept for FlipReconsCard ─── */
function Card({ children, className = "" }) {
  return (
    <div className={["bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm p-4 sm:p-5", className].join(" ")}>
      {children}
    </div>
  );
}
function SectionTitleCompact({ icon, title }) {
  return (
    <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 inline-flex items-center gap-2">
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300">{icon}</span>
      {title}
    </h2>
  );
}

/* ─── ShortcutTile ─── */
function ShortcutTile({ href, title, desc, icon, color = "blue", onClick }) {
  const colorMap = {
    blue: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300",
    violet: "bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300",
    emerald: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300",
    amber: "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300",
  };
  const ic = colorMap[color] || colorMap.blue;
  return (
    <Link
      to={href}
      onClick={onClick}
      className="group flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700/60 hover:bg-white dark:hover:bg-gray-700/70 transition-all duration-150 active:scale-[0.98]"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ic}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate leading-tight">{title}</div>
        <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{desc}</div>
      </div>
      <ArrowRight size={14} className="text-gray-300 dark:text-gray-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0" />
    </Link>
  );
}



/* ─── HealthRowCompact ─── */
function HealthRowCompact({ label, status, hint, latency }) {
  const s = String(status || "Unknown");
  const sLower = s.toLowerCase();
  
  const ok = sLower === "up" || sLower.includes("operational") || sLower === "ok";
  const warn = sLower.includes("warning") || sLower.includes("setup");
  const offline = sLower === "down" || sLower.includes("offline") || sLower === "unknown";

  // Dynamic Theme Generation
  let dotColor = "bg-gray-400";
  let textColor = "text-gray-600 dark:text-gray-400";
  let bgGradient = "from-gray-50 to-white dark:from-gray-800/10 dark:to-transparent border-gray-200 dark:border-gray-700/50";
  let Icon = Info;
  let pulse = false;

  if (ok) {
    dotColor = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]";
    textColor = "text-emerald-700 dark:text-emerald-400";
    bgGradient = "from-emerald-50/80 to-white border-emerald-100 dark:from-emerald-950/20 dark:to-transparent dark:border-emerald-900/30";
    Icon = CheckCircle2;
    pulse = true;
  } else if (warn) {
    dotColor = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]";
    textColor = "text-amber-700 dark:text-amber-400";
    bgGradient = "from-amber-50/80 to-white border-amber-100 dark:from-amber-950/20 dark:to-transparent dark:border-amber-900/30";
    Icon = AlertTriangle;
    pulse = true;
  } else if (offline) {
    dotColor = "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]";
    textColor = "text-rose-700 dark:text-rose-400";
    bgGradient = "from-rose-50/80 to-white border-rose-100 dark:from-rose-950/20 dark:to-transparent dark:border-rose-900/30";
    Icon = AlertTriangle;
  }

  return (
    <div className={`relative overflow-hidden flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border bg-gradient-to-r ${bgGradient} transition-all duration-300 hover:shadow-sm group`}>
      <div className="flex items-center gap-2.5 min-w-0 z-10">
        <div className="relative flex items-center justify-center w-6 h-6 rounded-md bg-white dark:bg-gray-800 shadow-sm shrink-0 border border-gray-100 dark:border-gray-700">
           {pulse && <span className="absolute inline-flex h-full w-full rounded-md bg-current opacity-20 animate-ping" style={{ color: 'inherit' }}></span>}
           <Icon size={12} className={textColor} />
        </div>
        <div className="min-w-0 flex flex-col leading-tight">
          <span className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{label}</span>
          {hint && <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{hint}</span>}
        </div>
      </div>
      
      <div className="flex items-center gap-2 shrink-0 z-10">
        {latency != null && (
          <span className="text-[10px] sm:text-[11px] font-medium font-mono text-gray-400 dark:text-gray-500 transition-colors group-hover:text-gray-600 dark:group-hover:text-gray-300">
            {latency}ms
          </span>
        )}
        <div className="flex items-center gap-1.5 bg-white/60 dark:bg-gray-900/40 px-1.5 py-0.5 rounded-md border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm shadow-sm min-w-[4rem] justify-center">
          <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${offline ? 'animate-pulse' : ''}`}></span>
          <span className={`text-[9px] font-black uppercase tracking-wider ${textColor}`}>{s}</span>
        </div>
      </div>

      {/* Decorative background accent line */}
      <div className={`absolute top-0 bottom-0 left-0 w-[3px] ${textColor.split(' ')[0].replace('text-', 'bg-')} opacity-30 dark:opacity-20`}></div>
    </div>
  );
}
/* ─── ReportExtractionSummaryCard (Graphical Visual Style) ─── */
function ReportExtractionSummaryCard({ summary, cta }) {
  const { counts, loading, error } = summary || {};
  const global = counts?.global || { pending: 0, onHold: 0, complete: 0, total: 0 };
  const mine = counts?.mine || { pending: 0, onHold: 0, complete: 0, total: 0 };

  const [view, setView] = useState("mine");
  const activeStats = view === "mine" ? mine : global;
  const { pending, onHold, complete, total } = activeStats;
  const incomplete = pending + onHold;
  const pctComplete = total > 0 ? Math.round((complete / total) * 100) : 0;
  const isClear = incomplete === 0;

  // SVG donut arc
  const R = 30;
  const C = 2 * Math.PI * R;
  const offset = C - (pctComplete / 100) * C;

  const statRows = [
    { label: "Pending", value: pending, color: "bg-rose-500", glow: "#f43f5e", pct: total > 0 ? (pending / total) * 100 : 0 },
    { label: "On Hold", value: onHold, color: "bg-amber-400", glow: "#fbbf24", pct: total > 0 ? (onHold / total) * 100 : 0 },
    { label: "Completed", value: complete, color: "bg-emerald-500", glow: "#10b981", pct: total > 0 ? (complete / total) * 100 : 0 },
  ];

  return (
    <div className="flex flex-col h-full p-3.5 relative overflow-hidden">

      {/* Subtle background glow */}
      <div className="pointer-events-none absolute -right-8 -top-8 w-28 h-28 rounded-full bg-violet-400/10 dark:bg-violet-500/5 blur-2xl" />

      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
            <ClipboardList size={14} />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-800 dark:text-gray-100 leading-tight">Report Extraction</div>
            <div className="text-[10px] text-gray-400 dark:text-gray-500">
              {loading ? "Loading..." : error ? "Failed" : "Live pipeline"}
            </div>
          </div>
        </div>
        {/* Tab Toggle */}
        <div className="flex p-0.5 bg-gray-100 dark:bg-gray-900/60 rounded-md">
          {["mine", "global"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded transition-all ${
                view === v
                  ? "bg-white text-violet-700 shadow-sm dark:bg-gray-700 dark:text-violet-300"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              {v === "mine" ? "Mine" : "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Main Body: SVG Donut + Big Number */}
      <div className="flex items-center gap-4 mb-3 shrink-0">
        {/* SVG Arc Donut */}
        <div className="relative shrink-0 w-[72px] h-[72px]">
          <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
            {/* track */}
            <circle cx="36" cy="36" r={R} fill="none" stroke="currentColor" strokeWidth="7" className="text-gray-100 dark:text-gray-700" />
            {/* progress */}
            <circle
              cx="36" cy="36" r={R}
              fill="none"
              stroke={isClear ? "#10b981" : "#8b5cf6"}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 1s ease, stroke 0.5s ease" }}
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-base font-black leading-none tabular-nums ${isClear ? "text-emerald-500" : "text-violet-600 dark:text-violet-400"}`}>
              {pctComplete}%
            </span>
            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wide">done</span>
          </div>
        </div>

        {/* Right: Incomplete Hero + total */}
        <div className="flex flex-col justify-center flex-1 min-w-0">
          <div className={`text-3xl font-black tabular-nums tracking-tighter leading-none ${isClear ? "text-emerald-500" : "text-rose-500"}`}>
            {incomplete}
          </div>
          <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-0.5">
            Incomplete
          </div>
          <div className="mt-1.5 flex items-center gap-1">
            <span className="text-[10px] text-gray-400 dark:text-gray-500">{complete}/{total} completed</span>
          </div>
        </div>
      </div>

      {/* Animated Status Bar Rows */}
      <div className="flex flex-col gap-1.5 flex-1 justify-end">
        {statRows.map((s) => (
          <div key={s.label} className="flex items-center gap-2 group/row">
            <div className="w-14 shrink-0">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{s.label}</span>
            </div>
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700/60 overflow-hidden">
              <div
                className={`h-full rounded-full ${s.color} transition-all duration-1000 ease-out`}
                style={{ width: `${Math.max(0, Math.min(100, s.pct))}%` }}
              />
            </div>
            <span className="text-[10px] font-black text-gray-700 dark:text-gray-300 w-4 text-right shrink-0">{s.value}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      {cta?.href && (
        <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700/60 shrink-0">
          <Link
            to={cta.href}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-colors group"
          >
            {cta.label} <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      )}
    </div>
  );
}


export default HomePage;

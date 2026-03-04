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
} from "lucide-react";

/* Firestore */
import {
  doc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  collection,
  query,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebaseClient";

import useReconsProgress from "../hooks/useReconsProgress";
import useEmailTrackerSummaryCounts from "../hooks/useEmailTrackerSummaryCounts";

/**
 * HomePage — Responsive Dashboard (desktop + mobile)
 * Fixes:
 *  - Email tracker "loading/failed loop" caused by re-subscribing onSnapshot due to refresh function identity changes
 *  - Prevents overlapping health polls + reduces UI flicker
 */

const GAS_HEALTH_URL = import.meta.env.VITE_GAS_HEALTH_URL;
const FLASK_HEALTH_URL = import.meta.env.VITE_FLASK_HEALTH_URL;
const HEALTH_POLL_MS = 60000;

function HomePage() {
  const lastSync = useMemo(() => new Date().toLocaleString(), []);

  // ---- System Health local state ----
  const [apiStatus, setApiStatus] = useState("Loading...");
  const [sheetStatus, setSheetStatus] = useState("Loading...");
  const [storageStatus, setStorageStatus] = useState("Loading...");
  const [apiHint, setApiHint] = useState("");
  const [sheetHint, setSheetHint] = useState("");
  const [storageHint, setStorageHint] = useState("");
  const [sheetLatency, setSheetLatency] = useState(null);
  const [apiLatency, setApiLatency] = useState(null);
  const [storageLatency, setStorageLatency] = useState(null);

  const abortRef = useRef(null);

  // ✅ prevent overlapping health polls + reduce UI flicker
  const inFlightRef = useRef(false);
  const lastHealthRef = useRef({ api: null, sheets: null, storage: null });

  /* Write to Firestore */
  async function writeHealthDoc(docId, payload, sourceOverride) {
    const ref = doc(db, "health", docId);
    await setDoc(
      ref,
      {
        status: payload.status ?? "Unknown",
        latencyMs: payload.latencyMs ?? null,
        checkedAt: serverTimestamp(),
        hint: payload.hint ?? null,
        source: sourceOverride ?? payload.source ?? "Unknown",
        url: payload.url ?? null,
        updatedAtStr: payload.updatedAt ?? new Date().toISOString(),
      },
      { merge: true }
    );
  }

  /*--------------FLIP CARD-------------------- */
  function FlipReconsCard() {
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

          const q = query(collection(db, "master_years"), orderBy("year", "desc"));
          const snap = await getDocs(q);

          const years = snap.docs
            .map((d) => d.data())
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
          <div className="absolute inset-0 h-full [backface-visibility:hidden]">
            <SummaryCardCompact
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
              accent="emerald"
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
                <div className="grid grid-cols-2 gap-2">
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
              cta={{ href: "/reports/matrix_recons", label: "Open" }}
            />

            <button
              type="button"
              onClick={openSettings}
              className="absolute bottom-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 bg-white/90 dark:bg-gray-900/40 hover:bg-white dark:hover:bg-gray-900 transition text-gray-500 dark:text-gray-300"
              title="Filter"
            >
              <Settings size={14} />
            </button>
          </div>

          {/* BACK: Filters */}
          <div className="absolute inset-0 h-full [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-100 dark:ring-gray-700 rounded-2xl p-4 h-full">
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
        <div className="invisible h-[260px] sm:h-[252px] lg:h-[240px]">
          <SummaryCardCompact
            title="Recons Progress"
            subtitle="Latest run"
            icon={<FileSpreadsheet size={18} />}
            accent="emerald"
            percent={86}
            footer={<div className="h-[92px]" />}
            cta={{ href: "#", label: "Open" }}
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

  async function fetchSheetsHealth(signal) {
    const url = `${GAS_HEALTH_URL}?mode=health&service=${encodeURIComponent("Google Sheets")}`;
    const res = await fetch(url, { signal, cache: "no-store" });
    if (!res.ok) throw new Error(`GAS HTTP ${res.status}`);
    const data = await res.json();
    const norm = normalizeHealthPayload(data, url);
    norm.source = "GAS";
    return norm;
  }

  async function fetchStorageHealth(signal) {
    const url = `${GAS_HEALTH_URL}?mode=health&service=${encodeURIComponent("Storage")}`;
    const res = await fetch(url, { signal, cache: "no-store" });
    if (!res.ok) throw new Error(`GAS HTTP ${res.status}`);
    const data = await res.json();
    const norm = normalizeHealthPayload(data, url);
    norm.source = "GAS";
    return norm;
  }

  // ✅ Health poll with guard (no overlapping) + no flicker
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    const hydrate = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          setApiStatus("OFFLINE");
          setSheetStatus("OFFLINE");
          setStorageStatus("OFFLINE");
          setApiHint("No internet connection");
          setSheetHint("No internet connection");
          setStorageHint("No internet connection");
          setApiLatency(null);
          setSheetLatency(null);
          setStorageLatency(null);
          return;
        }

        const [api, sheets, storage] = await Promise.allSettled([
          fetchApiHealth(controller.signal),
          fetchSheetsHealth(controller.signal),
          fetchStorageHealth(controller.signal),
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
        await apply("sheets", sheets, setSheetStatus, setSheetHint, setSheetLatency, "googleSheets", GAS_HEALTH_URL, "GAS");
        await apply("storage", storage, setStorageStatus, setStorageHint, setStorageLatency, "storage", GAS_HEALTH_URL, "GAS");
      } catch (err) {
        setApiStatus("DOWN");
        setSheetStatus("DOWN");
        setStorageStatus("DOWN");
        setApiHint(String(err));
        setSheetHint(String(err));
        setStorageHint(String(err));
        setApiLatency(null);
        setSheetLatency(null);
        setStorageLatency(null);
      } finally {
        inFlightRef.current = false;
      }
    };

    hydrate();
    const t = setInterval(hydrate, HEALTH_POLL_MS);

    return () => {
      clearInterval(t);
      controller.abort();
    };
  }, []); // keep []

  // ✅ Email Tracker Summary
  const emailSummary = useEmailTrackerSummaryCounts();

  // ✅ Fix: subscribe once, avoid infinite resubscribe loop
  const refreshRef = useRef(() => { });
  useEffect(() => {
    refreshRef.current = emailSummary.refresh;
  }, [emailSummary]);

  useEffect(() => {
    const ref = doc(db, "stats_ping", "email_tasks");
    const unsub = onSnapshot(
      ref,
      () => refreshRef.current?.(),
      (err) => console.error("stats_ping listener error:", err)
    );
    return () => unsub();
  }, []);

  const emailHint = useMemo(() => {
    if (!emailSummary.error) return "";
    return String(emailSummary.error).slice(0, 160);
  }, [emailSummary.error]);

  return (
    <div className="w-full min-w-0 px-3 sm:px-5 pb-3">

      {/* ── Header Banner ── */}
      <div className="relative overflow-hidden rounded-xl mb-3 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-200 dark:shadow-blue-950/40 px-4 py-3 sm:py-4">
        {/* decorative circles */}
        <div className="pointer-events-none absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-10 right-20 w-24 h-24 rounded-full bg-white/10" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                MDM Operations Dashboard
              </h1>
              <span className="inline-flex items-center rounded-full bg-white/20 text-white px-2 py-0.5 text-[10px] font-bold tracking-wide border border-white/30">
                v3.0
              </span>
            </div>
            <p className="text-blue-100 text-xs sm:text-sm">
              Real-time visibility into email, reconciliation &amp; system health.
            </p>
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-center bg-white/15 rounded-full px-3 py-1.5 border border-white/20 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span className="text-[11px] font-semibold text-white/90">Live · {lastSync}</span>
          </div>
        </div>
      </div>

      {/* ── Row 1: 3 summary cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-2.5">

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

        {/* System Health */}
        <DashCard
          title="System Health"
          icon={<ShieldCheck size={15} />}
          iconColor="text-emerald-600 dark:text-emerald-400"
          iconBg="bg-emerald-50 dark:bg-emerald-900/30"
          footer={
            <p className="text-[10px] text-gray-400 dark:text-gray-500 inline-flex items-center gap-1 mt-1">
              <Info size={10} /> Auto-refresh every {Math.round(HEALTH_POLL_MS / 1000)}s
            </p>
          }
        >
          <div className="space-y-2.5 mt-3">
            <HealthRowCompact label="API" status={apiStatus} hint={apiHint} latency={apiLatency} />
            <HealthRowCompact label="Sheets" status={sheetStatus} hint={sheetHint} latency={sheetLatency} />
            <HealthRowCompact label="Storage" status={storageStatus} hint={storageHint} latency={storageLatency} />
          </div>
        </DashCard>
      </div>

      {/* ── Row 2: Quick Actions + Helpful Links ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">

        {/* Quick Actions – spans 2/3 width */}
        <DashCard
          className="md:col-span-2"
          title="Quick Actions"
          icon={<ExternalLink size={15} />}
          iconColor="text-indigo-600 dark:text-indigo-400"
          iconBg="bg-indigo-50 dark:bg-indigo-900/30"
        >
          <div className="grid grid-cols-2 gap-2.5 mt-3">
            <ShortcutTile href="/upload" title="Upload OSDP & PBI" desc="Drag & drop reconciliation" icon={<UploadCloud size={18} />} color="blue" />
            <ShortcutTile href="/result_summary" title="Summary Reports" desc="Matched vs mismatch" icon={<BarChart2 size={18} />} color="violet" />
            <ShortcutTile href="/reports/matrix_recons" title="Recons Matrix" desc="Track by period" icon={<RefreshCw size={18} />} color="emerald" />
            <ShortcutTile href="/about" title="Documentation" desc="Formats & FAQs" icon={<FileText size={18} />} color="amber" />
          </div>
        </DashCard>

        {/* Helpful Links */}
        <DashCard
          title="Resources"
          icon={<LinkIcon size={15} />}
          iconColor="text-rose-500 dark:text-rose-400"
          iconBg="bg-rose-50 dark:bg-rose-900/30"
        >
          <div className="space-y-2 mt-3">
            <HelpLinkCompact href="/about#file-templates" title="File Templates" desc="Headers & valid examples" />
            <HelpLinkCompact href="/about#common-errors" title="Common Errors" desc="Validation fixes" />
            <HelpLinkCompact href="/about#best-practices" title="Best Practices" desc="Clean workflow" />
          </div>
        </DashCard>

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
    <div className={["bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700/60 shadow-sm hover:shadow-md transition-shadow duration-200 p-3.5 sm:p-4 flex flex-col", className].join(" ")}>
      <div className="flex items-center gap-2.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}>{icon}</div>
        <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">{title}</h2>
      </div>
      <div className="flex-1">{children}</div>
      {footer && <div className="mt-auto">{footer}</div>}
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
function ShortcutTile({ href, title, desc, icon, color = "blue" }) {
  const colorMap = {
    blue: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300",
    violet: "bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300",
    emerald: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300",
    amber: "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300",
  };
  const ic = colorMap[color] || colorMap.blue;
  return (
    <a href={href} className="group flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700/60 hover:bg-white dark:hover:bg-gray-700/70 transition-all duration-150 active:scale-[0.98]">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ic}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate leading-tight">{title}</div>
        <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{desc}</div>
      </div>
      <ArrowRight size={14} className="text-gray-300 dark:text-gray-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0" />
    </a>
  );
}

/* ─── HelpLinkCompact ─── */
function HelpLinkCompact({ href, title, desc }) {
  return (
    <a href={href} className="group flex items-center justify-between gap-2 p-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
      <div>
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{title}</div>
        <div className="text-xs text-gray-400 dark:text-gray-500">{desc}</div>
      </div>
      <ArrowRight size={13} className="text-gray-300 dark:text-gray-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0" />
    </a>
  );
}

/* ─── HealthRowCompact ─── */
function HealthRowCompact({ label, status, hint, latency }) {
  const s = String(status || "");
  const ok = s.toLowerCase() === "up" || s.toLowerCase().includes("operational");
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-14 shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-1 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${ok
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50"
          : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50"
          }`}>
          {ok ? <CheckCircle2 size={10} strokeWidth={3} /> : <AlertTriangle size={10} strokeWidth={2.5} />}
          {s}
        </span>
        {latency != null && <span className="text-[11px] text-gray-400 dark:text-gray-500 font-mono">{latency}ms</span>}
        {hint && <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[20ch]">{hint}</span>}
      </div>
    </div>
  );
}

export default HomePage;
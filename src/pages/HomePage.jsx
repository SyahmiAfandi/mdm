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
  Settings
} from "lucide-react";

/* Firestore */
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseClient";
import useReconsProgress from "../hooks/useReconsProgress";

/**
 * HomePage — One-screen Dashboard (fits most laptops)
 * Layout:
 *  - Top header (compact)
 *  - Row 1: Email | Recons | System Health
 *  - Row 2: Shortcuts (2 cols wide) | Helpful Links
 */

const GAS_HEALTH_URL = import.meta.env.VITE_GAS_HEALTH_URL;
const FLASK_HEALTH_URL = import.meta.env.VITE_FLASK_HEALTH_URL;
const HEALTH_POLL_MS = 60000;

const EMAIL_TRACKER_SHEET_ID = import.meta.env.VITE_EMAIL_TRACKER_SHEET_ID;
const EMAIL_TRACKER_SHEET_NAME = import.meta.env.VITE_EMAIL_TRACKER_SHEET_NAME || "";

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

  // calculate previous month properly
  let defaultYear = now.getFullYear();
  let defaultMonth = now.getMonth(); // 0-based previous month

  if (defaultMonth === 0) {
    // if current month is January, go to Dec last year
    defaultMonth = 12;
    defaultYear = defaultYear - 1;
  } else {
    defaultMonth = defaultMonth; // already previous month
  }


  // ✅ Applied filter (used for fetching)
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(String(defaultMonth));

  const [draftYear, setDraftYear] = useState(defaultYear);
  const [draftMonth, setDraftMonth] = useState(String(defaultMonth));


  const [flipped, setFlipped] = useState(false);

  const reconsProgress = useReconsProgress({
    year,
    month: month === "" ? undefined : Number(month),
  });

  const yearOptions = useMemo(() => {
  return Array.from({ length: 5 }, (_, i) => defaultYear - 2 + i);
  }, [defaultYear]);


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
    // sync drafts with current applied values
    setDraftYear(year);
    setDraftMonth(month);
    setFlipped(true);
  }

  function applyFilter() {
    setYear(Number(draftYear));
    setMonth(draftMonth); // "" or "1".."12"
    setFlipped(false);
  }

  return (
    <div className="relative [perspective:1200px] h-full min-h-[240px]">
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
            subtitle={reconsProgress.loading ? "Loading..." : reconsProgress.hasData ? "Latest run" : "No data yet"}
            icon={<FileSpreadsheet size={18} />}
            accent="emerald"
            percent={reconsProgress.percentDone}
            hint={year ? `Filter: ${year}${month ? ` • ${monthOptions.find(m=>m.value===String(month))?.label || ""}` : ""}` : ""}
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

          {/* ✅ gear bottom-right */}
          <button
            type="button"
            onClick={openSettings}
            className="absolute bottom-3 right-3 inline-flex items-center justify-center w-9 h-9 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 bg-white/90 dark:bg-gray-900/40 hover:bg-white dark:hover:bg-gray-900 transition"
            title="Filter"
          >
            <Settings size={16} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        {/* BACK */}
        <div className="absolute inset-0 h-full [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-100 dark:ring-gray-700 rounded-2xl p-4 h-full">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                Recons Filters
              </div>

              <button
                type="button"
                onClick={() => setFlipped(false)}
                className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:underline"
              >
                <ArrowLeft size={16} /> Back
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Year (default: current year)
                </label>
                <select
                  value={draftYear}
                  onChange={(e) => setDraftYear(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 bg-white dark:bg-gray-900/30 ring-1 ring-gray-200 dark:ring-gray-700 text-sm"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Month
                </label>
                <select
                  value={draftMonth}
                  onChange={(e) => setDraftMonth(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 bg-white dark:bg-gray-900/30 ring-1 ring-gray-200 dark:ring-gray-700 text-sm"
                >
                  {monthOptions.map((m) => (
                    <option key={m.value || "all"} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>

                <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                  Tip: leave “All months” to view the full year summary.
                </div>
              </div>

              <button
                type="button"
                onClick={applyFilter}
                className="-mt-1 inline-flex items-center justify-center gap-1 rounded-xl px-3 py-2 bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition"
              >
                <Check size={16} /> Apply
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* keeps height stable during flip */}
      <div className="invisible h-[240px] sm:h-[252px]">
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

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    const hydrate = async () => {
      try {
        const [api, sheets, storage] = await Promise.allSettled([
          fetchApiHealth(controller.signal),
          fetchSheetsHealth(controller.signal),
          fetchStorageHealth(controller.signal),
        ]);

        if (api.status === "fulfilled") {
          setApiStatus(api.value.status);
          setApiHint(api.value.hint || "");
          setApiLatency(api.value.latencyMs ?? null);
          await writeHealthDoc("apiService", api.value, "Flask");
        } else {
          setApiStatus("DOWN");
          setApiLatency(null);
          setApiHint("");
          await writeHealthDoc("apiService", { status: "DOWN", hint: String(api.reason), url: FLASK_HEALTH_URL }, "Flask");
        }

        if (sheets.status === "fulfilled") {
          setSheetStatus(sheets.value.status);
          setSheetHint(sheets.value.hint || "");
          setSheetLatency(sheets.value.latencyMs ?? null);
          await writeHealthDoc("googleSheets", sheets.value, "GAS");
        } else {
          setSheetStatus("DOWN");
          setSheetHint("");
          setSheetLatency(null);
          await writeHealthDoc("googleSheets", { status: "DOWN", hint: String(sheets.reason), url: GAS_HEALTH_URL }, "GAS");
        }

        if (storage.status === "fulfilled") {
          setStorageStatus(storage.value.status);
          setStorageHint(storage.value.hint || "");
          setStorageLatency(storage.value.latencyMs ?? null);
          await writeHealthDoc("storage", storage.value, storage.value.source || "GAS");
        } else {
          setStorageStatus("DOWN");
          setStorageHint("");
          setStorageLatency(null);
          await writeHealthDoc("storage", { status: "DOWN", hint: String(storage.reason), url: GAS_HEALTH_URL }, "GAS");
        }
      } catch (err) {
        await Promise.allSettled([
          writeHealthDoc("apiService", { status: "DOWN", hint: String(err), url: FLASK_HEALTH_URL }, "Flask"),
          writeHealthDoc("googleSheets", { status: "DOWN", hint: String(err), url: GAS_HEALTH_URL }, "GAS"),
          writeHealthDoc("storage", { status: "DOWN", hint: String(err), url: GAS_HEALTH_URL }, "GAS"),
        ]);
        setApiStatus("DOWN");
        setSheetStatus("DOWN");
        setStorageStatus("DOWN");
        setApiLatency(null);
        setSheetLatency(null);
        setStorageLatency(null);
      }
    };

    hydrate();
    const t = setInterval(hydrate, HEALTH_POLL_MS);
    return () => {
      clearInterval(t);
      controller.abort();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ Homepage widgets data
  const emailSummary = useEmailTrackerSummary({
    sheetId: EMAIL_TRACKER_SHEET_ID,
    sheetName: EMAIL_TRACKER_SHEET_NAME,
  });

  return (
    <div className="w-full min-w-0">
      {/* ✅ Header (more compact to fit one screen) */}
      <section className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 border border-gray-200/70 dark:border-gray-700 ring-1 ring-black/5 dark:ring-white/10 shadow-md p-4 mb-3">
        {/* Hero strip (quiet but premium) */}
        <div className="absolute top-0 left-0 right-0 h-[3px] sm:h-[4px] bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />

        <div className="relative flex items-start md:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-gray-900 dark:text-gray-100">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  MDM Operations Dashboard
                </span>
              </h1>
              <VersionPill version="v3.0" />
            </div>

            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1">
              Real-time visibility into email assignments, reconciliation progress, and system health — all in one place.
            </p>

            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              Last sync: {lastSync}
            </p>
          </div>

          <div className="flex gap-2 shrink-0">
            <a
              href="/upload"
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
            >
              <UploadCloud size={16} /> Upload
            </a>

            <a
              href="/result_summary"
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-white text-gray-800 ring-1 ring-gray-200 hover:ring-gray-300 dark:bg-gray-900/30 dark:text-gray-100 dark:ring-gray-700 transition text-sm font-semibold"
            >
              <BarChart2 size={16} /> Summary
            </a>
          </div>
        </div>
      </section>


      {/* ✅ ROW 1: Email | Recons | Health (fits one row on lg) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
        <SummaryCardCompact
          className="h-full"
          title="Email Tracker"
          subtitle={
            emailSummary.loading
              ? "Loading..."
              : emailSummary.error
              ? "Failed"
              : "Live overview"
          }
          icon={<Mail size={18} />}
          accent="blue"
          percent={emailSummary.percentComplete}
          hint={
            !EMAIL_TRACKER_SHEET_ID
              ? "Set VITE_EMAIL_TRACKER_SHEET_ID in .env"
              : emailSummary.error
              ? emailSummary.error
              : ""
          }
          footer={
            <div className="grid grid-cols-2 gap-2">
              <TinyPill icon={AlertTriangle} label="New" value={emailSummary.counts.new} tone="red" />
              <TinyPill icon={Clock3} label="In Progress" value={emailSummary.counts.inProgress} tone="amber" />
              <TinyPill icon={CheckCircle2} label="Done" value={emailSummary.counts.complete} tone="green" />
              <TinyPill icon={Mail} label="Total" value={emailSummary.counts.total} tone="gray" />
            </div>
          }
          cta={{ href: "/utilities/emailtracker", label: "Open" }}
        />

        <FlipReconsCard />

        <Card className="h-full">
          <div className="flex items-center justify-between mb-2">
            <SectionTitleCompact icon={<ShieldCheck size={16} />} title="System Health" />
          </div>

          <div className="space-y-2">
            <HealthRowCompact label="API" status={apiStatus} hint={apiHint} latency={apiLatency} />
            <HealthRowCompact label="Sheets" status={sheetStatus} hint={sheetHint} latency={sheetLatency} />
            <HealthRowCompact label="Storage" status={storageStatus} hint={storageHint} latency={storageLatency} />
          </div>

          <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
            <Info size={13} /> Auto refresh {Math.round(HEALTH_POLL_MS / 1000)}s
          </div>
        </Card>
      </div>

      {/* ✅ ROW 2: Shortcuts (wide) | Helpful Links (narrow) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
        <Card className="lg:col-span-2 p-4">
          <div className="flex items-center justify-between mb-2">
            <SectionTitleCompact icon={<ExternalLink size={16} />} title="Shortcuts" />
          </div>

          {/* 2x2 grid to keep height small */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <ShortcutTile
              href="/upload"
              title="Upload OSDP & PBI"
              desc="Drag & drop reconciliation"
              icon={<UploadCloud size={18} />}
            />
            <ShortcutTile
              href="/result_summary"
              title="Summary Reports"
              desc="Matched vs mismatch"
              icon={<BarChart2 size={18} />}
            />
            <ShortcutTile
              href="/reports/matrix_recons"
              title="Recons Matrix"
              desc="Track by period"
              icon={<RefreshCw size={18} />}
            />
            <ShortcutTile
              href="/about"
              title="Documentation"
              desc="Formats & FAQs"
              icon={<FileText size={18} />}
            />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <SectionTitleCompact icon={<LinkIcon size={16} />} title="Helpful Links" />
          </div>

          <div className="space-y-2">
            <HelpLinkCompact href="/about#file-templates" title="File Templates" desc="Headers & examples" />
            <HelpLinkCompact href="/about#common-errors" title="Common Errors" desc="Validation fixes" />
            <HelpLinkCompact href="/about#best-practices" title="Best Practices" desc="Clean workflow" />
          </div>
        </Card>
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

/* ------------------------- Compact Summary Card ------------------------- */

function SummaryCardCompact({
  title,
  subtitle,
  icon,
  accent = "blue",
  percent = 0,
  footer,
  hint,
  cta,
  className = "",
}) {
  const accentMap = {
    blue: {
      badge:
        "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40",
      bar: "bg-blue-600",
      link: "text-blue-600 dark:text-blue-400",
    },
    emerald: {
      badge:
        "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40",
      bar: "bg-emerald-600",
      link: "text-emerald-600 dark:text-emerald-400",
    },
  };

  const a = accentMap[accent] || accentMap.blue;

  return (
    <div className={`bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-100 dark:ring-gray-700 rounded-2xl p-4 h-full ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl border flex items-center justify-center ${a.badge}`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {title}
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
              {subtitle}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-[10px] text-gray-500 dark:text-gray-400">
            Done
          </div>
          <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
            {Math.round(percent)}%
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2">
        <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className={`h-full ${a.bar}`}
            style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
          />
        </div>
      </div>

      {/* Footer (pills) */}
      {footer ? <div className="mt-2">{footer}</div> : null}

      {/* Hint */}
      {hint ? (
        <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
          {hint}
        </div>
      ) : null}

      {/* CTA (React Router Link) */}
      {cta?.href ? (
        <div className="mt-2">
          <Link
            to={cta.href}
            className={`inline-flex items-center gap-1 text-sm font-semibold hover:underline ${a.link}`}
          >
            {cta.label} <ArrowRight size={16} />
          </Link>
        </div>
      ) : null}
    </div>
  );
}


function TinyPill({ icon: Icon, label, value, sub, tone = "blue" }) {
  const toneMap = {
    blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40",
    amber: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40",
    red: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/40",
    gray: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/60 dark:text-gray-200 dark:border-gray-700",
  };

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border ${toneMap[tone]}`}>
      <Icon size={14} />
      <div className="leading-tight">
        <div className="text-[10px] font-medium">{label}</div>
        <div className="text-xs font-semibold">
          {value}
          {sub ? <span className="ml-1 text-[10px] font-medium opacity-80">{sub}</span> : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Email Tracker (GViz) ------------------------- */

function normalizeStatus(v) {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return "new";
  if (s === "new") return "new";
  if (s.includes("progress")) return "inProgress";
  if (s === "in_progress" || s === "inprogress") return "inProgress";
  if (s.includes("complete") || s === "done" || s === "completed") return "complete";
  return "new";
}

function toGvizUrl(sheetId, sheetName = "") {
  const params = new URLSearchParams();
  params.set("tqx", "out:json");
  if (sheetName) params.set("sheet", sheetName);
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?${params.toString()}`;
}

function parseGviz(text) {
  const json = JSON.parse(text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1));
  const cols = json?.table?.cols || [];
  const rows = json?.table?.rows || [];
  const headers = cols.map((c) => String(c?.label || "").trim());
  const data = rows.map((r) => (r?.c || []).map((cell) => cell?.v ?? ""));
  return { headers, data };
}

function useEmailTrackerSummary({ sheetId, sheetName = "" } = {}) {
  const [loading, setLoading] = useState(Boolean(sheetId));
  const [error, setError] = useState("");
  const [counts, setCounts] = useState({ new: 0, inProgress: 0, complete: 0, total: 0 });

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!sheetId) {
        setLoading(false);
        setError("Missing sheet ID.");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const url = toGvizUrl(sheetId, sheetName);
        const res = await fetch(url, { cache: "no-store" });
        const text = await res.text();

        const { headers, data } = parseGviz(text);
        const lower = headers.map((h) => h.toLowerCase());

        let statusIdx = lower.findIndex((h) => h === "status");
        if (statusIdx === -1) statusIdx = lower.findIndex((h) => h.includes("status"));
        if (statusIdx === -1) throw new Error("No 'Status' column found in Email Tracker sheet.");

        let n = 0, p = 0, c = 0;
        for (const row of data) {
          const st = normalizeStatus(row[statusIdx]);
          if (st === "new") n++;
          else if (st === "inProgress") p++;
          else if (st === "complete") c++;
        }

        const total = n + p + c;
        if (!alive) return;
        setCounts({ new: n, inProgress: p, complete: c, total });
      } catch (e) {
        if (!alive) return;
        setError(e?.message || "Failed to load Email Tracker summary.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [sheetId, sheetName]);

  const percentComplete = useMemo(() => {
    if (!counts.total) return 0;
    return Math.round((counts.complete / counts.total) * 100);
  }, [counts]);

  return { loading, error, counts, percentComplete };
}


/* ------------------------- UI Components ------------------------- */

function VersionPill({ version }) {
  return (
    <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 px-2.5 py-1 text-xs font-semibold ring-1 ring-blue-200/70 dark:ring-blue-800">
      {version}
    </span>
  );
}

function Card({ children, className = "" }) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-100 dark:ring-gray-700 rounded-2xl p-4 h-full ${className}`}
    >
      {children}
    </div>
  );
}

function SectionTitleCompact({ icon, title }) {
  return (
    <h2 className="text-sm font-extrabold text-gray-900 dark:text-gray-100 inline-flex items-center gap-2">
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-50 dark:bg-gray-700/60">
        {icon}
      </span>
      {title}
    </h2>
  );
}

function ShortcutTile({ href, title, desc, icon }) {
  return (
    <a
      href={href}
      className="group rounded-xl px-3 py-3 ring-1 ring-gray-100 dark:ring-gray-700 bg-gray-50/60 dark:bg-gray-800/60 hover:bg-white dark:hover:bg-gray-800 transition block"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="rounded-lg bg-white dark:bg-gray-800 p-2 ring-1 ring-gray-100 dark:ring-gray-700 shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{title}</div>
            <div className="text-xs text-gray-600 dark:text-gray-300 truncate">{desc}</div>
          </div>
        </div>
        <ArrowRight className="opacity-0 group-hover:opacity-100 transition text-gray-400 shrink-0" size={18} />
      </div>
    </a>
  );
}

function HelpLinkCompact({ href, title, desc }) {
  return (
    <a
      href={href}
      className="rounded-xl px-3 py-3 ring-1 ring-gray-100 dark:ring-gray-700 bg-gray-50/60 dark:bg-gray-800/60 hover:bg-white dark:hover:bg-gray-800 transition block"
    >
      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</div>
      <div className="text-xs text-gray-600 dark:text-gray-300">{desc}</div>
    </a>
  );
}

function HealthRowCompact({ label, status, hint, latency }) {
  const s = String(status || "");
  const ok = s.toLowerCase() === "up" || s.toLowerCase().includes("operational");

  return (
    <div className="flex items-center gap-2 py-1">
      <div className="text-xs font-semibold text-gray-800 dark:text-gray-100 w-16">{label}</div>

      <div className="flex items-center gap-2 text-[11px] flex-wrap">
        {ok ? (
          <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={14} />
        ) : (
          <AlertTriangle className="text-amber-600 dark:text-amber-400" size={14} />
        )}

        <span
          className={`font-semibold px-2 py-1 rounded-full ${
            ok
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900"
              : "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900"
          }`}
        >
          {s}
        </span>

        {latency != null && <span className="text-gray-500 dark:text-gray-400">{latency} ms</span>}
        {hint && <span className="text-gray-500 dark:text-gray-400">{hint}</span>}
      </div>
    </div>
  );
}

export default HomePage;

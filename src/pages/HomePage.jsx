import React, { useMemo, useEffect, useState, useRef } from "react";
import DashboardLayout from "../components/DashboardLayout";
import {
  UploadCloud,
  BarChart2,
  FileText,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Link as LinkIcon,
  ShieldCheck,
  Clock,
  Activity,
  Info,
} from "lucide-react";
import { APP_FULL_NAME } from "../config";

/* Firestore */
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseClient";

/**
 * HomePage — Dashboard with live System Health
 * - API Service: Flask (/api/health)  ← Option A (direct)
 * - Google Sheets: GAS Web App        ← health via Sheet ping
 * - Storage: (kept via GAS; change if you have a real endpoint)
 */

const GAS_HEALTH_URL = import.meta.env.VITE_GAS_HEALTH_URL;
const FLASK_HEALTH_URL = import.meta.env.VITE_FLASK_HEALTH_URL;
const HEALTH_POLL_MS    = 60000; // 60s

function HomePage() {
  // ---- Mock KPI data (unchanged) ----
  const stats = { uploads: 42, matches: 87, mismatches: 5 };
  const trends = {
    uploads: [12, 18, 15, 22, 27, 35, 42],
    matches: [60, 64, 70, 73, 79, 83, 87],
    mismatches: [11, 9, 8, 8, 7, 6, 5],
  };
  const deltas = { uploads: +7, matches: +4, mismatches: -1 };

  const activities = useMemo(
    () => [
      { id: 1, type: "upload", label: "New upload from Distributor A", time: "Today • 10:12" },
      { id: 2, type: "recon", label: "Reconciliation completed successfully", time: "Today • 09:05" },
      { id: 3, type: "mismatch", label: "Mismatch detected in recent PBI file", time: "Yesterday • 18:21" },
    ],
    []
  );

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

  /* ---- Fetchers ---- */

  // Flask direct (API Service)
  async function fetchApiHealth(signal) {
    const res = await fetch(FLASK_HEALTH_URL, { signal, cache: "no-store" });
    if (!res.ok) throw new Error(`API HTTP ${res.status}`);
    const data = await res.json();
    const norm = normalizeHealthPayload(data, FLASK_HEALTH_URL);
    norm.source = "Flask";
    return norm;
  }

  // GAS (Google Sheets)
  async function fetchSheetsHealth(signal) {
    const url = `${GAS_HEALTH_URL}?mode=health&service=${encodeURIComponent("Google Sheets")}`;
    const res = await fetch(url, { signal, cache: "no-store" });
    if (!res.ok) throw new Error(`GAS HTTP ${res.status}`);
    const data = await res.json();
    const norm = normalizeHealthPayload(data, url);
    norm.source = "GAS";
    return norm;
  }

  // GAS (Storage) — change to your real storage health if available
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
          fetchApiHealth(controller.signal),     // Flask ✅
          fetchSheetsHealth(controller.signal),  // GAS  ✅
          fetchStorageHealth(controller.signal), // GAS  ✅ (or replace)
        ]);

        // API Service (Flask)
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

        // Google Sheets (GAS)
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

        // Storage (GAS or replace with your real endpoint)
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
        // Global failure safety
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

  return (
    <DashboardLayout mobileSlide pageTitle={APP_FULL_NAME} breadcrumbs={["Dashboard"]}>
      {/* HERO */}
      <section className="relative mb-8 sm:mb-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 opacity-10 dark:opacity-15 rounded-xl" />
        <div className="relative max-w-7xl mx-auto sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
                Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">MDM Tools</span>
                <span className="ml-3 align-text-top">
                  <VersionPill version="v3.0" />
                </span>
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2 max-w-2xl">
                Master distributor data with speed, accuracy, and full traceability.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Last sync: {lastSync}</p>
            </div>
            <div className="flex gap-2">
              <a
                href="#"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
                aria-label="Upload files"
              >
                <UploadCloud size={18} /> Upload Files
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 bg-white text-blue-700 ring-1 ring-blue-200 hover:ring-blue-300 dark:bg-gray-800 dark:text-blue-300 dark:ring-gray-700 transition"
                aria-label="View summary"
              >
                <BarChart2 size={18} /> View Summary
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* KPI CARDS */}
      <section className="px-4 sm:px-0 mb-8 sm:mb-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <KpiCard
            title="Uploads"
            value={stats.uploads}
            delta={deltas.uploads}
            trend={trends.uploads}
            icon={<UploadCloud className="text-blue-600 dark:text-blue-400" />}
          />
          <KpiCard
            title="Matches"
            value={stats.matches}
            delta={deltas.matches}
            trend={trends.matches}
            icon={<RefreshCw className="text-emerald-600 dark:text-emerald-400" />}
          />
          <KpiCard
            title="Mismatches"
            value={stats.mismatches}
            delta={deltas.mismatches}
            trend={trends.mismatches}
            inverse
            icon={<BarChart2 className="text-rose-600 dark:text-rose-400" />}
          />
        </div>
      </section>

      {/* QUICK ACTIONS */}
      <section className="px-4 sm:px-0 mb-8 sm:mb-10">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={<Activity size={18} />} title="Quick Actions" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <QuickAction
              href="/upload"
              title="Upload OSDP & PBI"
              desc="Drag & drop files for reconciliation"
              icon={<UploadCloud size={20} />}
            />
            <QuickAction
              href="/result_summary"
              title="Summary Reports"
              desc="View matched vs mismatched"
              icon={<BarChart2 size={20} />}
            />
            <QuickAction
              href="/reports/matrix_recons"
              title="Reconciliation Matrix"
              desc="Track progress by period"
              icon={<RefreshCw size={20} />}
            />
            <QuickAction
              href="/about"
              title="Documentation"
              desc="Guides, formats & FAQs"
              icon={<FileText size={20} />}
            />
          </div>
        </Card>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 px-4 sm:px-0">
        {/* RECENT ACTIVITY */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={<Clock size={18} />} title="Recent Activity" />
            <a href="/logs" className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
              View all <ExternalLink size={14} />
            </a>
          </div>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {activities.map((a) => (
              <ActivityRow key={a.id} type={a.type} label={a.label} time={a.time} />
            ))}
          </ul>
        </Card>

        {/* SYSTEM HEALTH (Live) */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={<ShieldCheck size={18} />} title="System Health" />
          </div>
          <div className="space-y-3">
            <HealthRow label="API Service" status={apiStatus} hint={apiHint}  latency={apiLatency} />
            <HealthRow label="Google Sheets" status={sheetStatus} hint={sheetHint} latency={sheetLatency} />
            <HealthRow label="Storage" status={storageStatus} hint={storageHint} latency={storageLatency} />
          </div>
          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            <p className="inline-flex items-center gap-1">
              <Info size={14} /> Live status auto-refreshes every {Math.round(HEALTH_POLL_MS / 1000)}s.
            </p>
          </div>
        </Card>
      </div>

      {/* HELP & LINKS */}
      <section className="px-4 sm:px-0 mt-8 sm:mt-10">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={<LinkIcon size={18} />} title="Helpful Links" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <HelpLink
              href="/about#file-templates"
              title="File Templates"
              desc="CSV structures and required headers"
            />
            <HelpLink
              href="/about#common-errors"
              title="Common Errors"
              desc="How to fix validation or import issues"
            />
            <HelpLink
              href="/about#best-practices"
              title="Best Practices"
              desc="Tips for clean and fast reconciliation"
            />
          </div>
        </Card>
      </section>
    </DashboardLayout>
  );
}

/* ------------------------- Helpers ------------------------- */

function normalizeHealthPayload(data, url) {
  // Supports both { service, status, hint, latencyMs, updatedAt } and array payloads
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
    <div className={`bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-100 dark:ring-gray-700 rounded-2xl p-4 sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title }) {
  return (
    <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 inline-flex items-center gap-2">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700/60">
        {icon}
      </span>
      {title}
    </h2>
  );
}

function QuickAction({ href, title, desc, icon }) {
  return (
    <a
      href={href}
      className="group rounded-xl p-4 ring-1 ring-gray-100 dark:ring-gray-700 bg-gray-50/60 dark:bg-gray-800/60 hover:bg-white dark:hover:bg-gray-800 transition block"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-white dark:bg-gray-800 p-2 ring-1 ring-gray-100 dark:ring-gray-700">
            {icon}
          </div>
          <div>
            <div className="font-semibold text-gray-900 dark:text-gray-100">{title}</div>
            <div className="text-sm text-gray-600 dark:text-gray-300">{desc}</div>
          </div>
        </div>
        <ExternalLink className="opacity-0 group-hover:opacity-100 transition text-gray-400" size={18} />
      </div>
    </a>
  );
}

function ActivityRow({ type, label, time }) {
  const iconMap = {
    upload: <UploadCloud size={18} className="text-blue-600 dark:text-blue-400" />,
    recon: <RefreshCw size={18} className="text-emerald-600 dark:text-emerald-400" />,
    mismatch: <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400" />,
  };
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-lg bg-gray-50 dark:bg-gray-700/60 p-2">{iconMap[type] ?? <Activity size={18} />}</div>
        <div className="flex-1">
          <p className="text-sm sm:text-base text-gray-800 dark:text-gray-100">{label}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{time}</p>
        </div>
      </div>
    </li>
  );
}

/* Left-aligned: label + status pill + latency + hint on same row */
function HealthRow({ label, status, hint, latency }) {
  const s = String(status || "");
  const ok = s.toLowerCase() === "up" || s.toLowerCase().includes("operational");

  return (
    <div className="flex items-center gap-3 py-1">
      {/* fixed-width label column for alignment */}
      <div className="text-sm font-medium text-gray-800 dark:text-gray-100 w-32">
        {label}
      </div>

      {/* status + latency + hint */}
      <div className="flex items-center gap-2 text-xs flex-wrap">
        {ok ? (
          <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={16} />
        ) : (
          <AlertTriangle className="text-amber-600 dark:text-amber-400" size={16} />
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

function HelpLink({ href, title, desc }) {
  return (
    <a
      href={href}
      className="rounded-xl p-4 ring-1 ring-gray-100 dark:ring-gray-700 bg-gray-50/60 dark:bg-gray-800/60 hover:bg-white dark:hover:bg-gray-800 transition block"
    >
      <div className="font-semibold text-gray-900 dark:text-gray-100">{title}</div>
      <div className="text-sm text-gray-600 dark:text-gray-300">{desc}</div>
    </a>
  );
}

function KpiCard({ title, value, delta, trend = [], icon, inverse = false }) {
  const positive = inverse ? delta < 0 : delta >= 0;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm ring-1 ring-gray-100 dark:ring-gray-700 p-4 sm:p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-500 dark:text-gray-300">{title}</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
        </div>
        <div className="rounded-xl bg-gray-50 dark:bg-gray-700/60 p-2">{icon}</div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="inline-flex items-center text-xs font-medium">
          {positive ? (
            <span className="inline-flex items-center text-emerald-700 dark:text-emerald-300">
              <ArrowUpRight size={16} className="mr-1" />
              {Math.abs(delta)} this week
            </span>
          ) : (
            <span className="inline-flex items-center text-rose-700 dark:text-rose-300">
              <ArrowDownRight size={16} className="mr-1" />
              {Math.abs(delta)} this week
            </span>
          )}
        </div>
        <div className="w-28 h-8">
          <Sparkline data={trend} />
        </div>
      </div>
    </div>
  );
}

function Sparkline({ data = [] }) {
  if (!data.length) return null;
  const width = 112;
  const height = 32;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = Math.max(1, max - min);
  const step = width / (data.length - 1);

  const points = data
    .map((d, i) => {
      const x = i * step;
      const y = height - ((d - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-blue-500/70 dark:text-blue-400/70"
        points={points}
      />
    </svg>
  );
}

export default HomePage;

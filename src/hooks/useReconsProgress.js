// src/hooks/useReconsProgress.js
import { useEffect, useMemo, useState } from "react";

const SHEET_ID = "1ql1BfkiuRuU3A3mfOxEw_GoL2gP5ki7eQECHxyfvFwk";
const SHEET_NAME = "Summary";
const POLL_MS = 60000;

// Fixed columns (0-based index)
const COL_YEAR = 0; // A
const COL_MONTH = 1; // B
const COL_E = 4; // E
const COL_F = 5; // F
const COL_STATUS = 6; // G
const COL_TIMESTAMP = 8; // I

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

function toGvizUrl(sheetId, sheetName) {
  const params = new URLSearchParams();
  params.set("tqx", "out:json");
  params.set("headers", "1");
  params.set("sheet", sheetName);
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?${params.toString()}`;
}

function extractGvizJson(text) {
  const start = text.indexOf("setResponse(");
  const firstBrace = text.indexOf("{", start);
  const lastBrace = text.lastIndexOf("}");
  return JSON.parse(text.slice(firstBrace, lastBrace + 1));
}

function parseToTable(payload) {
  const rows = payload?.table?.rows || [];
  const data = rows.map((r) => (r?.c || []).map((cell) => cell?.v ?? null));
  return data;
}

function isMeaningful(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return false;
  if (s === "-" || s === "—" || s === "n/a" || s === "na" || s === "null") return false;
  return true;
}

// Handles "Date(2026,1,10,9,39,4)" OR "2025-06-18 09:03:04"
function parseTimestamp(v) {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;

  const s = String(v).trim();

  // GViz Date(...) format
  const m = s.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]); // 0-based
    const day = Number(m[3]);
    const hh = Number(m[4] ?? 0);
    const mm = Number(m[5] ?? 0);
    const ss = Number(m[6] ?? 0);
    const d = new Date(year, month, day, hh, mm, ss);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatLastRun(d) {
  if (!d) return "—";
  return d.toLocaleString();
}

function normalizeReportStatus(v) {
  const s = String(v ?? "").trim().toLowerCase();

  // treat empty-ish as pending
  if (!isMeaningful(s)) return "pending";

  if (
    s.includes("mismatch") ||
    s.includes("not match") ||
    s.includes("unmatch") ||
    s.includes("fail")
  ) return "mismatch";

  // IMPORTANT: check "match" after mismatch keywords
  if (s === "match" || s.includes("match")) return "match";

  return "pending";
}

function normalizeMonthFilter(month) {
  // month can be: undefined / "" => all
  if (month === undefined || month === null || month === "") return undefined;

  // If number: 1..12 -> month name
  if (typeof month === "number") {
    const n = month;
    if (n >= 1 && n <= 12) return MONTHS[n - 1].toLowerCase();
    return undefined;
  }

  // If string number: "1".."12"
  const asNum = Number(month);
  if (Number.isFinite(asNum) && asNum >= 1 && asNum <= 12) {
    return MONTHS[asNum - 1].toLowerCase();
  }

  // If month name: "May"
  const s = String(month).trim().toLowerCase();
  const idx = MONTHS.map((m) => m.toLowerCase()).indexOf(s);
  if (idx !== -1) return MONTHS[idx].toLowerCase();

  return undefined;
}

/**
 * useReconsProgress({ year, month })
 * - year: number (defaults to current year if not provided)
 * - month: "January".."December" OR 1..12 OR undefined (all months)
 *
 * Rules (your request):
 * - Filter year based on Column A
 * - Filter month based on Column B (month name)
 * - Total = count rows where E OR F is filled (meaningful)
 * - Processed = count rows where G (Report Status) is filled (meaningful)
 */
export default function useReconsProgress(params = {}) {
  const now = new Date();
  const year = Number(params.year ?? now.getFullYear());
  const monthFilter = normalizeMonthFilter(params.month);

  const [rows, setRows] = useState([]);
  const [lastRunAt, setLastRunAt] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const url = toGvizUrl(SHEET_ID, SHEET_NAME);
        const res = await fetch(url, { cache: "no-store" });
        const text = await res.text();

        const payload = extractGvizJson(text);
        const data = parseToTable(payload);

        // Map raw rows -> structured
        const mappedAll = data.map((row) => {
          const yRaw = row[COL_YEAR];
          const mRaw = row[COL_MONTH];

          const y = Number(String(yRaw ?? "").trim());
          const m = String(mRaw ?? "").trim(); // "May"
          const mNorm = m.toLowerCase();

          const eVal = row[COL_E];
          const fVal = row[COL_F];
          const statusRaw = row[COL_STATUS];

          // Total rule: E or F must exist
          const hasBaseData = (isMeaningful(eVal) || isMeaningful(fVal));

          const status = normalizeReportStatus(statusRaw);
          const ts = parseTimestamp(row[COL_TIMESTAMP]);

          return {
            year: Number.isFinite(y) ? y : null,
            month: m,           // original
            monthNorm: mNorm,   // normalized
            hasBaseData,
            status,
            statusRaw,
            ts,
          };
        });

        // Apply filter by Column A + Column B
        const filtered = mappedAll.filter((r) => {
          if (r.year !== year) return false;
          if (monthFilter && r.monthNorm !== monthFilter) return false;
          return true;
        });

        // last run: latest timestamp within filtered rows
        let latest = null;
        for (const r of filtered) {
          if (!r.ts) continue;
          if (!latest || r.ts.getTime() > latest.getTime()) latest = r.ts;
        }

        if (!alive) return;
        setRows(filtered);
        setLastRunAt(latest);
        setError("");
      } catch (e) {
        if (!alive) return;
        setRows([]);
        setLastRunAt(null);
        setError(e?.message || "Failed to load recons progress.");
      }
    }

    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [year, monthFilter]);

  // ✅ Total = rows that have E or F (file rows)
  const eligible = useMemo(() => rows.filter((r) => r.hasBaseData), [rows]);

  // ✅ Processed = eligible rows where status in Column G is filled (meaningful)
  const processedRows = useMemo(() => {
    // numerator = only Match or Mismatch
    return rows.filter((r) => r.status === "match" || r.status === "mismatch");
  }, [rows]);

  const total = rows.length;
  const processed = processedRows.length;

  const matched = useMemo(
    () => processedRows.filter((r) => r.status === "match").length,
    [processedRows]
  );

  const mismatches = useMemo(
    () => processedRows.filter((r) => r.status === "mismatch").length,
    [processedRows]
  );

  const percentDone = useMemo(() => {
    if (!total) return 0;
    return Math.round((processed / total) * 100);
  }, [total, processed]);

  const filterLabel = useMemo(() => {
    if (!monthFilter) return `Filter: ${year}`;
    // prettify month back to Title Case
    const idx = MONTHS.map((m) => m.toLowerCase()).indexOf(monthFilter);
    const pretty = idx >= 0 ? MONTHS[idx] : monthFilter;
    return `Filter: ${year} • ${pretty}`;
  }, [year, monthFilter]);

  return {
    hasData: total > 0 && !error,
    total,
    processed,
    matched,
    mismatches,
    percentDone,
    lastRunLabel: formatLastRun(lastRunAt),
    lastRunAt,
    error,
    filter: { year, month: monthFilter },
    filterLabel,
  };
}

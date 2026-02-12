// src/hooks/useEmailTrackerSummary.js
import { useEffect, useMemo, useState } from "react";

function normalizeStatus(v) {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return "new";
  if (s === "new") return "new";
  if (s.includes("progress")) return "inProgress";
  if (s === "in_progress" || s === "inprogress") return "inProgress";
  if (s.includes("complete") || s === "done") return "complete";
  return "new";
}

function toGvizUrl(sheetId, sheetName = "") {
  const params = new URLSearchParams();
  params.set("tqx", "out:json");
  if (sheetName) params.set("sheet", sheetName);
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?${params.toString()}`;
}

function parseGviz(text) {
  // Google GViz wraps JSON in a function call
  const json = JSON.parse(text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1));
  const cols = json?.table?.cols || [];
  const rows = json?.table?.rows || [];

  const headers = cols.map((c) => String(c?.label || "").trim());
  const data = rows.map((r) => (r?.c || []).map((cell) => cell?.v ?? ""));

  return { headers, data };
}

export default function useEmailTrackerSummary({ sheetId, sheetName = "" } = {}) {
  const finalSheetId = sheetId || import.meta.env.VITE_EMAIL_TRACKER_SHEET_ID;

  const [loading, setLoading] = useState(Boolean(finalSheetId));
  const [error, setError] = useState("");
  const [counts, setCounts] = useState({
    new: 0,
    inProgress: 0,
    complete: 0,
    total: 0,
  });

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!finalSheetId) {
        setLoading(false);
        setError("Missing Email Tracker Sheet ID. Set VITE_EMAIL_TRACKER_SHEET_ID in .env");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const url = toGvizUrl(finalSheetId, sheetName);
        const res = await fetch(url, { cache: "no-store" });
        const text = await res.text();

        const { headers, data } = parseGviz(text);
        const statusIdx =
          headers.findIndex((h) => h.toLowerCase() === "status") !== -1
            ? headers.findIndex((h) => h.toLowerCase() === "status")
            : headers.findIndex((h) => h.toLowerCase().includes("status"));

        if (statusIdx === -1) {
          throw new Error("No 'Status' column found in Email Tracker sheet.");
        }

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
  }, [finalSheetId, sheetName]);

  const percentComplete = useMemo(() => {
    if (!counts.total) return 0;
    return Math.round((counts.complete / counts.total) * 100);
  }, [counts]);

  return { loading, error, counts, percentComplete };
}

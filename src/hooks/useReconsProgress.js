// src/hooks/useReconsProgress.js
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

const COL = "recon_cells";
const POLL_MS = 60000;

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

function normalizeMonthToNumber(month) {
  if (month === undefined || month === null || month === "") return undefined;

  if (typeof month === "number") {
    if (month >= 1 && month <= 12) return month;
    return undefined;
  }

  const asNum = Number(month);
  if (Number.isFinite(asNum) && asNum >= 1 && asNum <= 12) return asNum;

  const s = String(month).trim().toLowerCase();
  const idx = MONTHS.map((m) => m.toLowerCase()).indexOf(s);
  if (idx !== -1) return idx + 1;

  return undefined;
}

function formatLastRun(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

function baseQuery(queryBuild, year, monthNum) {
  let q = queryBuild.eq("year", Number(year));
  if (monthNum) q = q.eq("month", Number(monthNum));
  return q;
}

export default function useReconsProgress(params = {}) {
  const now = new Date();
  const year = Number(params.year ?? now.getFullYear());
  const monthNum = normalizeMonthToNumber(params.month);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastRunAt, setLastRunAt] = useState(null);

  const [total, setTotal] = useState(0);
  const [matched, setMatched] = useState(0);
  const [mismatches, setMismatches] = useState(0);
  const [noData, setNoData] = useState(0);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        // Build base queries for counts
        const getBase = () => baseQuery(supabase.from(COL).select('*', { count: 'exact', head: true }), year, monthNum);
        
        const [t, m, mm, nd] = await Promise.all([
          getBase(),
          getBase().eq("status", "match"),
          getBase().eq("status", "mismatch"),
          getBase().eq("status", "no_data"),
        ]);

        const totalCount = t.count || 0;
        const matchCount = m.count || 0;
        const mismatchCount = mm.count || 0;
        const noDataCount = nd.count || 0;

        // lastRunAt
        let latest = null;
        try {
          const { data: latestData } = await baseQuery(
            supabase.from(COL).select('updated_at').order('updated_at', { ascending: false }).limit(1),
            year, 
            monthNum
          ).maybeSingle();

          if (latestData?.updated_at) {
            latest = latestData.updated_at;
          }
        } catch (err) {
          latest = null;
        }

        if (!alive) return;
        setTotal(totalCount);
        setMatched(matchCount);
        setMismatches(mismatchCount);
        setNoData(noDataCount);
        setLastRunAt(latest);
        setError("");
      } catch (e) {
        if (!alive) return;
        setTotal(0);
        setMatched(0);
        setMismatches(0);
        setNoData(0);
        setLastRunAt(null);
        setError(e?.message || "Failed to load recons progress.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [year, monthNum]);

  const processed = useMemo(() => matched + mismatches + noData, [matched, mismatches, noData]);

  const percentDone = useMemo(() => {
    if (!total) return 0;
    return Math.round((processed / total) * 100);
  }, [total, processed]);

  const filterLabel = useMemo(() => {
    if (!monthNum) return `Filter: ${year}`;
    return `Filter: ${year} • ${MONTHS[monthNum - 1]}`;
  }, [year, monthNum]);

  return {
    loading,
    hasData: total > 0 && !error,
    total,
    processed,
    matched,
    mismatches,
    noData,
    percentDone,
    lastRunLabel: formatLastRun(lastRunAt),
    lastRunAt,
    error,
    filter: { year, month: monthNum },
    filterLabel,
  };
}
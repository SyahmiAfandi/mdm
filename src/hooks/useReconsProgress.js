// src/hooks/useReconsProgress.js
import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebaseClient";

const COL = "reconCells";
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
  return d.toLocaleString();
}

function baseQuery(year, monthNum) {
  const colRef = collection(db, COL);
  const filters = [where("year", "==", Number(year))];
  if (monthNum) filters.push(where("month", "==", Number(monthNum)));
  return query(colRef, ...filters);
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
        const qBase = baseQuery(year, monthNum);

        // counts
        const [t, m, mm, nd] = await Promise.all([
          getCountFromServer(qBase),
          getCountFromServer(query(qBase, where("status", "==", "match"))),
          getCountFromServer(query(qBase, where("status", "==", "mismatch"))),
          getCountFromServer(query(qBase, where("status", "==", "no_data"))),
        ]);

        const totalCount = t.data().count || 0;
        const matchCount = m.data().count || 0;
        const mismatchCount = mm.data().count || 0;
        const noDataCount = nd.data().count || 0;

        // lastRunAt (try with orderBy; if index missing, fall back to "—")
        let latest = null;
        try {
          const qLatest = query(qBase, orderBy("updatedAt", "desc"), limit(1));
          const snap = await getDocs(qLatest);
          if (!snap.empty) {
            const d = snap.docs[0].data();
            latest = d?.updatedAt?.toDate ? d.updatedAt.toDate() : null;
          }
        } catch (err) {
          // Common: missing index. We don't fail the whole card.
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
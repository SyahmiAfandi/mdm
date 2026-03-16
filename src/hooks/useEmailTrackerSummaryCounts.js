import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

export default function useEmailTrackerSummaryCounts() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState({ new: 0, inProgress: 0, complete: 0, total: 0 });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [newRes, progRes, compRes] = await Promise.all([
        supabase.from("email_tasks").select('*', { count: 'exact', head: true }).eq("status", "NEW"),
        supabase.from("email_tasks").select('*', { count: 'exact', head: true }).eq("status", "IN_PROGRESS"),
        supabase.from("email_tasks").select('*', { count: 'exact', head: true }).eq("status", "COMPLETE"),
      ]);

      const n = newRes.count || 0;
      const p = progRes.count || 0;
      const c = compRes.count || 0;

      setCounts({ new: n, inProgress: p, complete: c, total: n + p + c });
    } catch (e) {
      setError(e?.message || "Failed to load Email Tracker summary.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const percentComplete = useMemo(() => {
    if (!counts.total) return 0;
    return Math.round((counts.complete / counts.total) * 100);
  }, [counts]);

  return { loading, error, counts, percentComplete, refresh };
}
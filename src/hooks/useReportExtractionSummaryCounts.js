import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { useUser } from "../context/UserContext";

export default function useReportExtractionSummaryCounts() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState({ pending: 0, onHold: 0, complete: 0, unassigned: 0, total: 0 });

  const userId = user?.id || user?.uid;

  const refresh = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError("");
    try {
      // In a real production scenario, we'd apply stricter RLS filtering or use user match, 
      // but for dashboard overall view, we'll fetch an overview of the assigned items 
      // or global limits. Let's do a simple full aggregation since datasets are small,
      // or just hit the core counters.
      
      const { data, error: dbError } = await supabase
        .from("report_extraction_tracker")
        .select("status, assigned_to_uid, assigned_to_name");

      if (dbError) throw dbError;

      const myCounts = { pending: 0, onHold: 0, complete: 0, total: 0 };
      const globalCounts = { pending: 0, onHold: 0, complete: 0, unassigned: 0, total: data.length };

      (data || []).forEach(row => {
        const s = (row.status || "").toLowerCase();
        const isMine = row.assigned_to_uid === userId || (user?.name && row.assigned_to_name?.toLowerCase() === user.name.toLowerCase());

        // Global Tracker
        if (s === "pending" || s === "offline") globalCounts.pending++;
        else if (s === "on hold" || s === "onhold") globalCounts.onHold++;
        else if (s === "complete" || s === "completed") globalCounts.complete++;
        else globalCounts.unassigned++;

        // Personal Tracker
        if (isMine) {
          myCounts.total++;
          if (s === "pending" || s === "offline") myCounts.pending++;
          else if (s === "on hold" || s === "onhold") myCounts.onHold++;
          else if (s === "complete" || s === "completed") myCounts.complete++;
        }
      });

      setCounts({ mine: myCounts, global: globalCounts });
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to load Report Extraction summary.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const percentComplete = useMemo(() => {
    if (!counts.global?.total) return 0;
    return Math.round((counts.global.complete / counts.global.total) * 100);
  }, [counts]);

  return { loading, error, counts, percentComplete, refresh };
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

export default function useEmailTrackerSummary() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState({ new: 0, inProgress: 0, complete: 0, total: 0 });

  useEffect(() => {
    let alive = true;

    async function fetchStats() {
      try {
        const [newRes, progRes, compRes] = await Promise.all([
          supabase.from("email_tasks").select('*', { count: 'exact', head: true }).eq("status", "NEW"),
          supabase.from("email_tasks").select('*', { count: 'exact', head: true }).eq("status", "IN_PROGRESS"),
          supabase.from("email_tasks").select('*', { count: 'exact', head: true }).eq("status", "COMPLETE"),
        ]);
        
        if (!alive) return;
        const n = newRes.count || 0;
        const p = progRes.count || 0;
        const c = compRes.count || 0;

        setCounts({ new: n, inProgress: p, complete: c, total: n + p + c });
        setLoading(false);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || "Failed to load stats.");
        setLoading(false);
      }
    }

    fetchStats();
    
    // Poll every 10 seconds to simulate realtime behavior
    const interval = setInterval(() => {
      fetchStats();
    }, 10000);

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  const percentComplete = useMemo(() => {
    if (!counts.total) return 0;
    return Math.round((counts.complete / counts.total) * 100);
  }, [counts]);

  return { loading, error, counts, percentComplete };
}
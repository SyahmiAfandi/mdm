import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getCountFromServer, query, where } from "firebase/firestore";
import { db } from "../firebaseClient";

export default function useEmailTrackerSummaryCounts() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState({ new: 0, inProgress: 0, complete: 0, total: 0 });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const col = collection(db, "email_tasks");

      const [newSnap, progSnap, compSnap] = await Promise.all([
        getCountFromServer(query(col, where("status", "==", "NEW"))),
        getCountFromServer(query(col, where("status", "==", "IN_PROGRESS"))),
        getCountFromServer(query(col, where("status", "==", "COMPLETE"))),
      ]);

      const n = newSnap.data().count;
      const p = progSnap.data().count;
      const c = compSnap.data().count;

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
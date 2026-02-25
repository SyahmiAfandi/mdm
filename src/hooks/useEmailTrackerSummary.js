import { useEffect, useMemo, useState } from "react";
import { db } from "../firebaseClient";
import { doc, onSnapshot } from "firebase/firestore";

export default function useEmailTrackerSummaryFirestore() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState({ new: 0, inProgress: 0, complete: 0, total: 0 });

  useEffect(() => {
    const ref = doc(db, "stats", "email_tasks");

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const d = snap.exists() ? snap.data() : {};
        setCounts({
          new: Number(d.new || 0),
          inProgress: Number(d.inProgress || 0),
          complete: Number(d.complete || 0),
          total: Number(d.total || 0),
        });
        setLoading(false);
      },
      (e) => {
        setError(e?.message || "Failed to load stats.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const percentComplete = useMemo(() => {
    if (!counts.total) return 0;
    return Math.round((counts.complete / counts.total) * 100);
  }, [counts]);

  return { loading, error, counts, percentComplete };
}
// src/components/GoogleSheetsHealthViewer.jsx
import React, { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function GoogleSheetsHealthViewer() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const ref = doc(db, "health", "googleSheets");
    const unsub = onSnapshot(ref, (snap) => setData(snap.data() || null));
    return () => unsub();
  }, []);

  const Pill = ({ status }) => {
    const base =
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold";
    if (status === "UP")
      return <span className={`${base} bg-green-100 text-green-700`}>UP</span>;
    if (status === "DEGRADED")
      return (
        <span className={`${base} bg-yellow-100 text-yellow-700`}>DEGRADED</span>
      );
    if (status === "DOWN")
      return <span className={`${base} bg-red-100 text-red-700`}>DOWN</span>;
    return <span className={`${base} bg-gray-100 text-gray-700`}>UNKNOWN</span>;
  };

  return (
    <div className="rounded-2xl shadow p-4 border bg-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Google Sheets</h3>
          <Pill status={data?.status} />
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-600 grid grid-cols-2 gap-y-1">
        <div>
          <span className="font-medium">Latency:</span>{" "}
          {data?.latencyMs ?? "—"} ms
        </div>
        <div>
          <span className="font-medium">Last write:</span>{" "}
          {data?.checkedAt?.toDate?.().toLocaleString?.() ?? "—"}
        </div>
        <div className="col-span-2">
          <span className="font-medium">Hint:</span> {data?.hint ?? "—"}
        </div>
      </div>
    </div>
  );
}

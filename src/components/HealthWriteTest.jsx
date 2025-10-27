// src/components/HealthWriteTest.jsx
import React, { useState } from "react";
import { writeTestHealth } from "../services/healthStore";

export default function HealthWriteTest() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    try {
      setLoading(true);
      await writeTestHealth();
      alert("✅ Test health written to Firestore (health/googleSheets).");
    } catch (err) {
      console.error(err);
      alert("❌ Failed to write test health. Check console & Firestore Rules.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="px-3 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50"
    >
      {loading ? "Writing..." : "Write Test Health"}
    </button>
  );
}

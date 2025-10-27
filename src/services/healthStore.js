// src/services/healthStore.js
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Writes a test health document to Firestore at:
 *   health / googleSheets
 */
export async function writeTestHealth() {
  const ref = doc(db, "health", "googleSheets");

  await setDoc(
    ref,
    {
      status: "UP",                // "UP" | "DEGRADED" | "DOWN"
      latencyMs: 123,             // example test value
      checkedAt: serverTimestamp(), // server-side timestamp
      hint: "Manual test write",
      source: "GAS",
      url: "https://your-gas-url/exec", // replace later with your real GAS URL
      updatedAtStr: new Date().toISOString(),
    },
    { merge: true }
  );
}

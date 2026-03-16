// src/services/healthStore.js
import { supabase } from "../supabaseClient";

/**
 * Writes a test health document to Supabase (assuming health_checks table)
 * Fallback gracefully if table doesn't exist yet.
 */
export async function writeTestHealth() {
  try {
    await supabase.from("health").upsert({
      id: "googleSheets",
      status: "UP",
      latencyMs: 123,
      checkedAt: new Date().toISOString(),
      hint: "Manual test write",
      source: "GAS",
      url: "https://your-gas-url/exec",
      updatedAtStr: new Date().toISOString(),
    });
  } catch (err) {
    console.error("writeTestHealth failed, table may not exist:", err);
  }
}

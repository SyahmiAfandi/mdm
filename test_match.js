import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  console.log("Checking recon_cells for mismatch and period...");
  
  // 1. Get first available matching cell directly
  const { data: cells, error: cellsErr } = await supabase
    .from("recon_cells")
    .select("period_id, status, business_type, report_type_name")
    .eq("status", "mismatch")
    .limit(1);

  if (cellsErr) {
    console.error("Cells Error:", cellsErr);
    return;
  }
  
  if (!cells || cells.length === 0) {
    console.log("NO MISMATCH CELLS FOUND IN DB!");
    return;
  }

  const sample = cells[0];
  console.log("Found sample mismatch cell:", sample);
  
  const reportType = `${sample.business_type || 'Unknown'} - ${sample.report_type_name || 'Unknown'}`;
  console.log("Calculated Report Type String:", reportType);

  console.log("Checking if this exact combination exists using SQL...");
  // simulate the exact sql where clause
  const { data: rawData, error: rawErr } = await supabase
    .from("recon_cells")
    .select("id")
    .eq("status", "mismatch")
    .eq("period_id", sample.period_id);
    
  console.log("Found raw rows matching period & status:", rawData?.length, rawErr || "");
  
}
check();

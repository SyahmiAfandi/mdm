import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import Papa from "papaparse";
import { supabase } from "../../supabaseClient";
import { usePermissions } from "../../hooks/usePermissions";

/**
 * CSV headers expected (case-insensitive):
 * title,senderEmail,receivedAt,status,remark,messageId,pic_assign
 *
 * receivedAt can be ISO date: 2026-02-20T10:30:00+08:00
 * status: NEW | IN_PROGRESS | COMPLETE
 */

const BATCH_SIZE = 450;

function safeStr(v) {
  return (v ?? "").toString().trim();
}

function normalizeStatus(s) {
  const v = safeStr(s).toUpperCase().replace(/\s+/g, "_");
  if (v === "INPROGRESS") return "IN_PROGRESS";
  if (v === "IN_PROGRESS") return "IN_PROGRESS";
  if (v === "COMPLETE") return "COMPLETE";
  return "NEW";
}

function parseDateToTimestamp(v) {
  const s = safeStr(v);
  if (!s) return new Date().toISOString();
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function getLowerKey(obj, key) {
  // access CSV fields case-insensitively
  const k = Object.keys(obj || {}).find((x) => x.toLowerCase() === key.toLowerCase());
  return k ? obj[k] : undefined;
}

export default function EmailTrackerBulkImport() {
  const { can, role } = usePermissions();
  const canBulkImport = can("mdmEmailTracker.bulkImport") || role === "admin";

  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const preview = useMemo(() => rows.slice(0, 8), [rows]);

  function onPickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;

    if (!f.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please upload a .csv file");
      return;
    }

    setFile(f);
    setRows([]);

    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const data = result.data || [];
        if (!data.length) {
          toast.error("CSV has no rows");
          return;
        }
        setRows(data);
        toast.success(`Loaded ${data.length} row(s)`);
      },
      error: (err) => {
        console.error(err);
        toast.error("Failed to parse CSV");
      },
    });
  }

  function parseDateToTimestamp(v) {
    const s0 = safeStr(v);
    if (!s0) return new Date().toISOString();

    // normalize Firestore console-like string:
    // "29 January 2026 at 9:33:00 AM UTC+8"
    let s = s0.replace(/\s+at\s+/i, " ").trim();

    // convert "UTC+8" or "UTC+08" to "+08:00"
    s = s.replace(/UTC\+(\d{1,2})\b/i, (_, hh) => {
      const H = String(hh).padStart(2, "0");
      return `+${H}:00`;
    });

    // convert "UTC-5" -> "-05:00"
    s = s.replace(/UTC-(\d{1,2})\b/i, (_, hh) => {
      const H = String(hh).padStart(2, "0");
      return `-${H}:00`;
    });

    // Try parse now that it's closer to a standard form
    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();

    // Fallback: handle "DD Month YYYY HH:MM:SS AM/PM +08:00" manually
    const m = s.match(
      /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)\s*([+-]\d{2}:\d{2})?$/
    );
    if (!m) return new Date().toISOString();

    const day = Number(m[1]);
    const monName = m[2].toLowerCase();
    const year = Number(m[3]);
    let hour = Number(m[4]);
    const minute = Number(m[5]);
    const second = Number(m[6] || 0);
    const ampm = m[7].toUpperCase();
    const tz = m[8] || "+08:00";

    const months = {
      january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
      july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    };
    const month = months[monName];
    if (month === undefined) return new Date().toISOString();

    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;

    // Build ISO string
    const iso =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` +
      `T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}${tz}`;

    const dt2 = new Date(iso);
    if (!Number.isNaN(dt2.getTime())) return dt2.toISOString();

    return new Date().toISOString();
  }

  async function reserveTaskNoRange(count) {
    // Reserve [start..start+count-1] in counters
    const { data: snap } = await supabase.from("counters").select("next").eq("id", "email_tasks").maybeSingle();
    let current = Number(snap?.next || 1);

    if (snap) {
      await supabase.from("counters").update({ next: current + count }).eq("id", "email_tasks");
      return current;
    } else {
      const start = 1;
      await supabase.from("counters").insert({ id: "email_tasks", next: start + count });
      return start;
    }
  }

  async function importToFirestore() {
    if (!rows.length) {
      toast.error("No rows loaded");
      return;
    }

    setBusy(true);
    setProgress({ done: 0, total: rows.length });

    try {
      // 1) Reserve sequential taskNo in ONE go
      const startNo = await reserveTaskNoRange(rows.length);

      // 2) Batch write
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows.slice(i, i + BATCH_SIZE);
        
        const inserts = chunk.map((r, idx) => {
          const taskNo = startNo + i + idx;

          const title = safeStr(getLowerKey(r, "title")) || "(no subject)";
          const senderEmail = safeStr(getLowerKey(r, "senderEmail") ?? getLowerKey(r, "SenderEmail"));
          const receivedAt = parseDateToTimestamp(getLowerKey(r, "receivedAt"));
          const status = normalizeStatus(getLowerKey(r, "status"));
          const remark = safeStr(getLowerKey(r, "remark"));
          const messageId = safeStr(getLowerKey(r, "messageId"));
          const picAssign = safeStr(getLowerKey(r, "pic_assign"));

          return {
            taskNo,
            title,
            senderEmail,
            receivedAt,

            pic_assign: picAssign ? picAssign : null,
            status,
            remark,

            // IMPORTANT: use new Date().toISOString() so your UI (NEW 24h / sorting) updates immediately
            pic_create: "bulk_import",
            createdAt: new Date().toISOString(),
            pic_update: "bulk_import",
            updatedAt: new Date().toISOString(),

            messageId,
          };
        });

        const { error } = await supabase.from("email_tasks").insert(inserts);
        if (error) throw error;
        
        setProgress((p) => ({ ...p, done: Math.min(p.total, i + chunk.length) }));
      }

      toast.success(`Imported ${rows.length} row(s) ✅`);
    } catch (e) {
      console.error(e);
      toast.error(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Email Tracker — Bulk Import
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Upload CSV and import into Firestore <span className="font-semibold">email_tasks</span>.
          TaskNo will be reserved sequentially using <span className="font-semibold">counters/email_tasks</span>.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".csv"
              onChange={onPickFile}
              disabled={busy || !canBulkImport}
              className="block text-sm"
            />
            {file && (
              <div className="text-sm text-slate-600 dark:text-slate-300">
                {file.name} — {rows.length} row(s)
              </div>
            )}
          </div>

          <button
            onClick={importToFirestore}
            disabled={busy || rows.length === 0 || !canBulkImport}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "Importing..." : "Import to Firestore"}
          </button>
        </div>

        {busy && (
          <div className="text-sm text-slate-600 dark:text-slate-300">
            Progress: <span className="font-semibold">{progress.done}</span> / {progress.total}
          </div>
        )}

        <div className="text-xs text-slate-500 dark:text-slate-400">
          Required headers: <span className="font-semibold">title, senderEmail, receivedAt</span>.
          Optional: <span className="font-semibold">status, remark, messageId, pic_assign</span>.
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 overflow-x-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">title</th>
              <th className="px-4 py-3 text-left font-semibold">senderEmail</th>
              <th className="px-4 py-3 text-left font-semibold">receivedAt</th>
              <th className="px-4 py-3 text-left font-semibold">status</th>
              <th className="px-4 py-3 text-left font-semibold">remark</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {preview.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={5}>
                  No preview yet.
                </td>
              </tr>
            ) : (
              preview.map((r, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-3">{safeStr(getLowerKey(r, "title"))}</td>
                  <td className="px-4 py-3">{safeStr(getLowerKey(r, "senderEmail"))}</td>
                  <td className="px-4 py-3">{safeStr(getLowerKey(r, "receivedAt"))}</td>
                  <td className="px-4 py-3">{safeStr(getLowerKey(r, "status"))}</td>
                  <td className="px-4 py-3">{safeStr(getLowerKey(r, "remark"))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400">
        Tip: For big imports (1000+), keep the app open until done. If you refresh mid-import, some rows may already be committed.
      </div>
    </div>
  );
}
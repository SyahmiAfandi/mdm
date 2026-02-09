import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import DashboardLayout from "../components/DashboardLayout";
import { APP_FULL_NAME } from '../config';
import {
  RefreshCcw,
  UserPlus2,
  CheckCircle2,
  Pencil,
  Save,
  X,
} from "lucide-react";

/**
 * FRONTEND-ONLY EMAIL TRACKER (Google Sheet as data source)
 * - Reads from Google Sheet using GViz endpoint (public/anyone-with-link)
 * - Shows table
 * - Allows editing PIC / Status / REMARK locally (localStorage)
 *
 * Later:
 * - Replace localStorage save with backend API calls (Flask).
 */

// ====== CONFIG ======
// If your sheet tab name is not the first tab, set it here.
// Try leaving empty first (it will read default / first sheet).
const SHEET_NAME = ""; // e.g. "외부" or "Sheet1"

// Local edits storage
const LS_KEY = "email_tracker_local_edits_v1";

// Your app current user (later: replace with auth context)
const CURRENT_USER = "Syahmi";

// ====== Helpers ======
function safeStr(v) {
  return (v ?? "").toString().trim();
}

// Google GViz returns something like: "google.visualization.Query.setResponse({...});"
// We extract the JSON object inside.
function extractGvizJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Invalid GViz response");
  return JSON.parse(text.substring(start, end + 1));
}

// Convert GViz table -> array of objects based on column labels
function gvizToObjects(gviz) {
  const table = gviz?.table;
  const cols = (table?.cols || []).map((c) => safeStr(c.label));
  const rows = table?.rows || [];

  return rows.map((r) => {
    const obj = {};
    cols.forEach((colName, idx) => {
      const cell = r.c?.[idx];
      // prefer formatted value
      obj[colName] = cell?.f ?? cell?.v ?? "";
    });
    return obj;
  });
}

function readLocalEdits() {
  try {
    const s = localStorage.getItem(LS_KEY);
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

function writeLocalEdits(edits) {
  localStorage.setItem(LS_KEY, JSON.stringify(edits));
}

function buildId(row) {
  // Prefer "ID" column; fallback to title+date+time
  const id = safeStr(row["ID"]);
  if (id) return id;

  const title = safeStr(row["Email Title"]);
  const date = safeStr(row["Date Receive"]);
  const time = safeStr(row["Time Receive"]);
  return `${title}__${date}__${time}`.toLowerCase();
}

// ====== Main Component ======
export default function EmailTracker() {
  const [loading, setLoading] = useState(false);

  const [rawRows, setRawRows] = useState([]);
  const [edits, setEdits] = useState(() => readLocalEdits());

  // filters
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [picFilter, setPicFilter] = useState("All");

  // inline edit modal-ish (simple)
  const [editRowId, setEditRowId] = useState(null);
  const [editRemark, setEditRemark] = useState("");

  useEffect(() => {
    writeLocalEdits(edits);
  }, [edits]);

  async function fetchSheet() {
    setLoading(true);
    try {
      // GViz endpoint:
      // https://docs.google.com/spreadsheets/d/<ID>/gviz/tq?tqx=out:json&sheet=<SHEET_NAME>
      const url = import.meta.env.VITE_GSHEET_EMAIL_TRACKER;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const text = await res.text();
      const gviz = extractGvizJson(text);
      const objects = gvizToObjects(gviz);

      // Expect these headers (based on your sheet):
      // ID, Email Title, Sender, Date Receive, Time Receive, Due Date, PIC, Status, REMARK
      setRawRows(objects);
      toast.success(`Loaded ${objects.length} rows from Google Sheet`);
    } catch (err) {
      console.error(err);
      toast.error(
        "Failed to read Google Sheet. Make sure it is shared publicly (Anyone with link can view) OR published to web."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateEdit(id, patch) {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...patch },
    }));
  }

  function assignToMe(id) {
    updateEdit(id, { PIC: CURRENT_USER, Status: "IN PROGRESS" });
    toast.success("Assigned to you (local)");
  }

  function markDone(id) {
    updateEdit(id, { Status: "COMPLETE" });
    toast.success("Marked COMPLETE (local)");
  }

  function openRemarkEditor(id, currentRemark) {
    setEditRowId(id);
    setEditRemark(currentRemark || "");
  }

  function saveRemark() {
    if (!editRowId) return;
    updateEdit(editRowId, { REMARK: editRemark });
    toast.success("Remark saved (local)");
    setEditRowId(null);
    setEditRemark("");
  }

  function cancelRemark() {
    setEditRowId(null);
    setEditRemark("");
  }

  function clearLocal() {
    localStorage.removeItem(LS_KEY);
    setEdits({});
    toast.success("Cleared local edits");
  }

  const mergedRows = useMemo(() => {
    // Merge raw data + local edits by row id
    return rawRows.map((r) => {
      const id = buildId(r);
      const local = edits[id] || {};
      return {
        _id: id,
        ...r,
        ...local,
      };
    });
  }, [rawRows, edits]);

  const allPICs = useMemo(() => {
    const set = new Set();
    mergedRows.forEach((r) => {
      const pic = safeStr(r["PIC"]);
      if (pic) set.add(pic);
    });
    return ["All", ...Array.from(set).sort()];
  }, [mergedRows]);

  const statuses = ["All", "NEW", "IN PROGRESS", "COMPLETE"];

  const filteredRows = useMemo(() => {
    const query = q.trim().toLowerCase();

    return mergedRows.filter((r) => {
      const status = safeStr(r["Status"]).toUpperCase() || "NEW";
      const pic = safeStr(r["PIC"]);

      if (statusFilter !== "All" && status !== statusFilter) return false;
      if (picFilter !== "All" && pic !== picFilter) return false;

      if (!query) return true;

      const hay = [
        r["ID"],
        r["Email Title"],
        r["Sender"],
        r["Date Receive"],
        r["Time Receive"],
        r["Due Date"],
        r["PIC"],
        r["Status"],
        r["REMARK"],
      ]
        .map(safeStr)
        .join(" ")
        .toLowerCase();

      return hay.includes(query);
    });
  }, [mergedRows, q, statusFilter, picFilter]);

  const summary = useMemo(() => {
    const total = mergedRows.length;
    const counts = { NEW: 0, "IN PROGRESS": 0, COMPLETE: 0 };
    mergedRows.forEach((r) => {
      const s = (safeStr(r["Status"]).toUpperCase() || "NEW");
      if (counts[s] !== undefined) counts[s] += 1;
    });
    return { total, ...counts };
  }, [mergedRows]);

  return (
    <DashboardLayout pageTitle={APP_FULL_NAME} breadcrumbs={["Utilities","MDM Email Tracker"]}>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              MDM Email Tracker
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Reads from Google Sheet (frontend-only). Changes are stored locally.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchSheet}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>

            <button
              onClick={clearLocal}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              title="Clear local edits"
            >
              Clear Local
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <SummaryCard label="Total" value={summary.total} />
          <SummaryCard label="NEW" value={summary.NEW} />
          <SummaryCard label="IN PROGRESS" value={summary["IN PROGRESS"]} />
          <SummaryCard label="COMPLETE" value={summary.COMPLETE} />
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search subject / sender / PIC / remark..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={picFilter}
              onChange={(e) => setPicFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {allPICs.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <tr>
                <Th>ID</Th>
                <Th>Email Title</Th>
                <Th>Sender</Th>
                <Th>Date Receive</Th>
                <Th>Time Receive</Th>
                <Th>Due Date</Th>
                <Th>PIC</Th>
                <Th>Status</Th>
                <Th>Remark</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRows.length === 0 ? (
                <tr>
                  <td className="p-6 text-center text-slate-500" colSpan={10}>
                    No records found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const id = r._id;
                  const status = (safeStr(r["Status"]).toUpperCase() || "NEW");

                  return (
                    <tr key={id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <Td>{safeStr(r["ID"]) || "-"}</Td>
                      <Td className="font-medium">{safeStr(r["Email Title"])}</Td>
                      <Td>{safeStr(r["Sender"])}</Td>
                      <Td>{safeStr(r["Date Receive"])}</Td>
                      <Td>{safeStr(r["Time Receive"])}</Td>
                      <Td>{safeStr(r["Due Date"])}</Td>
                      <Td>{safeStr(r["PIC"]) || "-"}</Td>
                      <Td>
                        <StatusPill status={status} />
                      </Td>
                      <Td className="max-w-[260px] truncate" title={safeStr(r["REMARK"])}>
                        {safeStr(r["REMARK"]) || "-"}
                      </Td>

                      <Td className="text-right">
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => assignToMe(id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                          >
                            <UserPlus2 className="h-4 w-4" />
                            Assign
                          </button>

                          <button
                            onClick={() => markDone(id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Done
                          </button>

                          <button
                            onClick={() => openRemarkEditor(id, safeStr(r["REMARK"]))}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                          >
                            <Pencil className="h-4 w-4" />
                            Remark
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Simple remark editor */}
        {editRowId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Edit Remark
                </h3>
                <button
                  onClick={cancelRemark}
                  className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <textarea
                value={editRemark}
                onChange={(e) => setEditRemark(e.target.value)}
                rows={5}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="Type remark..."
              />

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={cancelRemark}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={saveRemark}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Save className="h-4 w-4" />
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}

function Th({ children, className = "" }) {
  return <th className={`px-4 py-3 text-left font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 align-top text-slate-800 dark:text-slate-100 ${className}`}>{children}</td>;
}

function StatusPill({ status }) {
  const s = (status || "NEW").toUpperCase();
  const base =
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border";
  if (s === "COMPLETE") {
    return <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200`}>COMPLETE</span>;
  }
  if (s === "IN PROGRESS") {
    return <span className={`${base} border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-200`}>IN PROGRESS</span>;
  }
  return <span className={`${base} border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200`}>NEW</span>;
}

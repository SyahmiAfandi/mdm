import React, { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import PostalMime from "postal-mime";
import { useUser } from "../context/UserContext";  // if you already have this
import {
  RefreshCcw,
  UserPlus2,
  CheckCircle2,
  Pencil,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  UploadCloud,
  Loader2,
} from "lucide-react";

/**
 * EmailTracker (Frontend-first + optional write-back)
 * - Reads from Google Sheet using GViz
 * - Local edits stored in localStorage
 * - Optional: write updates back to Google Sheet via Apps Script endpoint
 */

// ====== CONFIG ======
const PAGE_SIZE = 5;

// Toggle showing ID column in UI
const SHOW_ID = false;

// ====== Helpers ======
function safeStr(v) {
  return (v ?? "").toString().trim();
}

// Google GViz returns: "google.visualization.Query.setResponse({...});"
function extractGvizJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Invalid GViz response");
  return JSON.parse(text.substring(start, end + 1));
}

function gvizToObjects(gviz) {
  const table = gviz?.table;
  const cols = (table?.cols || []).map((c) => safeStr(c.label));
  const rows = table?.rows || [];

  return rows.map((r) => {
    const obj = {};
    cols.forEach((colName, idx) => {
      const cell = r.c?.[idx];
      obj[colName] = cell?.f ?? cell?.v ?? "";
    });
    return obj;
  });
}



/**
 * Stable internal row id for local edits.
 * Prefer Sheet "ID" column (best).
 * If missing, fallback to title+date+time.
 */
function buildId(row) {
  const id = safeStr(row["ID"]);
  if (id) return id;

  const title = safeStr(row["Email Title"]);
  const date = safeStr(row["Date Receive"]);
  const time = safeStr(row["Time Receive"]);
  return `${title}__${date}__${time}`.toLowerCase();
}

/**
 * Parse date string into YYYYMMDD integer for sorting.
 * Supports:
 * - YYYY-MM-DD
 * - DD/MM/YYYY (basic)
 */
function dateKey(dateStr) {
  const d = safeStr(dateStr);
  if (!d) return 0;

  // YYYY-MM-DD
  const iso = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const yyyy = iso[1];
    const mm = iso[2];
    const dd = iso[3];
    return parseInt(`${yyyy}${mm}${dd}`, 10);
  }

  // DD/MM/YYYY
  const dmY = d.replace(/-/g, "/").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) {
    const dd = String(parseInt(dmY[1], 10)).padStart(2, "0");
    const mm = String(parseInt(dmY[2], 10)).padStart(2, "0");
    const yyyy = dmY[3];
    return parseInt(`${yyyy}${mm}${dd}`, 10);
  }

  // fallback try Date parse
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return 0;
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return parseInt(`${yyyy}${mm}${dd}`, 10);
}

/**
 * Parse time string into HHMMSS integer for sorting.
 * Supports:
 * - HH:MM
 * - HH:MM:SS
 */
function timeKey(timeStr) {
  const t = safeStr(timeStr);
  if (!t) return 0;
  const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return 0;
  const HH = String(parseInt(m[1], 10)).padStart(2, "0");
  const MM = String(parseInt(m[2], 10)).padStart(2, "0");
  const SS = String(parseInt(m[3] ?? "0", 10)).padStart(2, "0");
  return parseInt(`${HH}${MM}${SS}`, 10);
}

// ====== Main Component ======
export default function EmailTracker() {
  const [loading, setLoading] = useState(false);
  const [rawRows, setRawRows] = useState([]);
  const { user } = useUser();
  const CURRENT_USER = user?.name || user?.email || "";

  // filters
  const [q, setQ] = useState("");
  const [picFilter, setPicFilter] = useState("All");

  // Multi-select status
  const STATUS_OPTIONS = ["NEW", "IN PROGRESS", "COMPLETE"];
  const [statusFilters, setStatusFilters] = useState([]);
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef(null);

  // pagination
  const [page, setPage] = useState(1);

  // remark modal
  const [editRowId, setEditRowId] = useState(null);
  const [editRemark, setEditRemark] = useState("");

  // email upload modal
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const fileInputRef = useRef(null);
  const [emlItems, setEmlItems] = useState([]);
  const [emlBusy, setEmlBusy] = useState(false);

  // === ENV ===
  const GAS_APPEND_URL = import.meta.env.VITE_GAS_EMAIL_APPEND_URL; // for adding new tasks
  const GAS_UPDATE_URL = import.meta.env.VITE_GAS_EMAIL_UPDATE_URL; // for updating existing task (assign/done/remark)
  const GSHEET_GVIZ_URL = import.meta.env.VITE_GSHEET_EMAIL_TRACKER;

  // close status dropdown on outside click / ESC
  useEffect(() => {
    function onDocClick(e) {
      if (!statusRef.current) return;
      if (!statusRef.current.contains(e.target)) setStatusOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setStatusOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  async function fetchSheet() {
    setLoading(true);
    try {
      if (!GSHEET_GVIZ_URL) {
        toast.error("Missing VITE_GSHEET_EMAIL_TRACKER in .env");
        return;
      }

      const res = await fetch(GSHEET_GVIZ_URL);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const text = await res.text();
      const gviz = extractGvizJson(text);
      const objects = gvizToObjects(gviz);

      setRawRows(objects);
      toast.success(`Loaded ${objects.length} rows from Google Sheet`);
      setPage(1);
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


  /**
   * OPTIONAL: write updates to Google Sheet (Apps Script).
   * Requires your sheet rows can be uniquely found (BEST = "ID" column).
   */
  async function writeUpdateToSheet({ id, patch }) {
    if (!GAS_UPDATE_URL) return { ok: false, skipped: true };

    const payload = {
      action: "update_email_task",
      id: safeStr(id), // should match Sheet "ID"
      patch: {
        // only fields you want to update:
        PIC: patch.PIC ?? undefined,
        Status: patch.Status ?? undefined,
        REMARK: patch.REMARK ?? undefined,
      },
    };

    const res = await fetch(GAS_UPDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const txt = await res.text();
    let json;
    try {
      json = JSON.parse(txt);
    } catch {
      json = { ok: false, error: txt };
    }

    if (!res.ok || !json.ok) throw new Error(json.error || `Apps Script error (${res.status})`);
    return json;
  }

  async function writeAssignToSheet({ id, actor }) {
  if (!GAS_UPDATE_URL) return { ok: false, skipped: true };

  const payload = {
    action: "assign_email_task",
    id: safeStr(id),        // Sheet "ID"
    actor: safeStr(actor),  // CURRENT_USER
  };

  const res = await fetch(GAS_UPDATE_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  const txt = await res.text();
  let json;
  try { json = JSON.parse(txt); } catch { json = { ok: false, error: txt }; }

  // If Apps Script says already assigned, return json so we can show who
  if (!res.ok) throw new Error(json.error || `Apps Script error (${res.status})`);
  return json;
}

  //-----Loading animation----
  const [rowLoading, setRowLoading] = useState({}); 
  // rowLoading = { [rowId]: "assign" | "done" | "remark" | "" }

  function setRowBusy(rowId, mode) {
    setRowLoading((prev) => ({ ...prev, [rowId]: mode }));
  }
  function clearRowBusy(rowId) {
    setRowLoading((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  }

  async function assignToMe(row) {
  const rowId = row._id;
  const status = (safeStr(row["Status"]) || "NEW").toUpperCase();
  if (status !== "NEW") return;

  const realId = safeStr(row["ID"]);
  if (!realId) return toast.error("Missing Sheet ID. Cannot assign.");

  setRowBusy(rowId, "assign");
  try {
    const res = await fetch(GAS_UPDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "assign_email_task",
        id: realId,
        actor: CURRENT_USER,
      }),
    });

    const txt = await res.text();
    let json;
    try { json = JSON.parse(txt); } catch { json = { ok: false, error: txt }; }

    if (!res.ok) throw new Error(json.error || `Apps Script error (${res.status})`);

    // ✅ IMPORTANT: ALREADY_ASSIGNED should be a normal 200 response
    if (json.code === "ALREADY_ASSIGNED") {
      toast.error(`Already assigned by ${json.current?.pic || "someone"}`);
      await fetchSheet();
      return;
    }

    if (!json.ok) throw new Error(json.error || "Assign failed");

    toast.success("Assigned ✅");
    await fetchSheet();
  } catch (e) {
    console.error(e);
    toast.error(String(e.message || e));
    await fetchSheet();
  } finally {
    clearRowBusy(rowId);
  }
}

  async function markDone(row) {
  const rowId = row._id;
  const status = (safeStr(row["Status"]) || "NEW").toUpperCase();
  const pic = safeStr(row["PIC"]).toLowerCase();
  const me = safeStr(CURRENT_USER).toLowerCase();
  if (!(status === "IN PROGRESS" && pic === me)) return;

  const realId = safeStr(row["ID"]);
  if (!realId) return toast.error("Missing Sheet ID. Cannot mark done.");

  setRowBusy(rowId, "done");
  try {
    await writeUpdateToSheet({ id: realId, patch: { Status: "COMPLETE" } });
    toast.success("Marked COMPLETE ✅");
    await fetchSheet();
  } catch (e) {
    console.error(e);
    toast.error(`Done failed: ${String(e.message || e)}`);
    await fetchSheet();
  } finally {
    clearRowBusy(rowId);
  }
}

  function openRemarkEditor(id, currentRemark) {
    setEditRowId(id);
    setEditRemark(currentRemark || "");
  }

  async function saveRemark() {
  if (!editRowId) return;

  const row = mergedRows.find((x) => x._id === editRowId);
  const realId = safeStr(row?.["ID"]);
  if (!realId) return toast.error("Missing Sheet ID. Cannot save remark.");

  setRowBusy(editRowId, "remark");
  try {
    await writeUpdateToSheet({ id: realId, patch: { REMARK: safeStr(editRemark) } });
    toast.success("Remark saved ✅");
    await fetchSheet();
  } catch (e) {
    console.error(e);
    toast.error(`Remark save failed: ${String(e.message || e)}`);
    await fetchSheet();
  } finally {
    clearRowBusy(editRowId);
    setEditRowId(null);
    setEditRemark("");
  }
}

  function cancelRemark() {
    setEditRowId(null);
    setEditRemark("");
  }

  // Status multi-select
  function toggleStatus(s) {
    setStatusFilters((prev) => {
      const next = prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s];
      return next;
    });
    setPage(1);
  }
  function selectAllStatuses() {
    setStatusFilters([]);
    setPage(1);
  }

  // ===== Email modal =====
  function openEmailModal() {
    setEmailModalOpen(true);
  }
  function closeEmailModal() {
    setEmailModalOpen(false);
    setEmlItems([]);
    setEmlBusy(false);
  }
  function removeEmlItem(id) {
    setEmlItems((prev) => prev.filter((x) => x.id !== id));
  }
  function clearEmlItems() {
    setEmlItems([]);
  }

  async function parseEmlFile(file) {
    const raw = await file.arrayBuffer();
    const parser = new PostalMime();
    const eml = await parser.parse(raw);

    const subject = safeStr(eml.subject);

    // keep as "Name <email>" for sheet; your Apps Script can clean <> if needed
    const from =
      eml.from?.address
        ? `${safeStr(eml.from.name)} <${safeStr(eml.from.address)}>`
        : safeStr(eml.from?.name || "");

    const date = eml.date ? new Date(eml.date) : null;
    const messageId = safeStr(eml.messageId);
    return { subject, from, date, messageId };
  }

  async function addEmlFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) =>
      f.name.toLowerCase().endsWith(".eml")
    );

    if (files.length === 0) {
      toast.error("Please select .eml files only");
      return;
    }

    setEmlBusy(true);
    try {
      for (const file of files) {
        const id = `${file.name}-${file.size}-${file.lastModified}`;

        setEmlItems((prev) => {
          if (prev.some((p) => p.id === id)) return prev;
          return [
            ...prev,
            {
              id,
              file,
              name: file.name,
              size: file.size,
              subject: "",
              from: "",
              date: null,
              messageId: "",
              ok: false,
              error: "",
            },
          ];
        });

        try {
          const meta = await parseEmlFile(file);
          setEmlItems((prev) =>
            prev.map((x) => (x.id === id ? { ...x, ...meta, ok: true, error: "" } : x))
          );
        } catch (err) {
          setEmlItems((prev) =>
            prev.map((x) =>
              x.id === id ? { ...x, ok: false, error: "Failed to parse .eml" } : x
            )
          );
        }
      }
      toast.success(`Added ${files.length} file(s)`);
    } finally {
      setEmlBusy(false);
    }
  }

  function onPickFiles(e) {
    const files = e.target.files;
    if (!files?.length) return;
    addEmlFiles(files);
    e.target.value = "";
  }

  function onDropFiles(e) {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    addEmlFiles(files);
  }

  function onDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // ✅ bulk append new tasks
  async function confirmWriteToSheet() {
    if (!GAS_APPEND_URL) {
      toast.error("Missing VITE_GAS_EMAIL_APPEND_URL in .env");
      return;
    }

    const ready = emlItems.filter((x) => x.ok);
    if (ready.length === 0) {
      toast.error("No valid parsed emails to submit");
      return;
    }

    setEmlBusy(true);
    try {
      const payload = {
        action: "append_email_tasks",
        rows: ready.map((item) => ({
          subject: safeStr(item.subject) || safeStr(item.name) || "(no subject)",
          from: safeStr(item.from) || "",
          dateIso: item.date ? new Date(item.date).toISOString() : "",
        })),
      };

      const res = await fetch(GAS_APPEND_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });

      const txt = await res.text();
      let json;
      try {
        json = JSON.parse(txt);
      } catch {
        json = { ok: false, error: txt };
      }

      if (!res.ok || !json.ok) throw new Error(json.error || `Apps Script error (${res.status})`);

      toast.success(`Submitted ${json.appended || ready.length} email task(s) ✅`);
      await fetchSheet();
      closeEmailModal();
    } catch (err) {
      console.error(err);
      toast.error(String(err.message || err));
    } finally {
      setEmlBusy(false);
    }
  }



  // ===== Data merge =====
const mergedRows = useMemo(() => {
  return rawRows.map((r) => {
    const id = buildId(r);
    return { _id: id, ...r };
  });
}, [rawRows]);

  const allPICs = useMemo(() => {
    const set = new Set();
    mergedRows.forEach((r) => {
      const pic = safeStr(r["PIC"]);
      if (pic) set.add(pic);
    });
    return ["All", ...Array.from(set).sort()];
  }, [mergedRows]);

  const filteredRows = useMemo(() => {
    const query = q.trim().toLowerCase();

    return mergedRows.filter((r) => {
      const status = safeStr(r["Status"]).toUpperCase() || "NEW";
      const pic = safeStr(r["PIC"]);

      if (statusFilters.length > 0 && !statusFilters.includes(status)) return false;
      if (picFilter !== "All" && pic !== picFilter) return false;

      if (!query) return true;

      const hay = [
        r["ID"],
        r["Email Title"],
        r["Sender"],
        r["Date Receive"],
        r["Time Receive"],
        r["Due Date"], // kept searchable even if hidden in table
        r["PIC"],
        r["Status"],
        r["REMARK"],
      ]
        .map(safeStr)
        .join(" ")
        .toLowerCase();

      return hay.includes(query);
    });
  }, [mergedRows, q, statusFilters, picFilter]);

  // ✅ Sort: Date Receive DESC, then Time Receive DESC
  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      const aD = dateKey(a["Date Receive"]);
      const bD = dateKey(b["Date Receive"]);
      if (bD !== aD) return bD - aD;

      const aT = timeKey(a["Time Receive"]);
      const bT = timeKey(b["Time Receive"]);
      return bT - aT;
    });
    return copy;
  }, [filteredRows]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE)),
    [sortedRows.length]
  );

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [sortedRows, page]);

  function gotoPage(p) {
    setPage(Math.min(Math.max(1, p), totalPages));
  }

  const pageButtons = useMemo(() => {
    const maxBtns = 7;
    const half = Math.floor(maxBtns / 2);

    let start = Math.max(1, page - half);
    let end = Math.min(totalPages, start + maxBtns - 1);
    start = Math.max(1, end - maxBtns + 1);

    const arr = [];
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, [page, totalPages]);

  const summary = useMemo(() => {
    const total = mergedRows.length;
    const counts = { NEW: 0, "IN PROGRESS": 0, COMPLETE: 0 };
    mergedRows.forEach((r) => {
      const s = safeStr(r["Status"]).toUpperCase() || "NEW";
      if (counts[s] !== undefined) counts[s] += 1;
    });
    return { total, ...counts };
  }, [mergedRows]);

  const statusLabel = useMemo(() => {
    if (statusFilters.length === 0) return "All Status";
    if (statusFilters.length === 1) return statusFilters[0];
    return `${statusFilters.length} selected`;
  }, [statusFilters]);

  const validCount = useMemo(() => emlItems.filter((x) => x.ok).length, [emlItems]);
  const totalCount = emlItems.length;

  

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            MDM Email Tracker
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Reads from Google Sheet. Local edits stored in browser. Optional write-back enabled if GAS update URL is set.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={openEmailModal}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            title="Add new email tasks by uploading .eml files"
          >
            <Plus className="h-4 w-4" />
            Email Task
          </button>

          <button
            onClick={fetchSheet}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
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
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search subject / sender / PIC / remark..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="flex gap-2 items-center">
          {/* Status dropdown multi-select */}
          <div className="relative" ref={statusRef}>
            <button
              onClick={() => setStatusOpen((v) => !v)}
              className="inline-flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 min-w-[150px]"
            >
              <span className="truncate">{statusLabel}</span>
              <ChevronDown className={`h-4 w-4 transition ${statusOpen ? "rotate-180" : ""}`} />
            </button>

            {statusOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900 z-30">
                <button
                  onClick={selectAllStatuses}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                  title="Show all statuses"
                >
                  <span className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      readOnly
                      checked={statusFilters.length === 0}
                      className="h-4 w-4"
                    />
                    All
                  </span>
                </button>

                <div className="my-2 h-px bg-slate-100 dark:bg-slate-800" />

                {STATUS_OPTIONS.map((s) => (
                  <label
                    key={s}
                    className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={statusFilters.includes(s)}
                      onChange={() => toggleStatus(s)}
                    />
                    <span>{s}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* PIC filter */}
          <select
            value={picFilter}
            onChange={(e) => {
              setPicFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {allPICs.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="min-w-[1050px] w-full text-sm">
          <thead className="bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <tr>
              {SHOW_ID && <Th>ID</Th>}
              <Th>Email</Th>
              <Th>Date Receive</Th>
              <Th>Time Receive</Th>
              <Th>PIC</Th>
              <Th>Status</Th>
              <Th>Remark</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {pagedRows.length === 0 ? (
              <tr>
                <td className="p-6 text-center text-slate-500" colSpan={SHOW_ID ? 8 : 7}>
                  No records found.
                </td>
              </tr>
            ) : (
              pagedRows.map((r) => {
                const status = safeStr(r["Status"]).toUpperCase() || "NEW";
                const title = safeStr(r["Email Title"]);
                const sender = safeStr(r["Sender"]);
                const pic = safeStr(r["PIC"]);
                const busy = rowLoading[r._id]; // "assign" | "done" | "remark" | undefined
                const assignBusy = busy === "assign";
                const doneBusy = busy === "done";
                const remarkBusy = busy === "remark";

                // ✅ Button rules
                const isComplete = status === "COMPLETE";
                const canAssign = status === "NEW" && !isComplete;
                const canDone = status === "IN PROGRESS" && safeStr(pic).toLowerCase() === safeStr(CURRENT_USER).toLowerCase();

                return (
                  <tr key={r._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    {SHOW_ID && <Td>{safeStr(r["ID"]) || "-"}</Td>}

                    {/* Email Title + Sender inside one cell */}
                    <Td className="min-w-[360px]">
                      <div className="flex flex-col gap-1">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                          {title || "-"}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                            From
                          </span>
                          <span className="truncate">{sender || "-"}</span>
                        </div>

                        {!safeStr(r["ID"]) && (
                          <div className="text-[11px] text-amber-600 dark:text-amber-400">
                            Tip: Add an “ID” column in Sheet to enable write-back updates.
                          </div>
                        )}
                      </div>
                    </Td>

                    <Td>{safeStr(r["Date Receive"])}</Td>
                    <Td>{safeStr(r["Time Receive"])}</Td>
                    <Td>{pic || "-"}</Td>

                    <Td>
                      <StatusPill status={status} />
                    </Td>

                    <Td className="max-w-[260px] truncate" title={safeStr(r["REMARK"])}>
                      {safeStr(r["REMARK"]) || "-"}
                    </Td>

                    <Td className="text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => assignToMe(r)}
                          disabled={!canAssign || assignBusy || doneBusy || remarkBusy}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                        >
                          {assignBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus2 className="h-4 w-4" />}
                          {assignBusy ? "Assigning..." : "Assign"}
                        </button>

                        <button
                          onClick={() => markDone(r)}
                          disabled={!canDone || assignBusy || doneBusy || remarkBusy}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                        >
                          {doneBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          {doneBusy ? "Saving..." : "Done"}
                        </button>

                        <button
                          onClick={() => openRemarkEditor(r._id, safeStr(r["REMARK"]))}
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

      {/* Pagination */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Showing{" "}
          <span className="font-medium text-slate-800 dark:text-slate-100">
            {sortedRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
          </span>{" "}
          -{" "}
          <span className="font-medium text-slate-800 dark:text-slate-100">
            {Math.min(page * PAGE_SIZE, sortedRows.length)}
          </span>{" "}
          of{" "}
          <span className="font-medium text-slate-800 dark:text-slate-100">
            {sortedRows.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => gotoPage(page - 1)}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>

          <div className="flex items-center gap-1">
            {pageButtons[0] > 1 && (
              <>
                <PageBtn page={1} active={page === 1} onClick={() => gotoPage(1)} />
                {pageButtons[0] > 2 && <span className="px-1 text-slate-400">…</span>}
              </>
            )}

            {pageButtons.map((p) => (
              <PageBtn key={p} page={p} active={p === page} onClick={() => gotoPage(p)} />
            ))}

            {pageButtons[pageButtons.length - 1] < totalPages && (
              <>
                {pageButtons[pageButtons.length - 1] < totalPages - 1 && (
                  <span className="px-1 text-slate-400">…</span>
                )}
                <PageBtn
                  page={totalPages}
                  active={page === totalPages}
                  onClick={() => gotoPage(totalPages)}
                />
              </>
            )}
          </div>

          <button
            onClick={() => gotoPage(page + 1)}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Remark editor */}
      {editRowId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Edit Remark</h3>
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

      {/* Email Task Upload Modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Add Email Task(s)
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Drop multiple <span className="font-medium">.eml</span> files, preview, then confirm to write into Google Sheet.
                </p>
              </div>

              <button
                onClick={closeEmailModal}
                className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                disabled={emlBusy}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drop zone */}
            <div
              onDrop={onDropFiles}
              onDragOver={onDragOver}
              className="mt-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-950"
            >
              <div className="mx-auto flex max-w-xl flex-col items-center gap-2">
                <UploadCloud className="h-7 w-7 text-slate-500" />
                <div className="text-sm text-slate-700 dark:text-slate-200">
                  Drag & drop .eml files here
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Or choose from your folder (multiple supported)
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={emlBusy}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Plus className="h-4 w-4" />
                    Choose Files
                  </button>

                  <button
                    onClick={clearEmlItems}
                    disabled={emlBusy || emlItems.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".eml,message/rfc822"
                  multiple
                  className="hidden"
                  onChange={onPickFiles}
                />
              </div>
            </div>

            {/* Preview list */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Preview ({validCount}/{totalCount} parsed)
                </div>
                {emlBusy && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">Processing...</div>
                )}
              </div>

              <div className="mt-2 max-h-[260px] overflow-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                {emlItems.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500 dark:text-slate-400">No files added yet.</div>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {emlItems.map((it) => {
                      const dateTxt = it.date ? new Date(it.date).toLocaleString() : "-";
                      return (
                        <li key={it.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
                                  {it.name}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {(it.size / 1024).toFixed(1)} KB
                                </span>
                                {!it.ok ? (
                                  <span className="text-xs font-semibold text-rose-600">
                                    {it.error || "Parse failed"}
                                  </span>
                                ) : (
                                  <span className="text-xs font-semibold text-emerald-600">Parsed</span>
                                )}
                              </div>

                              <div className="mt-1 grid grid-cols-1 gap-1 text-xs text-slate-600 dark:text-slate-300">
                                <div className="truncate">
                                  <span className="font-semibold">Subject:</span> {safeStr(it.subject) || "-"}
                                </div>
                                <div className="truncate">
                                  <span className="font-semibold">From:</span> {safeStr(it.from) || "-"}
                                </div>
                                <div className="truncate">
                                  <span className="font-semibold">Date:</span> {dateTxt}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => removeEmlItem(it.id)}
                              disabled={emlBusy}
                              className="rounded-xl border border-slate-200 bg-white p-2 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                              title="Remove"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Confirm will append NEW tasks into your Google Sheet.
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={closeEmailModal}
                    disabled={emlBusy}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={confirmWriteToSheet}
                    disabled={emlBusy || validCount === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    Confirm & Write
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ====== UI bits ======
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
  return (
    <td className={`px-4 py-3 align-top text-slate-800 dark:text-slate-100 ${className}`}>
      {children}
    </td>
  );
}

function PageBtn({ page = 1, active = false, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        "h-9 min-w-9 rounded-xl border px-3 text-sm font-medium",
        active
          ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-200"
          : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
      ].join(" ")}
    >
      {page}
    </button>
  );
}

function StatusPill({ status }) {
  const s = (status || "NEW").toUpperCase();
  const base = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border";
  if (s === "COMPLETE") {
    return (
      <span
        className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200`}
      >
        COMPLETE
      </span>
    );
  }
  if (s === "IN PROGRESS") {
    return (
      <span
        className={`${base} border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-200`}
      >
        IN PROGRESS
      </span>
    );
  }
  return (
    <span
      className={`${base} border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200`}
    >
      NEW
    </span>
  );
}
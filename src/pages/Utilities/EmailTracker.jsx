// src/pages/email/EmailTracker.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import PostalMime from "postal-mime";
import { useUser } from "../../context/UserContext";
import { usePermissions } from "../../hooks/usePermissions";
import { useNavigate } from "react-router-dom";

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
  Database,
} from "lucide-react";

/* Firestore */
import { db, auth } from "../../firebaseClient";
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  runTransaction,
  Timestamp,
} from "firebase/firestore";

/**
 * EmailTracker (Firestore)
 * - Reads from Firestore collection: email_tasks
 * - Upload .eml -> creates NEW tasks (bulk)
 * - Assign -> sets pic_assign + status IN_PROGRESS
 * - Done -> sets status COMPLETE (only for assigned user)
 * - Remark -> update remark
 *
 * Data structure (supported):
 * email_tasks/{autoDocId} = {
 *   taskNo: 37,
 *   title: "...",
 *   senderEmail: "...",
 *   receivedAt: Timestamp,
 *   pic_assign: { uid, name } | string | null,
 *   status: "NEW" | "IN_PROGRESS" | "COMPLETE",
 *   remark: "...",
 *   pic_create: { uid, name } | string,
 *   createdAt: serverTimestamp(),
 *   pic_update: { uid, name } | string,
 *   updatedAt: serverTimestamp(),
 * }
 */

// ====== CONFIG ======
const PAGE_SIZE = 5;

// Toggle showing Firestore doc id (debug)
const SHOW_DOC_ID = false;

// ====== Helpers ======
function safeStr(v) {
  return (v ?? "").toString().trim();
}

function isFsTimestamp(v) {
  return v && typeof v === "object" && typeof v.toDate === "function";
}

function toJsDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (isFsTimestamp(v)) return v.toDate();
  return null;
}

function formatDate(d) {
  const dt = toJsDate(d);
  if (!dt) return "-";
  // DD/MM/YYYY
  return dt.toLocaleDateString("en-GB");
}

function formatTime(d) {
  const dt = toJsDate(d);
  if (!dt) return "-";
  return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(d) {
  const dt = toJsDate(d);
  if (!dt) return "-";
  // DD/MM/YYYY, HH:MM
  return dt.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPicName(picField) {
  // supports string OR object {name}
  if (!picField) return "";
  if (typeof picField === "string") return safeStr(picField);
  if (typeof picField === "object") return safeStr(picField.name);
  return "";
}

function getPicUid(picField) {
  if (!picField) return "";
  if (typeof picField === "object") return safeStr(picField.uid);
  return "";
}

function statusLabel(s) {
  const v = safeStr(s).toUpperCase();
  if (v === "IN_PROGRESS") return "IN PROGRESS";
  return v || "NEW";
}

function normalizeStatus(s) {
  const v = safeStr(s).toUpperCase().replace(/\s+/g, "_");
  if (v === "INPROGRESS") return "IN_PROGRESS";
  if (v === "IN_PROGRESS") return "IN_PROGRESS";
  if (v === "COMPLETE") return "COMPLETE";
  return "NEW";
}

// Tag NEW if created within last 24 hours
function isNewWithin24h(row) {
  const created = toJsDate(row?.createdAt);
  if (!created) return false;
  const diffMs = Date.now() - created.getTime();
  return diffMs >= 0 && diffMs < 24 * 60 * 60 * 1000;
}

// ====== Main Component ======
export default function EmailTracker() {
  const { user } = useUser();
  const CURRENT_USER = safeStr(user?.name || user?.email || "");
  const CURRENT_UID = safeStr(user?.uid || "");

  //delete button hide
  const { can } = usePermissions();
  const canDelete = can("mdmEmailTracker.delete");
  //console.log("canDelete:", canDelete);

  const [loading, setLoading] = useState(false);
  const [rawRows, setRawRows] = useState([]); // firestore docs mapped

  // filters
  const [q, setQ] = useState("");
  const [picFilter, setPicFilter] = useState("All");

  //filter new status
  const [newOnly, setNewOnly] = useState(false);

  // Multi-select status
  const STATUS_OPTIONS = ["NEW", "IN_PROGRESS", "COMPLETE"];
  const [statusFilters, setStatusFilters] = useState([]);
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);

  //sorting
  const [sortBy, setSortBy] = useState("receivedAt"); // "receivedAt" | "createdAt"
  const [sortDir, setSortDir] = useState("desc");     // "desc" | "asc"

  function getTimeValue(row, key) {
    const d = toJsDate(row?.[key]);
    return d ? d.getTime() : 0;
  }

  // pagination
  const [page, setPage] = useState(1);

  // remark modal
  const [editRowId, setEditRowId] = useState(null);
  const [editRemark, setEditRemark] = useState("");

  // detail modal
  const [detailRow, setDetailRow] = useState(null);
  function openDetail(row) {
    setDetailRow(row);
  }
  function closeDetail() {
    setDetailRow(null);
  }
  //delete modal
  const [deleteRow, setDeleteRow] = useState(null);

  function requestDelete(row) {
    setDeleteRow(row);
  }
  function cancelDelete() {
    setDeleteRow(null);
  }

  //navigate to bulk upload
  const navigate = useNavigate();
  const canBulkImport = can("mdmEmailTracker.bulkImport") || user?.role === "admin";

  // email upload modal
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const fileInputRef = useRef(null);
  const [emlItems, setEmlItems] = useState([]);
  const [emlBusy, setEmlBusy] = useState(false);

  // per-row busy modes
  const [rowLoading, setRowLoading] = useState({});
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

  // close status dropdown on outside click / ESC
  useEffect(() => {
    function onDocClick(e) {
      if (statusRef.current && !statusRef.current.contains(e.target)) setStatusOpen(false);
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") {
        setStatusOpen(false);
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // ===== Firestore: Counter (running taskNo) =====
  async function getNextTaskNo() {
    const counterRef = doc(db, "counters", "email_tasks");

    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);

      // If not exists, start at 1
      if (!snap.exists()) {
        tx.set(counterRef, { next: 2 });
        return 1;
      }

      const current = Number(snap.data()?.next || 1);
      tx.update(counterRef, { next: current + 1 });
      return current;
    });
  }

  // ===== Firestore: Fetch =====
  async function fetchTasks() {
    setLoading(true);
    try {
      const qy = query(collection(db, "email_tasks"), orderBy("createdAt", "desc"));
      const snap = await getDocs(qy);

      const rows = snap.docs.map((d) => {
        const data = d.data() || {};
        return {
          _id: d.id, // Firestore doc id
          ...data,
          status: normalizeStatus(data.status),
        };
      });

      setRawRows(rows);
      setPage(1);
      //toast.success(`Loaded ${rows.length} tasks`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load Firestore data (check rules / indexes).");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Actions: Assign / Done / Remark =====
  async function assignToMe(row) {
    const rowId = row._id;

    setRowBusy(rowId, "assign");

    try {
      await runTransaction(db, async (transaction) => {
        const taskRef = doc(db, "email_tasks", rowId);
        const snap = await transaction.get(taskRef);

        if (!snap.exists()) {
          throw new Error("Task no longer exists.");
        }

        const data = snap.data();
        const currentStatus = normalizeStatus(data.status);
        const currentPic = data.pic_assign;

        // 🚨 If already assigned or not NEW → block
        if (currentStatus !== "NEW" || currentPic) {
          throw new Error(
            `This email is already assigned to ${getPicName(currentPic) || "another user"}`
          );
        }

        // ✅ Safe to assign
        transaction.update(taskRef, {
          pic_assign: CURRENT_UID
            ? { uid: CURRENT_UID, name: CURRENT_USER }
            : CURRENT_USER,
          status: "IN_PROGRESS",
          pic_update: CURRENT_UID
            ? { uid: CURRENT_UID, name: CURRENT_USER }
            : CURRENT_USER,
          updatedAt: serverTimestamp(),
        });
      });

      toast.success("Assigned successfully ✅");
      await fetchTasks();
    } catch (e) {
      console.error(e);
      toast.error(String(e?.message || e));
      await fetchTasks();
    } finally {
      clearRowBusy(rowId);
    }
  }

  async function markDone(row) {
    const rowId = row._id;
    const status = normalizeStatus(row.status);

    const assignedUid = getPicUid(row.pic_assign);
    const assignedName = getPicName(row.pic_assign);

    const meName = safeStr(CURRENT_USER).toLowerCase();
    const okByUid = CURRENT_UID && assignedUid && CURRENT_UID === assignedUid;
    const okByName = !assignedUid && assignedName && assignedName.toLowerCase() === meName;

    if (!(status === "IN_PROGRESS" && (okByUid || okByName))) return;

    setRowBusy(rowId, "done");
    try {
      await updateDoc(doc(db, "email_tasks", rowId), {
        status: "COMPLETE",
        pic_update: CURRENT_UID ? { uid: CURRENT_UID, name: CURRENT_USER } : CURRENT_USER,
        updatedAt: serverTimestamp(),
      });

      toast.success("Marked COMPLETE ✅");
      await fetchTasks();
    } catch (e) {
      console.error(e);
      toast.error(String(e?.message || e));
      await fetchTasks();
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

    setRowBusy(editRowId, "remark");
    try {
      await updateDoc(doc(db, "email_tasks", editRowId), {
        remark: safeStr(editRemark),
        pic_remark: CURRENT_UID ? { uid: CURRENT_UID, name: CURRENT_USER } : CURRENT_USER,
        remarkAt: serverTimestamp(),
      });

      toast.success("Remark saved ✅");
      await fetchTasks();
    } catch (e) {
      console.error(e);
      toast.error(String(e?.message || e));
      await fetchTasks();
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

  // ===== Status multi-select =====
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
    const fromEmail = eml.from?.address ? safeStr(eml.from.address) : safeStr(eml.from?.name || "");
    const date = eml.date ? new Date(eml.date) : null;
    const messageId = safeStr(eml.messageId);

    return { subject, fromEmail, date, messageId };
  }

  async function addEmlFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) => f.name.toLowerCase().endsWith(".eml"));

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
              fromEmail: "",
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
            prev.map((x) => (x.id === id ? { ...x, ok: false, error: "Failed to parse .eml" } : x))
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

  // ===== Bulk create tasks in Firestore =====
  async function confirmWriteToFirestore() {
    const ready = emlItems.filter((x) => x.ok);
    if (ready.length === 0) {
      toast.error("No valid parsed emails to submit");
      return;
    }

    setEmlBusy(true);
    try {
      for (const item of ready) {
        const taskNo = await getNextTaskNo();

        const receivedDate =
          item.date instanceof Date && !Number.isNaN(item.date.getTime()) ? item.date : new Date();

        await addDoc(collection(db, "email_tasks"), {
          taskNo,
          title: safeStr(item.subject) || safeStr(item.name) || "(no subject)",
          senderEmail: safeStr(item.fromEmail) || "",

          receivedAt: Timestamp.fromDate(receivedDate),

          pic_assign: null,
          status: "NEW",
          remark: "",

          pic_create: CURRENT_UID ? { uid: CURRENT_UID, name: CURRENT_USER } : CURRENT_USER,
          createdAt: Timestamp.now(),

          pic_update: CURRENT_UID ? { uid: CURRENT_UID, name: CURRENT_USER } : CURRENT_USER,
          updatedAt: Timestamp.now(),

          messageId: safeStr(item.messageId) || "",
        });
      }

      toast.success(`Submitted ${ready.length} email task(s) ✅`);
      await fetchTasks();
      closeEmailModal();
    } catch (err) {
      console.error(err);
      toast.error(String(err?.message || err));
    } finally {
      setEmlBusy(false);
    }
  }
  //confirm Delete function
  async function confirmDelete() {
    if (!deleteRow?._id) return;

    const rowId = deleteRow._id;
    setRowBusy(rowId, "delete");

    try {
      await deleteDoc(doc(db, "email_tasks", rowId));
      toast.success("Deleted ✅");
      setDeleteRow(null);
      await fetchTasks();
    } catch (e) {
      console.error(e);
      toast.error(String(e?.message || e));
    } finally {
      clearRowBusy(rowId);
    }
  }


  // ===== Derived data =====
  const mergedRows = useMemo(() => {
    return rawRows.map((r) => ({
      ...r,
      status: normalizeStatus(r.status),
    }));
  }, [rawRows]);

  const allPICs = useMemo(() => {
    const set = new Set();
    mergedRows.forEach((r) => {
      const pic = getPicName(r.pic_assign);
      if (pic) set.add(pic);
    });
    return ["All", ...Array.from(set).sort()];
  }, [mergedRows]);

  const filteredRows = useMemo(() => {
    const queryText = q.trim().toLowerCase();

    return mergedRows.filter((r) => {
      const status = normalizeStatus(r.status);
      const pic = getPicName(r.pic_assign);
      if (newOnly && !isNewWithin24h(r)) return false;
      if (statusFilters.length > 0 && !statusFilters.includes(status)) return false;
      if (picFilter !== "All" && pic !== picFilter) return false;

      if (!queryText) return true;

      const hay = [r.title, r.senderEmail, getPicName(r.pic_assign), statusLabel(status), r.remark]
        .map(safeStr)
        .join(" ")
        .toLowerCase();

      return hay.includes(queryText);
    });
  }, [mergedRows, q, statusFilters, picFilter,newOnly]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];

    copy.sort((a, b) => {
      const av = getTimeValue(a, sortBy);
      const bv = getTimeValue(b, sortBy);
      return sortDir === "asc" ? av - bv : bv - av;
    });

    return copy;
  }, [filteredRows, sortBy, sortDir]);

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
    const counts = { NEW: 0, IN_PROGRESS: 0, COMPLETE: 0 };
    mergedRows.forEach((r) => {
      const s = normalizeStatus(r.status);
      if (counts[s] !== undefined) counts[s] += 1;
    });
    return { total, ...counts };
  }, [mergedRows]);

  const statusLabelText = useMemo(() => {
    if (statusFilters.length === 0) return "All Status";
    if (statusFilters.length === 1) return statusLabel(statusFilters[0]);
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
            Firestore-powered email task tracker. Upload .eml to create tasks, assign PIC, update
            status, and manage remarks.
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
          {canBulkImport && (  
            <button
              onClick={() => navigate("/utilities/emailtracker/bulk-import")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              title="Bulk import email tasks (CSV)"
            >
              <Database className="h-4 w-4" />
              Bulk Import
            </button>
          )}

          <button
            onClick={fetchTasks}
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
        <SummaryCard label="IN PROGRESS" value={summary.IN_PROGRESS} />
        <SummaryCard label="COMPLETE" value={summary.COMPLETE} />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="flex flex-1 gap-2">
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search title / sender / PIC / remark..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 justify-end">
          {/* Sort (compact) */}
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sort</span>

            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-sm outline-none"
            >
              <option value="receivedAt">Received</option>
              <option value="createdAt">Created</option>
            </select>

            <button
              onClick={() => {
                setSortDir((d) => (d === "desc" ? "asc" : "desc"));
                setPage(1);
              }}
              className="ml-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              title={sortDir === "desc" ? "Newest first" : "Oldest first"}
            >
              {sortDir === "desc" ? "↓" : "↑"}
            </button>
          </div>

          {/* Filter popover */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Filter
              <ChevronDown className={`h-4 w-4 transition ${filterOpen ? "rotate-180" : ""}`} />
            </button>

            {filterOpen && (
              <div className="absolute right-0 mt-2 w-[340px] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900 z-40">
                {/* Status */}
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                  Status
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={selectAllStatuses}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold border ${
                      statusFilters.length === 0
                        ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-200"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    All
                  </button>

                  {STATUS_OPTIONS.map((s) => {
                    const active = statusFilters.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() => toggleStatus(s)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold border ${
                          active
                            ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-200"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {statusLabel(s)}
                      </button>
                    );
                  })}
                </div>

                <div className="my-3 h-px bg-slate-100 dark:bg-slate-800" />

                {/* PIC + Last 24h */}
                <div className="grid grid-cols-2 gap-2 items-center">
                  <div>
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">PIC</div>
                    <select
                      value={picFilter}
                      onChange={(e) => {
                        setPicFilter(e.target.value);
                        setPage(1);
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {allPICs.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                      Last 24h
                    </div>

                    <button
                      onClick={() => {
                        setNewOnly((v) => !v);
                        setPage(1);
                      }}
                      className="w-full inline-flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      <span>{newOnly ? "On" : "Off"}</span>
                      <span
                        className={[
                          "relative inline-flex h-5 w-9 items-center rounded-full transition",
                          newOnly ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "inline-block h-4 w-4 transform rounded-full bg-white transition",
                            newOnly ? "translate-x-4" : "translate-x-1",
                          ].join(" ")}
                        />
                      </span>
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setStatusFilters([]);
                      setPicFilter("All");
                      setNewOnly(false); // recommended default
                      setPage(1);
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setFilterOpen(false)}
                    className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <tr>
              {SHOW_DOC_ID && <Th>Doc ID</Th>}
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
                <td className="p-6 text-center text-slate-500" colSpan={SHOW_DOC_ID ? 8 : 7}>
                  No records found.
                </td>
              </tr>
            ) : (
              pagedRows.map((r) => {
                const status = normalizeStatus(r.status);
                const title = safeStr(r.title);
                const sender = safeStr(r.senderEmail);
                const pic = getPicName(r.pic_assign);
                const busy = rowLoading[r._id]; // "assign" | "done" | "remark" | undefined
                const assignBusy = busy === "assign";
                const doneBusy = busy === "done";
                const remarkBusy = busy === "remark";

                const isComplete = status === "COMPLETE";
                const canAssign = status === "NEW" && !isComplete;

                const assignedUid = getPicUid(r.pic_assign);
                const assignedName = getPicName(r.pic_assign);
                const meName = safeStr(CURRENT_USER).toLowerCase();
                const okByUid = CURRENT_UID && assignedUid && CURRENT_UID === assignedUid;
                const okByName = !assignedUid && assignedName && assignedName.toLowerCase() === meName;

                const canDone = status === "IN_PROGRESS" && (okByUid || okByName);

                const showNew = isNewWithin24h(r);

                return (
                  <tr key={r._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    {SHOW_DOC_ID && <Td className="text-xs text-slate-500">{r._id}</Td>}

                    {/* Email Title + Sender inside one cell */}
                    <Td className="min-w-[380px]">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-start gap-2">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                            {title || "-"}
                          </div>

                          {showNew && (
                            <span className="shrink-0 inline-flex items-center rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 px-2 py-0.5 text-[11px] font-extrabold text-white shadow-sm">
                              NEW
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="inline-flex rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                            From
                          </span>
                          <span className="truncate">{sender || "-"}</span>
                        </div>
                      </div>
                    </Td>

                    <Td className="whitespace-nowrap">{formatDate(r.receivedAt)}</Td>
                    <Td className="whitespace-nowrap">{formatTime(r.receivedAt)}</Td>
                    <Td className="whitespace-nowrap">{pic || "-"}</Td>

                    <Td>
                      <StatusPill status={status} />
                    </Td>

                    <Td className="max-w-[260px] truncate" title={safeStr(r.remark)}>
                      {safeStr(r.remark) || "-"}
                    </Td>

                    <Td className="text-right">
                      <div className="inline-flex items-center gap-1">
                        {/* Detail */}
                        <IconBtn
                          title="View details"
                          onClick={() => openDetail(r)}
                          disabled={assignBusy || doneBusy || remarkBusy}
                        >
                          <Plus className="h-4 w-4" />
                        </IconBtn>

                        {/* Assign */}
                        <IconBtn
                          title={assignBusy ? "Assigning..." : "Assign"}
                          onClick={() => assignToMe(r)}
                          disabled={!canAssign || assignBusy || doneBusy || remarkBusy}
                        >
                          {assignBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus2 className="h-4 w-4" />}
                        </IconBtn>

                        {/* Done */}
                        <IconBtn
                          title={doneBusy ? "Saving..." : "Mark complete"}
                          onClick={() => markDone(r)}
                          disabled={!canDone || assignBusy || doneBusy || remarkBusy}
                        >
                          {doneBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        </IconBtn>

                        {/* Remark */}
                        <IconBtn
                          title="Edit remark"
                          onClick={() => openRemarkEditor(r._id, safeStr(r.remark))}
                          disabled={assignBusy || doneBusy || remarkBusy}
                        >
                          <Pencil className="h-4 w-4" />
                        </IconBtn>

                        {/* Delete */}
                        {canDelete && (
                          <IconBtn
                            title={busy === "delete" ? "Deleting..." : "Delete"}
                            onClick={() => requestDelete(r)}
                            disabled={assignBusy || doneBusy || remarkBusy || busy === "delete"}
                            variant="danger"
                          >
                            {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </IconBtn>
                        )}
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

      {/* Detail Modal */}
      {detailRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Task Details
              </h3>
              <button
                onClick={closeDetail}
                className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  PIC Upload
                </div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {getPicName(detailRow.pic_create) || "-"}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {formatDateTime(detailRow.createdAt)}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  PIC Update
                </div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {getPicName(detailRow.pic_update) || "-"}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {formatDateTime(detailRow.updatedAt)}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  PIC Remark
                </div>
                <div className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                  {getPicName(detailRow.pic_remark) || "-"}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {formatDateTime(detailRow.remarkAt)}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Status
                </div>
                <div className="mt-2">
                  <StatusPill status={normalizeStatus(detailRow.status)} />
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={closeDetail}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remark editor */}
      {editRowId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Edit Remark</h3>
              <button
                onClick={cancelRemark}
                className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                disabled={rowLoading[editRowId] === "remark"}
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
                disabled={rowLoading[editRowId] === "remark"}
              >
                Cancel
              </button>
              <button
                onClick={saveRemark}
                disabled={rowLoading[editRowId] === "remark"}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {rowLoading[editRowId] === "remark" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Delete Task?
              </h3>
              <button
                onClick={cancelDelete}
                className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                disabled={rowLoading[deleteRow._id] === "delete"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              This will permanently delete:
              <div className="mt-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="text-xs text-slate-500 dark:text-slate-400">Title</div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {safeStr(deleteRow.title) || "-"}
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">From</div>
                <div className="text-slate-700 dark:text-slate-200">
                  {safeStr(deleteRow.senderEmail) || "-"}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={cancelDelete}
                disabled={rowLoading[deleteRow._id] === "delete"}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                onClick={confirmDelete}
                disabled={rowLoading[deleteRow._id] === "delete"}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {rowLoading[deleteRow._id] === "delete" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete
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
                  Drop multiple <span className="font-medium">.eml</span> files, preview, then confirm
                  to write into Firestore.
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
                  <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
                    No files added yet.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {emlItems.map((it) => {
                      const dateTxt = it.date ? new Date(it.date).toLocaleString("en-GB") : "-";
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
                                  <span className="font-semibold">Subject:</span>{" "}
                                  {safeStr(it.subject) || "-"}
                                </div>
                                <div className="truncate">
                                  <span className="font-semibold">From:</span>{" "}
                                  {safeStr(it.fromEmail) || "-"}
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
                  Confirm will append NEW tasks into Firestore collection{" "}
                  <span className="font-semibold">email_tasks</span>.
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
                    onClick={confirmWriteToFirestore}
                    disabled={emlBusy || validCount === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {emlBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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

function IconBtn({ title, onClick, disabled, children, variant = "default" }) {
  const base =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border text-slate-700 " +
    "hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed " +
    "dark:text-slate-200 dark:hover:bg-slate-800";

  const styles =
    variant === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-200 dark:hover:bg-rose-900/30"
      : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900";

  return (
    <button title={title} onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

function StatusPill({ status }) {
  const s = (status || "NEW").toUpperCase();
  const base = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border";

  if (s === "COMPLETE") {
    return (
      <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200`}>
        COMPLETE
      </span>
    );
  }

  if (s === "IN_PROGRESS") {
    return (
      <span className={`${base} border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-200`}>
        IN PROGRESS
      </span>
    );
  }

  return (
    <span className={`${base} border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200`}>
      NEW
    </span>
  );
}
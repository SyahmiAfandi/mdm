// src/pages/email/EmailTracker.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import PostalMime from "postal-mime";
import { motion, AnimatePresence } from "framer-motion";
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
  Layers,
  Clock,
  ShieldCheck,
  Search,
  Filter,
  ArrowUpRight,
  PlusCircle,
  Activity,
  History,
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
  setDoc,
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
const PAGE_SIZE = 4;

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

  //--------------ping stats
  async function pingEmailStats() {
    // one tiny doc to signal HomePage to refresh counts
    await setDoc(
      doc(db, "stats_ping", "email_tasks"),
      { updatedAt: serverTimestamp() },
      { merge: true }
    );
  }

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
      await Promise.all([fetchTasks(), pingEmailStats()]);
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
      await Promise.all([fetchTasks(), pingEmailStats()]);
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
      await Promise.all([fetchTasks(), pingEmailStats()]);
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
      await Promise.all([fetchTasks(), pingEmailStats()]);
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
      await Promise.all([fetchTasks(), pingEmailStats()]);
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
  }, [mergedRows, q, statusFilters, picFilter, newOnly]);

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
    <div className="px-4 pb-4 pt-2 md:pt-4 space-y-3 max-w-[1600px] mx-auto min-h-screen bg-slate-50 dark:bg-slate-950/20">

      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 p-4"
      >
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Database size={160} />
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                <Layers size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500/80">Utility Console</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Email <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">Tracker</span>
            </h1>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
              Smart email automation that manages your tasks and keeps your team in sync.
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={openEmailModal}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-700 transition-all"
            >
              <Plus className="h-4 w-4" />
              New Task
            </motion.button>

            {canBulkImport && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate("/utilities/emailtracker/bulk-import")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shadow-sm transition-all"
              >
                <Database className="h-4 w-4" />
                Bulk Import
              </motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={fetchTasks}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shadow-sm transition-all"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Sync
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Summary Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <SummaryCard label="Total Emails" value={summary.total} icon={Layers} color="slate" />
        <SummaryCard label="New Requests" value={summary.NEW} icon={PlusCircle} color="blue" />
        <SummaryCard label="Processing" value={summary.IN_PROGRESS} icon={Clock} color="indigo" />
        <SummaryCard label="Completed" value={summary.COMPLETE} icon={CheckCircle2} color="emerald" />
      </motion.div>

      {/* Filters & Actions Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        {/* Search Bar */}
        <div className="flex flex-1 max-w-md relative group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
            <Search size={14} />
          </div>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search by title, sender, PIC or remark..."
            className="w-full rounded-2xl border border-slate-200 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-800 dark:text-slate-100 transition-all font-medium"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 justify-end">
          {/* Enhanced Sort Trigger */}
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-3 py-2 text-sm dark:border-slate-800 shadow-sm transition-all focus-within:border-indigo-500">
            <History size={14} className="text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-xs font-bold outline-none text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <option value="receivedAt">Received At</option>
              <option value="createdAt">Created At</option>
            </select>

            <button
              onClick={() => {
                setSortDir((d) => (d === "desc" ? "asc" : "desc"));
                setPage(1);
              }}
              className="ml-1 rounded-lg bg-slate-100/50 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-black text-slate-700 dark:text-slate-300 hover:bg-indigo-500 hover:text-white transition-all uppercase"
              title={sortDir === "desc" ? "Newest first" : "Oldest first"}
            >
              {sortDir === "desc" ? "Desc" : "Asc"}
            </button>
          </div>

          {/* Advanced Filter Popover */}
          <div className="relative" ref={filterRef}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFilterOpen((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold shadow-sm transition-all ${filterOpen || statusFilters.length > 0 || picFilter !== "All" || newOnly
                ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400"
                : "border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/80 text-slate-700 dark:text-slate-200 hover:border-slate-400"
                }`}
            >
              <Filter className={`h-4 w-4 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
              Filters
              {(statusFilters.length > 0 || picFilter !== "All" || newOnly) && (
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse ml-1" />
              )}
            </motion.button>

            <AnimatePresence>
              {filterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-3 w-[360px] rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 z-[100] backdrop-blur-xl"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Active Filters</h4>
                    <button
                      onClick={() => {
                        setStatusFilters([]);
                        setPicFilter("All");
                        setNewOnly(false);
                        setPage(1);
                      }}
                      className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 transition-colors uppercase underline"
                    >
                      Clear All
                    </button>
                  </div>

                  {/* Status Options */}
                  <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">
                    Workflow Status
                  </div>
                  <div className="flex flex-wrap gap-2 mb-5">
                    <button
                      onClick={selectAllStatuses}
                      className={`rounded-xl px-4 py-2 text-xs font-bold border transition-all ${statusFilters.length === 0
                        ? "border-indigo-500 bg-indigo-500 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/50"
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
                          className={`rounded-xl px-4 py-2 text-xs font-bold border transition-all ${active
                            ? "border-indigo-500 bg-indigo-500 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/50"
                            }`}
                        >
                          {statusLabel(s)}
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">PIC</div>
                      <select
                        value={picFilter}
                        onChange={(e) => {
                          setPicFilter(e.target.value);
                          setPage(1);
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white dark:bg-slate-800/50 px-3 py-2 text-xs font-bold dark:border-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        {allPICs.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Fresh Influx</div>
                      <button
                        onClick={() => {
                          setNewOnly((v) => !v);
                          setPage(1);
                        }}
                        className={`w-full flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold transition-all ${newOnly
                          ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-500"
                          : "border-slate-200 bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 dark:border-slate-700"
                          }`}
                      >
                        <span>NEW (24h)</span>
                        <div className={`w-2 h-2 rounded-full ${newOnly ? "bg-indigo-500 animate-pulse" : "bg-slate-300 dark:bg-slate-600"}`} />
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => setFilterOpen(false)}
                    className="w-full mt-5 rounded-2xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-3 text-xs font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-slate-900/20"
                  >
                    Apply Criteria
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>


      {/* Main Table Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-lg"
      >
        <div className="overflow-x-auto">
          <table className="min-w-[1000px] w-full border-collapse">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
              <tr>
                {SHOW_DOC_ID && <Th>System ID</Th>}
                <Th className="pl-8">Email Title</Th>
                <Th>Received At</Th>
                <Th>PIC</Th>
                <Th>Status</Th>
                <Th>Remark</Th>
                <Th className="text-right pr-8">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {pagedRows.length === 0 ? (
                <tr>
                  <td className="p-16 text-center text-slate-400 dark:text-slate-600 font-medium" colSpan={SHOW_DOC_ID ? 8 : 7}>
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full opacity-50">
                        <Activity size={32} />
                      </div>
                      <p className="text-sm uppercase tracking-widest font-black">No intelligence records found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pagedRows.map((r, idx) => {
                  const status = normalizeStatus(r.status);
                  const title = safeStr(r.title);
                  const sender = safeStr(r.senderEmail);
                  const pic = getPicName(r.pic_assign);
                  const busy = rowLoading[r._id];
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
                    <motion.tr
                      key={r._id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="group border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-indigo-500/5 transition-colors text-[13px]"
                    >
                      {SHOW_DOC_ID && <Td className="text-[10px] font-mono text-slate-400">{r._id}</Td>}

                      <Td className="min-w-[420px] pl-8">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-start gap-2">
                            <span className="font-bold text-slate-900 dark:text-white leading-tight group-hover:text-indigo-500 transition-colors">
                              {title || "(No Intelligence Title)"}
                            </span>
                            {showNew && (
                              <span className="shrink-0 inline-flex items-center rounded-lg bg-indigo-500 px-1.5 py-0.5 text-[9px] font-black text-white shadow-lg shadow-indigo-500/20">
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                            <span className="text-xs font-medium text-slate-400 truncate max-w-[320px]" title={sender}>
                              {sender || "unknown_origin"}
                            </span>
                          </div>
                        </div>
                      </Td>

                      <Td className="whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700 dark:text-slate-300">{formatDate(r.receivedAt)}</span>
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">{formatTime(r.receivedAt)}</span>
                        </div>
                      </Td>

                      <Td className="whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${pic ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"}`} />
                          <span className={`font-bold ${pic ? "text-slate-800 dark:text-slate-200" : "text-slate-400"}`}>
                            {pic || "UNASSIGNED"}
                          </span>
                        </div>
                      </Td>

                      <Td>
                        <StatusPill status={status} />
                      </Td>

                      <Td className="max-w-[220px]" title={safeStr(r.remark)}>
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 line-clamp-2 italic">
                          {safeStr(r.remark) || "No operational notes recorded..."}
                        </div>
                      </Td>

                      <Td className="text-right pr-8">
                        <div className="inline-flex items-center gap-2">
                          <IconBtn
                            title="View Intelligence Detail"
                            onClick={() => openDetail(r)}
                            disabled={assignBusy || doneBusy || remarkBusy}
                          >
                            <PlusCircle size={14} />
                          </IconBtn>

                          <IconBtn
                            title={assignBusy ? "Assimilating..." : "Assign to Entity"}
                            onClick={() => assignToMe(r)}
                            disabled={!canAssign || assignBusy || doneBusy || remarkBusy}
                          >
                            {assignBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus2 size={14} />}
                          </IconBtn>

                          <IconBtn
                            title={doneBusy ? "Finalizing..." : "Terminate Mission (Complete)"}
                            onClick={() => markDone(r)}
                            disabled={!canDone || assignBusy || doneBusy || remarkBusy}
                          >
                            {doneBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 size={14} />}
                          </IconBtn>

                          <IconBtn
                            title="Append Notes"
                            onClick={() => openRemarkEditor(r._id, safeStr(r.remark))}
                            disabled={assignBusy || doneBusy || remarkBusy}
                          >
                            <Pencil size={14} />
                          </IconBtn>

                          {canDelete && (
                            <IconBtn
                              title={busy === "delete" ? "Purging..." : "Purge Record"}
                              onClick={() => requestDelete(r)}
                              disabled={assignBusy || doneBusy || remarkBusy || busy === "delete"}
                              variant="danger"
                            >
                              {busy === "delete" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 size={14} />}
                            </IconBtn>
                          )}
                        </div>
                      </Td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Console Pagination */}
        <div className="px-6 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-md">
          <div className="text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-[0.2em]">
            Scan Integrity: <span className="text-slate-900 dark:text-slate-200">{sortedRows.length} Emails Recorded</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => gotoPage(page - 1)}
                disabled={page <= 1}
                className="h-9 w-9 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm disabled:opacity-30 hover:border-indigo-500 transition-all text-slate-600 dark:text-slate-400"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex gap-2 mx-2">
                {pageButtons.map((p) => (
                  <PageBtn key={p} page={p} active={p === page} onClick={() => gotoPage(p)} />
                ))}
              </div>

              <button
                onClick={() => gotoPage(page + 1)}
                disabled={page >= totalPages}
                className="h-9 w-9 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm disabled:opacity-30 hover:border-indigo-500 transition-all text-slate-600 dark:text-slate-400"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Detail Modal */}
      <AnimatePresence>
        {detailRow && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDetail}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg rounded-[2rem] bg-white dark:bg-slate-900 p-8 shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                    <Activity size={20} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Intelligence Details</h3>
                </div>
                <button onClick={closeDetail} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <DetailItem label="Ingestion PIC" value={getPicName(detailRow.pic_create)} sub={formatDateTime(detailRow.createdAt)} />
                <DetailItem label="Last Orchestration" value={getPicName(detailRow.pic_update)} sub={formatDateTime(detailRow.updatedAt)} />
                <DetailItem label="Intelligence PIC" value={getPicName(detailRow.pic_remark)} sub={formatDateTime(detailRow.remarkAt)} />
                <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Operational Status</span>
                  <StatusPill status={normalizeStatus(detailRow.status)} />
                </div>
              </div>

              <div className="mt-8">
                <button
                  onClick={closeDetail}
                  className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-[0.2em] text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-slate-900/20"
                >
                  Close Console
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Remark editor */}
      <AnimatePresence>
        {editRowId && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative w-full max-w-xl rounded-[2.5rem] bg-white dark:bg-slate-900 p-8 shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                    <Pencil size={20} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Intelligence Log</h3>
                </div>
                <button onClick={cancelRemark} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <textarea
                value={editRemark}
                onChange={(e) => setEditRemark(e.target.value)}
                rows={6}
                className="w-full rounded-[2rem] border border-slate-200 bg-slate-50/50 dark:bg-slate-800/50 p-6 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-800 dark:text-white transition-all font-medium resize-none"
                placeholder="Synchronize operational remarks here..."
              />

              <div className="mt-8 flex gap-3">
                <button
                  onClick={cancelRemark}
                  className="flex-1 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all uppercase tracking-widest text-xs"
                  disabled={rowLoading[editRowId] === "remark"}
                >
                  Cancel
                </button>
                <button
                  onClick={saveRemark}
                  disabled={rowLoading[editRowId] === "remark"}
                  className="flex-[2] py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-xs hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50"
                >
                  {rowLoading[editRowId] === "remark" ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      <span>Syncing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Save size={16} />
                      <span>Log Notes</span>
                    </div>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {deleteRow && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-rose-950/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="relative w-full max-w-md rounded-[2rem] bg-white dark:bg-slate-900 p-8 shadow-2xl border border-rose-200 dark:border-rose-900/30"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mb-6">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Purge Intelligence Record?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium">
                  Warning: This operation will permanently erase this mission record from the intelligence collective.
                </p>

                <div className="w-full rounded-2xl bg-rose-50/50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/30 p-4 mb-8 text-left">
                  <span className="text-[10px] font-black uppercase text-rose-500 tracking-widest mb-1 block">Record Target</span>
                  <div className="font-bold text-slate-900 dark:text-white truncate">{safeStr(deleteRow.title)}</div>
                </div>

                <div className="w-full flex gap-3">
                  <button
                    onClick={cancelDelete}
                    className="flex-1 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-all uppercase tracking-widest text-xs"
                    disabled={rowLoading[deleteRow._id] === "delete"}
                  >
                    Abort
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={rowLoading[deleteRow._id] === "delete"}
                    className="flex-1 py-4 rounded-2xl bg-rose-600 text-white font-black uppercase tracking-widest text-xs hover:bg-rose-700 transition-all shadow-xl shadow-rose-900/20 disabled:opacity-50"
                  >
                    {rowLoading[deleteRow._id] === "delete" ? <Loader2 size={16} className="mx-auto animate-spin" /> : "Confirm Purge"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Email Task Upload Modal */}
      <AnimatePresence>
        {emailModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="relative w-full max-w-4xl my-auto rounded-[3rem] bg-white dark:bg-slate-900 p-8 shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-600/20">
                    <UploadCloud size={24} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Intelligence Ingestion</h3>
                    <p className="text-sm text-slate-500 font-medium tracking-tight">Process .eml files to synthesize new mission units.</p>
                  </div>
                </div>
                <button onClick={closeEmailModal} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors" disabled={emlBusy}>
                  <X size={24} />
                </button>
              </div>

              {/* Enhanced Drop Zone */}
              <div
                onDrop={onDropFiles}
                onDragOver={onDragOver}
                className="relative group rounded-[2.5rem] border-4 border-dashed border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 p-12 text-center transition-all hover:border-indigo-500/50 hover:bg-indigo-500/5"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-900 shadow-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-500 transition-colors">
                    <Plus size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-slate-800 dark:text-white">Transmit Documentation</p>
                    <p className="text-sm text-slate-500 font-medium">Batch synthesis of .eml files is supported.</p>
                  </div>

                  <div className="mt-4 flex gap-3">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => fileInputRef.current?.click()}
                      disabled={emlBusy}
                      className="px-6 py-3 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-500/20"
                    >
                      Browse Repository
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={clearEmlItems}
                      disabled={emlBusy || emlItems.length === 0}
                      className="px-6 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white font-black uppercase tracking-widest text-[10px]"
                    >
                      Clear Batch
                    </motion.button>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".eml,message/rfc822" multiple className="hidden" onChange={onPickFiles} />
                </div>
              </div>

              {/* Intelligence Preview */}
              {emlItems.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Analysis Preview ({validCount}/{totalCount} Validated)</h4>
                    {emlBusy && <Loader2 size={16} className="animate-spin text-indigo-500" />}
                  </div>
                  <div className="max-h-[300px] overflow-auto rounded-3xl border border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-inner">
                    <ul className="divide-y divide-slate-50 dark:divide-slate-800/50">
                      {emlItems.map((it) => (
                        <li key={it.id} className="p-5 hover:bg-slate-50 dark:hover:bg-indigo-500/5 transition-colors group">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <ShieldCheck size={16} className={it.ok ? "text-emerald-500" : "text-rose-500"} />
                                <span className="font-bold text-slate-900 dark:text-white truncate">{it.name}</span>
                                <span className="text-[10px] font-mono text-slate-400">{(it.size / 1024).toFixed(1)}KB</span>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">Intelligence Header</span>
                                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">{it.subject || "NO HEADER"}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[9px] font-black uppercase text-slate-400 block">Origin Point</span>
                                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">{it.fromEmail || "ANONYMOUS SOURCE"}</p>
                                </div>
                              </div>
                            </div>
                            <button onClick={() => removeEmlItem(it.id)} disabled={emlBusy} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center sm:text-left">
                  Ready to commit <span className="text-indigo-500">{validCount}</span> intelligence units to the cluster.
                </p>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button onClick={closeEmailModal} disabled={emlBusy} className="flex-1 sm:flex-none px-8 py-4 rounded-2xl font-bold text-slate-500 uppercase tracking-widest text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                    Cancel
                  </button>
                  <button
                    onClick={confirmWriteToFirestore}
                    disabled={emlBusy || validCount === 0}
                    className="flex-1 sm:flex-none px-8 py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-xs hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50"
                  >
                    {emlBusy ? <Loader2 size={16} className="mx-auto animate-spin" /> : "Initiate Commit"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, color = "blue" }) {
  const colors = {
    blue: "from-blue-500/10 to-transparent text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30",
    indigo: "from-indigo-500/10 to-transparent text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30",
    amber: "from-amber-500/10 to-transparent text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30",
    emerald: "from-emerald-500/10 to-transparent text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30",
    slate: "from-slate-500/10 to-transparent text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-900/30",
  };

  return (
    <motion.div
      whileHover={{ y: -1 }}
      className={`relative overflow-hidden rounded-xl border bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-3 transition-all ${colors[color] || colors.slate}`}
    >
      <div className={`absolute top-0 right-0 p-3 opacity-10`}>
        {Icon && <Icon size={64} />}
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded-lg bg-current/10`}>
          {Icon && <Icon size={16} />}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">
          {label}
        </span>
      </div>
      <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
        {value}
      </div>
    </motion.div>
  );
}

function DetailItem({ label, value, sub }) {
  return (
    <div className="p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      <div className="font-bold text-slate-900 dark:text-white">{value || "---"}</div>
      {sub && <div className="text-[10px] font-medium text-slate-500">{sub}</div>}
    </div>
  );
}


function Th({ children, className = "" }) {
  return (
    <th className={`px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return (
    <td className={`px-4 py-2.5 align-middle text-slate-800 dark:text-slate-200 ${className}`}>
      {children}
    </td>
  );
}

function PageBtn({ page = 1, active = false, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        "h-9 min-w-9 rounded-xl border px-3 text-sm font-bold transition-all",
        active
          ? "border-indigo-500 bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800",
      ].join(" ")}
    >
      {page}
    </button>
  );
}

function IconBtn({ title, onClick, disabled, children, variant = "default" }) {
  const base =
    "inline-flex h-8 w-8 items-center justify-center rounded-xl border transition-all " +
    "disabled:opacity-40 disabled:cursor-not-allowed";

  const styles =
    variant === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/40 shadow-sm"
      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 shadow-sm";

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.1 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles}`}
    >
      {children}
    </motion.button>
  );
}

function StatusPill({ status }) {
  const s = (status || "NEW").toUpperCase();
  const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide border shadow-sm";

  if (s === "COMPLETE") {
    return (
      <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/30 dark:text-emerald-400`}>
        <CheckCircle2 size={12} />
        COMPLETE
      </span>
    );
  }

  if (s === "IN_PROGRESS") {
    return (
      <span className={`${base} border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-900/30 dark:text-indigo-400`}>
        <Clock size={12} />
        IN PROGRESS
      </span>
    );
  }

  return (
    <span className={`${base} border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400`}>
      <Plus size={12} />
      NEW
    </span>
  );
}

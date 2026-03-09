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
const PAGE_SIZE = 10;

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
    <div className="h-[calc(100vh-112px)] flex flex-col gap-3 p-4 overflow-hidden">

      {/* ── HEADER + STATS ── */}
      <div className="shrink-0 w-full bg-white border border-slate-200 rounded-2xl shadow-sm px-4 py-3 flex items-center gap-3">

        {/* ── Title Card — flex-1 stretches to fill ── */}
        <div className="flex-1 flex items-center gap-3 bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 rounded-2xl px-5 py-4 shadow-lg shadow-indigo-200">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Layers size={18} className="text-white drop-shadow" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white leading-none tracking-tight drop-shadow-sm">Email Tracker</h1>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[8px] font-black uppercase tracking-widest text-indigo-200 bg-white/15 px-1.5 py-0.5 rounded-full leading-none">MDM</span>
              <span className="text-[8px] text-indigo-200 font-semibold leading-none">Utility</span>
            </div>
          </div>
        </div>

        {/* ── Stats — compact single row, equal width, match title height ── */}
        <div className="grid grid-cols-4 gap-2 shrink-0 self-stretch">
          <StatCard label="Total" value={summary.total} color="slate" icon="📋" />
          <StatCard label="New" value={summary.NEW} color="blue" icon="✨" />
          <StatCard label="In Progress" value={summary.IN_PROGRESS} color="amber" icon="⚡" />
          <StatCard label="Completed" value={summary.COMPLETE} color="emerald" icon="✅" />
        </div>

        {/* ── Actions ── */}
        <div className="flex flex-col items-stretch gap-2 shrink-0">
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.02 }}
            onClick={openEmailModal}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            New Task
          </motion.button>

          <div className="flex items-center gap-2">
            {canBulkImport && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate("/utilities/emailtracker/bulk-import")}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 shadow-sm transition-all"
              >
                <Database className="h-3.5 w-3.5" />
                Bulk Import
              </motion.button>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={fetchTasks}
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60 shadow-sm transition-all"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Sync
            </motion.button>
          </div>
        </div>
      </div>

      {/* ── TOOLBAR ── */}
      <div className="shrink-0 flex items-center gap-2">
        {/* Search */}
        <div className="flex-1 relative max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search title, sender, PIC, remark…"
            className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
          <History size={12} className="text-slate-400" />
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer"
          >
            <option value="receivedAt">Received</option>
            <option value="createdAt">Created</option>
          </select>
          <button
            onClick={() => { setSortDir((d) => (d === "desc" ? "asc" : "desc")); setPage(1); }}
            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-indigo-500 hover:text-white transition-all"
          >
            {sortDir === "desc" ? "↓" : "↑"}
          </button>
        </div>

        {/* Filter popover */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold shadow-sm transition-all ${filterOpen || statusFilters.length > 0 || picFilter !== "All" || newOnly
              ? "border-indigo-500 bg-indigo-50 text-indigo-700"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Filter
            {(statusFilters.length > 0 || picFilter !== "All" || newOnly) && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            )}
          </button>

          <AnimatePresence>
            {filterOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                className="absolute left-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl z-[100]"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-700">Filters</span>
                  <button
                    onClick={() => { setStatusFilters([]); setPicFilter("All"); setNewOnly(false); setPage(1); }}
                    className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700"
                  >
                    Clear all
                  </button>
                </div>

                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Status</div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button onClick={selectAllStatuses} className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-all ${statusFilters.length === 0 ? "border-indigo-500 bg-indigo-500 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>All</button>
                  {STATUS_OPTIONS.map((s) => (
                    <button key={s} onClick={() => toggleStatus(s)} className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-all ${statusFilters.includes(s) ? "border-indigo-500 bg-indigo-500 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                      {statusLabel(s)}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">PIC</div>
                    <select
                      value={picFilter}
                      onChange={(e) => { setPicFilter(e.target.value); setPage(1); }}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {allPICs.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">New (24h)</div>
                    <button
                      onClick={() => { setNewOnly((v) => !v); setPage(1); }}
                      className={`w-full flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-all ${newOnly ? "border-indigo-500 bg-indigo-50 text-indigo-600" : "border-slate-200 text-slate-600"
                        }`}
                    >
                      <span>{newOnly ? "ON" : "OFF"}</span>
                      <div className={`w-1.5 h-1.5 rounded-full ${newOnly ? "bg-indigo-500" : "bg-slate-300"}`} />
                    </button>
                  </div>
                </div>

                <button onClick={() => setFilterOpen(false)} className="w-full mt-3 rounded-lg bg-slate-900 text-white py-2 text-xs font-bold hover:bg-slate-800 transition-all">
                  Apply
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Result count */}
        <div className="text-[11px] font-semibold text-slate-400 ml-1">
          {sortedRows.length} result{sortedRows.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-h-0">
        <div className="flex-1 overflow-auto">
          <table className="min-w-[900px] w-full border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
              <tr>
                {SHOW_DOC_ID && <Th>ID</Th>}
                <Th className="pl-4">Email Title</Th>
                <Th>Received</Th>
                <Th>PIC</Th>
                <Th>Status</Th>
                <Th>Remark</Th>
                <Th className="text-right pr-4">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={SHOW_DOC_ID ? 8 : 7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-slate-400">Loading…</span>
                    </div>
                  </td>
                </tr>
              ) : pagedRows.length === 0 ? (
                <tr>
                  <td className="py-16 text-center text-slate-400" colSpan={SHOW_DOC_ID ? 8 : 7}>
                    <div className="flex flex-col items-center gap-2">
                      <div className="p-3 bg-slate-100 rounded-full">
                        <Activity size={24} className="opacity-40" />
                      </div>
                      <p className="text-sm font-semibold text-slate-500">No records found</p>
                      <p className="text-xs text-slate-400">{q ? "Try adjusting your search or filters" : "Import emails to get started"}</p>
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
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      className="group hover:bg-slate-50/70 transition-colors text-[12px]"
                    >
                      {SHOW_DOC_ID && <Td className="text-[10px] font-mono text-slate-400">{r._id}</Td>}

                      <Td className="min-w-[300px] pl-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors line-clamp-1">
                              {title || "(No Subject)"}
                            </span>
                            {showNew && (
                              <span className="shrink-0 inline-flex items-center rounded bg-indigo-500 px-1 py-0.5 text-[8px] font-black text-white">NEW</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 truncate max-w-[280px]" title={sender}>
                            {sender || "unknown sender"}
                          </span>
                        </div>
                      </Td>

                      <Td className="whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-700">{formatDate(r.receivedAt)}</span>
                          <span className="text-[10px] text-slate-400">{formatTime(r.receivedAt)}</span>
                        </div>
                      </Td>

                      <Td className="whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${pic ? "bg-emerald-500" : "bg-slate-300"}`} />
                          <span className={`font-medium ${pic ? "text-slate-800" : "text-slate-400"}`}>
                            {pic || "Unassigned"}
                          </span>
                        </div>
                      </Td>

                      <Td><StatusPill status={status} /></Td>

                      <Td className="max-w-[180px]" title={safeStr(r.remark)}>
                        <div className="text-[11px] text-slate-500 line-clamp-2 italic">
                          {safeStr(r.remark) || <span className="not-italic text-slate-300">—</span>}
                        </div>
                      </Td>

                      <Td className="text-right pr-4">
                        <div className="inline-flex items-center gap-1">
                          <IconBtn title="View Details" onClick={() => openDetail(r)} disabled={assignBusy || doneBusy || remarkBusy}>
                            <ArrowUpRight size={13} />
                          </IconBtn>
                          <IconBtn title={assignBusy ? "Assigning…" : "Assign to Me"} onClick={() => assignToMe(r)} disabled={!canAssign || assignBusy || doneBusy || remarkBusy}>
                            {assignBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus2 size={13} />}
                          </IconBtn>
                          <IconBtn title={doneBusy ? "Saving…" : "Mark Complete"} onClick={() => markDone(r)} disabled={!canDone || assignBusy || doneBusy || remarkBusy}>
                            {doneBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 size={13} />}
                          </IconBtn>
                          <IconBtn title="Edit Remark" onClick={() => openRemarkEditor(r._id, safeStr(r.remark))} disabled={assignBusy || doneBusy || remarkBusy}>
                            <Pencil size={13} />
                          </IconBtn>
                          {canDelete && (
                            <IconBtn title={busy === "delete" ? "Deleting…" : "Delete"} onClick={() => requestDelete(r)} disabled={assignBusy || doneBusy || remarkBusy || busy === "delete"} variant="danger">
                              {busy === "delete" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 size={13} />}
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

        {/* Pagination */}
        <div className="shrink-0 px-4 py-2.5 flex items-center justify-between border-t border-slate-100 bg-slate-50/50">
          <div className="text-[11px] font-medium text-slate-500">
            {sortedRows.length > 0 ? (
              <>Showing <strong>{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sortedRows.length)}</strong> of <strong>{sortedRows.length}</strong></>
            ) : "No records"}
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={() => gotoPage(page - 1)} disabled={page <= 1} className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white disabled:opacity-30 hover:border-indigo-400 transition-all text-slate-600">
              <ChevronLeft size={13} />
            </button>
            {pageButtons.map((p) => (
              <PageBtn key={p} page={p} active={p === page} onClick={() => gotoPage(p)} />
            ))}
            <button onClick={() => gotoPage(page + 1)} disabled={page >= totalPages} className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white disabled:opacity-30 hover:border-indigo-400 transition-all text-slate-600">
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {detailRow && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeDetail} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }} className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-slate-900">Email Details</h3>
                <button onClick={closeDetail} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><X size={16} /></button>
              </div>
              <div className="space-y-3">
                <DetailItem label="Created By" value={getPicName(detailRow.pic_create)} sub={formatDateTime(detailRow.createdAt)} />
                <DetailItem label="Last Updated By" value={getPicName(detailRow.pic_update)} sub={formatDateTime(detailRow.updatedAt)} />
                <DetailItem label="Remark By" value={getPicName(detailRow.pic_remark)} sub={formatDateTime(detailRow.remarkAt)} />
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Status</span>
                  <StatusPill status={normalizeStatus(detailRow.status)} />
                </div>
              </div>
              <button onClick={closeDetail} className="w-full mt-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all">Close</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Remark Editor ── */}
      <AnimatePresence>
        {editRowId && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 20 }} className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900">Edit Remark</h3>
                <button onClick={cancelRemark} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><X size={16} /></button>
              </div>
              <textarea
                value={editRemark}
                onChange={(e) => setEditRemark(e.target.value)}
                rows={5}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                placeholder="Add a remark…"
              />
              <div className="mt-4 flex gap-2">
                <button onClick={cancelRemark} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all" disabled={rowLoading[editRowId] === "remark"}>Cancel</button>
                <button onClick={saveRemark} disabled={rowLoading[editRowId] === "remark"} className="flex-[2] py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all disabled:opacity-50">
                  {rowLoading[editRowId] === "remark" ? <div className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /><span>Saving…</span></div> : <div className="flex items-center justify-center gap-1.5"><Save size={14} /><span>Save Remark</span></div>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Delete Modal ── */}
      <AnimatePresence>
        {deleteRow && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-rose-950/30 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-rose-200">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center mb-4">
                  <Trash2 size={22} />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">Delete Record?</h3>
                <p className="text-xs text-slate-500 mb-4">This action cannot be undone.</p>
                <div className="w-full rounded-xl bg-rose-50 border border-rose-100 p-3 mb-5 text-left">
                  <span className="text-[10px] font-bold uppercase text-rose-500 tracking-widest mb-0.5 block">Record</span>
                  <div className="font-semibold text-slate-900 text-sm truncate">{safeStr(deleteRow.title)}</div>
                </div>
                <div className="w-full flex gap-2">
                  <button onClick={cancelDelete} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all" disabled={rowLoading[deleteRow._id] === "delete"}>Cancel</button>
                  <button onClick={confirmDelete} disabled={rowLoading[deleteRow._id] === "delete"} className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all disabled:opacity-50">
                    {rowLoading[deleteRow._id] === "delete" ? <Loader2 size={14} className="mx-auto animate-spin" /> : "Delete"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Upload Modal ── */}
      <AnimatePresence>
        {emailModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/50 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }} className="relative w-full max-w-2xl my-auto rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600 rounded-xl text-white shadow shadow-indigo-200">
                    <UploadCloud size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Import Email Tasks</h3>
                    <p className="text-[11px] text-slate-500">Drop .eml files to create new task records</p>
                  </div>
                </div>
                <button onClick={closeEmailModal} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" disabled={emlBusy}><X size={18} /></button>
              </div>

              <div
                onDrop={onDropFiles}
                onDragOver={onDragOver}
                className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/20 transition-all"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white shadow flex items-center justify-center text-slate-400">
                    <Plus size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Drop .eml files here</p>
                    <p className="text-xs text-slate-400">or click to browse your files</p>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => fileInputRef.current?.click()} disabled={emlBusy} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all shadow shadow-indigo-200">Browse Files</button>
                    <button onClick={clearEmlItems} disabled={emlBusy || emlItems.length === 0} className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all disabled:opacity-40">Clear</button>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".eml,message/rfc822" multiple className="hidden" onChange={onPickFiles} />
                </div>
              </div>

              {emlItems.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Preview ({validCount}/{totalCount} valid)</span>
                    {emlBusy && <Loader2 size={14} className="animate-spin text-indigo-500" />}
                  </div>
                  <div className="max-h-52 overflow-auto rounded-xl border border-slate-100 bg-white shadow-inner">
                    <ul className="divide-y divide-slate-50">
                      {emlItems.map((it) => (
                        <li key={it.id} className="p-3 hover:bg-slate-50 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <ShieldCheck size={13} className={it.ok ? "text-emerald-500" : "text-rose-500"} />
                                <span className="font-semibold text-slate-800 text-xs truncate">{it.name}</span>
                                <span className="text-[10px] font-mono text-slate-400">{(it.size / 1024).toFixed(1)}KB</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="text-[9px] font-bold uppercase text-slate-400">Subject</span>
                                  <p className="text-[11px] font-medium text-slate-600 truncate">{it.subject || "—"}</p>
                                </div>
                                <div>
                                  <span className="text-[9px] font-bold uppercase text-slate-400">From</span>
                                  <p className="text-[11px] font-medium text-slate-600 truncate">{it.fromEmail || "—"}</p>
                                </div>
                              </div>
                            </div>
                            <button onClick={() => removeEmlItem(it.id)} disabled={emlBusy} className="p-1 text-slate-300 hover:text-rose-500 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="mt-5 flex items-center justify-between gap-4 pt-4 border-t border-slate-100">
                <p className="text-[11px] font-medium text-slate-400">{validCount} task{validCount !== 1 ? "s" : ""} ready to submit</p>
                <div className="flex gap-2">
                  <button onClick={closeEmailModal} disabled={emlBusy} className="px-5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all">Cancel</button>
                  <button onClick={confirmWriteToFirestore} disabled={emlBusy || validCount === 0} className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-all shadow shadow-indigo-200 disabled:opacity-50">
                    {emlBusy ? <Loader2 size={14} className="mx-auto animate-spin" /> : `Submit ${validCount > 0 ? validCount : ""} Task${validCount !== 1 ? "s" : ""}`}
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

function StatCard({ label, value, color = "slate", icon }) {
  const config = {
    slate: {
      bg: "bg-white",
      border: "border-slate-200",
      labelColor: "text-slate-400",
      valueColor: "text-slate-800",
      glow: "",
    },
    blue: {
      bg: "bg-blue-50",
      border: "border-blue-100",
      labelColor: "text-blue-400",
      valueColor: "text-blue-700",
      glow: "shadow-blue-100",
    },
    amber: {
      bg: "bg-amber-50",
      border: "border-amber-100",
      labelColor: "text-amber-500",
      valueColor: "text-amber-700",
      glow: "shadow-amber-100",
    },
    emerald: {
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      labelColor: "text-emerald-500",
      valueColor: "text-emerald-700",
      glow: "shadow-emerald-100",
    },
  };
  const c = config[color] || config.slate;
  return (
    <motion.div
      whileHover={{ scale: 1.04, y: -1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`flex items-center gap-2 px-3 rounded-xl border shadow-sm cursor-default h-full w-[140px] ${c.bg} ${c.border} ${c.glow}`}
    >
      <span className="text-base leading-none shrink-0">{icon}</span>
      <div className="flex flex-col min-w-0">
        <span className={`text-[8px] font-bold uppercase tracking-widest leading-none ${c.labelColor}`}>{label}</span>
        <span className={`text-lg font-black leading-tight mt-0.5 ${c.valueColor}`}>{value}</span>
      </div>
    </motion.div>
  );
}

function DetailItem({ label, value, sub }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <div className="font-semibold text-slate-900 text-sm">{value || "—"}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}


function Th({ children, className = "" }) {
  return (
    <th className={`px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }) {
  return (
    <td className={`px-3 py-2.5 align-middle text-slate-800 ${className}`}>
      {children}
    </td>
  );
}

function PageBtn({ page = 1, active = false, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        "h-7 min-w-7 rounded-lg border px-2 text-xs font-bold transition-all",
        active
          ? "border-indigo-500 bg-indigo-500 text-white shadow shadow-indigo-200"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300",
      ].join(" ")}
    >
      {page}
    </button>
  );
}

function IconBtn({ title, onClick, disabled, children, variant = "default" }) {
  const base =
    "inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-all " +
    "disabled:opacity-40 disabled:cursor-not-allowed";
  const styles =
    variant === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 shadow-sm"
      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-400 shadow-sm";
  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.08 } : {}}
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
  const base = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border";

  if (s === "COMPLETE") {
    return (
      <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700`}>
        <CheckCircle2 size={10} />
        Done
      </span>
    );
  }

  if (s === "IN_PROGRESS") {
    return (
      <span className={`${base} border-indigo-200 bg-indigo-50 text-indigo-700`}>
        <Clock size={10} />
        In Progress
      </span>
    );
  }

  return (
    <span className={`${base} border-slate-200 bg-slate-50 text-slate-600`}>
      <Plus size={10} />
      New
    </span>
  );
}

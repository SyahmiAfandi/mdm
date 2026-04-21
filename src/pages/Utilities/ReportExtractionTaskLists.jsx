import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import toast from "react-hot-toast";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Plus, Archive, Download, ChevronRight, Loader2, ArrowRightCircle, CalendarDays, Clock5, Pencil, ChevronDown, Check, Trash2 } from "lucide-react";
import { useUser } from "../../context/UserContext";
import { usePermissions } from "../../hooks/usePermissions";

const TASK_LISTS_TABLE = "report_extraction_task_lists";
const TRACKER_TABLE = "report_extraction_tracker";
const STORAGE_BUCKET = "report-extractions";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function safeText(value) {
  return String(value ?? "").trim();
}

function sanitizeZipToken(value, fallback = "file") {
  const token = safeText(value)
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^[_\-.]+|[_\-.]+$/g, "")
    .replace(/_+/g, "_");
  return token || fallback;
}

function basenameFromPath(path) {
  const text = safeText(path);
  if (!text) return "";
  const parts = text.split("/");
  return parts[parts.length - 1] || "";
}

function buildZipFileName(task) {
  const title = sanitizeZipToken(task?.title, "report_extraction_task");
  return `${title}_attachments.zip`;
}

export default function ReportExtractionTaskLists() {
  const { user } = useUser();
  const { role, can } = usePermissions();
  const navigate = useNavigate();
  
  const isAdmin = role === "admin" || can("admin.*");

  const [loading, setLoading] = useState(true);
  const [taskLists, setTaskLists] = useState([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  
  // Create Modal State
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [details, setDetails] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [status, setStatus] = useState("Pending");
  
  const [dataSource, setDataSource] = useState("Mismatch (DB)");
  const [periodIds, setPeriodIds] = useState([]);
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);
  const [reportType, setReportType] = useState("All");
  const [creating, setCreating] = useState(false);
  const [downloadingTaskId, setDownloadingTaskId] = useState(null);
  
  const [reconPeriods, setReconPeriods] = useState([]);
  const [mismatchReportTypes, setMismatchReportTypes] = useState(["All"]);
  
  // Users state for dropdown
  const [userOptions, setUserOptions] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  function openCreateModal() {
    setEditingTaskId(null);
    setTitle("");
    setStartDate("");
    setDueDate("");
    setDetails("");
    setDataSource("Mismatch (DB)");
    if (reconPeriods.length > 0) setPeriodIds([reconPeriods[0].id]);
    else setPeriodIds([]);
    setReportType("All");
    const defaultName = user?.display_name || user?.email || "";
    setSelectedUsers(defaultName ? [defaultName] : []);
    setStatus("Pending");
    setCreateModalOpen(true);
  }

  function openEditModal(task) {
    setEditingTaskId(task.id);
    setTitle(task.title || "");
    setStartDate(task.start_date || "");
    setDueDate(task.due_date || "");
    setDetails(task.details || "");
    setDataSource(task.data_source || "Mismatch (DB)");
    // period_year/month stored — reconstruct as array
    const mappedDate = task.period_year && task.period_month
      ? `${task.period_year}-${String(task.period_month).padStart(2, "0")}`
      : "";
    setPeriodIds(mappedDate ? [mappedDate] : []);
    setReportType(task.report_type || "All");
    const parsedUsers = (task.assigned_to || "").split(",").map(s => s.trim()).filter(Boolean);
    setSelectedUsers(parsedUsers);
    setStatus(task.status || "Pending");
    setCreateModalOpen(true);
  }

  // Pre-fill user on first load
  useEffect(() => {
    if (selectedUsers.length === 0 && user) {
      const defaultName = user.display_name || user.email || "";
      if (defaultName) setSelectedUsers([defaultName]);
    }
  }, [user]);

  useEffect(() => {
    fetchTaskLists();
    fetchUsers();
    fetchReconPeriods();
  }, []);

  async function fetchReconPeriods() {
    try {
      const { data, error } = await supabase.from("recon_periods").select("id, year, month, month_name, status").eq("status", "locked").order("id", { ascending: false });
      if (error) throw error;
      setReconPeriods(data || []);
      if (periodIds.length === 0 && data?.length > 0) {
        setPeriodIds([data[0].id]);
      }
    } catch (err) {
      console.error("Failed to fetch periods", err);
    }
  }

  useEffect(() => {
    if (dataSource !== "Mismatch (DB)" || periodIds.length === 0) return;

    let isMounted = true;
    async function fetchMismatchTypes() {
      try {
        const { data, error } = await supabase
          .from("recon_cells")
          .select("business_type, report_type_name")
          .in("period_id", periodIds)
          .eq("status", "mismatch");

        if (error) throw error;
        
        if (isMounted) {
          if (!data || data.length === 0) {
             setMismatchReportTypes(["All"]);
             if (reportType !== "All") setReportType("All");
             return;
          }
          const combos = new Set();
          data.forEach(row => {
            const bt = row.business_type || "Unknown";
            const rt = row.report_type_name || "Unknown";
            combos.add(`${bt} - ${rt}`);
          });
          const options = ["All", ...Array.from(combos).sort()];
          setMismatchReportTypes(options);
          
          if (!options.includes(reportType)) {
             setReportType("All");
          }
        }
      } catch (err) {
        console.error("Failed to fetch mismatch types", err);
      }
    }
    
    fetchMismatchTypes();
    
    return () => { isMounted = false; };
  }, [dataSource, periodIds]);

  async function fetchUsers() {
    try {
      const [{ data: profiles, error: profileError }, { data: roles, error: roleError }] = await Promise.all([
        supabase.from("profiles").select("id,display_name,email,username"),
        supabase.from("user_roles").select("id,role"),
      ]);

      if (profileError) throw profileError;
      if (roleError) throw roleError;

      const roleById = {};
      (roles || []).forEach((row) => {
        if (row?.id && row?.role) roleById[row.id] = row.role;
      });

      const mappedUsers = (profiles || [])
        .map((profile) => {
           const mappedRole = roleById[profile.id] || "viewer";
           return {
             id: profile.id,
             name: profile.display_name || profile.name || profile.username || profile.email || "Unknown User",
             role: mappedRole
           };
        })
        .filter((option) => option.id && option.name && option.name !== "Unknown User" && option.role !== "viewer")
        .sort((a, b) => a.name.localeCompare(b.name));

      // Deduplicate by name just in case
      const unique = [];
      const seen = new Set();
      for (const u of mappedUsers) {
        if (!seen.has(u.name)) {
          seen.add(u.name);
          unique.push(u);
        }
      }
      setUserOptions(unique);
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  }

  function toggleUser(name) {
    setSelectedUsers(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  }

  async function fetchTaskLists() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(TASK_LISTS_TABLE)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTaskLists(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load task lists.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Title is required.");

    setCreating(true);
    try {
      const author = user?.display_name || user?.email || "System";
      // Use first period for year/month storage (for backwards compat), store all in report_type field context
      const firstPeriod = periodIds[0] || "";
      const payload = {
        title: title.trim(),
        start_date: startDate || null,
        due_date: dueDate || null,
        details: details.trim() || null,
        status: status,
        assigned_to: selectedUsers.length > 0 ? selectedUsers.join(", ") : null,
        data_source: dataSource,
        period_year: dataSource === "Mismatch (DB)" && firstPeriod ? firstPeriod.split("-")[0] : null,
        period_month: dataSource === "Mismatch (DB)" && firstPeriod ? Number(firstPeriod.split("-")[1]) : null,
        report_type: dataSource === "Mismatch (DB)" ? reportType : null,
      };

      if (editingTaskId) {
        payload.updated_at = new Date().toISOString();
        payload.updated_by = author;

        const { error } = await supabase
          .from(TASK_LISTS_TABLE)
          .update(payload)
          .eq("id", editingTaskId);

        if (error) throw error;
        toast.success("Task List updated successfully!");
      } else {
        payload.created_by = author;
        const { data, error } = await supabase
          .from(TASK_LISTS_TABLE)
          .insert(payload)
          .select("*")
          .single();

        if (error) throw error;

          // Sync mismatches for EACH selected period
          let totalSynced = 0;
          const syncErrors = [];
          for (const pid of periodIds) {
            try {
              const rpcPayload = {
                p_task_list_id: data.id,
                p_period_id: pid,
                p_report_type: reportType || "All",
                p_user: author
              };
              const { error: rpcError, data: rpcData } = await supabase.rpc("sync_cells_to_task_list", rpcPayload);
              if (rpcError) throw new Error(rpcError.message || JSON.stringify(rpcError));
              totalSynced += rpcData || 0;
            } catch (syncErr) {
              syncErrors.push(`${pid}: ${syncErr.message}`);
            }
          }

          if (syncErrors.length > 0) {
            toast.error("DB Error: " + syncErrors.join(" | "));
          } else {
            console.log(`Successfully synced ${totalSynced} rows across ${periodIds.length} period(s).`);
          }
        toast.success("Task List Created successfully!");
      }

      setCreateModalOpen(false);
      fetchTaskLists();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to save task list.");
    } finally {
      setCreating(false);
    }
  }

  async function handleArchive(task) {
    const isCreator = task.created_by === user?.display_name || task.created_by === user?.email;
    if (!isAdmin && !isCreator) return toast.error("Only the creator of this task list can archive it.");
    if (!window.confirm("Are you sure you want to archive this task list? This will move its data to the historical archive.")) return;

    try {
      toast.loading("Archiving task list...", { id: "archiveToast" });
      const { error } = await supabase.rpc("archive_report_extraction_task_list", {
        p_task_list_id: task.id,
        p_user: user?.display_name || user?.email || "System"
      });
      if (error) throw error;
      toast.success("Task list archived successfully.", { id: "archiveToast" });
      fetchTaskLists();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to archive task.", { id: "archiveToast" });
    }
  }

  async function handleDelete(task) {
    if (!window.confirm(`Are you sure you want to permanently delete "${task.title}"? This will also wipe all tracker rows attached to it. This action cannot be reversed.`)) return;
    
    toast.loading("Deleting task list...", { id: "deleteToast" });
    try {
      const { error } = await supabase
        .from("report_extraction_task_lists")
        .delete()
        .eq("id", task.id);
        
      if (error) throw error;
      
      toast.success("Task List deleted successfully", { id: "deleteToast" });
      setTaskLists(prev => prev.filter(t => t.id !== task.id));
    } catch (err) {
      console.error("Failed to delete task:", err);
      toast.error(err.message || "Failed to delete task.", { id: "deleteToast" });
    }
  }

  async function handleDownloadAllFiles(task) {
    const toastId = `download-all-${task.id}`;
    setDownloadingTaskId(task.id);
    toast.loading("Preparing ZIP download...", { id: toastId });

    try {
      const { data: trackerRows, error: trackerError } = await supabase
        .from(TRACKER_TABLE)
        .select("id,file_path,file_name")
        .eq("task_list_id", task.id)
        .not("file_path", "is", null);

      if (trackerError) throw trackerError;

      const files = (trackerRows || []).filter((row) => safeText(row?.file_path));
      if (!files.length) {
        toast.error("No attached files found for this task.", { id: toastId });
        return;
      }

      const zip = new JSZip();
      const usedNames = new Set();

      for (let index = 0; index < files.length; index += 1) {
        const row = files[index];
        toast.loading(`Downloading file ${index + 1} of ${files.length}...`, { id: toastId });

        const { data: blob, error: downloadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .download(row.file_path);

        if (downloadError) throw new Error(`Failed to download ${row.file_name || row.file_path}: ${downloadError.message || downloadError}`);

        const originalName = sanitizeZipToken(row.file_name || basenameFromPath(row.file_path), `attachment_${index + 1}`);
        let uniqueName = originalName;
        let duplicateCounter = 2;

        while (usedNames.has(uniqueName.toLowerCase())) {
          const extensionIndex = originalName.lastIndexOf(".");
          const base = extensionIndex > 0 ? originalName.slice(0, extensionIndex) : originalName;
          const ext = extensionIndex > 0 ? originalName.slice(extensionIndex) : "";
          uniqueName = `${base}_${duplicateCounter}${ext}`;
          duplicateCounter += 1;
        }

        usedNames.add(uniqueName.toLowerCase());
        zip.file(uniqueName, blob);
      }

      toast.loading("Creating ZIP archive...", { id: toastId });
      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, buildZipFileName(task));
      toast.success(`Downloaded ${files.length} file(s) as ZIP.`, { id: toastId });
    } catch (err) {
      console.error("Failed to download task attachments:", err);
      toast.error(err.message || "Failed to download task attachments.", { id: toastId });
    } finally {
      setDownloadingTaskId((current) => (current === task.id ? null : current));
    }
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4" style={{background: 'linear-gradient(135deg, #f0f4ff, #eef6ff)'}}>
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 8px 24px rgba(99,102,241,0.4)'}}>
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
        <div className="text-sm font-semibold text-slate-400">Loading task lists&hellip;</div>
      </div>
    );
  }

  // Filter tasks based on Admin and Assignees
  const isRelevantTask = (task) => {
    if (isAdmin) return true;
    const authorMatches = task.created_by === user?.display_name || task.created_by === user?.email;
    if (authorMatches) return true;
    const assignedStr = task.assigned_to || "";
    return assignedStr.includes(user?.display_name) || assignedStr.includes(user?.email);
  };

  const filteredTaskLists = taskLists.filter(isRelevantTask);
  const activeTasks = filteredTaskLists.filter(t => t.status !== "Expired");
  const archivedTasks = filteredTaskLists.filter(t => t.status === "Expired");

  return (
    <div className="flex flex-col pb-10" style={{background: 'linear-gradient(135deg, #f0f4ff 0%, #f8faff 50%, #eef6ff 100%)', minHeight: '100vh'}}>
      <div className="mx-auto w-full max-w-7xl flex flex-col gap-6 px-4 sm:px-6 lg:px-8 pt-6">

        {/* ── Premium Hero Header ── */}
        <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-2xl shadow-2xl" style={{background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, #312e81 100%)'}}>
          <div className="pointer-events-none absolute -top-10 -right-8 h-48 w-48 rounded-full opacity-20" style={{background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)'}} />
          <div className="pointer-events-none absolute -bottom-6 left-1/4 h-32 w-32 rounded-full opacity-10" style={{background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)'}} />
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-lg" style={{background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 4px 15px rgba(99,102,241,0.5)'}}>
              <Plus className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white m-0 leading-none">Report Extraction Tasks</h1>
              <p className="text-[12px] text-slate-400 mt-0.5">Manage and track distinct extraction task periods</p>
            </div>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white transition-all hover:scale-105 active:scale-95 whitespace-nowrap flex-shrink-0"
            style={{background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 15px rgba(16,185,129,0.4)'}}
          >
            <Plus className="w-4 h-4" />
            Add Task List
          </button>
        </div>

        {/* ── Active Tasks ── */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 px-1">
            <div className="h-px flex-1" style={{background: 'linear-gradient(to right, #c7d2fe, transparent)'}} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Active Tasks</span>
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full text-[10px] font-black text-white px-1.5" style={{background: 'linear-gradient(135deg, #6366f1, #4f46e5)'}}>
              {activeTasks.length}
            </span>
            <div className="h-px flex-1" style={{background: 'linear-gradient(to left, #c7d2fe, transparent)'}} />
          </div>

          {activeTasks.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-md border border-white/70 border-dashed rounded-3xl p-14 text-center flex flex-col items-center shadow-lg">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4" style={{background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)'}}>
                <Archive className="w-10 h-10 text-indigo-300" />
              </div>
              <h3 className="text-lg font-black text-slate-600">No Active Tasks</h3>
              <p className="text-slate-400 text-sm mt-1 max-w-sm">Create a new task list to pull mismatches and start tracking extraction assignments.</p>
              <button
                onClick={openCreateModal}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white text-sm transition-all hover:scale-105"
                style={{background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 4px 12px rgba(99,102,241,0.35)'}}
              >
                <Plus className="w-4 h-4" /> Create First Task
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeTasks.map(task => {
                const statusCfg = {
                  Completed: { grad: 'linear-gradient(135deg,#10b981,#059669)', badgeBg: 'linear-gradient(135deg,#d1fae5,#a7f3d0)', badgeBorder: '#10b981', badgeText: '#065f46', badgeShadow: 'rgba(16,185,129,0.2)' },
                  Ongoing:   { grad: 'linear-gradient(135deg,#f59e0b,#d97706)', badgeBg: 'linear-gradient(135deg,#fef3c7,#fde68a)', badgeBorder: '#f59e0b', badgeText: '#92400e', badgeShadow: 'rgba(245,158,11,0.2)' },
                  Pending:   { grad: 'linear-gradient(135deg,#64748b,#475569)', badgeBg: 'linear-gradient(135deg,#f1f5f9,#e2e8f0)', badgeBorder: '#94a3b8', badgeText: '#475569', badgeShadow: 'rgba(100,116,139,0.1)' },
                };
                const cfg = statusCfg[task.status] || statusCfg.Pending;
                const avatarColors = ['linear-gradient(135deg,#6366f1,#4f46e5)', 'linear-gradient(135deg,#10b981,#059669)', 'linear-gradient(135deg,#f59e0b,#d97706)', 'linear-gradient(135deg,#f43f5e,#e11d48)'];
                const assignees = (task.assigned_to || '').split(',').map(s => s.trim()).filter(Boolean);

                return (
                  <div key={task.id} className="group flex flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/90 backdrop-blur-md shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl" style={{boxShadow: '0 4px 24px rgba(99,102,241,0.08)'}}>
                    {/* Colored top strip */}
                    <div className="h-1.5 w-full flex-shrink-0" style={{background: cfg.grad}} />

                    <div className="flex flex-col gap-0 p-5 flex-1">
                      <div className="flex justify-between items-start mb-3">
                        <span
                          className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                          style={{background: cfg.badgeBg, border: `1px solid ${cfg.badgeBorder}`, color: cfg.badgeText, boxShadow: `0 2px 6px ${cfg.badgeShadow}`}}
                        >
                          {task.status}
                        </span>
                        <div className="text-[11px] font-semibold text-slate-400">
                          {MONTHS[parseInt(task.period_month)-1]} {task.period_year}
                        </div>
                      </div>

                      <h3 className="text-base font-black text-slate-800 leading-snug">{task.title}</h3>

                      {/* Assignee avatars */}
                      {assignees.length > 0 && (
                        <div className="flex items-center gap-2 mt-3">
                          <div className="flex -space-x-1.5">
                            {assignees.slice(0, 3).map((name, i) => (
                              <div
                                key={i}
                                title={name}
                                className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-black text-white ring-2 ring-white"
                                style={{background: avatarColors[i % avatarColors.length]}}
                              >
                                {name.charAt(0).toUpperCase()}
                              </div>
                            ))}
                            {assignees.length > 3 && (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-black text-slate-600 ring-2 ring-white bg-slate-100">
                                +{assignees.length - 3}
                              </div>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 font-medium truncate">
                            {assignees[0]}{assignees.length > 1 ? ` +${assignees.length - 1} more` : ''}
                          </span>
                        </div>
                      )}

                      <div className="flex flex-col gap-1 mt-3">
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                          <CalendarDays className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                          {task.due_date ? new Date(task.due_date).toLocaleDateString('en-GB') : <span className="italic text-slate-300">No deadline</span>}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                          <Clock5 className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                          Created {new Date(task.created_at).toLocaleDateString('en-GB')}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleDownloadAllFiles(task)}
                          disabled={downloadingTaskId === task.id}
                          title="Download all files as ZIP"
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {downloadingTaskId === task.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        </button>
                        {(isAdmin || task.created_by === user?.display_name || task.created_by === user?.email) && (
                          <>
                            <button onClick={() => handleArchive(task)} title="Archive" className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all">
                              <Archive className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(task)} title="Delete" className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => openEditModal(task)} title="Edit" className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                              <Pencil className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>

                      <Link
                        to={`/utilities/report-extraction-tracker/${task.id}`}
                        className="inline-flex items-center gap-1.5 text-[12px] font-black text-white px-4 py-1.5 rounded-xl transition-all hover:scale-105 active:scale-95"
                        style={{background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 3px 10px rgba(99,102,241,0.35)'}}
                      >
                        Open Tracker <ArrowRightCircle className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Historical Archive ── */}
        {archivedTasks.length > 0 && (
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex items-center gap-3 px-1">
              <div className="h-px flex-1" style={{background: 'linear-gradient(to right, #e2e8f0, transparent)'}} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Historical Archive</span>
              <div className="h-px flex-1" style={{background: 'linear-gradient(to left, #e2e8f0, transparent)'}} />
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/80 backdrop-blur-md overflow-hidden shadow-lg">
              <table className="w-full text-left text-sm">
                <thead style={{background: 'linear-gradient(135deg, #1e293b, #0f172a)'}}>
                  <tr>
                    <th className="px-5 py-3 text-[9px] font-extrabold uppercase tracking-[0.18em]" style={{color: '#94a3b8'}}>Task Title</th>
                    <th className="px-5 py-3 text-[9px] font-extrabold uppercase tracking-[0.18em]" style={{color: '#94a3b8'}}>Period</th>
                    <th className="px-5 py-3 text-[9px] font-extrabold uppercase tracking-[0.18em]" style={{color: '#94a3b8'}}>Archived On</th>
                    <th className="px-5 py-3 text-[9px] font-extrabold uppercase tracking-[0.18em] text-right" style={{color: '#94a3b8'}}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {archivedTasks.map(task => (
                    <tr key={task.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-5 py-3 font-bold text-slate-700">{task.title}</td>
                      <td className="px-5 py-3 text-[12px] text-slate-500">{MONTHS[parseInt(task.period_month)-1]} {task.period_year}</td>
                      <td className="px-5 py-3 text-[12px] text-slate-500">{new Date(task.updated_at).toLocaleDateString('en-GB')}</td>
                      <td className="px-5 py-3 text-right">
                        {(isAdmin || task.created_by === user?.display_name || task.created_by === user?.email) && (
                          <button onClick={() => handleDelete(task)} title="Delete Permanently" className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-flex">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-10 overflow-y-auto" style={{background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)'}}>
          <div className="w-full max-w-5xl m-auto flex flex-col rounded-3xl overflow-hidden shadow-2xl" style={{background: '#fff', boxShadow: '0 24px 80px rgba(15,23,42,0.4)'}}>

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 flex-shrink-0" style={{background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #312e81 100%)'}}>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)'}}>
                  <Plus className="h-4 w-4 text-indigo-300" />
                </div>
                <div>
                  <h3 className="font-black text-white text-base leading-none">{editingTaskId ? 'Edit Task List' : 'New Task List'}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">{editingTaskId ? 'Update the task details below' : 'Configure and sync a new extraction task'}</p>
                </div>
              </div>
              <button type="button" onClick={() => setCreateModalOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-all">
                <ChevronDown className="w-4 h-4 rotate-180" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col">
              <div className="p-6 grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-8 bg-slate-50/50">

                {/* Left column – basic info */}
                <div className="flex flex-col gap-5">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 mb-2">Task Title</label>
                    <input
                      autoFocus type="text" required
                      value={title} onChange={e => setTitle(e.target.value)}
                      placeholder="e.g., March 2026 Batch 1..."
                      className="w-full px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-800 shadow-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 mb-2">Start Date</label>
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                        className="w-full px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-800 shadow-sm" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 mb-2">Due Date</label>
                      <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                        className="w-full px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-800 shadow-sm" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 mb-2">Assignment / PIC</label>
                      <div className="relative">
                        <div onClick={() => setDropdownOpen(!dropdownOpen)}
                          className="w-full px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-all font-medium text-slate-800 shadow-sm">
                          <span className="truncate pr-2">{selectedUsers.length > 0 ? selectedUsers.join(', ') : <span className="text-slate-400">Select Assignees</span>}</span>
                          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        </div>
                        {dropdownOpen && (
                          <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                            {userOptions.length === 0
                              ? <div className="p-3 text-sm text-slate-400 text-center">No users found.</div>
                              : <div className="flex flex-col py-1">
                                  {userOptions.map(u => {
                                    const selected = selectedUsers.includes(u.name);
                                    return (
                                      <div key={u.id} onClick={() => toggleUser(u.name)}
                                        className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${selected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selected ? 'text-white' : 'border-slate-300 bg-white'}`}
                                          style={selected ? {background: 'linear-gradient(135deg,#6366f1,#4f46e5)', border: 'none'} : {}}>
                                          {selected ? <Check className="w-3 h-3" /> : null}
                                        </div>
                                        <span className={`text-sm ${selected ? 'font-bold text-indigo-900' : 'text-slate-700'}`}>{u.name}</span>
                                      </div>
                                    );
                                  })}
                                </div>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 mb-2">Status</label>
                      <select value={status} onChange={e => setStatus(e.target.value)}
                        className="w-full px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-800 shadow-sm">
                        <option value="Pending">Pending</option>
                        <option value="Ongoing">Ongoing</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 mb-2">Details</label>
                    <textarea rows={3} value={details} onChange={e => setDetails(e.target.value)}
                      placeholder="Any additional details or instructions..."
                      className="w-full px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-800 shadow-sm resize-none" />
                  </div>
                </div>

                {/* Right column – data source */}
                <div className="flex flex-col">
                  <div className="border border-slate-200 rounded-2xl overflow-hidden h-full flex flex-col bg-white shadow-sm">
                    <div className="px-5 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)'}}>
                      <div className="text-sm font-black text-slate-700">Data Source</div>
                      <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
                        {['Mismatch (DB)', 'Custom Data'].map(opt => (
                          <button key={opt} type="button" onClick={() => setDataSource(opt)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                              dataSource === opt ? 'text-white shadow' : 'text-slate-500 hover:bg-slate-50'
                            }`}
                            style={dataSource === opt ? {background: 'linear-gradient(135deg,#0f172a,#1e293b)'} : {}}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {dataSource === 'Mismatch (DB)' ? (
                      <div className="p-5 flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 mb-2">Period</label>
                            <div className="relative">
                              <div onClick={() => setPeriodDropdownOpen(o => !o)}
                                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-all font-medium text-slate-800 min-h-[42px]">
                                <span className="truncate pr-2 text-sm">
                                  {periodIds.length === 0 ? <span className="text-slate-400">Select period(s)</span>
                                    : periodIds.length === 1 ? periodIds[0]
                                    : `${periodIds.length} periods selected`}
                                </span>
                                <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              </div>
                              {periodDropdownOpen && (
                                <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                                  {reconPeriods.length === 0
                                    ? <div className="p-3 text-sm text-slate-400 text-center">No locked periods available</div>
                                    : <div className="flex flex-col py-1">
                                        {reconPeriods.map(p => {
                                          const selected = periodIds.includes(p.id);
                                          return (
                                            <div key={p.id} onClick={() => setPeriodIds(prev => selected ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                                              className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${selected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                                              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selected ? 'text-white' : 'border-slate-300 bg-white'}`}
                                                style={selected ? {background: 'linear-gradient(135deg,#6366f1,#4f46e5)', border: 'none'} : {}}>
                                                {selected ? <Check className="w-3 h-3" /> : null}
                                              </div>
                                              <span className={`text-sm ${selected ? 'font-bold text-indigo-900' : 'text-slate-700'}`}>{p.id} ({p.month_name})</span>
                                            </div>
                                          );
                                        })}
                                      </div>}
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 mb-2">Report Status</label>
                            <div className="w-full px-3 py-2.5 text-sm bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium flex items-center min-h-[42px]">
                              <span className="w-2 h-2 rounded-full bg-rose-500 mr-2 flex-shrink-0"></span> Mismatch
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 mb-2">Report Type</label>
                          <select value={reportType} onChange={e => setReportType(e.target.value)}
                            className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-800">
                            {mismatchReportTypes.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                          <Archive className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-sm text-slate-400 italic">No additional configuration required for custom data source.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
                <button type="button" onClick={() => setCreateModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={creating}
                  className="inline-flex items-center gap-2 px-7 py-2.5 text-sm font-black text-white rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 4px 12px rgba(99,102,241,0.4)'}}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {editingTaskId ? 'Save Changes' : 'Create & Sync'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

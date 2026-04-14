import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import toast from "react-hot-toast";
import { Plus, Archive, ChevronRight, Loader2, ArrowRightCircle, CalendarDays, User, Clock5, Pencil, ChevronDown, Check, Trash2 } from "lucide-react";
import { useUser } from "../../context/UserContext";
import { usePermissions } from "../../hooks/usePermissions";

const TASK_LISTS_TABLE = "report_extraction_task_lists";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
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
    <div className="flex flex-col h-full bg-slate-50 p-4 sm:p-6 lg:p-8 overflow-y-auto">
      <div className="mx-auto w-full max-w-7xl flex flex-col gap-6">
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Report Extraction Tasks</h1>
            <p className="text-sm text-slate-500 mt-1">Manage and track distinct extraction task periods</p>
          </div>
          
          <button 
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm shadow-slate-900/10 hover:bg-slate-800 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Task List
          </button>
        </div>

        {/* Active Tasks */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-extrabold uppercase tracking-widest text-slate-500 px-1">Active Tasks</h2>
          
          {activeTasks.length === 0 ? (
            <div className="bg-white border border-slate-200 border-dashed rounded-3xl p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
                <Archive className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">No Active Tasks</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-sm">Create a new task list to pull mismatches and start tracking extraction assignments.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeTasks.map(task => (
                <div key={task.id} className="group bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md hover:border-sky-300 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className={`text-[10px] uppercase font-black tracking-widest px-2 py-1 rounded-md ${
                        task.status === "Completed" ? "bg-emerald-50 text-emerald-600" :
                        task.status === "Ongoing" ? "bg-amber-50 text-amber-600" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {task.status}
                      </div>
                      <div className="text-xs text-slate-400 font-medium">
                         {MONTHS[parseInt(task.period_month)-1]} {task.period_year}
                      </div>
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-2 leading-tight">{task.title}</h3>
                    
                    <div className="flex flex-col gap-1.5 mt-3">
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                        <User className="w-3.5 h-3.5" />
                        {task.assigned_to || <span className="italic text-slate-400">Unassigned</span>}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {task.due_date ? new Date(task.due_date).toLocaleDateString() : <span className="italic text-slate-400">No deadline</span>}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                        <Clock5 className="w-3.5 h-3.5" />
                        Created {new Date(task.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                       {(isAdmin || task.created_by === user?.display_name || task.created_by === user?.email) && (
                         <>
                           <button 
                             onClick={() => handleArchive(task)}
                             title="Archive Task List"
                             className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                           >
                             <Archive className="w-4 h-4" />
                           </button>
                           <button 
                             onClick={() => handleDelete(task)}
                             title="Delete Task List"
                             className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </>
                       )}
                       <button 
                         onClick={() => openEditModal(task)}
                         title="Edit Task List"
                         className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                       >
                         <Pencil className="w-4 h-4" />
                       </button>
                    </div>
                     
                     <Link 
                       to={`/utilities/report-extraction-tracker/${task.id}`}
                       className="inline-flex items-center gap-2 text-sm font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-4 py-2 rounded-xl transition-colors"
                     >
                        Open Tracker <ArrowRightCircle className="w-4 h-4" />
                     </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Archived Tasks */}
        {archivedTasks.length > 0 && (
          <div className="flex flex-col gap-4 mt-8">
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-slate-400 px-1">Historical Archive</h2>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm text-sm">
               <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                     <tr>
                       <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Task Title</th>
                       <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Period</th>
                       <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Archived On</th>
                       <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Actions</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {archivedTasks.map(task => (
                      <tr key={task.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-bold text-slate-700">{task.title}</td>
                        <td className="px-5 py-3 text-slate-500">{MONTHS[parseInt(task.period_month)-1]} {task.period_year}</td>
                        <td className="px-5 py-3 text-slate-500">{new Date(task.updated_at).toLocaleDateString()}</td>
                        <td className="px-5 py-3 text-right">
                          {(isAdmin || task.created_by === user?.display_name || task.created_by === user?.email) && (
                            <button 
                              onClick={() => handleDelete(task)}
                              title="Delete Task List Permanently"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors inline-flex"
                            >
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

      {/* Create Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-10 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-5xl m-auto flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between flex-shrink-0">
              <h3 className="font-black text-slate-800 text-lg">{editingTaskId ? "Edit Task List" : "New Task List"}</h3>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col">
              <div className="p-6 grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-8">
                <div className="flex flex-col gap-5">
                  <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Task Title</label>
                <input 
                  autoFocus
                  type="text" 
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., March 2026 Batch 1..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium text-slate-800"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Start Date</label>
                  <input 
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Due Date</label>
                  <input 
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Assignment / PIC</label>
                  <div className="relative">
                    <div 
                      onClick={() => setDropdownOpen(!dropdownOpen)} 
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:border-sky-300 transition-all font-medium text-slate-800"
                    >
                      <span className="truncate pr-2">
                        {selectedUsers.length > 0 ? selectedUsers.join(", ") : <span className="text-slate-400">Select Assignees</span>}
                      </span>
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    </div>
                    {dropdownOpen && (
                      <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                        {userOptions.length === 0 ? (
                           <div className="p-3 text-sm text-slate-400 text-center">No users found.</div>
                        ) : (
                          <div className="flex flex-col py-1">
                            {userOptions.map(u => {
                              const selected = selectedUsers.includes(u.name);
                              return (
                                <div 
                                  key={u.id}
                                  onClick={() => toggleUser(u.name)}
                                  className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${selected ? 'bg-sky-50' : 'hover:bg-slate-50'}`}
                                >
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selected ? 'bg-sky-500 border-sky-500 text-white' : 'border-slate-300 bg-white'}`}>
                                    {selected ? <Check className="w-3 h-3" /> : null}
                                  </div>
                                  <span className={`text-sm ${selected ? 'font-bold text-sky-900' : 'text-slate-700'}`}>{u.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Status</label>
                  <select 
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium text-slate-800"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Ongoing">Ongoing</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Details</label>
                <textarea 
                  rows={2}
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  placeholder="Any additional details or instructions..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium text-slate-800 resize-none"
                />
              </div>
              </div>

              <div className="flex flex-col">
                <div className="border border-slate-200 rounded-2xl overflow-hidden h-full flex flex-col">
                <div className="bg-slate-100/50 px-5 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-sm font-bold text-slate-700">Data Source</div>
                  <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
                    {["Mismatch (DB)", "Custom Data"].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setDataSource(opt)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                          dataSource === opt
                            ? "bg-slate-900 text-white shadow"
                            : "text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {dataSource === "Mismatch (DB)" ? (
                  <div className="p-5 flex flex-col gap-4 bg-slate-50/30">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Period</label>
                        <div className="relative">
                          <div
                            onClick={() => setPeriodDropdownOpen(o => !o)}
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:border-sky-300 transition-all font-medium text-slate-800 min-h-[38px]"
                          >
                            <span className="truncate pr-2 text-sm">
                              {periodIds.length === 0
                                ? <span className="text-slate-400">Select period(s)</span>
                                : periodIds.length === 1
                                  ? periodIds[0]
                                  : `${periodIds.length} periods selected`}
                            </span>
                            <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          </div>
                          {periodDropdownOpen && (
                            <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                              {reconPeriods.length === 0 ? (
                                <div className="p-3 text-sm text-slate-400 text-center">No locked periods available</div>
                              ) : (
                                <div className="flex flex-col py-1">
                                  {reconPeriods.map(p => {
                                    const selected = periodIds.includes(p.id);
                                    return (
                                      <div
                                        key={p.id}
                                        onClick={() => {
                                          setPeriodIds(prev =>
                                            selected ? prev.filter(x => x !== p.id) : [...prev, p.id]
                                          );
                                        }}
                                        className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${selected ? 'bg-sky-50' : 'hover:bg-slate-50'}`}
                                      >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selected ? 'bg-sky-500 border-sky-500 text-white' : 'border-slate-300 bg-white'}`}>
                                          {selected ? <Check className="w-3 h-3" /> : null}
                                        </div>
                                        <span className={`text-sm ${selected ? 'font-bold text-sky-900' : 'text-slate-700'}`}>
                                          {p.id} ({p.month_name})
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Report Status</label>
                        <div className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium flex items-center">
                          <span className="w-2 h-2 rounded-full bg-rose-500 mr-2"></span> Mismatch
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Report Type</label>
                      <select 
                        value={reportType}
                        onChange={e => setReportType(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium text-slate-800"
                      >
                        {mismatchReportTypes.map(rt => (
                          <option key={rt} value={rt}>{rt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 text-center bg-slate-50/30">
                    <p className="text-sm text-slate-400 italic">No additional configuration required for custom data source.</p>
                  </div>
                )}
              </div>
              </div>
              </div>
              
              <div className="flex items-center justify-end gap-3 p-4 bg-slate-50 border-t border-slate-100 flex-shrink-0">
                 <button 
                   type="button" 
                   onClick={() => setCreateModalOpen(false)}
                   className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                 >
                   Cancel
                 </button>
                 <button 
                   type="submit" 
                   disabled={creating}
                   className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold rounded-lg shadow-sm disabled:opacity-50 transition-colors flex items-center gap-2"
                 >
                   {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                   {editingTaskId ? "Save Changes" : "Create & Sync"}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

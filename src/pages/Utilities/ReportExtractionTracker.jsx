import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Eye,
  EyeOff,
  Info,
  Loader2,
  PauseCircle,
  Pencil,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from "lucide-react";

import { supabase } from "../../supabaseClient";
import { usePermissions } from "../../hooks/usePermissions";
import { useUser } from "../../context/UserContext";

const CELLS_TABLE = "recon_cells";
const TRACKER_TABLE = "report_extraction_tracker";
const DISTRIBUTOR_TABLE = "master_distributors";
const PROFILE_TABLE = "profiles";
const USER_ROLE_TABLE = "user_roles";
const ROWS_PER_PAGE = 12;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const TRACKER_STATUS_OPTIONS = ["Pending", "Complete", "Offline", "On Hold"];
const TRACKER_FILTER_OPTIONS = ["Unassigned", ...TRACKER_STATUS_OPTIONS];

function safeStr(value) {
  return String(value ?? "").trim();
}

function lookupKey(value) {
  return safeStr(value).toUpperCase();
}

function hasValue(value) {
  return safeStr(value) !== "";
}

function maskSecret(value) {
  const text = safeStr(value);
  if (!text) return "-";
  if (text.length <= 4) return "*".repeat(text.length);
  return `${text.slice(0, 2)}${"*".repeat(Math.max(4, text.length - 4))}${text.slice(-2)}`;
}

function monthName(monthNum) {
  return MONTHS[Number(monthNum) - 1] || safeStr(monthNum);
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDefaultPeriod() {
  const today = new Date();
  const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return { year: previousMonth.getFullYear(), monthNum: previousMonth.getMonth() + 1 };
}

function getPeriodYear(row) {
  const value = Number(row?.year);
  if (Number.isFinite(value) && value > 0) return String(value);
  return safeStr(row?.period_id).split("-")[0] || "";
}

function getPeriodMonthNumber(row) {
  const value = Number(row?.month);
  if (Number.isFinite(value) && value >= 1 && value <= 12) return value;
  const part = Number(safeStr(row?.period_id).split("-")[1]);
  return Number.isFinite(part) && part >= 1 && part <= 12 ? part : 0;
}

function getUniqueRows(rows = []) {
  const seen = new Map();
  rows.forEach((row) => {
    const id = safeStr(row?.id);
    if (!id || seen.has(id)) return;
    seen.set(id, row);
  });
  return Array.from(seen.values());
}

function matchesAnyName(value, candidates = []) {
  const left = safeStr(value).toLowerCase();
  if (!left) return false;
  return candidates.some((candidate) => left === safeStr(candidate).toLowerCase());
}

function mapMismatchCell(row) {
  const periodYear = getPeriodYear(row);
  const periodMonthNumber = getPeriodMonthNumber(row);

  return {
    id: safeStr(row?.id),
    periodId: safeStr(row?.period_id),
    periodYear,
    periodMonthNumber,
    periodMonthName: monthName(periodMonthNumber),
    businessCode: safeStr(row?.business_type),
    distributorCode: safeStr(row?.distributor_code),
    distributorName: safeStr(row?.distributor_name),
    reportType: safeStr(row?.report_type_name) || safeStr(row?.report_type_id),
    reconRemark: safeStr(row?.remark),
    reconUpdatedAt: row?.updated_at || null,
    reconCreatedAt: row?.created_at || null,
    reconUpdatedBy: safeStr(row?.updated_by),
  };
}

function mapTrackerRow(row) {
  return {
    id: safeStr(row?.id),
    tvid: safeStr(row?.tvid || row?.TVID),
    password: safeStr(row?.password),
    priority: safeStr(row?.priority) || "Medium",
    status: safeStr(row?.status),
    pic: safeStr(row?.pic),
    dueDate: row?.due_date || null,
    remark: safeStr(row?.remark),
    requestedBy: safeStr(row?.requested_by),
    requestedAt: row?.requested_at || null,
    createdAt: row?.created_at || null,
    createdBy: safeStr(row?.created_by),
    updatedAt: row?.updated_at || null,
    updatedBy: safeStr(row?.updated_by),
    assignedToUid: safeStr(row?.assigned_to_uid),
    assignedToName: safeStr(row?.assigned_to_name),
    assignedAt: row?.assigned_at || null,
    assignedByUid: safeStr(row?.assigned_by_uid),
    assignedByName: safeStr(row?.assigned_by_name),
    completedAt: row?.completed_at || null,
  };
}

function mapDistributorRow(row) {
  return {
    code: lookupKey(row?.code || row?.distributor_code),
    tvid: safeStr(row?.tvid || row?.TVID),
    password: safeStr(row?.password),
  };
}

function mapAssignableUser(profile, roleById) {
  const uid = safeStr(profile?.id);
  const role = safeStr(roleById[uid]).toLowerCase() || "viewer";
  const name =
    safeStr(profile?.display_name)
    || safeStr(profile?.name)
    || safeStr(profile?.username)
    || safeStr(profile?.email);

  return {
    id: uid,
    name,
    email: safeStr(profile?.email),
    username: safeStr(profile?.username),
    role,
  };
}

function getEffectiveTrackerStatus(row) {
  return row.isAssigned ? safeStr(row.trackerStatus) || "Pending" : "Unassigned";
}

function getStatusTone(status) {
  if (status === "Complete") return "emerald";
  if (status === "Offline") return "slate";
  if (status === "On Hold") return "rose";
  if (status === "Pending") return "amber";
  return "sky";
}

function buildTrackerPayload(row, overrides = {}) {
  const nowIso = overrides.updated_at || new Date().toISOString();
  return {
    id: row.trackerId || row.id,
    period_year: row.periodYear,
    period_month: row.periodMonthName,
    business_code: row.businessCode,
    report_type: row.reportType,
    distributor_code: row.distributorCode,
    distributor_name: row.distributorName,
    tvid: hasValue(row.snapshotTvid) ? row.snapshotTvid : row.tvid || null,
    password: hasValue(row.snapshotPassword) ? row.snapshotPassword : row.password || null,
    priority: row.priority || "Medium",
    status: row.trackerStatus || null,
    requested_by: row.requestedBy || row.reconUpdatedBy || "System Sync",
    requested_at: row.requestedAt || row.reconUpdatedAt || row.reconCreatedAt || nowIso,
    due_date: row.dueDate || null,
    completed_at: row.completedAt || null,
    remark: row.trackerRemark || row.reconRemark || "",
    created_at: row.createdAt || row.reconCreatedAt || nowIso,
    updated_at: row.trackerUpdatedAt || null,
    created_by: row.createdBy || row.reconUpdatedBy || "System Sync",
    updated_by: row.trackerUpdatedBy || null,
    pic: row.pic || null,
    assigned_to_uid: row.assignedToUid || null,
    assigned_to_name: row.assignedToName || null,
    assigned_at: row.assignedAt || null,
    assigned_by_uid: row.assignedByUid || null,
    assigned_by_name: row.assignedByName || null,
    ...overrides,
  };
}

export default function ReportExtractionTracker() {
  const { taskId } = useParams();
  const { user, loading: userLoading } = useUser();
  const { role, can, loading: permissionsLoading } = usePermissions();

  const currentUserId = safeStr(user?.uid || user?.id);
  const currentUserName = safeStr(user?.display_name || user?.name || user?.email);
  const currentUserEmail = safeStr(user?.email);
  const currentUserAliases = useMemo(
    () => [currentUserName, currentUserEmail].filter(Boolean),
    [currentUserName, currentUserEmail]
  );
  const isAdmin = role === "admin" || can("admin.*") || can("utilities.reportExtraction.assign");

  const defaultPeriod = useMemo(() => getDefaultPeriod(), []);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [statusSavingById, setStatusSavingById] = useState({});
  const [mismatchRows, setMismatchRows] = useState([]);
  const [trackerRows, setTrackerRows] = useState([]);
  const [distributorRows, setDistributorRows] = useState([]);
  const [assigneeOptions, setAssigneeOptions] = useState([]);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState([]);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState(String(defaultPeriod.year));
  const [monthFilter, setMonthFilter] = useState(String(defaultPeriod.monthNum));
  const [businessFilter, setBusinessFilter] = useState("All");
  const [trackerStatusFilter, setTrackerStatusFilter] = useState("All");
  const [showPasswords, setShowPasswords] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [listMode, setListMode] = useState("my");
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [remarkModalOpen, setRemarkModalOpen] = useState(false);
  const [activeRemarkRow, setActiveRemarkRow] = useState(null);
  const [draftRemark, setDraftRemark] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);

  const trackerById = useMemo(() => {
    const map = new Map();
    trackerRows.forEach((row) => {
      const parts = String(row.id || "").split('_');
      const cellId = parts.length > 1 ? parts.slice(1).join('_') : row.id;
      map.set(cellId, row);
    });
    return map;
  }, [trackerRows]);

  const distributorByCode = useMemo(() => {
    const map = new Map();
    distributorRows.forEach((row) => {
      map.set(row.code, row);
    });
    return map;
  }, [distributorRows]);

  const rows = useMemo(() => {
    return mismatchRows.map((cell) => {
      const tracker = trackerById.get(cell.id);
      const distributor = distributorByCode.get(lookupKey(cell.distributorCode));
      const snapshotTvid = safeStr(tracker?.tvid);
      const snapshotPassword = safeStr(tracker?.password);
      const liveTvid = safeStr(distributor?.tvid);
      const livePassword = safeStr(distributor?.password);
      const hasSnapshot = hasValue(snapshotTvid) || hasValue(snapshotPassword);
      const hasLive = hasValue(liveTvid) || hasValue(livePassword);
      const assignedToUid = safeStr(tracker?.assignedToUid);
      const assignedToName = safeStr(tracker?.assignedToName || tracker?.pic);
      const isAssigned = hasValue(assignedToUid) || hasValue(assignedToName);

      return {
        ...cell,
        trackerId: tracker?.id || cell.id,
        tvid: snapshotTvid || liveTvid || "",
        password: snapshotPassword || livePassword || "",
        snapshotTvid,
        snapshotPassword,
        credentialSource: hasSnapshot ? "Monthly Snapshot" : hasLive ? "Master Fallback" : "Missing",
        hasCredentialSnapshot: hasSnapshot,
        priority: tracker?.priority || "",
        trackerStatus: isAssigned ? safeStr(tracker?.status) || "Pending" : "",
        pic: assignedToName,
        dueDate: tracker?.dueDate || null,
        trackerRemark: tracker?.remark || "",
        requestedBy: tracker?.requestedBy || cell.reconUpdatedBy || "System Sync",
        requestedAt: tracker?.requestedAt || cell.reconUpdatedAt || cell.reconCreatedAt || null,
        createdAt: tracker?.createdAt || cell.reconCreatedAt || null,
        createdBy: tracker?.createdBy || cell.reconUpdatedBy || "System Sync",
        trackerUpdatedAt: isAssigned ? tracker?.updatedAt || null : null,
        trackerUpdatedBy: isAssigned ? tracker?.updatedBy || "" : "",
        assignedToUid,
        assignedToName,
        assignedAt: tracker?.assignedAt || null,
        assignedByUid: tracker?.assignedByUid || "",
        assignedByName: tracker?.assignedByName || "",
        completedAt: tracker?.completedAt || null,
        isAssigned,
      };
    });
  }, [mismatchRows, trackerById, distributorByCode]);

  const scopedRows = useMemo(() => {
    if (listMode === "all") {
      return rows;
    }

    return rows.filter((row) => {
      const isMineByUid = hasValue(row.assignedToUid) && row.assignedToUid === currentUserId;
      const isMineByName = !hasValue(row.assignedToUid) && matchesAnyName(row.assignedToName || row.pic, currentUserAliases);
      return isMineByUid || isMineByName;
    });
  }, [rows, listMode, currentUserId, currentUserAliases]);

  const yearOptions = useMemo(
    () => Array.from(new Set(scopedRows.map((row) => row.periodYear).filter(Boolean))).sort((a, b) => Number(b) - Number(a)),
    [scopedRows]
  );

  const businessOptions = useMemo(
    () => Array.from(new Set(scopedRows.map((row) => row.businessCode).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [scopedRows]
  );

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return scopedRows.filter((row) => {
      const effectiveStatus = getEffectiveTrackerStatus(row);
      const searchText = [
        row.periodYear,
        row.periodMonthName,
        row.businessCode,
        row.distributorCode,
        row.distributorName,
        row.reportType,
        row.tvid,
        row.password,
        row.pic,
        effectiveStatus,
        row.reconRemark,
        row.trackerRemark,
        row.assignedByName,
      ].join(" ").toLowerCase();

      return (yearFilter === "All" || row.periodYear === yearFilter)
        && (monthFilter === "All" || String(row.periodMonthNumber) === monthFilter)
        && (businessFilter === "All" || row.businessCode === businessFilter)
        && (trackerStatusFilter === "All" || effectiveStatus === trackerStatusFilter)
        && (!q || searchText.includes(q));
    });
  }, [scopedRows, yearFilter, monthFilter, businessFilter, trackerStatusFilter, search]);

  const stats = useMemo(() => ({
    total: filteredRows.length,
    unassigned: filteredRows.filter((row) => !row.isAssigned).length,
    pending: filteredRows.filter((row) => getEffectiveTrackerStatus(row) === "Pending").length,
    complete: filteredRows.filter((row) => getEffectiveTrackerStatus(row) === "Complete").length,
    offline: filteredRows.filter((row) => getEffectiveTrackerStatus(row) === "Offline").length,
    onHold: filteredRows.filter((row) => getEffectiveTrackerStatus(row) === "On Hold").length,
  }), [filteredRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredRows.slice(start, start + ROWS_PER_PAGE);
  }, [filteredRows, currentPage]);

  const visibleUnassignedRows = useMemo(
    () => filteredRows.filter((row) => !row.isAssigned),
    [filteredRows]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, yearFilter, monthFilter, businessFilter, trackerStatusFilter, listMode]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!assigneeOptions.length) {
      setSelectedAssigneeIds([]);
      return;
    }

    setSelectedAssigneeIds((previous) => {
      const validPrevious = previous.filter((id) => assigneeOptions.some((option) => option.id === id));
      if (validPrevious.length) return validPrevious;

      const preferred = assigneeOptions.filter((option) => option.role === "user").map((option) => option.id);
      return preferred.length ? preferred : assigneeOptions.map((option) => option.id);
    });
  }, [assigneeOptions]);

  async function loadAssignableUsers(assignedToList = "") {
    const [{ data: profiles, error: profileError }, { data: roles, error: roleError }] = await Promise.all([
      supabase.from(PROFILE_TABLE).select("id,display_name,email,username"),
      supabase.from(USER_ROLE_TABLE).select("id,role"),
    ]);

    if (profileError) throw profileError;
    if (roleError) throw roleError;

    const roleById = {};
    (roles || []).forEach((row) => {
      roleById[safeStr(row?.id)] = safeStr(row?.role);
    });

    const definedNames = assignedToList.split(",").map(String).map(s => s.trim().toLowerCase()).filter(Boolean);

    const options = (profiles || [])
      .map((profile) => mapAssignableUser(profile, roleById))
      .filter((option) => option.id && option.name && option.role !== "viewer")
      .filter((option) => {
        if (!definedNames.length) return true; // fallback to all if none explicitly assigned mapped
        const n = option.name.toLowerCase();
        const e = (option.email || "").toLowerCase();
        return definedNames.some(d => n.includes(d) || e.includes(d) || d.includes(n));
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    setAssigneeOptions(options);
  }

  async function loadTrackerRowsForCurrentUser() {
    const trackerRequests = [];

    if (currentUserId) {
      trackerRequests.push(
        supabase.from(TRACKER_TABLE).select("*").eq("task_list_id", taskId).eq("assigned_to_uid", currentUserId)
      );
    }

    currentUserAliases.forEach((alias) => {
      trackerRequests.push(
        supabase.from(TRACKER_TABLE).select("*").eq("task_list_id", taskId).eq("assigned_to_name", alias)
      );
      trackerRequests.push(
        supabase.from(TRACKER_TABLE).select("*").eq("task_list_id", taskId).eq("pic", alias)
      );
    });

    if (!trackerRequests.length) {
      return [];
    }

    const results = await Promise.all(trackerRequests);
    const merged = [];
    results.forEach(({ data, error }) => {
      if (error) throw error;
      merged.push(...(data || []));
    });

    return getUniqueRows(merged);
  }

  async function fetchData({ background = false } = {}) {
    if (userLoading || permissionsLoading) return;

    try {
      if (background) setRefreshing(true);
      else setLoading(true);

      const [
        { data: allTracker, error: trackerError },
        { data: distributors, error: distributorError },
        { data: taskListData, error: taskListError },
      ] = await Promise.all([
        supabase.from(TRACKER_TABLE).select("*").eq("task_list_id", taskId),
        supabase.from(DISTRIBUTOR_TABLE).select("code,tvid,password"),
        supabase.from("report_extraction_task_lists").select("assigned_to").eq("id", taskId).single(),
      ]);

      if (trackerError) throw trackerError;
      if (distributorError) throw distributorError;

      const trackerData = allTracker || [];
      const trackerIds = trackerData.map((row) => safeStr(row?.id)).filter(Boolean);
      const originalCellIds = trackerIds.map(id => {
        const parts = id.split('_');
        return parts.length > 1 ? parts.slice(1).join('_') : id;
      });

      let allCells = [];
      if (trackerIds.length > 0) {
        const { data, error } = await supabase
          .from(CELLS_TABLE)
          .select("id,period_id,year,month,business_type,distributor_code,distributor_name,report_type_id,report_type_name,status,remark,created_at,updated_at,updated_by")
          .eq("status", "mismatch")
          .in("id", originalCellIds)
          .order("year", { ascending: false })
          .order("month", { ascending: false });
          
        if (error) throw error;
        allCells = data || [];
      }

      setDistributorRows((distributors || []).map(mapDistributorRow));
      try {
        await loadAssignableUsers(taskListData?.assigned_to || "");
      } catch (err) {
        setAssigneeOptions([]);
      }

      setMismatchRows((allCells || []).map(mapMismatchCell));
      setTrackerRows((trackerData || []).map(mapTrackerRow));
    } catch (error) {
      console.error(error);
      toast.error(String(error?.message || error || "Failed to load report extraction data"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function assignVisibleRowsEqually() {
    if (!isAdmin) return;

    const assignees = assigneeOptions.filter((option) => selectedAssigneeIds.includes(option.id));
    if (!assignees.length) {
      toast.error("Select at least one assignee first.");
      return;
    }

    if (!visibleUnassignedRows.length) {
      toast.error("No unassigned rows are visible for the current filters.");
      return;
    }

    try {
      setAssigning(true);
      const timestamp = new Date().toISOString();
      const assignedByName = currentUserName || currentUserEmail || "Admin";

      const payload = visibleUnassignedRows.map((row, index) => {
        const assignee = assignees[index % assignees.length];
        return buildTrackerPayload(row, {
          task_list_id: taskId,
          status: "Pending",
          pic: assignee.name,
          assigned_to_uid: assignee.id,
          assigned_to_name: assignee.name,
          assigned_at: timestamp,
          assigned_by_uid: currentUserId || null,
          assigned_by_name: assignedByName,
          updated_at: timestamp,
          updated_by: assignedByName,
          completed_at: null,
        });
      });

      const { error } = await supabase.from(TRACKER_TABLE).upsert(payload, { onConflict: "id" });
      if (error) throw error;

      toast.success(`Assigned ${payload.length} row(s) equally to ${assignees.length} user(s).`);
      setAssignmentModalOpen(false);
      await fetchData({ background: true });
    } catch (error) {
      console.error(error);
      toast.error(String(error?.message || error || "Failed to assign rows"));
    } finally {
      setAssigning(false);
    }
  }

  async function updateRowStatus(row, nextStatus) {
    const isMineByUid = row.assignedToUid && row.assignedToUid === currentUserId;
    const isMineByName = !row.assignedToUid && matchesAnyName(row.assignedToName, currentUserAliases);
    if (!(isAdmin || isMineByUid || isMineByName)) {
      toast.error("You can only update rows assigned to you.");
      return;
    }

    try {
      setStatusSavingById((previous) => ({ ...previous, [row.id]: true }));
      const timestamp = new Date().toISOString();

      const payload = buildTrackerPayload(row, {
        task_list_id: taskId,
        status: nextStatus,
        updated_at: timestamp,
        updated_by: currentUserName || currentUserEmail || "System",
        completed_at: nextStatus === "Complete" ? timestamp : null,
      });

      const { error } = await supabase.from(TRACKER_TABLE).upsert(payload, { onConflict: "id" });
      if (error) throw error;

      toast.success(`Status updated to ${nextStatus}.`);
      await fetchData({ background: true });
    } catch (error) {
      console.error(error);
      toast.error(String(error?.message || error || "Failed to update status"));
    } finally {
      setStatusSavingById((previous) => {
        const next = { ...previous };
        delete next[row.id];
        return next;
      });
    }
  }

  function openRemarkModal(row) {
    const isMineByUid = row.assignedToUid && row.assignedToUid === currentUserId;
    const isMineByName = !row.assignedToUid && matchesAnyName(row.assignedToName, currentUserAliases);
    if (!(isAdmin || isMineByUid || isMineByName)) {
      toast.error("You can only update remarks for rows assigned to you.");
      return;
    }

    setActiveRemarkRow(row);
    setDraftRemark(row.reconRemark || "");
    setRemarkModalOpen(true);
  }

  async function saveRemark() {
    if (!activeRemarkRow) return;

    try {
      setSavingRemark(true);
      setStatusSavingById((previous) => ({ ...previous, [activeRemarkRow.id]: true }));
      const timestamp = new Date().toISOString();

      const { error } = await supabase
        .from(CELLS_TABLE)
        .update({
          remark: draftRemark,
          updated_at: timestamp,
          updated_by: currentUserName || currentUserEmail || "System"
        })
        .eq("id", activeRemarkRow.id);

      // Also ensure tracker remark is somewhat synced if needed, but the original code just updated CELLS_TABLE
      if (error) throw error;

      if (error) throw error;

      toast.success("Remark updated.");
      setRemarkModalOpen(false);
      setActiveRemarkRow(null);
      await fetchData({ background: true });
    } catch (error) {
      console.error(error);
      toast.error(String(error?.message || error || "Failed to update remark"));
    } finally {
      setStatusSavingById((previous) => {
        const next = { ...previous };
        delete next[activeRemarkRow.id];
        return next;
      });
      setSavingRemark(false);
    }
  }

  function toggleAssignee(userId) {
    setSelectedAssigneeIds((previous) => (
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId]
    ));
  }

  useEffect(() => {
    fetchData();

    const channel = supabase.channel("report_extraction_tracker_page")
      .on("postgres_changes", { event: "*", schema: "public", table: CELLS_TABLE }, () => fetchData({ background: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: TRACKER_TABLE }, () => fetchData({ background: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: DISTRIBUTOR_TABLE }, () => fetchData({ background: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: PROFILE_TABLE }, () => {
        if (isAdmin) fetchData({ background: true });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: USER_ROLE_TABLE }, () => {
        if (isAdmin) fetchData({ background: true });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, currentUserId, currentUserName, currentUserEmail, userLoading, permissionsLoading]);

  const defaultMonthLabel = monthName(defaultPeriod.monthNum);

  const progressRows = useMemo(() => {
    return scopedRows.filter((row) => {
      return (yearFilter === "All" || row.periodYear === yearFilter)
        && (monthFilter === "All" || String(row.periodMonthNumber) === monthFilter);
    });
  }, [scopedRows, yearFilter, monthFilter]);

  const progressStats = useMemo(() => {
    let total = 0, complete = 0, pending = 0, unassigned = 0;
    const assigneeMap = {};

    assigneeOptions.forEach((opt) => {
      assigneeMap[opt.name] = { total: 0, complete: 0, pending: 0 };
    });

    progressRows.forEach((row) => {
      total++;
      const isAssigned = row.isAssigned;
      const effectiveStatus = getEffectiveTrackerStatus(row);
      
      if (!isAssigned) {
        unassigned++;
      } else if (effectiveStatus === "Complete") {
        complete++;
      } else {
        pending++;
      }

      if (isAssigned) {
        const name = row.assignedToName || row.pic || "Unknown";
        if (!assigneeMap[name]) {
          assigneeMap[name] = { total: 0, complete: 0, pending: 0 };
        }
        assigneeMap[name].total++;
        if (effectiveStatus === "Complete") {
          assigneeMap[name].complete++;
        } else {
          assigneeMap[name].pending++;
        }
      }
    });

    const assigneeStats = Object.entries(assigneeMap)
      .map(([name, stats]) => ({
        name,
        total: stats.total,
        complete: stats.complete,
        pending: stats.pending,
        percent: stats.total > 0 ? Math.round((stats.complete / stats.total) * 100) : 0,
      }))
      .sort((a, b) => {
        // Sort by total assigned first, then name
        if (b.total !== a.total) return b.total - a.total;
        return a.name.localeCompare(b.name);
      });

    const overallPercent = total > 0 ? Math.round((complete / total) * 100) : 0;

    return { total, complete, pending, unassigned, overallPercent, assigneeStats };
  }, [progressRows, assigneeOptions]);

  return (
    <div className="w-full min-w-0 px-3 sm:px-5 pb-4 flex flex-col gap-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 mx-3 sm:mx-5 mt-5 p-4 sm:p-5 rounded-2xl shadow-xl shadow-slate-900/10">
        <div>
          <div className="flex items-center gap-3">
            <Link to="/utilities/report-extraction-tracker" className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2 text-emerald-400">
              <ClipboardList className="h-6 w-6" />
              <h1 className="text-xl font-black tracking-tight text-white m-0">Extraction Tracker</h1>
            </div>
          </div>
          <div className="text-[13px] text-slate-400 font-medium pl-10 mt-1">Manage distributor logins and file collection status.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-white/25 bg-white/10 p-1">
              <button
                className={`px-3 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                  listMode === "all" ? "bg-white text-sky-700 shadow" : "text-white hover:bg-white/15"
                }`}
                onClick={() => setListMode("all")}
              >
                All Tasks
              </button>
              <button
                className={`px-3 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                  listMode === "my" ? "bg-white text-sky-700 shadow" : "text-white hover:bg-white/15"
                }`}
                onClick={() => setListMode("my")}
              >
                My Tasks
              </button>
            </div>

            {isAdmin && (
              <button
                onClick={() => setAssignmentModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 px-3 sm:px-4 py-2 text-sm font-bold text-white shadow-sm transition-all shadow-indigo-900/20 whitespace-nowrap"
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Assignments</span>
              </button>
            )}
            <button
              onClick={() => setProgressModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 sm:px-4 py-2 text-sm font-bold text-white transition-all hover:bg-white/20 whitespace-nowrap"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPasswords((value) => !value)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/15 transition"
            >
              {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPasswords ? "Hide Secrets" : "Show Secrets"}
            </button>
            <button
              type="button"
              onClick={() => fetchData({ background: true })}
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/15"
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Visible Rows" value={stats.total} icon={<ClipboardList className="h-4 w-4 text-sky-600" />} tone="sky" />
        <StatCard label="Unassigned" value={stats.unassigned} icon={<Users className="h-4 w-4 text-slate-700" />} tone="slate" />
        <StatCard label="Pending" value={stats.pending} icon={<Clock3 className="h-4 w-4 text-amber-600" />} tone="amber" />
        <StatCard label="Complete" value={stats.complete} icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} tone="emerald" />
        <StatCard label="On Hold" value={stats.onHold} icon={<AlertTriangle className="h-4 w-4 text-rose-600" />} tone="rose" />
        <StatCard label="Offline" value={stats.offline} icon={<PauseCircle className="h-4 w-4 text-slate-700" />} tone="slate" />
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-2 sm:p-3 shadow-sm">
        <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center lg:gap-3">
          <div className="relative col-span-2 lg:col-span-1 lg:max-w-[240px] lg:flex-1">
            <Search className="absolute left-2.5 top-[9px] h-3.5 w-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={listMode === "all" ? "Search all records..." : "Search assigned tasks..."}
              className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-[11px] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </div>
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="w-full lg:w-auto rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100">
            <option value="All">All Years</option>
            {yearOptions.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="w-full lg:w-auto rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100">
            <option value="All">All Months</option>
            {MONTHS.map((label, index) => <option key={label} value={String(index + 1)}>{label}</option>)}
          </select>
          <select value={businessFilter} onChange={(e) => setBusinessFilter(e.target.value)} className="w-full lg:w-auto rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100">
            <option value="All">All Businesses</option>
            {businessOptions.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={trackerStatusFilter} onChange={(e) => setTrackerStatusFilter(e.target.value)} className="col-span-2 lg:col-span-1 w-full lg:w-auto rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100">
            <option value="All">All Statuses</option>
            {TRACKER_FILTER_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <div className="col-span-2 hidden text-right text-[11px] font-semibold text-slate-500 lg:block lg:flex-1">
            {filteredRows.length} result(s)
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-3 py-2.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold text-slate-800">
              {isAdmin
                ? (listMode === "all" ? "Mismatch List with Assignment Control" : "My Assigned Extraction List")
                : "Your Assigned Extraction List"}
            </div>
            <div className="text-xs text-slate-500">
              {filteredRows.length ? `${(currentPage - 1) * ROWS_PER_PAGE + 1}-${Math.min(currentPage * ROWS_PER_PAGE, filteredRows.length)} of ${filteredRows.length}` : "0 results"}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full">
            <thead className="bg-slate-50">
              <tr>
                <Th>Period</Th>
                <Th>Business / Report</Th>
                <Th>Distributor</Th>
                <Th>Access</Th>
                <Th>Recon Remark</Th>
                <Th>Assignment</Th>
                <Th>Status</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(loading || userLoading || permissionsLoading) ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading report extraction list...
                    </span>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">
                    {isAdmin
                      ? "No mismatches found for the selected filters."
                      : "No assigned report extraction rows found for the selected filters."}
                  </td>
                </tr>
              ) : paginatedRows.map((row) => {
                const effectiveStatus = getEffectiveTrackerStatus(row);
                const savingStatus = !!statusSavingById[row.id];
                const canUpdateByUid = row.assignedToUid && row.assignedToUid === currentUserId;
                const canUpdateByName = !row.assignedToUid && matchesAnyName(row.assignedToName, currentUserAliases);
                  const canUpdateRow = row.isAssigned && (isAdmin || canUpdateByUid || canUpdateByName);

                  return (
                    <tr key={row.id} className="align-top hover:bg-slate-50/80">
                      <Td>
                        <div className="font-semibold text-slate-800">{row.periodMonthName} {row.periodYear}</div>
                        <div className="text-[11px] text-slate-500">{row.periodId || "-"}</div>
                      </Td>
                      <Td>
                        <div className="font-semibold text-slate-800">{row.reportType}</div>
                        <div className="text-[11px] text-slate-500">{row.businessCode}</div>
                      </Td>
                      <Td>
                        <div className="font-semibold text-slate-800">{row.distributorCode}</div>
                        <div className="max-w-[180px] truncate text-[11px] text-slate-500">{row.distributorName}</div>
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-1 w-[160px]">
                          <div className="flex items-center gap-2 rounded-md bg-slate-50 ring-1 ring-inset ring-slate-100 px-1 py-0.5">
                            <div className="flex flex-col flex-1 px-1">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">TVID</span>
                              <span className="font-mono text-[10px] text-slate-700 truncate">{row.tvid || "-"}</span>
                            </div>
                            <div className="h-5 w-px bg-slate-200" />
                            <div className="flex flex-col flex-1 px-1">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">PWD</span>
                              <span className="font-mono text-[10px] text-slate-700 truncate">
                                {showPasswords ? (row.password || "-") : maskSecret(row.password)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <div className="max-w-[220px] group flex gap-2">
                           <div className="whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-600 flex-1">
                             {row.reconRemark || <span className="text-slate-400 italic">No remark</span>}
                           </div>
                           {canUpdateRow && (
                              <button 
                                type="button" 
                                onClick={() => openRemarkModal(row)} 
                                disabled={savingStatus}
                                className="shrink-0 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-sky-600 transition-all self-start pt-0.5 disabled:opacity-0"
                                title="Edit Remark"
                              >
                                 <Pencil className="h-3.5 w-3.5" />
                              </button>
                           )}
                        </div>
                      </Td>
                      <Td>
                        {row.isAssigned ? (
                          <div className="text-[11px] font-bold text-slate-800">{row.assignedToName || row.pic || "-"}</div>
                        ) : (
                          <div>
                            <Badge tone="slate">Unassigned</Badge>
                          </div>
                        )}
                      </Td>
                      <Td>
                        <div className="flex items-center w-max">
                          {canUpdateRow ? (
                            <select
                              value={effectiveStatus}
                              onChange={(event) => updateRowStatus(row, event.target.value)}
                              disabled={savingStatus}
                              className={`w-28 rounded-xl border px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                                effectiveStatus === "Complete" ? "bg-emerald-50 text-emerald-700 border-emerald-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" :
                                effectiveStatus === "Pending" ? "bg-amber-50 text-amber-700 border-amber-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100" :
                                "bg-slate-50 text-slate-700 border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                              }`}
                            >
                              {TRACKER_STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          ) : (
                            <Badge tone={getStatusTone(effectiveStatus)}>{effectiveStatus}</Badge>
                          )}
                        </div>
                      </Td>
                      <Td>
                        {savingStatus ? (
                          <div className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-600">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Sav...
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (row.trackerUpdatedAt) {
                                toast(
                                  <div className="flex flex-col gap-0.5">
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Update Details</div>
                                    <div className="text-sm font-bold text-slate-800">{row.trackerUpdatedBy || "Unknown User"}</div>
                                    <div className="text-xs text-sky-600 font-medium">{formatDateTime(row.trackerUpdatedAt)}</div>
                                  </div>,
                                  { duration: 4000, position: 'bottom-right' }
                                );
                              } else {
                                toast("No update details available.", { icon: 'ℹ️', position: 'bottom-right' });
                              }
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600 hover:shadow-sm transition-all"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        )}
                      </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredRows.length > ROWS_PER_PAGE ? (
          <div className="flex flex-col gap-3 border-t border-gray-100 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-slate-500">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                    currentPage === page
                      ? "bg-sky-600 text-white shadow-sm shadow-sky-200"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {isAdmin && assignmentModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <div className="text-lg font-black tracking-tight text-slate-900">Equal Assignment</div>
                <p className="mt-1 text-sm text-slate-500">
                  Round-robin assignment for the currently visible unassigned rows in your active filters.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignmentModalOpen(false)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-slate-100 px-5 py-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                  <ClipboardList className="h-3.5 w-3.5" />
                  {visibleUnassignedRows.length} visible unassigned row(s)
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                  <Users className="h-3.5 w-3.5" />
                  {selectedAssigneeIds.length} selected assignee(s)
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                  Scope: {listMode === "all" ? "Full list" : "My list"}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {assigneeOptions.map((option) => {
                  const active = selectedAssigneeIds.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleAssignee(option.id)}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-sky-300 bg-sky-50 shadow-sm shadow-sky-100"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{option.name}</div>
                          <div className="truncate text-xs text-slate-500">{option.email || option.username || option.id}</div>
                        </div>
                        <Badge tone={option.role === "admin" ? "rose" : "sky"}>{option.role}</Badge>
                      </div>
                    </button>
                  );
                })}
                {!assigneeOptions.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    No assignable users found in `profiles` + `user_roles`.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-500">
                Visible rows are assigned evenly in sequence across the selected users.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAssignmentModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={assignVisibleRowsEqually}
                  disabled={assigning || !selectedAssigneeIds.length || !visibleUnassignedRows.length}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-white shadow-sm shadow-sky-200 hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                  Assign Visible Rows
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {progressModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-slate-900/60">
          <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-[24px] bg-slate-50 shadow-2xl ring-1 ring-white/20">
            <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-5 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 border border-sky-400/30">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-white">Performance Analytics</h2>
                  <p className="text-xs text-slate-400">
                    Period Scope: <span className="font-semibold text-slate-200">{monthFilter === "All" ? "All Months" : monthName(monthFilter)} {yearFilter === "All" ? "All Years" : yearFilter}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProgressModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 pb-10">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
                 <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                   <div className="absolute -right-4 -top-4 opacity-5">
                      <ClipboardList className="h-24 w-24" />
                   </div>
                   <div className="flex items-center gap-2 text-slate-500 mb-2">
                      <ClipboardList className="h-4 w-4" />
                      <div className="text-[10px] font-bold uppercase tracking-wider">Assigned Workload</div>
                   </div>
                   <div className="text-3xl font-black text-slate-800">{progressStats.total - progressStats.unassigned}</div>
                 </div>
                 
                 <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 shadow-md shadow-emerald-200 ring-1 ring-emerald-600 text-white">
                   <div className="absolute -right-4 -top-4 opacity-10">
                      <CheckCircle2 className="h-24 w-24" />
                   </div>
                   <div className="flex items-center gap-2 text-emerald-100 mb-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <div className="text-[10px] font-bold uppercase tracking-wider">Fulfilled</div>
                   </div>
                   <div className="text-3xl font-black">{progressStats.complete}</div>
                 </div>

                 <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                   <div className="absolute -right-4 -top-4 opacity-[0.03]">
                      <Clock3 className="h-24 w-24" />
                   </div>
                   <div className="flex items-center gap-2 text-amber-600 mb-2">
                      <Clock3 className="h-4 w-4" />
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">In Progress / Pending</div>
                   </div>
                   <div className="text-3xl font-black text-slate-800">{progressStats.pending}</div>
                 </div>

                 <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                   <div className="absolute -right-4 -top-4 opacity-[0.03]">
                      <Users className="h-24 w-24" />
                   </div>
                   <div className="flex items-center gap-2 text-slate-400 mb-2">
                      <Users className="h-4 w-4" />
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Unassigned Backlog</div>
                   </div>
                   <div className="text-3xl font-black text-slate-800">{progressStats.unassigned}</div>
                 </div>
              </div>

              <div className="mb-8">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Overall Assigned Completion</h3>
                  <div className="text-xl font-black text-sky-600">
                    {progressStats.total - progressStats.unassigned > 0 ? Math.round((progressStats.complete / (progressStats.total - progressStats.unassigned)) * 100) : 0}%
                  </div>
                </div>
                <div className="relative h-6 w-full overflow-hidden rounded-full bg-slate-200/60 shadow-inner">
                  <div 
                    className="absolute bottom-0 left-0 top-0 bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-1000 ease-out flex items-center justify-end px-3" 
                    style={{ width: `${progressStats.total - progressStats.unassigned > 0 ? Math.round((progressStats.complete / (progressStats.total - progressStats.unassigned)) * 100) : 0}%` }} 
                  >
                     <div className="h-1.5 w-1.5 rounded-full bg-white/50 animate-pulse" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide mb-4">Assignee Performance Breakdown</h3>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {(() => {
                    const meStat = progressStats.assigneeStats.find((s) => matchesAnyName(s.name, currentUserAliases)) || {
                      name: currentUserName || "Current User",
                      total: 0,
                      complete: 0,
                      pending: 0,
                      percent: 0,
                    };
                    const otherStats = progressStats.assigneeStats.filter((s) => !matchesAnyName(s.name, currentUserAliases) && s.total > 0);

                    return (
                      <>
                        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all">
                           <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                             <div className="flex items-center gap-3">
                               <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-bold uppercase">
                                  {meStat.name.charAt(0)}
                               </div>
                               <div>
                                 <div className="text-sm font-bold text-slate-900">{meStat.name} <span className="ml-1 text-[9px] font-bold tracking-wider text-sky-600 uppercase bg-sky-50 px-1.5 py-0.5 rounded">You</span></div>
                                 <div className="text-[11px] font-medium text-slate-500">{meStat.total} assigned tasks</div>
                               </div>
                             </div>
                             <div className="flex flex-col items-end">
                                <div className="text-sm font-black text-slate-800">{meStat.percent}%</div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Done</div>
                             </div>
                           </div>
                           
                           <div className="flex items-center gap-4 py-1">
                              <div className="flex-1">
                                 <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                   <div 
                                     className="absolute bottom-0 left-0 top-0 bg-emerald-500 transition-all duration-1000" 
                                     style={{ width: `${meStat.percent}%` }} 
                                   />
                                 </div>
                              </div>
                              <div className="flex items-center gap-3 text-xs font-bold text-slate-700">
                                 <div className="flex items-center gap-1.5">
                                   <span className="block h-2 w-2 rounded-full bg-emerald-500"></span>
                                   {meStat.complete}
                                 </div>
                                 <div className="flex items-center gap-1.5">
                                   <span className="block h-2 w-2 rounded-full bg-amber-400"></span>
                                   {meStat.pending}
                                 </div>
                              </div>
                           </div>
                        </div>

                        {otherStats.length > 0 ? (
                          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-4 border-b border-slate-100 pb-2">Other Team Members ({otherStats.length})</div>
                            <div className="flex flex-col gap-4 overflow-y-auto max-h-[140px] pr-2">
                              {otherStats.map((assignee) => (
                                 <div key={assignee.name} className="flex items-center justify-between gap-4">
                                    <div className="w-[120px]">
                                      <div className="truncate text-[11px] font-bold text-slate-800">{assignee.name}</div>
                                      <div className="text-[9px] text-slate-400">{assignee.total} assigned</div>
                                    </div>
                                    <div className="flex-1">
                                       <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                         <div 
                                           className="absolute bottom-0 left-0 top-0 bg-emerald-500 transition-all duration-1000" 
                                           style={{ width: `${assignee.percent}%` }} 
                                         />
                                       </div>
                                    </div>
                                    <div className="w-10 shrink-0 text-right text-[10px] font-black text-slate-700">
                                      {assignee.percent}%
                                    </div>
                                 </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center flex flex-col items-center justify-center bg-slate-50/50">
                            <div className="text-[11px] font-bold text-slate-500">No Other Assignees</div>
                            <div className="mt-1 text-[10px] text-slate-400">Rest of the team has no tasks.</div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {remarkModalOpen && activeRemarkRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-all">
          <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight text-slate-800">Edit Recon Remark</h3>
                  <p className="text-xs text-slate-500">Update remark for {activeRemarkRow.businessCode}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRemarkModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Remark Text
              </label>
              <textarea
                value={draftRemark}
                onChange={(e) => setDraftRemark(e.target.value)}
                placeholder="Enter your observation, recon details or any status notes here..."
                className="h-32 w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-700 outline-none focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 transition-all"
              />
            </div>
            
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4">
              <button
                type="button"
                onClick={() => setRemarkModalOpen(false)}
                className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveRemark}
                disabled={savingRemark}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-sky-500 disabled:opacity-50 transition"
              >
                {savingRemark ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Remark"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, icon, tone }) {
  const tones = {
    amber: "border-amber-100 bg-amber-50",
    sky: "border-sky-100 bg-sky-50",
    emerald: "border-emerald-100 bg-emerald-50",
    rose: "border-rose-100 bg-rose-50",
    slate: "border-slate-100 bg-slate-50",
  };

  return (
    <div className={`rounded-2xl border px-3.5 py-3 shadow-sm ${tones[tone] || "border-slate-100 bg-white"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</div>
          <div className="mt-1 text-xl font-black tracking-tight text-slate-900">{value}</div>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 shadow-sm">{icon}</div>
      </div>
    </div>
  );
}

function Badge({ children, tone = "slate" }) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    slate: "border-slate-200 bg-slate-100 text-slate-600",
  };

  return (
    <span className={`inline-flex w-fit rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Th({ children }) {
  return <th className="px-2.5 py-2 text-left text-[9px] font-extrabold uppercase tracking-[0.16em] text-slate-500">{children}</th>;
}

function Td({ children }) {
  return <td className="px-2.5 py-2 text-[11px] text-slate-700">{children}</td>;
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileSpreadsheet,
  Info,
  Loader2,
  Paperclip,
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
const TRACKER_STATUS_OPTIONS = ["Pending", "Offline", "On Hold", "Complete"];
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

function sanitizeFileToken(value, fallback) {
  const token = safeStr(value)
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return token || fallback;
}

function getExcelExtension(file) {
  const name = safeStr(file?.name);
  const lastDotIndex = name.lastIndexOf(".");
  const rawExtension = lastDotIndex >= 0 ? name.slice(lastDotIndex + 1).toLowerCase() : "";
  if (rawExtension === "xls" || rawExtension === "xlsx") return `.${rawExtension}`;
  if (file?.type === "application/vnd.ms-excel") return ".xls";
  return ".xlsx";
}

function buildUploadFileName(row, file) {
  const periodValue = safeStr(row?.periodId) || `${safeStr(row?.periodYear)}_${String(row?.periodMonthNumber || "").padStart(2, "0")}`;
  const parts = [
    sanitizeFileToken(row?.businessCode, "Business"),
    sanitizeFileToken(row?.reportType, "ReportType"),
    sanitizeFileToken(row?.distributorCode, "DistributorCode"),
    sanitizeFileToken(periodValue, "Period"),
  ];
  return `${parts.join("_")}${getExcelExtension(file)}`;
}

function isAllowedExcelFile(file) {
  if (!file) return false;
  const allowedTypes = [
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];
  const ext = safeStr(file.name).split(".").pop().toLowerCase();
  return allowedTypes.includes(file.type) || ["xls", "xlsx"].includes(ext);
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
    remarkBy: safeStr(row?.remark_by),
    remarkAt: row?.remark_at || null,
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
    filePath: safeStr(row?.file_path),
    fileName: safeStr(row?.file_name),
    fileUploadedAt: row?.file_uploaded_at || null,
    fileUploadedBy: safeStr(row?.file_uploaded_by),
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
  if (!row.isAssigned) return "Unassigned";
  if (row.filePath) return "Complete"; // file upload always means Complete
  return safeStr(row.trackerStatus) || "Pending";
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
  const [taskListCreatedBy, setTaskListCreatedBy] = useState("");
  const isTaskCreator = useMemo(
    () => matchesAnyName(taskListCreatedBy, currentUserAliases),
    [taskListCreatedBy, currentUserAliases]
  );
  const canManageAssignments = isAdmin || isTaskCreator;

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
  const [yearFilter, setYearFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState("All");
  const [businessFilter, setBusinessFilter] = useState("All");
  const [trackerStatusFilter, setTrackerStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [listMode, setListMode] = useState("my");
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [remarkModalOpen, setRemarkModalOpen] = useState(false);
  const [activeRemarkRow, setActiveRemarkRow] = useState(null);
  const [draftRemark, setDraftRemark] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);
  const [uploadingById, setUploadingById] = useState({});
  const [uploadModalRow, setUploadModalRow] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [stagedFile, setStagedFile] = useState(null);
  const [dragOverRowId, setDragOverRowId] = useState(null);
  const fileInputRefs = useRef({});
  const dropZoneRef = useRef(null);
  const analyticsPreviousListModeRef = useRef("my");

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
        trackerRemarkBy: tracker?.remarkBy || "",
        trackerRemarkAt: tracker?.remarkAt || null,
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
        filePath: tracker?.filePath || "",
        fileName: tracker?.fileName || "",
        fileUploadedAt: tracker?.fileUploadedAt || null,
        fileUploadedBy: tracker?.fileUploadedBy || "",
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

  // statsRows excludes the status card filter so card numbers stay stable when a card is clicked
  const statsRows = useMemo(() => {
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
        && (!q || searchText.includes(q));
    });
  }, [scopedRows, yearFilter, monthFilter, businessFilter, search]);

  const stats = useMemo(() => ({
    total: statsRows.length,
    unassigned: statsRows.filter((row) => !row.isAssigned).length,
    pending: statsRows.filter((row) => getEffectiveTrackerStatus(row) === "Pending").length,
    complete: statsRows.filter((row) => getEffectiveTrackerStatus(row) === "Complete").length,
    offline: statsRows.filter((row) => getEffectiveTrackerStatus(row) === "Offline").length,
    onHold: statsRows.filter((row) => getEffectiveTrackerStatus(row) === "On Hold").length,
  }), [statsRows]);

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
        supabase.from("report_extraction_task_lists").select("assigned_to,created_by").eq("id", taskId).single(),
      ]);

      if (trackerError) throw trackerError;
      if (distributorError) throw distributorError;
      if (taskListError) throw taskListError;

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
      setTaskListCreatedBy(safeStr(taskListData?.created_by));
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
    if (!canManageAssignments) return;

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
    setDraftRemark(row.trackerRemark || ""); // seed from tracker remark, not recon_cells remark
    setRemarkModalOpen(true);
  }

  async function uploadFileForRow(row, file) {
    if (!isAllowedExcelFile(file)) {
      toast.error("Only .xls and .xlsx files are allowed.");
      return;
    }

    const isMineByUid = row.assignedToUid && row.assignedToUid === currentUserId;
    const isMineByName = !row.assignedToUid && matchesAnyName(row.assignedToName, currentUserAliases);
    if (!(isAdmin || isMineByUid || isMineByName)) {
      toast.error("You can only upload files for rows assigned to you.");
      return;
    }

    const generatedFileName = buildUploadFileName(row, file);
    const storagePath = `${taskId}/${row.id}/${generatedFileName}`;
    const uploadToastId = toast.loading("Uploading file...");

    try {
      setUploadingById(prev => ({ ...prev, [row.id]: true }));

      // Remove old file if exists
      if (row.filePath) {
        await supabase.storage.from("report-extractions").remove([row.filePath]);
      }

      const { error: uploadError } = await supabase.storage
        .from("report-extractions")
        .upload(storagePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const timestamp = new Date().toISOString();
      const uploader = currentUserName || currentUserEmail || "System";

      const { error: dbError } = await supabase
        .from(TRACKER_TABLE)
        .update({
          file_path: storagePath,
          file_name: generatedFileName,
          file_uploaded_at: timestamp,
          file_uploaded_by: uploader,
          status: "Complete",
          completed_at: timestamp,
          updated_at: timestamp,
          updated_by: uploader,
        })
        .eq("id", row.trackerId);  // Use composite tracker ID, not cell ID

      if (dbError) throw dbError;

      toast.success("File uploaded & marked Complete!", { id: uploadToastId });
      await fetchData({ background: true });
    } catch (err) {
      console.error(err);
      toast.error("Upload failed: " + (err.message || String(err)), { id: uploadToastId });
    } finally {
      setUploadingById(prev => { const n = { ...prev }; delete n[row.id]; return n; });
    }
  }

  async function handleInlineFilePick(row, file) {
    if (!file) return;
    setDragOverRowId(null);
    await uploadFileForRow(row, file);
  }

  async function handleInlineFileDrop(row, event) {
    event.preventDefault();
    setDragOverRowId(null);
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    await handleInlineFilePick(row, file);
  }

  async function downloadFileForRow(row) {
    if (!row.filePath) return;
    const { data, error } = await supabase.storage
      .from("report-extractions")
      .createSignedUrl(row.filePath, 60);
    if (error) { toast.error("Could not generate download link."); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function saveRemark() {
    if (!activeRemarkRow) return;

    try {
      setSavingRemark(true);
      setStatusSavingById((previous) => ({ ...previous, [activeRemarkRow.id]: true }));
      const timestamp = new Date().toISOString();
      const author = currentUserName || currentUserEmail || "System";

      // Save remark to the tracker table (not recon_cells)
      const { error } = await supabase
        .from(TRACKER_TABLE)
        .update({
          remark: draftRemark,
          remark_by: author,
          remark_at: timestamp,
          updated_at: timestamp,
          updated_by: author,
        })
        .eq("id", activeRemarkRow.trackerId);

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

  async function deleteFileForRow(row) {
    const isMineByUid = row.assignedToUid && row.assignedToUid === currentUserId;
    const isMineByName = !row.assignedToUid && matchesAnyName(row.assignedToName, currentUserAliases);
    if (!(isAdmin || isMineByUid || isMineByName)) {
      toast.error("You can only remove files for rows assigned to you.");
      return;
    }
    if (!window.confirm(`Remove file "${row.fileName}" and reset status to Pending?`)) return;

    const toastId = toast.loading("Removing file...");
    try {
      setUploadingById(prev => ({ ...prev, [row.id]: true }));

      if (row.filePath) {
        await supabase.storage.from("report-extractions").remove([row.filePath]);
      }

      const timestamp = new Date().toISOString();
      const { error } = await supabase
        .from(TRACKER_TABLE)
        .update({
          file_path: null,
          file_name: null,
          file_uploaded_at: null,
          file_uploaded_by: null,
          status: "Pending",
          completed_at: null,
          updated_at: timestamp,
          updated_by: currentUserName || currentUserEmail || "System",
        })
        .eq("id", row.trackerId);

      if (error) throw error;
      toast.success("File removed & status reset to Pending.", { id: toastId });
      await fetchData({ background: true });
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove file: " + (err.message || String(err)), { id: toastId });
    } finally {
      setUploadingById(prev => { const n = { ...prev }; delete n[row.id]; return n; });
    }
  }

  useEffect(() => {
    fetchData();

    const channel = supabase.channel("report_extraction_tracker_page")
      .on("postgres_changes", { event: "*", schema: "public", table: CELLS_TABLE }, () => fetchData({ background: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: TRACKER_TABLE }, () => fetchData({ background: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: DISTRIBUTOR_TABLE }, () => fetchData({ background: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: PROFILE_TABLE }, () => {
        if (canManageAssignments) fetchData({ background: true });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: USER_ROLE_TABLE }, () => {
        if (canManageAssignments) fetchData({ background: true });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageAssignments, currentUserId, currentUserName, currentUserEmail, userLoading, permissionsLoading]);

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

  function openProgressModal() {
    analyticsPreviousListModeRef.current = listMode;
    setListMode("all");
    setProgressModalOpen(true);
  }

  function closeProgressModal() {
    setProgressModalOpen(false);
    setListMode(analyticsPreviousListModeRef.current || "my");
  }

  return (
    <div className="w-full min-w-0 px-3 sm:px-5 pb-6 flex flex-col gap-4" style={{background: 'linear-gradient(135deg, #f0f4ff 0%, #f8faff 50%, #eef6ff 100%)', minHeight: '100vh'}}>
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mx-0 mt-4 p-5 sm:p-6 rounded-2xl shadow-2xl" style={{background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #0c4a6e 100%)'}}>
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute -top-10 -right-10 h-48 w-48 rounded-full opacity-20" style={{background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)'}} />
        <div className="pointer-events-none absolute -bottom-8 left-1/3 h-32 w-32 rounded-full opacity-10" style={{background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)'}} />
        <div>
          <div className="flex items-center gap-3">
            <Link to="/utilities/report-extraction-tracker" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-all">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{background: 'linear-gradient(135deg, #10b981, #059669)'}}>
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-white m-0 leading-none">Extraction Tracker</h1>
                <div className="text-[11px] text-slate-400 font-medium mt-0.5">Distributor login &amp; file collection</div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* My / All toggle */}
          <div className="inline-flex rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm p-1">
            <button
              className={`px-3 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                listMode === "my"
                  ? "bg-white/15 text-white shadow-md shadow-black/20 ring-1 ring-white/20"
                  : "text-slate-400 hover:text-white hover:bg-white/10"
              }`}
              onClick={() => setListMode("my")}
            >
              My Tasks
            </button>
            <button
              className={`px-3 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                listMode === "all"
                  ? "bg-white/15 text-white shadow-md shadow-black/20 ring-1 ring-white/20"
                  : "text-slate-400 hover:text-white hover:bg-white/10"
              }`}
              onClick={() => setListMode("all")}
            >
              All Tasks
            </button>
          </div>

          {canManageAssignments && (
            <button
              onClick={() => setAssignmentModalOpen(true)}
              className="flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2 text-sm font-bold text-white transition-all whitespace-nowrap hover:scale-105 active:scale-95"
              style={{background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 4px 15px rgba(99,102,241,0.4)'}}
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Assignments</span>
            </button>
          )}
          <button
            onClick={openProgressModal}
            className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/8 backdrop-blur-sm px-3 sm:px-4 py-2 text-sm font-bold text-white transition-all hover:bg-white/15 hover:scale-105 active:scale-95 whitespace-nowrap"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </button>
          <button
            type="button"
            onClick={() => fetchData({ background: true })}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/8 backdrop-blur-sm px-4 py-2 text-xs font-bold text-white hover:bg-white/15 transition-all hover:scale-105 active:scale-95"
          >
            <RefreshCcw className={`h-4 w-4 transition-transform ${refreshing ? "animate-spin" : "hover:rotate-180"}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard 
          label="Visible" 
          value={stats.total} 
          icon={<ClipboardList className="h-4 w-4" />} 
          tone="sky" 
          isActive={trackerStatusFilter === "All"}
          onClick={() => setTrackerStatusFilter("All")}
        />
        <StatCard 
          label="Unassigned" 
          value={stats.unassigned} 
          icon={<Users className="h-4 w-4" />} 
          tone="slate" 
          isActive={trackerStatusFilter === "Unassigned"}
          onClick={() => setTrackerStatusFilter("Unassigned")}
        />
        <StatCard 
          label="Pending" 
          value={stats.pending} 
          icon={<Clock3 className="h-4 w-4" />} 
          tone="amber" 
          isActive={trackerStatusFilter === "Pending"}
          onClick={() => setTrackerStatusFilter("Pending")}
        />
        <StatCard 
          label="Complete" 
          value={stats.complete} 
          icon={<CheckCircle2 className="h-4 w-4" />} 
          tone="emerald" 
          isActive={trackerStatusFilter === "Complete"}
          onClick={() => setTrackerStatusFilter("Complete")}
        />
        <StatCard 
          label="On Hold" 
          value={stats.onHold} 
          icon={<AlertTriangle className="h-4 w-4" />} 
          tone="rose" 
          isActive={trackerStatusFilter === "On Hold"}
          onClick={() => setTrackerStatusFilter("On Hold")}
        />
        <StatCard 
          label="Offline" 
          value={stats.offline} 
          icon={<PauseCircle className="h-4 w-4" />} 
          tone="violet" 
          isActive={trackerStatusFilter === "Offline"}
          onClick={() => setTrackerStatusFilter("Offline")}
        />
      </div>

      {/* ── Filter Bar ── */}
      <div className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur-md p-3 shadow-lg shadow-slate-200/60">
        <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center lg:gap-2.5">
          <div className="relative col-span-2 lg:col-span-1 lg:max-w-[260px] lg:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={listMode === "all" ? "Search all records..." : "Search my tasks..."}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-[11px] font-medium outline-none focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="w-full lg:w-auto rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all">
            <option value="All">All Years</option>
            {yearOptions.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="w-full lg:w-auto rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all">
            <option value="All">All Months</option>
            {MONTHS.map((label, index) => <option key={label} value={String(index + 1)}>{label}</option>)}
          </select>
          <select value={businessFilter} onChange={(e) => setBusinessFilter(e.target.value)} className="w-full lg:w-auto rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all">
            <option value="All">All Businesses</option>
            {businessOptions.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={trackerStatusFilter} onChange={(e) => setTrackerStatusFilter(e.target.value)} className="col-span-2 lg:col-span-1 w-full lg:w-auto rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all">
            <option value="All">All Statuses</option>
            {TRACKER_FILTER_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <div className="col-span-2 hidden text-right lg:block lg:flex-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1">
              <span className="text-[10px] font-black text-indigo-600">{filteredRows.length}</span>
              <span className="text-[10px] font-semibold text-indigo-400">results</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Table ── */}
      <div className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur-md shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3" style={{background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'}}>
          <div className="flex items-center gap-2.5">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <div className="text-sm font-bold text-white">
              {canManageAssignments
                ? (listMode === "all" ? "Full Mismatch List" : "My Assigned Extraction Tasks")
                : "Your Assigned Extraction Tasks"}
            </div>
          </div>
          <div className="text-[11px] font-semibold text-slate-400">
            {filteredRows.length ? `${(currentPage - 1) * ROWS_PER_PAGE + 1}–${Math.min(currentPage * ROWS_PER_PAGE, filteredRows.length)} of ${filteredRows.length}` : "0 results"}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full">
            <thead style={{background: 'linear-gradient(135deg, #1e293b, #0f172a)'}}>
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
            <tbody className="divide-y divide-slate-100/80">
              {(loading || userLoading || permissionsLoading) ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <span className="inline-flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                      <span className="text-sm font-medium text-slate-500">Loading extraction tasks...</span>
                    </span>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                        <ClipboardList className="h-8 w-8 text-slate-400" />
                      </div>
                      <div className="text-sm font-semibold text-slate-500">
                        {canManageAssignments ? "No mismatches match the active filters." : "No assigned extraction tasks found."}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : paginatedRows.map((row, rowIdx) => {
                const effectiveStatus = getEffectiveTrackerStatus(row);
                const savingStatus = !!statusSavingById[row.id];
                const canUpdateByUid = row.assignedToUid && row.assignedToUid === currentUserId;
                const canUpdateByName = !row.assignedToUid && matchesAnyName(row.assignedToName, currentUserAliases);
                const canUpdateRow = row.isAssigned && (isAdmin || canUpdateByUid || canUpdateByName);

                return (
                  <tr
                    key={row.id}
                    onDragOver={(event) => {
                      if (!canUpdateRow) return;
                      event.preventDefault();
                      setDragOverRowId(row.id);
                    }}
                    onDragLeave={(event) => {
                      if (!canUpdateRow) return;
                      if (event.currentTarget.contains(event.relatedTarget)) return;
                      setDragOverRowId((current) => (current === row.id ? null : current));
                    }}
                    onDrop={(event) => {
                      if (!canUpdateRow) return;
                      void handleInlineFileDrop(row, event);
                    }}
                    className={`align-top transition-all duration-150 ${
                      dragOverRowId === row.id
                        ? "bg-indigo-50 ring-1 ring-inset ring-indigo-200"
                        : rowIdx % 2 === 0 ? "bg-white hover:bg-slate-50/80" : "bg-slate-50/40 hover:bg-slate-50"
                    }`}
                  >
                      <Td>
                        <div className="font-bold text-slate-800 text-[12px]">{row.periodMonthName} {row.periodYear}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{row.periodId || "–"}</div>
                      </Td>
                      <Td>
                        <div className="font-bold text-slate-800 text-[12px]">{row.reportType}</div>
                        <div className="inline-flex items-center mt-0.5">
                          <span className="text-[10px] font-bold tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-px">{row.businessCode}</span>
                        </div>
                      </Td>
                      <Td>
                        <div className="font-bold text-slate-800 text-[12px]">{row.distributorCode}</div>
                        <div className="max-w-[180px] truncate text-[10px] text-slate-400 mt-0.5">{row.distributorName}</div>
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-1.5 w-[165px]">
                          <div className="flex items-stretch gap-0 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                            <button
                              type="button"
                              title="Click to copy TVID"
                              onClick={() => row.tvid && navigator.clipboard.writeText(row.tvid).then(() => toast.success("TVID copied!"))}
                              className="flex flex-col flex-1 px-2 py-1 text-left bg-white hover:bg-cyan-50 transition-colors cursor-pointer group/tvid border-r border-slate-200"
                            >
                              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 group-hover/tvid:text-cyan-500">TVID</span>
                              <span className="font-mono text-[10px] font-semibold text-slate-700 truncate group-hover/tvid:text-cyan-700">{row.tvid || "–"}</span>
                            </button>
                            <button
                              type="button"
                              title="Click to copy Password"
                              onClick={() => row.password && navigator.clipboard.writeText(row.password).then(() => toast.success("Password copied!"))}
                              className="flex flex-col flex-1 px-2 py-1 text-left bg-white hover:bg-violet-50 transition-colors cursor-pointer group/pwd"
                            >
                              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 group-hover/pwd:text-violet-500">PWD</span>
                              <span className="font-mono text-[10px] font-semibold text-slate-700 truncate group-hover/pwd:text-violet-700">{maskSecret(row.password)}</span>
                            </button>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <div className="w-[185px] max-w-[185px] group flex gap-2 overflow-hidden">
                          <div className="overflow-hidden text-[11px] leading-relaxed text-slate-600 flex-1" style={{display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'}} title={row.trackerRemark || row.reconRemark || ""}>
                            {row.trackerRemark ? (
                              <span className="text-slate-800 font-medium">{row.trackerRemark}</span>
                            ) : row.reconRemark ? (
                              <span className="text-slate-500 italic">{row.reconRemark}</span>
                            ) : (
                              <span className="text-slate-300 italic text-[10px]">No remark</span>
                            )}
                          </div>
                          {canUpdateRow && (
                            <button
                              type="button"
                              onClick={() => openRemarkModal(row)}
                              disabled={savingStatus}
                              className="shrink-0 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-indigo-500 transition-all self-start pt-0.5 disabled:opacity-0"
                              title="Edit Remark"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {row.trackerRemark && (
                          <div className="flex items-center gap-1 mt-1 text-[9px] font-bold text-slate-400">
                             <div className="h-1 w-1 rounded-full bg-slate-300" />
                             <span className="truncate">{row.trackerRemarkBy || "Unknown"}</span>
                             <span>•</span>
                             <span>{row.trackerRemarkAt ? formatDateTime(row.trackerRemarkAt) : "Recently"}</span>
                          </div>
                        )}
                      </Td>
                      <Td>
                        {row.isAssigned ? (
                          <div className="flex items-center gap-1.5">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-black text-white uppercase shadow-sm" style={{background: 'linear-gradient(135deg, #6366f1, #8b5cf6)'}}>
                              {(row.assignedToName || row.pic || "?").charAt(0)}
                            </div>
                            <div className="text-[11px] font-bold text-slate-700 truncate max-w-[110px]">{row.assignedToName || row.pic || "–"}</div>
                          </div>
                        ) : (
                          <Badge tone="slate">Unassigned</Badge>
                        )}
                      </Td>
                      <Td>
                        <div className="flex items-center w-max">
                          {canUpdateRow && effectiveStatus !== "Complete" ? (
                            <select
                              value={effectiveStatus}
                              onChange={(event) => updateRowStatus(row, event.target.value)}
                              disabled={savingStatus}
                              className={`w-28 rounded-xl border px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
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
                          <div className="flex items-center gap-1">
                            {/* Info button */}
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

                            {/* Upload / File button */}
                            {canUpdateRow && (
                              <>
                                {row.filePath ? (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      title={`Download: ${row.fileName}`}
                                      onClick={() => downloadFileForRow(row)}
                                      disabled={uploadingById[row.id]}
                                      className="inline-flex h-8 items-center gap-1 rounded-l-xl border border-emerald-200 bg-emerald-50 px-2 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition-all disabled:opacity-50"
                                    >
                                      <FileSpreadsheet className="h-3.5 w-3.5" />
                                      <span className="max-w-[60px] truncate">{row.fileName}</span>
                                    </button>
                                    <button
                                      type="button"
                                      title="Remove uploaded file"
                                      onClick={() => deleteFileForRow(row)}
                                      disabled={uploadingById[row.id]}
                                      className="inline-flex h-8 w-6 items-center justify-center rounded-r-xl border border-l-0 border-emerald-200 bg-emerald-50 text-emerald-400 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-500 transition-all disabled:opacity-50"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="inline-flex">
                                    <input
                                      ref={(element) => {
                                        if (element) fileInputRefs.current[row.id] = element;
                                        else delete fileInputRefs.current[row.id];
                                      }}
                                      type="file"
                                      accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                      className="hidden"
                                      onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        void handleInlineFilePick(row, file);
                                        event.target.value = "";
                                      }}
                                    />
                                    <button
                                      type="button"
                                      title="Click to upload .xls / .xlsx file"
                                      onClick={() => fileInputRefs.current[row.id]?.click()}
                                      disabled={uploadingById[row.id]}
                                      className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-500 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 hover:shadow-sm disabled:opacity-50"
                                    >
                                      {uploadingById[row.id]
                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        : <Paperclip className="h-4 w-4" />}
                                      <span>Attach</span>
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredRows.length > ROWS_PER_PAGE ? (
          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[11px] font-semibold text-slate-400">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40 transition-all"
              >
                ← Prev
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                    currentPage === page
                      ? "text-white shadow-md"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                  }`}
                  style={currentPage === page ? {background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 2px 8px rgba(99,102,241,0.35)'} : {}}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40 transition-all"
              >
                Next →
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Upload Modal ── */}
      {uploadModalRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-black text-slate-800">Upload Extraction File</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {uploadModalRow.distributorCode} — {uploadModalRow.reportType}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setUploadModalRow(null); setStagedFile(null); setDragOver(false); }}
                className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drop Zone */}
            <div className="p-6 flex flex-col gap-4">
              <div
                ref={dropZoneRef}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (!file) return;
                  const ext = file.name.split(".").pop().toLowerCase();
                  if (!['xls','xlsx'].includes(ext)) {
                    toast.error("Only .xls and .xlsx files are allowed.");
                    return;
                  }
                  setStagedFile(file);
                }}
                onClick={() => dropZoneRef.current?.querySelector('input')?.click()}
                className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 cursor-pointer transition-all ${
                  dragOver
                    ? "border-indigo-400 bg-indigo-50"
                    : stagedFile
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50"
                }`}
              >
                <input
                  type="file"
                  accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) setStagedFile(file);
                    e.target.value = "";
                  }}
                />
                {stagedFile ? (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
                      <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-emerald-800 break-all">{stagedFile.name}</div>
                      <div className="text-[11px] text-emerald-600 mt-0.5">{(stagedFile.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <div className="text-[11px] text-slate-400">Click or drop to replace</div>
                  </>
                ) : (
                  <>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors ${
                      dragOver ? "bg-indigo-100" : "bg-slate-100"
                    }`}>
                      <Paperclip className={`h-6 w-6 transition-colors ${
                        dragOver ? "text-indigo-500" : "text-slate-400"
                      }`} />
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-semibold text-slate-700">
                        {dragOver ? "Drop file here" : "Drag & drop or click to browse"}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">.xls and .xlsx files only</div>
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setUploadModalRow(null); setStagedFile(null); setDragOver(false); }}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!stagedFile || uploadingById[uploadModalRow?.id]}
                  onClick={async () => {
                    if (!stagedFile || !uploadModalRow) return;
                    await uploadFileForRow(uploadModalRow, stagedFile);
                    setUploadModalRow(null);
                    setStagedFile(null);
                    setDragOver(false);
                  }}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {uploadingById[uploadModalRow?.id] ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
                  ) : (
                    <><Paperclip className="h-4 w-4" /> Upload & Complete</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {canManageAssignments && assignmentModalOpen ? (
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
                onClick={closeProgressModal}
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
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Remark Text
                </label>
                {activeRemarkRow.trackerRemarkBy && (
                   <span className="text-[10px] font-medium text-slate-400">
                     Last edited by <span className="text-slate-600 font-bold">{activeRemarkRow.trackerRemarkBy}</span>
                   </span>
                )}
              </div>
              <textarea
                value={draftRemark}
                onChange={(e) => setDraftRemark(e.target.value)}
                placeholder="Enter your observation, recon details or any status notes here..."
                className="h-32 w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-700 outline-none focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 transition-all"
              />
              {activeRemarkRow.trackerRemarkAt && (
                <div className="mt-2 text-[10px] text-right text-slate-400">
                   Modified {formatDateTime(activeRemarkRow.trackerRemarkAt)}
                </div>
              )}
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

function StatCard({ label, value, icon, tone, isActive, onClick }) {
  const configs = {
    sky:     { grad: 'linear-gradient(135deg,#0ea5e9,#0284c7)', shadow: 'rgba(14,165,233,0.3)', bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1', ring: 'ring-sky-400' },
    amber:   { grad: 'linear-gradient(135deg,#f59e0b,#d97706)', shadow: 'rgba(245,158,11,0.3)',  bg: '#fffbeb', border: '#fde68a', text: '#92400e', ring: 'ring-amber-400' },
    emerald: { grad: 'linear-gradient(135deg,#10b981,#059669)', shadow: 'rgba(16,185,129,0.3)', bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', ring: 'ring-emerald-400' },
    rose:    { grad: 'linear-gradient(135deg,#f43f5e,#e11d48)', shadow: 'rgba(244,63,94,0.3)',  bg: '#fff1f2', border: '#fecdd3', text: '#9f1239', ring: 'ring-rose-400' },
    violet:  { grad: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', shadow: 'rgba(139,92,246,0.3)', bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6', ring: 'ring-violet-400' },
    slate:   { grad: 'linear-gradient(135deg,#64748b,#475569)', shadow: 'rgba(100,116,139,0.2)', bg: '#f8fafc', border: '#e2e8f0', text: '#334155', ring: 'ring-slate-400' },
  };
  const cfg = configs[tone] || configs.slate;

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl p-4 shadow-md transition-all cursor-pointer select-none ${
        isActive 
          ? `ring-2 ${cfg.ring} ring-offset-2 scale-[1.02] shadow-lg` 
          : "hover:scale-[1.02] hover:shadow-lg opacity-80 hover:opacity-100"
      }`}
      style={{ 
        background: cfg.bg, 
        border: `1px solid ${isActive ? 'transparent' : cfg.border}`, 
        boxShadow: isActive ? `0 8px 24px ${cfg.shadow}` : `0 4px 16px ${cfg.shadow}` 
      }}
    >
      <div className="pointer-events-none absolute -right-3 -top-3 h-20 w-20 rounded-full opacity-10" style={{ background: cfg.grad }} />
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: cfg.text, opacity: 0.7 }}>{label}</div>
          <div className="mt-1.5 text-2xl font-black tracking-tight" style={{ color: cfg.text }}>{value}</div>
        </div>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-md"
          style={{ background: cfg.grad, boxShadow: `0 4px 12px ${cfg.shadow}`, color: 'white' }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function Badge({ children, tone = "slate" }) {
  const configs = {
    amber:   { bg: 'linear-gradient(135deg,#fef3c7,#fde68a)', border: '#f59e0b', text: '#92400e', shadow: 'rgba(245,158,11,0.2)' },
    sky:     { bg: 'linear-gradient(135deg,#e0f2fe,#bae6fd)', border: '#0ea5e9', text: '#0369a1', shadow: 'rgba(14,165,233,0.2)' },
    emerald: { bg: 'linear-gradient(135deg,#d1fae5,#a7f3d0)', border: '#10b981', text: '#065f46', shadow: 'rgba(16,185,129,0.2)' },
    rose:    { bg: 'linear-gradient(135deg,#ffe4e6,#fecdd3)', border: '#f43f5e', text: '#9f1239', shadow: 'rgba(244,63,94,0.2)' },
    slate:   { bg: 'linear-gradient(135deg,#f1f5f9,#e2e8f0)', border: '#94a3b8', text: '#475569', shadow: 'rgba(100,116,139,0.1)' },
    violet:  { bg: 'linear-gradient(135deg,#ede9fe,#ddd6fe)', border: '#8b5cf6', text: '#5b21b6', shadow: 'rgba(139,92,246,0.2)' },
  };
  const cfg = configs[tone] || configs.slate;

  return (
    <span
      className="inline-flex w-fit rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text, boxShadow: `0 2px 6px ${cfg.shadow}` }}
    >
      {children}
    </span>
  );
}

function Th({ children }) {
  return (
    <th className="px-3 py-3 text-left text-[9px] font-extrabold uppercase tracking-[0.18em]" style={{ color: '#94a3b8' }}>
      {children}
    </th>
  );
}

function Td({ children }) {
  return <td className="px-3 py-2.5 text-[11px] text-slate-700">{children}</td>;
}

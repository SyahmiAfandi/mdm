import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const REFRESH_MS = 60000;

function safeText(value) {
  return String(value ?? "").trim();
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const localDate = new Date(`${value}T00:00:00`);
    return Number.isNaN(localDate.getTime()) ? null : localDate;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toTimestamp(value) {
  const date = toDate(value);
  return date ? date.getTime() : 0;
}

function formatShortDate(value) {
  const date = toDate(value);
  if (!date) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateRange(start, end) {
  const startLabel = formatShortDate(start);
  const endLabel = formatShortDate(end);
  if (startLabel === "-" && endLabel === "-") return "Dates not set";
  if (startLabel === "-") return `Ends ${endLabel}`;
  if (endLabel === "-") return `Starts ${startLabel}`;
  return `${startLabel} - ${endLabel}`;
}

function formatRelativeTime(value) {
  const date = toDate(value);
  if (!date) return "Recently";

  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (absMs < hour) return rtf.format(Math.round(diffMs / minute), "minute");
  if (absMs < day) return rtf.format(Math.round(diffMs / hour), "hour");
  return rtf.format(Math.round(diffMs / day), "day");
}

function getDayDiff(value) {
  const date = toDate(value);
  if (!date) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function splitAssignedNames(value) {
  return safeText(value)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function matchesAliases(value, aliases) {
  const candidate = safeText(value).toLowerCase();
  if (!candidate) return false;
  return aliases.some((alias) => candidate === alias.toLowerCase());
}

function matchesAssignedList(value, aliases) {
  const values = splitAssignedNames(value);
  if (!values.length) return false;
  return aliases.some((alias) => values.includes(alias.toLowerCase()));
}

function dedupeRows(rows = []) {
  const seen = new Set();
  return rows.filter((row) => {
    const id = safeText(row?.id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function compareNotifications(left, right) {
  if ((left.priority ?? 99) !== (right.priority ?? 99)) {
    return (left.priority ?? 99) - (right.priority ?? 99);
  }
  return (right.sortAt ?? 0) - (left.sortAt ?? 0);
}

function healthLabel(row) {
  const id = safeText(row?.id);
  if (id === "apiService") return "API service";
  if (id === "supabaseDb") return "Supabase DB";
  if (id === "googleSheets") return "Google Sheets";
  if (id === "email_tasks") return "Email tracker";
  if (safeText(row?.source)) return safeText(row.source);
  return id || "System";
}

async function fetchHealthNotifications() {
  const { data, error } = await supabase
    .from("health")
    .select("id,status,hint,checkedAt,updatedAtStr,source")
    .order("checkedAt", { ascending: false })
    .limit(8);

  if (error) throw error;

  return (data || [])
    .filter((row) => {
      const status = safeText(row?.status).toUpperCase();
      return status && status !== "UP" && status !== "UNKNOWN";
    })
    .slice(0, 3)
    .map((row) => {
      const status = safeText(row?.status).toUpperCase();
      const when = row?.checkedAt || row?.updatedAtStr;
      const isCritical = status === "DOWN" || status === "OFFLINE";

      return {
        id: `health:${safeText(row?.id)}:${status}:${safeText(row?.updatedAtStr || row?.checkedAt)}`,
        section: "Urgent",
        priority: isCritical ? 0 : 1,
        tone: isCritical ? "critical" : "warning",
        tag: "System",
        title: `${healthLabel(row)} is ${status}`,
        detail: safeText(row?.hint) || "The latest health check needs attention.",
        time: `Checked ${formatRelativeTime(when)}`,
        route: "/",
        sortAt: toTimestamp(when),
      };
    });
}

async function fetchPromoNotifications() {
  const { data, error } = await supabase
    .from("promo_periods")
    .select("period_id,promo_period,start_date,end_date,active,updated_at,created_at")
    .eq("active", true)
    .order("end_date", { ascending: true })
    .limit(8);

  if (error) throw error;

  return (data || [])
    .map((row) => {
      const daysLeft = getDayDiff(row?.end_date);
      if (daysLeft === null || daysLeft > 7) return null;

      const periodLabel = safeText(row?.promo_period) || safeText(row?.period_id) || "Promo period";
      const endTime = row?.end_date;
      const sortAt = toTimestamp(endTime || row?.updated_at || row?.created_at);

      if (daysLeft < 0) {
        return {
          id: `promo:${safeText(row?.period_id)}:overdue:${safeText(row?.updated_at || row?.end_date)}`,
          section: "Urgent",
          priority: 0,
          tone: "critical",
          tag: "Promotions",
          title: `${periodLabel} is overdue`,
          detail: `This active promo period ended on ${formatShortDate(row?.end_date)}. ${formatDateRange(row?.start_date, row?.end_date)}`,
          time: `Ended ${formatRelativeTime(endTime)}`,
          route: "/promotions/promo-period",
          sortAt,
        };
      }

      if (daysLeft === 0) {
        return {
          id: `promo:${safeText(row?.period_id)}:today:${safeText(row?.updated_at || row?.end_date)}`,
          section: "Urgent",
          priority: 1,
          tone: "warning",
          tag: "Promotions",
          title: `${periodLabel} ends today`,
          detail: formatDateRange(row?.start_date, row?.end_date),
          time: "Ends today",
          route: "/promotions/promo-period",
          sortAt,
        };
      }

      return {
        id: `promo:${safeText(row?.period_id)}:soon:${safeText(row?.updated_at || row?.end_date)}`,
        section: daysLeft <= 2 ? "Today" : "Earlier",
        priority: daysLeft <= 2 ? 2 : 3,
        tone: daysLeft <= 2 ? "warning" : "reminder",
        tag: "Promotions",
        title: `${periodLabel} ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
        detail: formatDateRange(row?.start_date, row?.end_date),
        time: `Ends ${formatRelativeTime(endTime)}`,
        route: "/promotions/promo-period",
        sortAt,
      };
    })
    .filter(Boolean)
    .slice(0, 3);
}

async function fetchExtractionTaskNotifications(aliases) {
  const { data, error } = await supabase
    .from("report_extraction_task_lists")
    .select("id,title,status,due_date,assigned_to,created_by,updated_at,created_at")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) throw error;

  return (data || [])
    .map((row) => {
      const status = safeText(row?.status).toLowerCase();
      const isAssigned = matchesAssignedList(row?.assigned_to, aliases);
      const isCreatedByMe = matchesAliases(row?.created_by, aliases);
      const dueInDays = getDayDiff(row?.due_date);
      const createdAt = row?.created_at;
      const updatedAt = row?.updated_at;
      const recentAt = updatedAt || createdAt;
      const isRecent = Math.abs(Date.now() - toTimestamp(recentAt)) <= 24 * 60 * 60 * 1000;

      if (!isAssigned && !isCreatedByMe) return null;
      if (status === "expired" || status === "completed") return null;

      const baseId = `tasklist:${safeText(row?.id)}:${status}:${safeText(row?.due_date)}:${safeText(recentAt)}`;
      const route = `/utilities/report-extraction-tracker/${safeText(row?.id)}`;
      const taskTitle = safeText(row?.title) || "Extraction task";
      const ownerLabel = isAssigned ? "Assigned to you" : "Created by you";

      if (dueInDays !== null && dueInDays < 0) {
        return {
          id: `${baseId}:overdue`,
          section: "Urgent",
          priority: 0,
          tone: "critical",
          tag: "Extraction",
          title: `${taskTitle} is overdue`,
          detail: `${ownerLabel}. Due ${formatShortDate(row?.due_date)}.`,
          time: `Due ${formatRelativeTime(row?.due_date)}`,
          route,
          sortAt: toTimestamp(row?.due_date),
        };
      }

      if (dueInDays !== null && dueInDays <= 2) {
        return {
          id: `${baseId}:due-soon`,
          section: dueInDays === 0 ? "Urgent" : "Today",
          priority: dueInDays === 0 ? 1 : 2,
          tone: dueInDays === 0 ? "warning" : "reminder",
          tag: "Extraction",
          title: dueInDays === 0 ? `${taskTitle} is due today` : `${taskTitle} is due in ${dueInDays} day${dueInDays === 1 ? "" : "s"}`,
          detail: `${ownerLabel}. Due ${formatShortDate(row?.due_date)}.`,
          time: `Due ${formatRelativeTime(row?.due_date)}`,
          route,
          sortAt: toTimestamp(row?.due_date),
        };
      }

      if (isAssigned && isRecent) {
        return {
          id: `${baseId}:assigned`,
          section: "Today",
          priority: 3,
          tone: "info",
          tag: "Extraction",
          title: "New extraction task assigned",
          detail: `${taskTitle}${row?.due_date ? ` is due ${formatShortDate(row?.due_date)}.` : " is now in your queue."}`,
          time: `Updated ${formatRelativeTime(recentAt)}`,
          route,
          sortAt: toTimestamp(recentAt),
        };
      }

      return null;
    })
    .filter(Boolean)
    .slice(0, 3);
}

async function fetchExtractionWorkloadNotifications(userIdentity, aliases) {
  const selectColumns = "id,task_list_id,status,due_date,updated_at,file_path,assigned_to_uid,assigned_to_name,pic,report_type,distributor_name";
  const requests = [];
  const userId = safeText(userIdentity?.id);
  const userEmail = safeText(userIdentity?.email);

  if (userId) {
    requests.push(
      supabase
        .from("report_extraction_tracker")
        .select(selectColumns)
        .eq("assigned_to_uid", userId)
    );
  }

  aliases.forEach((alias) => {
    requests.push(
      supabase
        .from("report_extraction_tracker")
        .select(selectColumns)
        .eq("assigned_to_name", alias)
    );
    requests.push(
      supabase
        .from("report_extraction_tracker")
        .select(selectColumns)
        .eq("pic", alias)
    );
  });

  if (!requests.length) return [];

  const settled = await Promise.all(requests);
  const merged = [];

  settled.forEach(({ data, error }) => {
    if (error) throw error;
    merged.push(...(data || []));
  });

  const pendingRows = dedupeRows(merged).filter((row) => {
    const status = safeText(row?.status).toLowerCase();
    return !safeText(row?.file_path) && status !== "complete";
  });

  if (!pendingRows.length) return [];

  const taskIds = Array.from(
    new Set(
      pendingRows
        .map((row) => safeText(row?.task_list_id))
        .filter(Boolean)
    )
  );

  const taskTitleById = {};
  const taskDueById = {};

  if (taskIds.length > 0) {
    const { data: taskRows, error } = await supabase
      .from("report_extraction_task_lists")
      .select("id,title,due_date")
      .in("id", taskIds);

    if (error) throw error;

    (taskRows || []).forEach((row) => {
      const id = safeText(row?.id);
      taskTitleById[id] = safeText(row?.title);
      taskDueById[id] = row?.due_date || null;
    });
  }

  const overdueCount = pendingRows.filter((row) => {
    const dueDate = row?.due_date || taskDueById[safeText(row?.task_list_id)];
    const daysLeft = getDayDiff(dueDate);
    return daysLeft !== null && daysLeft < 0;
  }).length;

  const dueSoonCount = pendingRows.filter((row) => {
    const dueDate = row?.due_date || taskDueById[safeText(row?.task_list_id)];
    const daysLeft = getDayDiff(dueDate);
    return daysLeft !== null && daysLeft >= 0 && daysLeft <= 2;
  }).length;

  const latestChange = pendingRows.reduce((latest, row) => {
    const current = toTimestamp(row?.updated_at || row?.due_date);
    return current > latest ? current : latest;
  }, 0);

  const singleTaskId = taskIds.length === 1 ? taskIds[0] : "";
  const singleTaskTitle = singleTaskId ? taskTitleById[singleTaskId] : "";
  const route = singleTaskId
    ? `/utilities/report-extraction-tracker/${singleTaskId}`
    : "/utilities/report-extraction-tracker";

  let detail = `Across ${taskIds.length} task list${taskIds.length === 1 ? "" : "s"}.`;
  if (singleTaskTitle) {
    detail = `${pendingRows.length} row(s) still need action in ${singleTaskTitle}.`;
  } else if (dueSoonCount > 0) {
    detail = `${detail} ${dueSoonCount} due soon.`;
  }

  return [
    {
      id: `tracker-workload:${safeText(userId || userEmail)}:${pendingRows.length}:${overdueCount}:${latestChange}`,
      section: overdueCount > 0 ? "Urgent" : "Today",
      priority: overdueCount > 0 ? 1 : 3,
      tone: overdueCount > 0 ? "warning" : "info",
      tag: "Extraction",
      title: overdueCount > 0
        ? `${overdueCount} extraction row${overdueCount === 1 ? "" : "s"} overdue`
        : `${pendingRows.length} extraction row${pendingRows.length === 1 ? "" : "s"} pending`,
      detail,
      time: latestChange ? `Updated ${formatRelativeTime(latestChange)}` : "Awaiting action",
      route,
      sortAt: latestChange || Date.now(),
    },
  ];
}

async function fetchEmailNotifications() {
  const [newRes, inProgressRes, latestRes] = await Promise.all([
    supabase.from("email_tasks").select("*", { count: "exact", head: true }).eq("status", "NEW"),
    supabase.from("email_tasks").select("*", { count: "exact", head: true }).eq("status", "IN_PROGRESS"),
    supabase
      .from("email_tasks")
      .select("id,updated_at,created_at,received_at")
      .in("status", ["NEW", "IN_PROGRESS"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (newRes.error) throw newRes.error;
  if (inProgressRes.error) throw inProgressRes.error;
  if (latestRes.error) throw latestRes.error;

  const newCount = newRes.count || 0;
  const inProgressCount = inProgressRes.count || 0;
  const openCount = newCount + inProgressCount;
  if (!openCount) return [];

  const latestAt =
    latestRes.data?.updated_at
    || latestRes.data?.received_at
    || latestRes.data?.created_at
    || null;

  return [
    {
      id: `email-open:${openCount}:${newCount}:${inProgressCount}:${safeText(latestAt)}`,
      section: newCount > 0 ? "Today" : "Earlier",
      priority: newCount > 0 ? 3 : 4,
      tone: newCount > 0 ? "info" : "reminder",
      tag: "Email",
      title: `${openCount} email task${openCount === 1 ? "" : "s"} open`,
      detail: `${newCount} new, ${inProgressCount} in progress in Email Tracker.`,
      time: latestAt ? `Updated ${formatRelativeTime(latestAt)}` : "Awaiting review",
      route: "/utilities/emailtracker",
      sortAt: toTimestamp(latestAt) || Date.now(),
    },
  ];
}

export default function useHeaderNotifications({
  user,
  enableUtilities = true,
  enableEmailTracker = true,
  enablePromotions = true,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState([]);
  const userId = safeText(user?.id || user?.uid);
  const userEmail = safeText(user?.email);
  const userDisplayName = safeText(user?.display_name || user?.displayName || user?.name);

  useEffect(() => {
    let alive = true;
    let refreshTimer = null;
    const aliases = Array.from(new Set([userDisplayName, userEmail].filter(Boolean)));

    async function loadNotifications({ background = false } = {}) {
      if (!background && alive) setLoading(true);

      const jobs = [
        { name: "health", run: fetchHealthNotifications },
      ];

      if (enablePromotions) {
        jobs.push({ name: "promo periods", run: fetchPromoNotifications });
      }

      if (enableUtilities && aliases.length > 0) {
        jobs.push({ name: "extraction tasks", run: () => fetchExtractionTaskNotifications(aliases) });
        jobs.push({
          name: "extraction workload",
          run: () => fetchExtractionWorkloadNotifications({ id: userId, email: userEmail }, aliases),
        });
      }

      if (enableEmailTracker) {
        jobs.push({ name: "email tracker", run: fetchEmailNotifications });
      }

      const results = await Promise.allSettled(jobs.map((job) => job.run()));
      if (!alive) return;

      const nextNotifications = [];
      const failures = [];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          nextNotifications.push(...(result.value || []));
        } else {
          failures.push(jobs[index].name);
          console.warn(`[header-notifications] Failed to load ${jobs[index].name}:`, result.reason);
        }
      });

      nextNotifications.sort(compareNotifications);
      setNotifications(nextNotifications.slice(0, 8));
      setError(failures.length > 0 ? `Some sources unavailable: ${failures.join(", ")}` : "");
      setLoading(false);
    }

    function queueRefresh() {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        loadNotifications({ background: true });
      }, 250);
    }

    loadNotifications();

    const channel = supabase
      .channel(`header-notifications-${safeText(userId || userEmail || "anon")}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "health" }, queueRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "promo_periods" }, queueRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "report_extraction_task_lists" }, queueRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "report_extraction_tracker" }, queueRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "email_tasks" }, queueRefresh)
      .subscribe();

    const interval = setInterval(() => {
      loadNotifications({ background: true });
    }, REFRESH_MS);

    return () => {
      alive = false;
      clearInterval(interval);
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [
    userId,
    userEmail,
    userDisplayName,
    enableUtilities,
    enableEmailTracker,
    enablePromotions,
  ]);

  return { loading, error, notifications };
}

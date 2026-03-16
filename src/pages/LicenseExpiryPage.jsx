import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Search } from "lucide-react";
import { supabase } from "../supabaseClient";
import { usePermissions } from "../hooks/usePermissions";

const OWNER_UID = import.meta.env.VITE_FIREBASE_OWNER_UID;
const USERS_PER_PAGE = 10;

function formatYMD(d) {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

function tsToDisplayDate(validUntilTs) {
  if (!validUntilTs) return "";
  const nextMidnight = new Date(validUntilTs);
  const inclusive = new Date(nextMidnight.getTime() - 24 * 60 * 60 * 1000);
  return formatYMD(inclusive);
}

function computeStatusFromDisplayDate(displayYYYYMMDD) {
  if (!displayYYYYMMDD) return "Expired";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(today.getDate() + 7);

  const lic = new Date(`${displayYYYYMMDD}T00:00:00`);
  if (lic > soon) return "Active";
  if (lic >= today && lic <= soon) return "Expiring Soon";
  return "Expired";
}

function getLicenseValidUntil(row) {
  return row?.valid_until ?? row?.validUntil ?? null;
}

function StatTile({ label, value, tone = "slate" }) {
  const tones = {
    slate: "from-slate-950 via-slate-900 to-slate-800 text-white",
    emerald: "from-emerald-500 to-teal-500 text-white",
    amber: "from-amber-300 to-orange-400 text-slate-950",
    rose: "from-rose-500 to-red-600 text-white",
  };

  return (
    <div className={`flex h-[58px] w-[108px] flex-col justify-between rounded-lg bg-gradient-to-br ${tones[tone]} px-3 py-2 shadow-sm`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80">{label}</div>
      <div className="mt-1 text-lg font-bold leading-none">{value}</div>
    </div>
  );
}

function RolePill({ role }) {
  const cls =
    role === "admin"
      ? "border-red-200 bg-red-50 text-red-700"
      : role === "user"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${cls}`}>
      {role}
    </span>
  );
}

function StatusPill({ status }) {
  const cls =
    status === "Expired"
      ? "border-red-200 bg-red-50 text-red-700"
      : status === "Expiring Soon"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

export default function LicenseExpiryPage() {
  const { can, role } = usePermissions();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  const canManageLicenses =
    can("admin.license") || role === "admin" || (!!OWNER_UID && me?.id === OWNER_UID);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setMe(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadLicenses({ silent = false } = {}) {
    if (!me) return;
    if (!canManageLicenses) {
      setLoading(false);
      return;
    }

    if (silent) setSyncing(true);
    else setLoading(true);

    try {
      const [profRes, roleRes, licRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
        supabase.from("licenses").select("*"),
      ]);

      if (profRes.error) throw profRes.error;

      const rolesMap = {};
      (roleRes.data || []).forEach((r) => {
        rolesMap[r.id] = r.role;
      });

      const licsMap = {};
      (licRes.data || []).forEach((l) => {
        licsMap[l.id] = getLicenseValidUntil(l);
      });

      const list = (profRes.data || []).map((p) => {
        const userRole = rolesMap[p.id] || "viewer";
        const displayDate = tsToDisplayDate(licsMap[p.id]);
        const status = computeStatusFromDisplayDate(displayDate);
        return {
          uid: p.id,
          name: p.display_name || p.name || "",
          username: p.username || "",
          email: p.email || "",
          role: userRole,
          licenseDate: displayDate,
          status,
        };
      });

      setRows(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadLicenses();
  }, [me, canManageLicenses]);

  const summary = useMemo(() => {
    const out = { total: rows.length, active: 0, soon: 0, expired: 0 };
    rows.forEach((row) => {
      if (row.status === "Active") out.active += 1;
      else if (row.status === "Expiring Soon") out.soon += 1;
      else out.expired += 1;
    });
    return out;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const arr = rows.filter((u) => {
      const matchesSearch =
        (u.name || "").toLowerCase().includes(q) ||
        (u.username || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter ? u.status === statusFilter : true;
      return matchesSearch && matchesStatus;
    });

    arr.sort((a, b) => {
      const av = (a[sortField] ?? "").toString().toLowerCase();
      const bv = (b[sortField] ?? "").toString().toLowerCase();
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    return arr;
  }, [rows, search, statusFilter, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / USERS_PER_PAGE));
  const pageStart = (currentPage - 1) * USERS_PER_PAGE;
  const pageUsers = filtered.slice(pageStart, pageStart + USERS_PER_PAGE);

  if (!loading && me && !canManageLicenses) {
    return (
      <div className="mx-auto max-w-5xl p-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">License Expiry</h2>
          <p className="mt-2 text-sm text-slate-600">
            You are signed in as <span className="font-medium">{me.email || me.id}</span>. You need{" "}
            <span className="font-medium">admin.license</span> or admin access to open this page.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 px-4 py-3.5 shadow-lg">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200/80">Settings</div>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-white">License Expiry Overview</h2>
            <p className="mt-0.5 text-xs text-slate-300">
              Monitor who is active, expiring soon, or already expired across the current user base.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatTile label="Total" value={summary.total} tone="slate" />
            <StatTile label="Active" value={summary.active} tone="emerald" />
            <StatTile label="Soon" value={summary.soon} tone="amber" />
            <StatTile label="Expired" value={summary.expired} tone="rose" />
            <button
              onClick={() => loadLicenses({ silent: true })}
              className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/10 p-2 text-white transition hover:bg-white/15"
              title="Sync"
              aria-label="Sync"
              disabled={syncing}
            >
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
            </button>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/85">Sync</span>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">License Directory</div>
              <div className="mt-0.5 text-xs text-slate-500">
                Showing <span className="font-semibold text-slate-900">{pageUsers.length}</span> of{" "}
                <span className="font-semibold text-slate-900">{filtered.length}</span> matching users
              </div>
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative w-full lg:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, email, username"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {["", "Active", "Expiring Soon", "Expired"].map((value) => {
                  const active = statusFilter === value;
                  const label = value || "all";
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setStatusFilter(value);
                        setCurrentPage(1);
                      }}
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize tracking-[0.08em] transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                          : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">Loading license data...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    {["name", "username", "email", "role", "licenseDate"].map((field) => (
                      <th
                        key={field}
                        className="cursor-pointer select-none px-4 py-3 text-left font-semibold"
                        onClick={() => {
                          if (sortField === field) setSortAsc((s) => !s);
                          else {
                            setSortField(field);
                            setSortAsc(true);
                          }
                        }}
                      >
                        <span className="inline-flex items-center gap-2">
                          {field === "licenseDate" ? "License" : field.charAt(0).toUpperCase() + field.slice(1)}
                          <span className="text-xs text-slate-400">
                            {sortField === field ? (sortAsc ? "↑" : "↓") : ""}
                          </span>
                        </span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {pageUsers.map((u) => (
                    <tr key={u.uid} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 align-top">
                        <div>
                          <div className="font-semibold text-slate-900">{u.name || "-"}</div>
                          <div className="mt-1 text-xs text-slate-500">{u.uid}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="font-mono text-slate-700">{u.username || "-"}</span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="text-slate-700">{u.email || "-"}</span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <RolePill role={u.role} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            u.licenseDate ? "bg-slate-100 text-slate-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {u.licenseDate || "No license"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <StatusPill status={u.status} />
                      </td>
                    </tr>
                  ))}

                  {!pageUsers.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <div className="mx-auto max-w-md">
                          <div className="text-base font-semibold text-slate-900">No users found</div>
                          <div className="mt-2 text-sm text-slate-500">
                            Try adjusting the search text or current status filter.
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-slate-500">
                Page <span className="font-semibold text-slate-900">{currentPage}</span> of{" "}
                <span className="font-semibold text-slate-900">{totalPages}</span>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

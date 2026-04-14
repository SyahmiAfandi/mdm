// AdminUsersPage (Supabase)
// - Lists users from profiles table
// - Joins user_roles and licenses by ID
// - Remove deletes records from profiles/user_roles/licenses ONLY (not Auth account)

import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "../supabaseClient";
import { Key, RefreshCw, Search } from "lucide-react";
import { usePermissions } from "../hooks/usePermissions";

const OWNER_UID = import.meta.env.VITE_FIREBASE_OWNER_UID;
const USERS_PER_PAGE = 10;

function throwIfSupabaseError(response) {
  if (response?.error) {
    throw response.error;
  }

  return response?.data;
}

function formatYMD(d) {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

function tsToLicenseDate(validUntilTs) {
  try {
    if (!validUntilTs) return "";
    const dt = new Date(validUntilTs);
    const prev = new Date(dt.getTime() - 24 * 60 * 60 * 1000);
    return formatYMD(prev);
  } catch {
    return "";
  }
}

function licenseDateToValidUntil(ymd) {
  if (!ymd) return null;
  const base = new Date(`${ymd}T00:00:00`);
  const next = new Date(base.getTime() + 24 * 60 * 60 * 1000);
  return next.toISOString();
}

function getLicenseValidUntil(row) {
  return row?.valid_until ?? row?.validUntil ?? null;
}

function StatTile({ label, value, tone = "slate" }) {
  const tones = {
    slate: "from-slate-950 via-slate-900 to-slate-800 text-white",
    blue: "from-blue-600 to-indigo-600 text-white",
    emerald: "from-emerald-500 to-teal-500 text-white",
    amber: "from-amber-300 to-orange-400 text-slate-950",
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

export default function AdminUsersPage() {
  const { can, role } = usePermissions();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [users, setUsers] = useState([]);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState([]);
  const [sortField, setSortField] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);

  const [editingUid, setEditingUid] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [currentPage, setCurrentPage] = useState(1);

  const canManageUsers =
    can("admin.manageUsers") || role === "admin" || (!!OWNER_UID && me?.id === OWNER_UID);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setMe(data.session?.user || null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setMe(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadUsers({ silent = false } = {}) {
    if (!me) return;
    if (!canManageUsers) {
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

      const profiles = throwIfSupabaseError(profRes) || [];
      const roles = throwIfSupabaseError(roleRes) || [];
      const licenses = throwIfSupabaseError(licRes) || [];

      const rolesMap = {};
      roles.forEach((r) => {
        rolesMap[r.id] = r.role;
      });

      const licsMap = {};
      licenses.forEach((l) => {
        licsMap[l.id] = getLicenseValidUntil(l);
      });

      const rows = profiles.map((p) => ({
        uid: p.id,
        username: p.username || "",
        name: p.display_name || p.name || "",
        email: p.email || "",
        role: rolesMap[p.id] || "viewer",
        licenseDate: tsToLicenseDate(licsMap[p.id]),
      }));

      setUsers(rows);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to load users");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [me, canManageUsers]);

  const filteredUsers = useMemo(() => {
    let arr = [...users];
    if (roleFilter.length) {
      arr = arr.filter((u) => roleFilter.includes(u.role));
    }
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (u) =>
          (u.name || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q) ||
          (u.username || "").toLowerCase().includes(q)
      );
    }
    arr.sort((a, b) => {
      const av = (a[sortField] || "").toString().toLowerCase();
      const bv = (b[sortField] || "").toString().toLowerCase();
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return arr;
  }, [users, roleFilter, search, sortField, sortAsc]);

  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE) || 1;
  const pageStart = (currentPage - 1) * USERS_PER_PAGE;
  const pageUsers = filteredUsers.slice(pageStart, pageStart + USERS_PER_PAGE);

  const summary = useMemo(() => {
    const stats = { total: users.length, admin: 0, user: 0, viewer: 0 };
    users.forEach((u) => {
      if (u.role === "admin") stats.admin += 1;
      else if (u.role === "user") stats.user += 1;
      else stats.viewer += 1;
    });
    return stats;
  }, [users]);

  const toggleRoleFilter = (value) => {
    setRoleFilter((prev) => (prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]));
    setCurrentPage(1);
  };

  const startEdit = (u) => {
    setEditingUid(u.uid);
    setEditDraft({ ...u });
  };

  const cancelEdit = () => {
    setEditingUid(null);
    setEditDraft({});
  };

  const saveEdit = async () => {
    const d = editDraft;
    if (!d || !editingUid) return;

    if (!d.username) return toast.error("Username is required");
    if (!d.name) return toast.error("Name is required");

    try {
      const [profileRes, roleRes] = await Promise.all([
        supabase
          .from("profiles")
          .update({
            username: d.username,
            display_name: d.name,
            name: d.name,
            email: d.email || "",
          })
          .eq("id", editingUid),
        supabase.from("user_roles").upsert({
          id: editingUid,
          role: d.role,
        }),
      ]);

      throwIfSupabaseError(profileRes);
      throwIfSupabaseError(roleRes);

      const validUntil = licenseDateToValidUntil(d.licenseDate);
      const licenseRes = await supabase.from("licenses").upsert({
        id: editingUid,
        valid_until: validUntil,
      });

      throwIfSupabaseError(licenseRes);

      setUsers((prev) => prev.map((u) => (u.uid === editingUid ? { ...d } : u)));
      toast.success("User updated");
      cancelEdit();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to save changes");
    }
  };

  const removeUser = async (u) => {
    if (!window.confirm(`Remove user docs for ${u.username}?`)) return;
    try {
      const [profileRes, roleRes, licenseRes] = await Promise.all([
        supabase.from("profiles").delete().eq("id", u.uid),
        supabase.from("user_roles").delete().eq("id", u.uid),
        supabase.from("licenses").delete().eq("id", u.uid),
      ]);

      throwIfSupabaseError(profileRes);
      throwIfSupabaseError(roleRes);
      throwIfSupabaseError(licenseRes);

      setUsers((prev) => prev.filter((x) => x.uid !== u.uid));
      toast.success("Removed user docs. (Auth account NOT deleted)");
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to remove");
    }
  };

  const handleResetPassword = async (u) => {
    if (!u.email) {
      toast.error("User does not have an email address");
      return;
    }

    const ok = window.confirm(`Send password reset email to ${u.email}?`);
    if (!ok) return;

    try {
      const redirectTo = `${window.location.origin}/login`;
      const { error } = await supabase.auth.resetPasswordForEmail(u.email, {
        redirectTo,
      });

      if (error) throw error;
      toast.success(`Password reset email sent to ${u.email}`);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to send reset email");
    }
  };

  if (!loading && me && !canManageUsers) {
    return (
      <div className="mx-auto max-w-5xl p-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Manage Users</h2>
          <p className="mt-2 text-sm text-slate-600">
            You are signed in as <span className="font-medium">{me.email || me.id}</span>. You need{" "}
            <span className="font-medium">admin.manageUsers</span> or admin access to open this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-4">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 px-4 py-3.5 shadow-lg">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-200/80">Settings</div>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-white">Manage Users</h2>
            <p className="mt-0.5 text-xs text-slate-300">
              Update account details, roles, licenses, and password recovery access.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatTile label="Total" value={summary.total} tone="slate" />
            <StatTile label="Admins" value={summary.admin} tone="blue" />
            <StatTile label="Users" value={summary.user} tone="emerald" />
            <StatTile label="Viewers" value={summary.viewer} tone="amber" />
            <button
              onClick={() => loadUsers({ silent: true })}
              className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/10 p-2 text-white transition hover:bg-white/15"
              title="Sync"
              aria-label="Sync"
              disabled={syncing}
            >
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
            </button>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100/85">Sync</span>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">User Directory</div>
              <div className="mt-0.5 text-xs text-slate-500">
                Showing <span className="font-semibold text-slate-900">{pageUsers.length}</span> of{" "}
                <span className="font-semibold text-slate-900">{filteredUsers.length}</span> matching users
              </div>
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative w-full lg:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, email, username"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {["admin", "user", "viewer"].map((value) => {
                  const active = roleFilter.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleRoleFilter(value)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize tracking-[0.08em] transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                          : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-slate-500">Loading users...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    {["name", "email", "username", "role", "licenseDate"].map((field) => (
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
                    <th className="px-4 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {pageUsers.map((u) => {
                    const isEditing = editingUid === u.uid;
                    return (
                      <tr key={u.uid} className={isEditing ? "bg-indigo-50/50" : "hover:bg-slate-50/70"}>
                        <td className="px-4 py-3 align-top">
                          {isEditing ? (
                            <input
                              type="text"
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                              value={editDraft.name || ""}
                              onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                            />
                          ) : (
                            <div>
                              <div className="font-semibold text-slate-900">{u.name || "-"}</div>
                              <div className="mt-1 text-xs text-slate-500">{u.uid}</div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {isEditing ? (
                            <input
                              type="email"
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                              value={editDraft.email || ""}
                              onChange={(e) => setEditDraft({ ...editDraft, email: e.target.value })}
                            />
                          ) : (
                            <span className="text-slate-700">{u.email || "-"}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {isEditing ? (
                            <input
                              type="text"
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                              value={editDraft.username || ""}
                              onChange={(e) => setEditDraft({ ...editDraft, username: e.target.value })}
                            />
                          ) : (
                            <span className="font-mono text-slate-700">{u.username || "-"}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {isEditing ? (
                            <select
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                              value={editDraft.role || "viewer"}
                              onChange={(e) => setEditDraft({ ...editDraft, role: e.target.value })}
                            >
                              <option value="admin">Admin</option>
                              <option value="user">User</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          ) : (
                            <RolePill role={u.role} />
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {isEditing ? (
                            <input
                              type="date"
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                              value={editDraft.licenseDate || ""}
                              onChange={(e) => setEditDraft({ ...editDraft, licenseDate: e.target.value })}
                            />
                          ) : (
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                u.licenseDate ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {u.licenseDate || "No license"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {isEditing ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={saveEdit}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                              >
                                Save Changes
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => startEdit(u)}
                                className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleResetPassword(u)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
                                title="Reset Password"
                              >
                                <Key size={14} />
                                Reset
                              </button>
                              <button
                                onClick={() => removeUser(u)}
                                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {!pageUsers.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <div className="mx-auto max-w-md">
                          <div className="text-base font-semibold text-slate-900">No users found</div>
                          <div className="mt-2 text-sm text-slate-500">
                            Try adjusting the search text or clearing the selected role filters.
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

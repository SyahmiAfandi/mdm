// AdminUsersPage (Firebase, frontend-only)
// - Lists users from Firestore /profiles
// - Joins /roles and /licenses by UID
// - Owner (YOUR_UID_HERE) can edit: name, role, license expiry (inclusive date)
// - Remove deletes Firestore docs (profiles/roles/licenses) ONLY (not Auth account)
//
// Prereqs:
// 1) Configure firebaseClient.js that exports { auth, db }
// 2) Publish Firestore Rules as provided earlier (owner-only writes for roles/licenses)
// 3) Replace OWNER_UID with your actual UID from Firebase Auth

import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import toast from "react-hot-toast";
import { APP_FULL_NAME } from "../config";
import { auth, db } from "../firebaseClient";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";

const OWNER_UID = import.meta.env.VITE_FIREBASE_OWNER_UID; // <-- replace with your owner UID
const USERS_PER_PAGE = 10;

function formatYMD(d) {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

// We store validUntil as NEXT-DAY 00:00 to make the chosen date inclusive.
// For display, we show the previous calendar day.
function tsToLicenseDate(validUntilTs) {
  try {
    if (!validUntilTs) return "";
    const dt = validUntilTs.toDate ? validUntilTs.toDate() : new Date(validUntilTs);
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
  return Timestamp.fromDate(next);
}

export default function AdminUsersPage() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]); // {uid, username, name, email, role, licenseDate}

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState([]); // ["admin","user","viewer"]
  const [sortField, setSortField] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);

  const [editingUid, setEditingUid] = useState(null);
  const [editDraft, setEditDraft] = useState({});

  const [currentPage, setCurrentPage] = useState(1);

  // Load current user & users directory
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      setMe(u);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!me) return; // wait for auth
    if (me && me.uid !== OWNER_UID) {
      setLoading(false);
      return; // unauthorized view rendered below
    }
    (async () => {
      setLoading(true);
      try {
        // 1) Get all profiles (our directory)
        const profSnap = await getDocs(collection(db, "profiles"));

        // 2) For each profile UID, fetch role + license
        const rows = [];
        for (const d of profSnap.docs) {
          const uid = d.id;
          const p = d.data() || {};
          // role
          const roleSnap = await getDoc(doc(db, "roles", uid));
          const role = roleSnap.exists() ? roleSnap.data().role : "viewer";
          // license
          const licSnap = await getDoc(doc(db, "licenses", uid));
          const licenseDate = licSnap.exists()
            ? tsToLicenseDate(licSnap.data().validUntil)
            : "";
          rows.push({
            uid,
            username: p.username || "",
            name: p.name || "",
            email: p.email || "",
            role,
            licenseDate,
          });
        }
        setUsers(rows);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load users");
      } finally {
        setLoading(false);
      }
    })();
  }, [me]);

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

  const toggleRoleFilter = (role) => {
    setRoleFilter((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
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

    // Basic validation
    if (!d.username) return toast.error("Username is required");
    if (!d.name) return toast.error("Name is required");

    try {
      // Update profile
      await setDoc(
        doc(db, "profiles", editingUid),
        { username: d.username, name: d.name, email: d.email || "" },
        { merge: true }
      );

      // Update role (owner-only by Rules)
      await setDoc(doc(db, "roles", editingUid), { role: d.role }, { merge: true });

      // Update license (owner-only by Rules)
      const validUntil = licenseDateToValidUntil(d.licenseDate);
      if (validUntil) {
        await setDoc(
          doc(db, "licenses", editingUid),
          { validUntil },
          { merge: true }
        );
      }

      // Reflect in UI
      setUsers((prev) => prev.map((u) => (u.uid === editingUid ? { ...d } : u)));
      toast.success("User updated");
      cancelEdit();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save changes (check Rules & auth)");
    }
  };

  const removeUser = async (u) => {
    if (!window.confirm(`Remove Firestore docs for ${u.username}?`)) return;
    try {
      await Promise.all([
        deleteDoc(doc(db, "profiles", u.uid)),
        deleteDoc(doc(db, "roles", u.uid)),
        deleteDoc(doc(db, "licenses", u.uid)),
      ]);
      setUsers((prev) => prev.filter((x) => x.uid !== u.uid));
      toast.success("Removed Firestore docs. (Auth account NOT deleted)");
    } catch (e) {
      console.error(e);
      toast.error("Failed to remove");
    }
  };

  // Unauthorized view for non-owner accounts
  if (!loading && me && me.uid !== OWNER_UID) {
    return (
      <DashboardLayout pageTitle={APP_FULL_NAME} breadcrumbs={["Settings", "Admin", "Manage Users"]}>
        <div className="max-w-3xl mx-auto p-6">
          <h2 className="text-xl font-semibold">Manage Users</h2>
          <p className="mt-2 text-sm text-gray-600">
            You are signed in as <span className="font-medium">{me.email || me.uid}</span>.
            This page is restricted to the owner.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout pageTitle={APP_FULL_NAME} breadcrumbs={["Settings", "Admin", "Manage Users"]}>

      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Manage Users</h2>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200"
          >Reload</button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-gray-500">Loading users…</div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <input
                type="text"
                placeholder="Search by name, email, or username"
                className="w-full sm:max-w-sm border border-gray-300 rounded px-3 py-2 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <div className="flex gap-2 flex-wrap text-sm">
                {(["admin", "user", "viewer"]).map((r) => (
                  <label key={r} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={roleFilter.includes(r)}
                      onChange={() => toggleRoleFilter(r)}
                    />
                    <span className="capitalize">{r}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[820px] w-full bg-white shadow rounded">
                <thead className="bg-gray-100 text-gray-600 text-sm">
                  <tr>
                    {["name", "email", "username", "role", "licenseDate"].map((field) => (
                      <th
                        key={field}
                        className="px-6 py-3 text-left cursor-pointer select-none"
                        onClick={() => {
                          if (sortField === field) setSortAsc((s) => !s);
                          else { setSortField(field); setSortAsc(true); }
                        }}
                      >
                        {field.charAt(0).toUpperCase() + field.slice(1)}
                        {sortField === field && (sortAsc ? " ↑" : " ↓")}
                      </th>
                    ))}
                    <th className="px-6 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageUsers.map((u) => (
                    <tr key={u.uid} className="border-t text-sm">
                      <td className="px-6 py-3">
                        {editingUid === u.uid ? (
                          <input
                            type="text"
                            className="border px-2 py-1 rounded w-full"
                            value={editDraft.name || ""}
                            onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                          />
                        ) : (
                          u.name
                        )}
                      </td>
                      <td className="px-6 py-3">
                        {editingUid === u.uid ? (
                          <input
                            type="email"
                            className="border px-2 py-1 rounded w-full"
                            value={editDraft.email || ""}
                            onChange={(e) => setEditDraft({ ...editDraft, email: e.target.value })}
                          />
                        ) : (
                          u.email
                        )}
                      </td>
                      <td className="px-6 py-3">
                        {editingUid === u.uid ? (
                          <input
                            type="text"
                            className="border px-2 py-1 rounded w-full"
                            value={editDraft.username || ""}
                            onChange={(e) => setEditDraft({ ...editDraft, username: e.target.value })}
                          />
                        ) : (
                          u.username
                        )}
                      </td>
                      <td className="px-6 py-3">
                        {editingUid === u.uid ? (
                          <select
                            className="border px-2 py-1 rounded w-full"
                            value={editDraft.role || "viewer"}
                            onChange={(e) => setEditDraft({ ...editDraft, role: e.target.value })}
                          >
                            <option value="admin">Admin</option>
                            <option value="user">User</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              u.role === "admin"
                                ? "bg-red-100 text-red-700"
                                : u.role === "user"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {u.role}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        {editingUid === u.uid ? (
                          <input
                            type="date"
                            className="border px-2 py-1 rounded w-full"
                            value={editDraft.licenseDate || ""}
                            onChange={(e) => setEditDraft({ ...editDraft, licenseDate: e.target.value })}
                          />
                        ) : (
                          u.licenseDate || ""
                        )}
                      </td>
                      <td className="px-6 py-3 space-x-2">
                        {editingUid === u.uid ? (
                          <>
                            <button
                              onClick={saveEdit}
                              className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="bg-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-400"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(u)}
                              className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => removeUser(u)}
                              className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center mt-4">
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

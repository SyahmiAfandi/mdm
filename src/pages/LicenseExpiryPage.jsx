// LicenseExpiryPage.jsx (Firebase version)
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { APP_FULL_NAME } from "../config";
import { auth, db } from "../firebaseClient";
import {
  collection,
  getDocs,
} from "firebase/firestore";

// 👉 replace with your owner UID (same as in Firestore Rules)
const OWNER_UID = import.meta.env.VITE_FIREBASE_OWNER_UID;

const USERS_PER_PAGE = 10;

function formatYMD(d) {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

// We store validUntil as NEXT-DAY 00:00 (inclusive display date = validUntil - 1 day)
function tsToDisplayDate(validUntilTs) {
  if (!validUntilTs?.toDate) return "";
  const nextMidnight = validUntilTs.toDate(); // Date of next-day 00:00
  const inclusive = new Date(nextMidnight.getTime() - 24 * 60 * 60 * 1000);
  return formatYMD(inclusive);
}

function computeStatusFromDisplayDate(displayYYYYMMDD) {
  if (!displayYYYYMMDD) return "Expired"; // treat missing license as expired
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(today.getDate() + 7);

  const lic = new Date(`${displayYYYYMMDD}T00:00:00`);
  if (lic > soon) return "Active";
  if (lic >= today && lic <= soon) return "Expiring Soon";
  return "Expired";
}

export default function LicenseExpiryPage() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]); // [{uid,name,username,email,role,licenseDate,status}]
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  // watch auth
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(setMe);
    return () => unsub();
  }, []);

  // load users (owner only)
  useEffect(() => {
    if (!me) return;
    if (me.uid !== OWNER_UID) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        // Get all three collections
        const [profSnap, roleSnap, licSnap] = await Promise.all([
          getDocs(collection(db, "profiles")),
          getDocs(collection(db, "roles")),
          getDocs(collection(db, "licenses")),
        ]);

        // Build quick maps for roles & licenses
        const rolesMap = {};
        roleSnap.forEach(d => { rolesMap[d.id] = d.data(); });

        const licMap = {};
        licSnap.forEach(d => { licMap[d.id] = d.data(); });

        // Join into rows
        const list = [];
        profSnap.forEach(d => {
          const p = d.data() || {};
          const r = rolesMap[d.id]?.role || "viewer";
          const displayDate = tsToDisplayDate(licMap[d.id]?.validUntil);
          const status = computeStatusFromDisplayDate(displayDate);
          list.push({
            uid: d.id,
            name: p.name || "",
            username: p.username || "",
            email: p.email || "",
            role: r,
            licenseDate: displayDate,
            status,
          });
        });

        setRows(list);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [me]);

  // derived: summary, filter, sort, paginate
  const summary = useMemo(() => {
    return rows.reduce((acc, x) => {
      acc[x.status] = (acc[x.status] || 0) + 1;
      return acc;
    }, {});
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let arr = rows.filter(u => {
      const s =
        (u.name || "").toLowerCase().includes(q) ||
        (u.username || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q);
      const matches = statusFilter ? u.status === statusFilter : true;
      return s && matches;
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

  // Non-owner view
  if (!loading && me && me.uid !== OWNER_UID) {
    return (
      <DashboardLayout pageTitle={APP_FULL_NAME} breadcrumbs={["Settings","Admin","License Expiry"]}>
        <div className="max-w-3xl mx-auto p-6">
          <h2 className="text-xl font-semibold">License Expiry</h2>
          <p className="mt-2 text-sm text-gray-600">
            You are signed in as <span className="font-medium">{me.email || me.uid}</span>. This page is restricted to the owner.
          </p>
          <button onClick={() => navigate(-1)} className="mt-4 text-sm px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Back</button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout pageTitle={APP_FULL_NAME} breadcrumbs={["Settings","Admin","License Expiry"]}>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">License Expiry Overview</h1>
          <button onClick={() => navigate(-1)} className="text-sm px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Back</button>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <input
            type="text"
            placeholder="Search name, username, or email"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full md:w-1/2 border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="w-full md:w-60 border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Expiring Soon">Expiring Soon</option>
            <option value="Expired">Expired</option>
          </select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {["Active", "Expiring Soon", "Expired"].map((type) => (
            <div key={type} className={`rounded shadow p-4 text-center ${
              type === "Expired" ? "bg-red-100 text-red-700"
              : type === "Expiring Soon" ? "bg-yellow-100 text-yellow-800"
              : "bg-green-100 text-green-700"
            }`}>
              <div className="text-sm font-semibold">{type}</div>
              <div className="text-2xl font-bold">{summary[type] || 0}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-[800px] w-full bg-white shadow rounded mt-4">
            <thead className="bg-gray-100 text-gray-600 text-sm">
              <tr>
                {["name", "username", "email", "role", "licenseDate"].map((field) => (
                  <th
                    key={field}
                    className="px-6 py-3 text-left cursor-pointer select-none"
                    onClick={() => {
                      if (sortField === field) setSortAsc(s => !s);
                      else { setSortField(field); setSortAsc(true); }
                    }}
                  >
                    {field.charAt(0).toUpperCase() + field.slice(1)}{sortField === field && (sortAsc ? " ↑" : " ↓")}
                  </th>
                ))}
                <th className="px-6 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center p-4">Loading...</td></tr>
              ) : pageUsers.length === 0 ? (
                <tr><td colSpan="6" className="text-center p-4 text-gray-500">No users found</td></tr>
              ) : (
                pageUsers.map((u) => (
                  <tr key={u.uid} className="border-t text-sm">
                    <td className="px-6 py-3">{u.name}</td>
                    <td className="px-6 py-3">{u.username}</td>
                    <td className="px-6 py-3">{u.email}</td>
                    <td className="px-6 py-3 capitalize">{u.role}</td>
                    <td className="px-6 py-3">{u.licenseDate || "—"}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        u.status === "Expired" ? "bg-red-100 text-red-700"
                        : u.status === "Expiring Soon" ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-700"
                      }`}>{u.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex justify-between items-center mt-4">
          <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >Previous</button>
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >Next</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

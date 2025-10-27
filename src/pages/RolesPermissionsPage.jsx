// Roles & Permissions configuration page (frontend-only, Firebase)
// - Owner can configure which features each role can access
// - Stores permissions under /rolePermissions/{role} as { permissions: {key:boolean}, updatedAt }
// - Provide a small hook + gate to enforce in UI: usePermissions() and <RequirePermission />
//
// 🔧 Setup
// 1) Add this page to your routes (e.g., /settings/admin/permissions)
// 2) Ensure your Firestore Rules allow:
//    match /rolePermissions/{roleId} { allow read: if isSignedIn(); allow write: if isOwner(); }
//    (Keep your existing roles/profiles/licenses rules from earlier.)
// 3) Replace OWNER_UID with your actual UID (must match the one in Rules)
// 4) Optionally tweak PERMISSION_KEYS to fit your app modules/actions
// 5) Use <RequirePermission perm="admin.manageUsers"> to protect pages/components
//
// Files in this single snippet:
//   A) RolesPermissionsPage.jsx  (main page)
//   B) hooks/usePermissions.js   (client hook for gating)
//   C) components/RequirePermission.jsx (simple wrapper)

// ==============================
// A) RolesPermissionsPage.jsx
// ==============================
import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { APP_FULL_NAME } from "../config";
import { auth, db } from "../firebaseClient";
import toast from "react-hot-toast";
import { collection, doc, getDoc, setDoc, getDocs, serverTimestamp } from "firebase/firestore";

// 🔑 Must match your owner UID in Firestore Rules
const OWNER_UID = import.meta.env.VITE_FIREBASE_OWNER_UID;

// List of feature flags you want to manage (add/remove as needed)
const PERMISSION_KEYS = [
  "dashboard.view",
  "tools.view",
  "utilities.view",
  "uploads.use",
  "reports.view",
  "reports.edit",
  "reports.export",
  "mismatch.view",
  "admin.manageUsers",
  "admin.license",
  "settings.configureRoles",
  "reports.status.view",
  "settings.view",
];

// Roles you support today (you can add more; docs will be created/saved on demand)
const ROLES = ["admin", "user", "viewer"];

function bool(v) { return !!v; }

export default function RolesPermissionsPage() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [matrix, setMatrix] = useState({}); // { role: { key:boolean } }
  const [filter, setFilter] = useState("");
  const [newKey, setNewKey] = useState("");

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(setMe);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!me) return;
    if (me.uid !== OWNER_UID) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      try {
        // Fetch all role permissions
        const snap = await getDocs(collection(db, "rolePermissions"));
        const tmp = {};
        ROLES.forEach(r => tmp[r] = {});
        snap.forEach(d => {
          const r = d.id; // role id
          const data = d.data() || {};
          tmp[r] = { ...(data.permissions || {}) };
        });
        setMatrix(tmp);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load permissions");
      } finally {
        setLoading(false);
      }
    })();
  }, [me]);

  const keys = useMemo(() => {
    const set = new Set(PERMISSION_KEYS);
    // include any keys already in Firestore docs
    Object.values(matrix).forEach(map => Object.keys(map || {}).forEach(k => set.add(k)));
    return Array.from(set).filter(k => (filter ? k.includes(filter) : true)).sort();
  }, [matrix, filter]);

  const toggle = (role, key) => {
    setMatrix(prev => ({
      ...prev,
      [role]: { ...(prev[role] || {}), [key]: !bool(prev[role]?.[key]) }
    }));
  };

  const addPermissionKey = () => {
    const k = newKey.trim();
    if (!k) return;
    if (keys.includes(k)) { toast("Key already exists"); return; }
    // Just add to local state; it will be persisted on save
    setMatrix(prev => {
      const next = { ...prev };
      ROLES.forEach(r => { next[r] = { ...(next[r] || {}), [k]: false }; });
      return next;
    });
    setNewKey("");
  };

  const save = async () => {
    if (!me || me.uid !== OWNER_UID) return;
    try {
      await Promise.all(
        ROLES.map(async (role) => {
          const docRef = doc(db, "rolePermissions", role);
          const existing = await getDoc(docRef);
          const payload = {
            permissions: matrix[role] || {},
            updatedAt: serverTimestamp(),
          };
          if (existing.exists()) await setDoc(docRef, payload, { merge: true });
          else await setDoc(docRef, payload);
        })
      );
      toast.success("Permissions saved");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save (check Rules/owner UID)");
    }
  };

  // Non-owner view
  if (!loading && me && me.uid !== OWNER_UID) {
    return (
      <DashboardLayout pageTitle={APP_FULL_NAME} breadcrumbs={["Settings","Admin","Roles & Permissions"]}>
        <div className="max-w-3xl mx-auto p-6">
          <h2 className="text-xl font-semibold">Roles & Permissions</h2>
          <p className="mt-2 text-sm text-gray-600">This page is restricted to the owner.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout pageTitle={APP_FULL_NAME} breadcrumbs={["Settings","Admin","Roles & Permissions"]}>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Configure Roles & Permissions</h1>
          <div className="flex gap-2">
            <button onClick={save} className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">Save</button>
          </div>
        </div>

        {/* Tools */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <input
            placeholder="Filter permissions (e.g., reports)"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full md:w-80 border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <div className="flex gap-2 items-center">
            <input
              placeholder="Add new permission key (e.g., billing.view)"
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              className="w-72 border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <button onClick={addPermissionKey} className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 text-sm">Add</button>
          </div>
        </div>

        {/* Matrix */}
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full bg-white shadow rounded">
            <thead className="bg-gray-100 text-gray-700 text-sm">
              <tr>
                <th className="px-6 py-3 text-left">Permission Key</th>
                {ROLES.map(r => (
                  <th key={r} className="px-6 py-3 text-left capitalize">{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={1+ROLES.length} className="text-center p-6 text-gray-500">Loading…</td></tr>
              ) : keys.length === 0 ? (
                <tr><td colSpan={1+ROLES.length} className="text-center p-6 text-gray-500">No permission keys</td></tr>
              ) : (
                keys.map((key) => (
                  <tr key={key} className="border-t text-sm">
                    <td className="px-6 py-3 font-mono text-xs sm:text-sm">{key}</td>
                    {ROLES.map((role) => (
                      <td key={role} className="px-6 py-3">
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={!!matrix[role]?.[key]}
                            onChange={() => toggle(role, key)}
                          />
                          <span className={`px-2 py-0.5 rounded text-xs ${matrix[role]?.[key] ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                            {matrix[role]?.[key] ? "Allow" : "Deny"}
                          </span>
                        </label>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-gray-500">
          <p>Tip: use short, namespaced keys (e.g., <code>reports.view</code>, <code>admin.manageUsers</code>, <code>billing.export</code>). Your UI can check these via <code>usePermissions().can(key)</code>.</p>
        </div>
      </div>
    </DashboardLayout>
  );
}



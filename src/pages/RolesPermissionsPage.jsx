import React, { useEffect, useMemo, useState } from "react";
import { APP_FULL_NAME } from "../config";
import { auth, db } from "../firebaseClient";
import toast from "react-hot-toast";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import {
  ChevronDown,
  ChevronRight,
  Save,
  Shield,
  Search,
  Lock,
} from "lucide-react";

// 🔑 Must match your owner UID in Firestore Rules
const OWNER_UID = import.meta.env.VITE_FIREBASE_OWNER_UID;

// Roles you support today
const ROLES = ["admin", "user", "viewer"];

/**
 * ✅ Define your permission structure here (Main -> Sub -> SubSub -> permissions)
 * Each permission item: { key, label, desc? }
 *
 * Tip:
 * - key should match what you check in <RequirePermission perm="..." />
 * - group labels can match your sidebar / modules
 */
const PERMISSION_TREE = [
  {
    id: "dashboard",
    label: "Main Dashboard",
    icon: "🏠",
    children: [
      {
        id: "dashboard-core",
        label: "Dashboard Core",
        permissions: [
          { key: "dashboard.view", label: "View Dashboard" },
        ],
      },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    icon: "🧰",
    children: [
      {
        id: "tools-core",
        label: "Tools Access",
        permissions: [
          { key: "tools.view", label: "View Tools Section" },
        ],
      },
    ],
  },
  {
    id: "utilities",
    label: "Utilities",
    icon: "🧩",
    children: [
      {
        id: "utilities-core",
        label: "Utilities Access",
        permissions: [{ key: "utilities.view", label: "View Utilities Section" }],
      },
      {
        id: "mdm-email-tracker",
        label: "MDM Email Tracker",
        children: [
          {
            id: "mdm-email-tracker-core",
            label: "Tracker Permissions",
            permissions: [
              { key: "mdmEmailTracker.view", label: "View Tracker" },
              { key: "mdmEmailTracker.assign", label: "Assign Email to Self / PIC" },
              { key: "mdmEmailTracker.edit", label: "Edit Status / Remark" },
              { key: "mdmEmailTracker.export", label: "Export Tracker" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "uploads",
    label: "Uploads",
    icon: "📤",
    children: [
      {
        id: "uploads-core",
        label: "Uploads Access",
        permissions: [{ key: "uploads.use", label: "Use Uploads" }],
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: "📊",
    children: [
      {
        id: "reports-core",
        label: "Reports Access",
        permissions: [
          { key: "reports.view", label: "View Reports" },
          { key: "reports.edit", label: "Edit Reports" },
          { key: "reports.export", label: "Export Reports" },
          { key: "reports.status.view", label: "View Report Status" },
        ],
      },
      {
        id: "mismatch",
        label: "Mismatch Tracker",
        permissions: [
          { key: "mismatch.view", label: "View Mismatch Tracker" },
        ],
      },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    icon: "🛡️",
    children: [
      {
        id: "admin-core",
        label: "Admin Actions",
        permissions: [
          { key: "admin.manageUsers", label: "Manage Users" },
          { key: "admin.license", label: "Manage Licenses" },
        ],
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: "⚙️",
    children: [
      {
        id: "settings-core",
        label: "Settings Access",
        permissions: [
          { key: "settings.view", label: "View Settings" },
          { key: "settings.configureRoles", label: "Configure Roles & Permissions" },
        ],
      },
    ],
  },
];

// ---------- helpers ----------
function bool(v) {
  return !!v;
}

function flattenTree(tree) {
  const out = [];
  const walk = (node, pathLabels = []) => {
    const nextPath = node.label ? [...pathLabels, node.label] : pathLabels;

    if (node.permissions?.length) {
      node.permissions.forEach((p) => {
        out.push({
          ...p,
          path: nextPath,
        });
      });
    }

    if (node.children?.length) {
      node.children.forEach((c) => walk(c, nextPath));
    }
  };

  tree.forEach((n) => walk(n, []));
  return out;
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

// ---------- small UI components ----------
function RoleSelect({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">Role:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r.toUpperCase()}
          </option>
        ))}
      </select>
    </div>
  );
}

function AllowDenyToggle({ value, onChange }) {
  // value: boolean
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={classNames(
          "px-3 py-1.5 text-xs font-semibold rounded-md transition",
          value
            ? "bg-green-600 text-white shadow"
            : "text-gray-600 hover:bg-white"
        )}
      >
        Allow
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={classNames(
          "px-3 py-1.5 text-xs font-semibold rounded-md transition",
          !value
            ? "bg-red-600 text-white shadow"
            : "text-gray-600 hover:bg-white"
        )}
      >
        Deny
      </button>
    </div>
  );
}

function AccordionSection({ title, subtitle, icon, open, onToggle, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-lg">
            {icon || "📦"}
          </div>
          <div className="text-left">
            <div className="font-semibold text-gray-800">{title}</div>
            {subtitle ? (
              <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>
            ) : null}
          </div>
        </div>
        {open ? (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {open ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  );
}

function SubBlock({ title, children }) {
  return (
    <div className="mt-3">
      <div className="text-sm font-semibold text-gray-700 mb-2">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function PermissionRow({ label, permKey, path, value, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 border border-gray-100 rounded-lg px-3 py-2 hover:bg-gray-50 transition">
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-800">{label}</div>
        <div className="text-xs text-gray-500 mt-0.5">
          <span className="font-mono">{permKey}</span>
          {path?.length ? (
            <span className="ml-2 text-gray-400">
              • {path.join(" / ")}
            </span>
          ) : null}
        </div>
      </div>
      <AllowDenyToggle value={value} onChange={onChange} />
    </div>
  );
}

// ---------- main page ----------
export default function RolesPermissionsPage() {
  const [me, setMe] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [matrix, setMatrix] = useState({}); // { role: { key:boolean } }

  const [selectedRole, setSelectedRole] = useState(ROLES[0]);
  const [search, setSearch] = useState("");

  const [openMain, setOpenMain] = useState(() => {
    // open a few by default
    return {
      dashboard: true,
      tools: true,
      utilities: true,
      uploads: false,
      reports: false,
      admin: false,
      settings: false,
    };
  });

  // auth
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(setMe);
    return () => unsub();
  }, []);

  // load all role docs once (owner only)
  useEffect(() => {
    if (!me) return;
    if (me.uid !== OWNER_UID) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "rolePermissions"));
        const tmp = {};
        ROLES.forEach((r) => (tmp[r] = {}));
        snap.forEach((d) => {
          const roleId = d.id;
          const data = d.data() || {};
          tmp[roleId] = { ...(data.permissions || {}) };
        });

        // ensure all defined keys exist in state (default false)
        const all = flattenTree(PERMISSION_TREE);
        ROLES.forEach((r) => {
          tmp[r] = tmp[r] || {};
          all.forEach((p) => {
            if (typeof tmp[r][p.key] === "undefined") tmp[r][p.key] = false;
          });
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

  const allPermissions = useMemo(() => flattenTree(PERMISSION_TREE), []);

  const matchesSearch = (text) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (text || "").toLowerCase().includes(q);
  };

  const filteredKeysSet = useMemo(() => {
    if (!search) return null;
    const set = new Set();
    allPermissions.forEach((p) => {
      const hay = `${p.key} ${p.label} ${(p.path || []).join(" ")}`;
      if (matchesSearch(hay)) set.add(p.key);
    });
    return set;
  }, [search, allPermissions]);

  const currentRoleMap = matrix[selectedRole] || {};

  const setPerm = (role, key, value) => {
    setMatrix((prev) => ({
      ...prev,
      [role]: { ...(prev[role] || {}), [key]: !!value },
    }));
  };

  const saveSelectedRole = async () => {
    if (!me || me.uid !== OWNER_UID) return;
    setSaving(true);
    try {
      const role = selectedRole;
      const docRef = doc(db, "rolePermissions", role);
      const payload = {
        permissions: matrix[role] || {},
        updatedAt: serverTimestamp(),
      };
      const existing = await getDoc(docRef);
      if (existing.exists()) await setDoc(docRef, payload, { merge: true });
      else await setDoc(docRef, payload);

      toast.success(`Saved permissions for ${role.toUpperCase()}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save (check Rules/owner UID)");
    } finally {
      setSaving(false);
    }
  };

  // non-owner view
  if (!loading && me && me.uid !== OWNER_UID) {
    return (
        <div className="max-w-3xl mx-auto p-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <Lock className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  Roles & Permissions
                </h2>
                <p className="text-sm text-gray-600">
                  This page is restricted to the owner.
                </p>
              </div>
            </div>
          </div>
        </div>
    );
  }

  return (
      <div className="max-w-6xl mx-auto p-6 space-y-5">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900">
                  Roles & Permissions
                </h1>
                <p className="text-sm text-gray-600">
                  Pick a role, then allow/deny features in a structured way.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <RoleSelect value={selectedRole} onChange={setSelectedRole} />
              <button
                onClick={saveSelectedRole}
                disabled={saving || loading}
                className={classNames(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm",
                  saving || loading
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                )}
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save Role"}
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="mt-4 flex items-center gap-2">
            <div className="relative w-full md:w-[420px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search permission (e.g., reports, mdm, export)"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            <div className="text-xs text-gray-500 hidden md:block">
              Managing:{" "}
              <span className="font-semibold text-gray-700">
                {selectedRole.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {PERMISSION_TREE.map((main) => {
            // If search is active, open sections with matches automatically
            const isOpen =
              openMain[main.id] ||
              (filteredKeysSet
                ? sectionHasMatch(main, filteredKeysSet)
                : false);

            return (
              <AccordionSection
                key={main.id}
                title={main.label}
                subtitle={`Configure ${main.label} access for ${selectedRole.toUpperCase()}`}
                icon={main.icon}
                open={isOpen}
                onToggle={() =>
                  setOpenMain((p) => ({ ...p, [main.id]: !p[main.id] }))
                }
              >
                {renderChildren(main.children || [], {
                  selectedRole,
                  currentRoleMap,
                  setPerm,
                  filteredKeysSet,
                })}
              </AccordionSection>
            );
          })}
        </div>

        <div className="text-xs text-gray-500">
          Tip: Use namespaced keys like <code className="font-mono">reports.view</code> or{" "}
          <code className="font-mono">mdmEmailTracker.assign</code>. Then protect screens with{" "}
          <code className="font-mono">{`<RequirePermission perm="reports.view">`}</code>.
        </div>
      </div>
  );
}

// ---------- render helpers ----------
function sectionHasMatch(section, keySet) {
  if (!keySet) return true;
  const walk = (node) => {
    if (node.permissions?.some((p) => keySet.has(p.key))) return true;
    if (node.children?.some(walk)) return true;
    return false;
  };
  return walk(section);
}

function renderChildren(children, ctx) {
  const { selectedRole, currentRoleMap, setPerm, filteredKeysSet } = ctx;

  return (
    <div className="space-y-3 mt-2">
      {children.map((child) => {
        const hasMatch = filteredKeysSet ? sectionHasMatch(child, filteredKeysSet) : true;
        if (!hasMatch) return null;

        const hasSubChildren = (child.children || []).length > 0;
        const hasPerms = (child.permissions || []).length > 0;

        // Sub block title
        return (
          <div key={child.id} className="border border-gray-100 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-gray-800 text-sm">
                {child.label}
              </div>

              {/* quick badges */}
              <div className="text-[11px] text-gray-500">
                {hasPerms ? `${child.permissions.length} permissions` : null}
                {hasPerms && hasSubChildren ? " • " : null}
                {hasSubChildren ? `${child.children.length} sub modules` : null}
              </div>
            </div>

            {/* permissions in this level */}
            {hasPerms ? (
              <SubBlock title="Permissions">
                {child.permissions
                  .filter((p) => (filteredKeysSet ? filteredKeysSet.has(p.key) : true))
                  .map((p) => (
                    <PermissionRow
                      key={p.key}
                      label={p.label}
                      permKey={p.key}
                      path={[child.label]}
                      value={bool(currentRoleMap?.[p.key])}
                      onChange={(v) => setPerm(selectedRole, p.key, v)}
                    />
                  ))}
              </SubBlock>
            ) : null}

            {/* nested children */}
            {hasSubChildren ? (
              <div className="mt-3 space-y-3">
                {renderChildren(child.children, ctx)}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

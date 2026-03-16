import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import toast from "react-hot-toast";
import { normalizePermissionRows, usePermissions } from "../hooks/usePermissions";
import {
  ChevronDown,
  Save,
  Shield,
  Search,
  Lock,
  Check,
  X,
  Users,
  Layers,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// 🔑 Must match your owner UID in Firestore Rules
const OWNER_UID = import.meta.env.VITE_FIREBASE_OWNER_UID;

// Roles you support today
const ROLES = ["admin", "user", "viewer"];

const ROLE_META = {
  admin: { label: "Admin", color: "from-violet-500 to-purple-600", badge: "bg-violet-100 text-violet-700 border-violet-200" },
  user: { label: "User", color: "from-blue-500 to-cyan-500", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  viewer: { label: "Viewer", color: "from-slate-400 to-slate-500", badge: "bg-slate-100 text-slate-600 border-slate-200" },
};

const PERMISSION_TREE = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "🏠",
    children: [
      {
        id: "dashboard-core",
        label: "Core",
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
        label: "Core",
        permissions: [
          { key: "tools.view", label: "View Tools Section" },
        ],
      },
      {
        id: "tools-promotions",
        label: "Promotions",
        permissions: [
          { key: "tools.promotions.view", label: "View Promotions" },
          { key: "tools.promotions.edit", label: "Edit Promotions" },
          { key: "promotions.regionDistributor.view", label: "View Region & Distributor Config" },
          { key: "promotions.regionDistributor.edit", label: "Edit Region & Distributor Config" },
          { key: "promotions.promoItem.view", label: "View Promo Item Config" },
          { key: "promotions.promoItem.edit", label: "Edit Promo Item Config" },
          { key: "promotions.promoPeriod.view", label: "View Promo Period Config" },
          { key: "promotions.promoPeriod.edit", label: "Edit Promo Period Config" },
          { key: "promotions.promoCriteria.view", label: "View Promo Criteria Config" },
          { key: "promotions.promoCriteria.edit", label: "Edit Promo Criteria Config" },
          { key: "promotions.regionCriteriaMapping.view", label: "View Region & Criteria Mapping" },
          { key: "promotions.regionCriteriaMapping.edit", label: "Edit Region & Criteria Mapping" },
        ],
      },
      {
        id: "tools-reconciliation",
        label: "Reconciliation",
        permissions: [
          { key: "tools.reconciliation.view", label: "View Reconciliation" },
          { key: "tools.reconciliation.edit", label: "Edit Reconciliation (Upload, Config, Import)" },
        ],
      },
      {
        id: "tools-detailedView",
        label: "Detailed View",
        permissions: [
          { key: "tools.detailedView.view", label: "View Detailed View" },
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
        label: "Core",
        permissions: [{ key: "utilities.view", label: "View Utilities Section" }],
      },
      {
        id: "mdm-email-tracker",
        label: "MDM Email Tracker",
        children: [
          {
            id: "mdm-email-tracker-core",
            label: "Tracker",
            permissions: [
              { key: "mdmEmailTracker.view", label: "View Tracker" },
              { key: "mdmEmailTracker.assign", label: "Assign Email to PIC" },
              { key: "mdmEmailTracker.edit", label: "Edit Status / Remark" },
              { key: "mdmEmailTracker.delete", label: "Delete Email" },
              { key: "mdmEmailTracker.bulkImport", label: "Bulk Import Email" },
            ],
          },
        ],
      },
      {
        id: "utilities-manualRecons",
        label: "Manual Recons Entry",
        permissions: [
          { key: "utilities.manualRecons.view", label: "View Manual Recons" },
          { key: "utilities.manualRecons.edit", label: "Edit / Add Manual Recons" },
        ],
      },
      {
        id: "utilities-dateConverter",
        label: "Date Converter",
        permissions: [
          { key: "utilities.dateConverter.view", label: "View Date Converter" },
        ],
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
        label: "Core",
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
      {
        id: "reports-summaryRecons",
        label: "Summary Recons",
        permissions: [
          { key: "reports.summaryRecons.view", label: "View Summary Recons" },
        ],
      },
      {
        id: "reports-mismatchList",
        label: "Mismatch List",
        permissions: [
          { key: "reports.mismatchList.view", label: "View Mismatch List" },
        ],
      },
      {
        id: "reports-matrixRecons",
        label: "Reconciliation Matrix",
        permissions: [
          { key: "reports.matrixRecons.view", label: "View Reconciliation Matrix" },
        ],
      },
      {
        id: "reports-dss",
        label: "Daily Sales Summary",
        permissions: [
          { key: "reports.dss.view", label: "View Daily Sales Summary" },
        ],
      },
      {
        id: "reports-reconSchedule",
        label: "Recon Schedule",
        permissions: [
          { key: "reports.reconSchedule.view", label: "View Recon Schedule" },
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
        label: "Core",
        permissions: [
          { key: "admin.manageUsers", label: "Manage Users" },
          { key: "admin.license", label: "Manage Licenses" },
        ],
      },
    ],
  },
  {
    id: "masterData",
    label: "Master Data",
    icon: "🗂️",
    children: [
      {
        id: "masterData-core",
        label: "Core",
        permissions: [
          { key: "masterData.view", label: "View Master Data" },
        ],
      },
      {
        id: "masterData-distributors",
        label: "Distributors",
        permissions: [
          { key: "masterData.distributors.view", label: "View Distributors" },
          { key: "masterData.distributors.edit", label: "Edit Distributors" },
        ],
      },
      {
        id: "masterData-Countries",
        label: "Countries",
        permissions: [
          { key: "masterData.countries.view", label: "View Countries" },
          { key: "masterData.countries.edit", label: "Edit Countries" },
        ],
      },
      {
        id: "masterData-business",
        label: "Businesses",
        permissions: [
          { key: "masterData.business.view", label: "View Businesses" },
          { key: "masterData.business.edit", label: "Edit Businesses" },
        ],
      },
      {
        id: "masterData-sku",
        label: "SKU Master",
        permissions: [
          { key: "masterData.sku.view", label: "View SKU Master" },
          { key: "masterData.sku.edit", label: "Edit SKU Master" },
        ],
      },
      {
        id: "masterData-promoItems",
        label: "Promotion Item Master",
        permissions: [
          { key: "masterData.promoItems.view", label: "View Promotion Item Master" },
          { key: "masterData.promoItems.edit", label: "Edit Promotion Item Master" },
        ],
      },
      {
        id: "masterData-reportTypes",
        label: "Report Types",
        permissions: [
          { key: "masterData.reportTypes.view", label: "View Report Types" },
          { key: "masterData.reportTypes.edit", label: "Edit Report Types" },
        ],
      },
      {
        id: "masterData-years",
        label: "Years",
        permissions: [
          { key: "masterData.years.view", label: "View Years" },
          { key: "masterData.years.edit", label: "Edit Years" },
        ],
      },
      {
        id: "masterData-mapping",
        label: "Business & Report Type Mapping",
        permissions: [
          { key: "masterData.mapping.view", label: "View Mapping" },
          { key: "masterData.mapping.edit", label: "Edit Mapping" },
        ],
      },
      {
        id: "masterData-reconsButton",
        label: "Recons Button Mapping",
        permissions: [
          { key: "masterData.reconsButtonMapping.view", label: "View Recons Button Mapping" },
          { key: "masterData.reconsButtonMapping.edit", label: "Edit Recons Button Mapping" },
        ],
      },
      {
        id: "masterData-mapPromoSku",
        label: "Map Promo Item to SKU",
        permissions: [
          { key: "masterData.mapPromoSku.view", label: "View Map Promo to SKU" },
          { key: "masterData.mapPromoSku.edit", label: "Edit Map Promo to SKU" },
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
        label: "Core",
        permissions: [
          { key: "settings.view", label: "View Settings" },
          { key: "settings.configureRoles", label: "Configure Roles & Perms" },
        ],
      },
    ],
  },
];

// ---------- helpers ----------
function bool(v) { return !!v; }

function flattenTree(tree) {
  const out = [];
  const walk = (node, pathLabels = []) => {
    const nextPath = node.label ? [...pathLabels, node.label] : pathLabels;
    if (node.permissions?.length) {
      node.permissions.forEach((p) => out.push({ ...p, path: nextPath }));
    }
    if (node.children?.length) {
      node.children.forEach((c) => walk(c, nextPath));
    }
  };
  tree.forEach((n) => walk(n, []));
  return out;
}

function sectionHasMatch(node, keySet) {
  if (node.permissions?.some((p) => keySet.has(p.key))) return true;
  return (node.children || []).some((c) => sectionHasMatch(c, keySet));
}

function cx(...xs) { return xs.filter(Boolean).join(" "); }

function countPerms(node) {
  let c = 0;
  if (node.permissions) c += node.permissions.length;
  if (node.children) node.children.forEach((ch) => { c += countPerms(ch); });
  return c;
}

// ---------- Toggle ----------
function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cx(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 shrink-0",
        value ? "bg-violet-500 shadow-sm shadow-violet-300" : "bg-gray-200"
      )}
    >
      <span
        className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: value ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}

// ---------- Permission Row (table row style) ----------
function PermRow({ label, permKey, value, onChange }) {
  return (
    <div className={cx(
      "flex items-center justify-between py-2 px-3 rounded-lg transition-all duration-150 group",
      value
        ? "bg-violet-50 border border-violet-100"
        : "border border-transparent hover:bg-gray-50 hover:border-gray-100"
    )}>
      <div className="min-w-0 flex-1 pr-4">
        <span className={cx(
          "text-xs font-semibold leading-none transition-colors",
          value ? "text-violet-800" : "text-gray-700"
        )}>{label}</span>
        <code className={cx(
          "block mt-0.5 text-[10px] font-mono leading-none tracking-tight transition-colors",
          value ? "text-violet-400" : "text-gray-400"
        )}>{permKey}</code>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <span className={cx(
          "text-[10px] font-bold tracking-wide w-5 text-right transition-colors",
          value ? "text-violet-500" : "text-gray-300"
        )}>
          {value ? "ON" : "OFF"}
        </span>
        <Toggle value={value} onChange={onChange} />
      </div>
    </div>
  );
}

// ---------- Tab Nav Item ----------
function NavItem({ node, active, onClick }) {
  const total = countPerms(node);
  return (
    <button
      onClick={onClick}
      className={cx(
        "w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150",
        active
          ? "bg-violet-50 ring-1 ring-violet-200/60"
          : "hover:bg-gray-50"
      )}
    >
      <span className={cx(
        "text-base shrink-0 leading-none transition-all duration-150",
        active ? "scale-110" : ""
      )}>{node.icon}</span>
      <div className="flex-1 min-w-0">
        <div className={cx(
          "text-xs font-semibold truncate leading-none transition-colors",
          active ? "text-violet-700" : "text-gray-600"
        )}>
          {node.label}
        </div>
        <div className={cx(
          "text-[10px] mt-0.5 leading-none font-medium",
          active ? "text-violet-400" : "text-gray-400"
        )}>{total} perm{total !== 1 ? "s" : ""}</div>
      </div>
      {active && <div className="w-1 h-5 rounded-full bg-violet-400 shrink-0" />}
    </button>
  );
}

// ---------- Section renderer (recursive) ----------
function Section({ node, roleMap, onSet, role, filteredKeys }) {
  const hasPerms = (node.permissions || []).length > 0;
  const hasChildren = (node.children || []).length > 0;

  const visiblePerms = hasPerms
    ? node.permissions.filter((p) => (filteredKeys ? filteredKeys.has(p.key) : true))
    : [];

  const visibleChildren = hasChildren
    ? node.children.filter((c) => (filteredKeys ? sectionHasMatch(c, filteredKeys) : true))
    : [];

  if (visiblePerms.length === 0 && visibleChildren.length === 0) return null;

  return (
    <div className="mb-3">
      {node.label && (
        <div className="flex items-center gap-2 mb-1.5 px-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{node.label}</div>
          <div className="flex-1 h-px bg-gray-100" />
          {visiblePerms.length > 0 && (
            <span className="text-[10px] font-semibold text-gray-400">{visiblePerms.length}</span>
          )}
        </div>
      )}
      {visiblePerms.length > 0 && (
        <div className="space-y-0.5">
          {visiblePerms.map((p) => (
            <PermRow
              key={p.key}
              label={p.label}
              permKey={p.key}
              value={bool(roleMap?.[p.key])}
              onChange={(v) => onSet(role, p.key, v)}
            />
          ))}
        </div>
      )}
      {visibleChildren.length > 0 && (
        <div className={cx(visiblePerms.length > 0 ? "mt-2" : "")}>
          {visibleChildren.map((child) => (
            <Section
              key={child.id}
              node={child}
              roleMap={roleMap}
              onSet={onSet}
              role={role}
              filteredKeys={filteredKeys}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================================
// MAIN PAGE
// ==========================================================
export default function RolesPermissionsPage() {
  const { can, role } = usePermissions();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matrix, setMatrix] = useState({});
  const [selectedRole, setSelectedRole] = useState(ROLES[0]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState(PERMISSION_TREE[0].id);
  const canManageRoles = can("settings.configureRoles") || role === "admin" || (!!OWNER_UID && me?.id === OWNER_UID);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setMe(session?.user || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setMe(session?.user || null);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!me) return;
    if (!canManageRoles) { setLoading(false); return; }

    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from("role_permissions").select("*");
        if (error) throw error;
        
        const tmp = {};
        ROLES.forEach((r) => (tmp[r] = {}));
        const grouped = {};
        data?.forEach((d) => {
          const roleKey = String(d.role || "").trim();
          if (!roleKey) return;
          if (!grouped[roleKey]) grouped[roleKey] = [];
          grouped[roleKey].push(d);
        });
        Object.keys(grouped).forEach((roleKey) => {
          tmp[roleKey] = normalizePermissionRows(grouped[roleKey]);
        });
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
  }, [me, canManageRoles]);

  const allPermissions = useMemo(() => flattenTree(PERMISSION_TREE), []);

  const filteredKeys = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const set = new Set();
    allPermissions.forEach((p) => {
      if (`${p.key} ${p.label}`.toLowerCase().includes(q)) set.add(p.key);
    });
    return set;
  }, [search, allPermissions]);

  const currentRoleMap = matrix[selectedRole] || {};

  const setPerm = (role, key, val) => {
    setMatrix((prev) => ({ ...prev, [role]: { ...(prev[role] || {}), [key]: !!val } }));
  };

  const saveRole = async () => {
    if (!me || !canManageRoles) return;
    setSaving(true);
    try {
      const payload = allPermissions.map((p) => ({
        role: selectedRole,
        permission: p.key,
        allow: currentRoleMap[p.key] ? 1 : 0,
        updated_at: new Date().toISOString(),
      }));
      
      const { error } = await supabase
        .from("role_permissions")
        .upsert(payload, { onConflict: 'role,permission' });
        
      if (error) throw error;
      
      toast.success(`Saved — ${selectedRole.toUpperCase()}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Allowed-count summary
  const allowedCount = useMemo(() => {
    return allPermissions.filter((p) => bool(currentRoleMap[p.key])).length;
  }, [currentRoleMap, allPermissions]);

  const totalCount = allPermissions.length;

  // non-owner
  if (!loading && me && !canManageRoles) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center px-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-10 shadow-xl max-w-sm w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 mx-auto flex items-center justify-center">
            <Lock className="w-7 h-7 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Access Restricted</h2>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">You need <code className="font-mono">settings.configureRoles</code> or admin access to manage roles and permissions.</p>
          </div>
        </div>
      </div>
    );
  }

  const roleMeta = ROLE_META[selectedRole] || ROLE_META.user;

  // Sidebar tabs — filter by search
  const visibleTabs = PERMISSION_TREE.filter((m) =>
    filteredKeys ? sectionHasMatch(m, filteredKeys) : true
  );

  // Active content node
  const activeModule = filteredKeys
    ? null // search mode shows all
    : PERMISSION_TREE.find((m) => m.id === activeTab);

  return (
    <div className="h-[calc(100vh-112px)] flex flex-col gap-3 p-4 overflow-hidden">

      {/* ── HEADER ── */}
      <div className="shrink-0 flex items-center justify-between gap-4 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
        {/* Left: title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-200 shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-none">Roles & Permissions</h1>
            <p className="text-[10px] text-gray-400 mt-0.5 leading-none">Control system access by role</p>
          </div>
        </div>

        {/* Right: role selector + stats + save */}
        <div className="flex items-center gap-2">
          {/* Allowed stat */}
          <div className="hidden sm:flex flex-col items-end mr-2">
            <div className="text-xs font-bold text-gray-700 leading-none">{allowedCount} / {totalCount}</div>
            <div className="text-[10px] text-gray-400 mt-0.5 leading-none">permissions on</div>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-gray-100 hidden sm:block" />

          {/* Role tabs */}
          <div className="flex items-center gap-1 bg-gray-100/70 p-0.5 rounded-lg">
            {ROLES.map((r) => {
              const meta = ROLE_META[r];
              const isActive = selectedRole === r;
              return (
                <button
                  key={r}
                  onClick={() => setSelectedRole(r)}
                  className={cx(
                    "px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-150",
                    isActive
                      ? "bg-white shadow-sm text-gray-900 scale-[1.02]"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-gray-100" />

          {/* Save */}
          <button
            onClick={saveRole}
            disabled={saving || loading}
            className={cx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150",
              saving || loading
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-200 active:scale-95"
            )}
          >
            <Save className="w-3 h-3" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 flex gap-3 min-h-0">

        {/* ── SIDEBAR ── */}
        <div className="w-48 shrink-0 flex flex-col bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* Search */}
          <div className="px-2.5 pt-2.5 pb-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full pl-6 pr-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-300 focus:bg-white transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Nav */}
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            {visibleTabs.length === 0 && (
              <div className="text-[10px] text-gray-400 text-center py-6 font-medium">No matches</div>
            )}
            {visibleTabs.map((m) => (
              <NavItem
                key={m.id}
                node={m}
                active={!filteredKeys && activeTab === m.id}
                onClick={() => { setActiveTab(m.id); setSearch(""); }}
                filtered={!!filteredKeys}
              />
            ))}
          </div>
        </div>

        {/* ── CONTENT ── */}
        <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden min-w-0">

          {/* Content header */}
          <div className="shrink-0 px-4 py-2.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2">
              {filteredKeys ? (
                <>
                  <Search className="w-3.5 h-3.5 text-violet-500" />
                  <span className="text-xs font-bold text-gray-900">Search: <em className="not-italic text-violet-600">"{search}"</em></span>
                  <span className="text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded font-semibold">{filteredKeys.size} found</span>
                </>
              ) : activeModule ? (
                <>
                  <span className="text-base leading-none">{activeModule.icon}</span>
                  <span className="text-xs font-bold text-gray-900">{activeModule.label}</span>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-semibold">{countPerms(activeModule)} perms</span>
                </>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400 font-medium">Role:</span>
              <span className={cx(
                "text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wide",
                roleMeta.badge
              )}>
                {selectedRole}
              </span>
            </div>
          </div>

          {/* Permission list */}
          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-gray-500">Loading…</span>
                </div>
              </div>
            ) : filteredKeys ? (
              // Search mode: show all matching sections
              filteredKeys.size === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                  <Search className="w-8 h-8 text-gray-200" />
                  <p className="text-xs text-gray-500">No permissions match "<strong>{search}</strong>"</p>
                </div>
              ) : (
                <div>
                  {PERMISSION_TREE.map((m) => {
                    if (!sectionHasMatch(m, filteredKeys)) return null;
                    return (
                      <div key={m.id} className="mb-4">
                        <div className="flex items-center gap-1.5 mb-2 px-1">
                          <span className="text-sm leading-none">{m.icon}</span>
                          <span className="text-[11px] font-bold text-gray-700">{m.label}</span>
                          <div className="flex-1 h-px bg-gray-100" />
                        </div>
                        {m.children.map((child) => (
                          <Section
                            key={child.id}
                            node={child}
                            roleMap={currentRoleMap}
                            onSet={setPerm}
                            role={selectedRole}
                            filteredKeys={filteredKeys}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              )
            ) : activeModule ? (
              <div>
                {activeModule.children.map((child) => (
                  <Section
                    key={child.id}
                    node={child}
                    roleMap={currentRoleMap}
                    onSet={setPerm}
                    role={selectedRole}
                    filteredKeys={null}
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-gray-400">
                Select a module from the left
              </div>
            )}
          </div>

          {/* Footer: quick stats bar */}
          <div className="shrink-0 px-4 py-2 border-t border-gray-100 flex items-center gap-4 bg-gray-50/50">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span className="text-[10px] text-gray-500 font-medium">
                <strong className="text-emerald-600">{allowedCount}</strong> allowed
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="w-3 h-3 text-red-400" />
              <span className="text-[10px] text-gray-500 font-medium">
                <strong className="text-red-500">{totalCount - allowedCount}</strong> denied
              </span>
            </div>
            <div className="flex-1" />
            <div className="text-[10px] text-gray-400">
              Use <code className="font-mono bg-gray-100 px-1 rounded text-gray-600">{"<RequirePermission>"}</code> to guard components
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

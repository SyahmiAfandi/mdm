import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebaseClient";
import { doc, getDoc } from "firebase/firestore";

/**
 * usePermissions()
 * - Reads user's role from /roles/{uid} (field: role)
 * - Reads permissions from /rolePermissions/{role} (field: permissions: { [key]: boolean })
 *
 * Improvements:
 * - Wildcards supported: "reports.*", "admin.*", "*"
 * - Default role fallback (e.g. viewer) if role doc missing
 * - Helpers for UI: can(), canAll(), canAny(), filterNav()
 */

const DEFAULT_OPTIONS = {
  defaultRole: "viewer",
  roleCollection: "roles",
  roleField: "role",
  rolePermissionsCollection: "rolePermissions",
  // Optional: cache permissions for snappier nav rendering
  cacheKey: "perm_cache_v1",
  cacheTtlMs: 60_000, // 1 minute
};

function now() {
  return Date.now();
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function loadCache(cacheKey) {
  if (!cacheKey) return null;
  const raw = localStorage.getItem(cacheKey);
  return raw ? safeJsonParse(raw) : null;
}

function saveCache(cacheKey, value) {
  if (!cacheKey) return;
  try {
    localStorage.setItem(cacheKey, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/**
 * Wildcard rules:
 * - Exact match wins ("reports.view")
 * - Then try parent wildcards ("reports.*", "reports.status.*")
 * - Then global wildcard ("*")
 */
export function canWithWildcards(perms, key) {
  if (!key) return false;
  if (perms?.[key] === true) return true;
  if (perms?.[key] === false) return false;

  const parts = String(key).split(".").filter(Boolean);
  // progressively reduce: a.b.c => a.b.* then a.*
  for (let i = parts.length - 1; i >= 1; i--) {
    const prefix = parts.slice(0, i).join(".");
    const wild = `${prefix}.*`;
    if (perms?.[wild] === true) return true;
    if (perms?.[wild] === false) return false;
  }

  if (perms?.["*"] === true) return true;
  if (perms?.["*"] === false) return false;

  return false;
}

/**
 * Filter sidebar/nav config by permissions.
 *
 * Expected item shape (flexible):
 * { label, to, icon, perm?: string | string[], requireAll?: boolean, children?: [] }
 */
export function filterNavByPermissions(items = [], canFn) {
  const walk = (arr) =>
    (arr || [])
      .map((item) => {
        const children = item.children ? walk(item.children) : undefined;

        const perms = item.perm;
        const requireAll = !!item.requireAll;
        const allowed = !perms
          ? true
          : Array.isArray(perms)
          ? requireAll
            ? perms.every((p) => canFn(p))
            : perms.some((p) => canFn(p))
          : canFn(perms);

        // Keep parent if allowed OR any child remains
        if (!allowed && (!children || children.length === 0)) return null;

        return {
          ...item,
          ...(children ? { children } : {}),
        };
      })
      .filter(Boolean);

  return walk(items);
}

export function usePermissions(options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [state, setState] = useState({
    loading: true,
    user: null,
    role: null,
    perms: {},
  });

  // Load cached snapshot immediately (fast sidebar render)
  useEffect(() => {
    const cached = loadCache(opts.cacheKey);
    if (!cached) return;
    if (cached.expiresAt && cached.expiresAt < now()) return;

    // only apply cache if we haven't loaded yet
    setState((prev) => {
      if (!prev.loading) return prev;
      return {
        ...prev,
        role: cached.role ?? prev.role,
        perms: cached.perms ?? prev.perms,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setState({ loading: false, user: null, role: null, perms: {} });
        return;
      }

      setState((p) => ({ ...p, loading: true, user: u }));
      try {
        // 1) Read role
        const roleSnap = await getDoc(doc(db, opts.roleCollection, u.uid));
        let role = roleSnap.exists() ? roleSnap.data()?.[opts.roleField] : null;
        if (!role) role = opts.defaultRole;

        // 2) Read role permissions
        let perms = {};
        if (role) {
          const rp = await getDoc(doc(db, opts.rolePermissionsCollection, role));
          perms = rp.exists() ? rp.data()?.permissions || {} : {};
        }

        setState({ loading: false, user: u, role, perms });

        saveCache(opts.cacheKey, {
          role,
          perms,
          expiresAt: now() + opts.cacheTtlMs,
        });
      } catch (e) {
        console.error(e);
        setState({ loading: false, user: u, role: opts.defaultRole, perms: {} });
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const api = useMemo(() => {
    const can = (key) => canWithWildcards(state.perms, key);
    const canAll = (keys = []) => (keys || []).every((k) => can(k));
    const canAny = (keys = []) => (keys || []).some((k) => can(k));
    const filterNav = (items) => filterNavByPermissions(items, can);

    return { can, canAll, canAny, filterNav };
  }, [state.perms]);

  return { ...state, ...api };
}

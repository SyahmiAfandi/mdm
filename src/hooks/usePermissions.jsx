import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

/**
 * usePermissions()
 * - Reads user's role from user_roles (field: role)
 * - Reads permissions from role_permissions rows: { role, permission, allow }
 *
 * Improvements:
 * - Wildcards supported: "reports.*", "admin.*", "*"
 * - Default role fallback (e.g. viewer) if role doc missing
 * - Helpers for UI: can(), canAll(), canAny(), filterNav()
 */

const DEFAULT_OPTIONS = {
  defaultRole: "viewer",
  roleCollection: "user_roles",
  roleField: "role",
  rolePermissionsCollection: "role_permissions",
  // Optional: cache permissions for snappier nav rendering
  cacheKey: "perm_cache_v1",
  cacheTtlMs: 24 * 60 * 60 * 1000, // 24 hours
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

export function canWithWildcards(perms, key) {
  if (!key) return false;
  if (perms?.[key] === true) return true;
  if (perms?.[key] === false) return false;

  const parts = String(key).split(".").filter(Boolean);
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

export function normalizePermissionRows(rows = []) {
  const out = {};
  (rows || []).forEach((row) => {
    const key = String(row?.permission ?? "").trim();
    if (!key) return;
    const allow = Number(row?.allow ?? 0) === 1;
    out[key] = allow;
  });
  return out;
}

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

        if (!allowed && (!children || children.length === 0)) return null;

        return {
          ...item,
          ...(children ? { children } : {}),
        };
      })
      .filter(Boolean);

  return walk(items);
}

const PermissionsContext = createContext(null);

export function PermissionsProvider({ children, options = {} }) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [state, setState] = useState({
    loading: true,
    user: null,
    role: null,
    perms: {},
  });

  // Load cached snapshot immediately — also sets loading=false so RequirePermission
  // does NOT unmount child pages while the background network refresh runs.
  useEffect(() => {
    const cached = loadCache(opts.cacheKey);
    if (!cached) return;
    if (cached.expiresAt && cached.expiresAt < now()) return;

    setState((prev) => ({
      ...prev,
      role: cached.role ?? prev.role,
      perms: cached.perms ?? prev.perms,
      // ✅ KEY FIX: mark as loaded immediately so pages don't remount mid-refresh
      loading: false,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[usePermissions] Auth event: ${event}`);
      const u = session?.user || null;
      if (!u) {
        setState({ loading: false, user: null, role: null, perms: {} });
        return;
      }

      // Only show loading if we have NO data. 
      // If we have cached role/perms, don't show loading so user stays on Home.
      setState((p) => ({ ...p, user: u, loading: p.role ? false : true }));
      
      const refreshStart = Date.now();
      try {
        console.log(`[usePermissions] Background refresh starting for ${u.email}...`);
        
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const headers = { apikey: key, Authorization: `Bearer ${key}` };

        // 1. Fetch Role via RAW API
        const roleRes = await fetch(`${url}/rest/v1/${opts.roleCollection}?id=eq.${u.id}&select=${opts.roleField}`, { 
          headers, signal: AbortSignal.timeout(5000) 
        });
        const roleData = await roleRes.json();
        let role = (roleData?.[0]?.[opts.roleField]) || opts.defaultRole;

        // 2. Fetch Perms via RAW API
        let perms = {};
        if (role) {
          const permsRes = await fetch(`${url}/rest/v1/${opts.rolePermissionsCollection}?role=eq.${role}&select=permission,allow`, { 
            headers, signal: AbortSignal.timeout(5000) 
          });
          const permsData = await permsRes.json();
          perms = normalizePermissionRows(permsData);
        }
        
        console.log(`[usePermissions] Background refresh done in ${Date.now() - refreshStart}ms (role=${role})`);
        setState({ loading: false, user: u, role, perms });
        saveCache(opts.cacheKey, { role, perms, expiresAt: now() + opts.cacheTtlMs });
      } catch (e) {
        console.warn(`[usePermissions] Background refresh stalled or failed (${Date.now() - refreshStart}ms). Using existing state.`, e.message);
        setState((p) => ({ ...p, loading: false, user: u, role: p.role || opts.defaultRole }));
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const api = useMemo(() => {
    const can = (key) => canWithWildcards(state.perms, key);
    const canAll = (keys = []) => (keys || []).every((k) => can(k));
    const canAny = (keys = []) => (keys || []).some((k) => can(k));
    const filterNav = (items) => filterNavByPermissions(items, can);

    return { can, canAll, canAny, filterNav };
  }, [state.perms]);

  return <PermissionsContext.Provider value={{ ...state, ...api }}>{children}</PermissionsContext.Provider>;
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    console.warn("usePermissions must be used within a PermissionsProvider. Returning empty permissions.");
    return {
      loading: false,
      user: null,
      role: null,
      perms: {},
      can: () => false,
      canAll: () => false,
      canAny: () => false,
      filterNav: (items) => items,
    };
  }
  return ctx;
}

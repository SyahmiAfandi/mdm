// context/UserContext.js
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

const UserContext = createContext(null);

const STORAGE_KEY = "mdm_auth_v1";

export const UserProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);

  // IMPORTANT: start as null (not a truthy object)
  const [user, setUser] = useState(null); // { name, email } | null
  const [role, setRole] = useState(null); // "admin" | "user" | etc | null

  // Restore session on first load (deep links included)
  useEffect(() => {
    let mounted = true;

    // 1. First, check local storage for immediate (optimistic) UI rendering
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.user?.email && parsed?.role) {
          setUser(parsed.user);
          setRole(parsed.role);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }

    // 2. Listen to Supabase for the actual source of truth.
    // Only clear the local user state on an explicit SIGNED_OUT.
    // This avoids a race condition on page reload where the initial auth
    // check fires before the session is confirmed, causing the UI to flicker
    // and pages to remount with stale cached data.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        if (event === "SIGNED_OUT") {
          setUser(null);
          setRole(null);
          localStorage.removeItem(STORAGE_KEY);
        }

        // Mark loading as done once Supabase has responded for the first time.
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Persist on changes
  useEffect(() => {
    if (loading) return;
    if (user?.email && role) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, role }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user, role, loading]);

  // Centralized logout (very important so role is always cleared)
  const logout = () => {
    setUser(null);
    setRole(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo(
    () => ({
      loading,
      user,
      role,
      setUser,
      setRole,
      logout,
      isAuthed: !!(user?.email && role),
    }),
    [loading, user, role]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within <UserProvider />");
  return ctx;
};
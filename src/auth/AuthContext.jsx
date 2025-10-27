// src/auth/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { observeAuth } from "../firebaseClient";

const AuthCtx = createContext({ user: null, loading: true });

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, loading: true });

  useEffect(() => {
    const unsub = observeAuth((user) => setState({ user, loading: false }));
    return () => unsub();
  }, []);

  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}

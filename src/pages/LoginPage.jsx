// src/pages/LoginPage.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  CheckCircle,
  Eye,
  EyeOff,
  Lock,
  User,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { useUser } from "../context/UserContext";

/**
 * IMPORTANT:
 * - This version logs in ONLY ONCE via loginWithUsername()
 * - loginWithUsername() already does Firebase Auth signInWithEmailAndPassword()
 * - We do NOT signIn again in this page (prevents "double login" + signOut issues)
 */
import {
  loginWithUsername,
  logout,
  buildPermissionSnapshot,
  persistPermissionSnapshot,
} from "../firebaseClient";

const PERM_STORAGE_KEY = "ff.permissions";
const ROLE_STORAGE_KEY = "ff.role";

export default function LoginPage() {
  const [username, setUserName] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [success, setSuccess] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  // UI-only
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [shake, setShake] = useState(false);

  const navigate = useNavigate();
  const { setRole, setUser } = useUser();

  const canSubmit = useMemo(() => {
    return !!username.trim() && !!password && !loading && !success;
  }, [username, password, loading, success]);

  const clearLocalPerms = () => {
    try {
      localStorage.removeItem(PERM_STORAGE_KEY);
      localStorage.removeItem(ROLE_STORAGE_KEY);
      localStorage.removeItem("username");
    } catch {}
  };

  const hardSignOutEverywhere = async () => {
    try {
      await logout();
    } catch {}
    clearLocalPerms();
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 420);
  };

  const handleLogin = async () => {
    setLoading(true);
    setError("");

    // prevent duplicates
    toast.dismiss("login");

    try {
      // ✅ Single login source-of-truth:
      const result = await loginWithUsername(username, password);
      const { user, role, profile, license, licenseValid, permissions } = result;

      const resolvedRole = role || "viewer";

      // ✅ License gate
      if (!licenseValid) {
        await hardSignOutEverywhere();
        setLoading(false);

        let expText = "N/A";
        try {
          const d = license?.validUntil?.toDate?.() || null;
          if (d) expText = d.toISOString().slice(0, 10);
        } catch {}

        toast.error(`❌ Account expired on ${expText}`, { id: "login" });
        triggerShake();
        return;
      }

      // ✅ Put into context (for UI / headers / permissions)
      setRole(resolvedRole);
      setUser({
        uid: user?.uid || "",
        name: profile?.name || profile?.username || username,
        email: profile?.email || user?.email || "",
      });

      // ✅ Persist UI bits
      localStorage.setItem(
        "username",
        profile?.name || profile?.username || username
      );
      localStorage.setItem(ROLE_STORAGE_KEY, resolvedRole);

      // ✅ Permission snapshot for sidebar/guards
      const permSnapshot = buildPermissionSnapshot(resolvedRole, permissions);
      persistPermissionSnapshot(resolvedRole, permSnapshot);

      setLoading(false);
      setSuccess(true);

      toast.success("🎉 Welcome! Logged in successfully.", { id: "login" });

      // Navigate after a short success animation
      setTimeout(() => {
        setFadeOut(true);
        setTimeout(() => navigate("/"), 450);
      }, 900);
    } catch (e) {
      console.error(e);
      setLoading(false);

      // Ensure no partial session remains
      await hardSignOutEverywhere();

      const msg = e?.message || "Invalid credentials";
      setError(msg);

      toast.error(msg, { id: "login" });
      triggerShake();
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-slate-950">
      <style>{`
        /* ===== Animated background ===== */
        .animated-gradient {
          background: linear-gradient(-45deg,
            rgba(37, 99, 235, 0.55),
            rgba(79, 70, 229, 0.55),
            rgba(14, 165, 233, 0.50),
            rgba(30, 58, 138, 0.60)
          );
          background-size: 400% 400%;
          animation: gradientMove 14s ease infinite;
          filter: saturate(1.15);
        }
        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        /* ===== UI animations ===== */
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(10px); } }
        @keyframes pop { 0% { transform: scale(.96); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-6px); } 80% { transform: translateX(6px); } }
        .anim-in { animation: fadeIn .55s ease-out both; }
        .anim-out { animation: fadeOut .5s ease-in both; }
        .anim-pop { animation: pop .35s ease-out both; }
        .anim-shake { animation: shake .42s ease-in-out both; }
      `}</style>

      {/* Animated gradient layer */}
      <div className="absolute inset-0 animated-gradient" />

      {/* Live soft glows */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-400/25 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -right-24 h-80 w-80 rounded-full bg-indigo-400/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-24 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl" />

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-slate-950/35" />

      {/* Content */}
      <div className={["relative z-10 w-full max-w-md", fadeOut ? "anim-out" : "anim-in"].join(" ")}>
        <div
          className={[
            "rounded-2xl border border-white/20 bg-white/75 backdrop-blur-xl",
            "shadow-[0_20px_60px_-20px_rgba(0,0,0,0.55)]",
            "p-6 sm:p-8",
            shake ? "anim-shake" : "",
          ].join(" ")}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <Sparkles className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Welcome back
              </h2>
              <p className="text-sm text-slate-600">
                Sign in to continue to your dashboard
              </p>
            </div>
          </div>

          {/* Username */}
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Username
          </label>
          <div className="relative mb-4">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <User size={18} />
            </span>
            <input
              type="text"
              placeholder="User Name"
              className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-200 bg-white/85 text-slate-900 placeholder:text-slate-400
                          focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400
                          transition shadow-sm hover:shadow"
              value={username}
              onChange={(e) => setUserName(e.target.value)}
              disabled={loading || success}
              autoComplete="username"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) handleLogin();
              }}
              aria-label="Username"
            />
          </div>

          {/* Password */}
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Password
          </label>
          <div className="relative mb-2">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Lock size={18} />
            </span>

            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="w-full pl-10 pr-12 py-3 rounded-xl border border-slate-200 bg-white/85 text-slate-900 placeholder:text-slate-400
                          focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-400
                          transition shadow-sm hover:shadow"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || success}
              autoComplete="current-password"
              onKeyDown={(e) => {
                setCapsOn(!!e.getModifierState?.("CapsLock"));
                if (e.key === "Enter" && canSubmit) handleLogin();
              }}
              onBlur={() => setCapsOn(false)}
              aria-label="Password"
            />

            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition disabled:opacity-50"
              disabled={loading || success || !password}
              title={showPassword ? "Hide password" : "Show password"}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {capsOn && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4 anim-pop">
              <AlertCircle size={14} />
              Caps Lock is ON
            </div>
          )}

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={!canSubmit}
            className="group w-full relative overflow-hidden rounded-xl py-3 font-semibold text-white
                        bg-gradient-to-r from-blue-600 to-indigo-600
                        shadow-lg shadow-blue-600/25
                        hover:shadow-xl hover:shadow-indigo-600/30
                        focus:outline-none focus:ring-2 focus:ring-blue-500/60
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition"
            title={!username.trim() || !password ? "Enter username and password" : ""}
          >
            <span className="relative flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="text-white anim-pop" size={22} />
                  Success
                </>
              ) : (
                "Login"
              )}
            </span>
          </button>

          {/* Inline error (toast will also show) */}
          {error && (
            <div className="mt-4 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 anim-pop">
              <AlertCircle className="mt-0.5" size={16} />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          <p className="mt-5 text-xs text-slate-600 text-center">
            Tip: Press <span className="font-semibold text-slate-800">Enter</span> to sign in.
          </p>
        </div>
      </div>
    </div>
  );
}
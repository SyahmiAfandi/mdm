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
    } catch { }
  };

  const hardSignOutEverywhere = async () => {
    try {
      await logout();
    } catch { }
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
        } catch { }

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
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-[#030712] font-sans selection:bg-indigo-500/30">
      <style>{`
        .bg-rays {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: radial-gradient(circle at 50% -20%, rgba(120,119,198,0.15), rgba(255,255,255,0));
          pointer-events: none;
        }
        .orb-1 {
          position: absolute; top: 10%; left: 20%; width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(0,0,0,0) 70%);
          border-radius: 50%; filter: blur(40px); animation: float 8s ease-in-out infinite;
        }
        .orb-2 {
          position: absolute; bottom: 10%; right: 20%; width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(236,72,153,0.1) 0%, rgba(0,0,0,0) 70%);
          border-radius: 50%; filter: blur(60px); animation: float 10s ease-in-out infinite reverse;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-20px) scale(1.05); }
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); filter: blur(10px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
        @keyframes fadeOut { from { opacity: 1; transform: translateY(0); filter: blur(0); } to { opacity: 0; transform: translateY(-20px); filter: blur(10px); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
        @keyframes pop { 0% { transform: scale(.96); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes float-icon { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        
        .anim-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .anim-out { animation: fadeOut 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .anim-shake { animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both; }
        .anim-pop { animation: pop .35s ease-out both; }
        .float-icon { animation: float-icon 4s ease-in-out infinite; }
        
        .glass-card {
          background: rgba(17, 24, 39, 0.45);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255,255,255,0.1);
        }
        .glass-input {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #f8fafc;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .glass-input:focus {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(99, 102, 241, 0.5);
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
        }
        .glass-input::placeholder { color: rgba(148, 163, 184, 0.4); }
        .shimmer-btn {
          background: linear-gradient(110deg, #4f46e5 0%, #7c3aed 50%, #4f46e5 100%);
          background-size: 200% auto;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .shimmer-btn:hover:not(:disabled) {
          background-position: right center;
          box-shadow: 0 0 20px rgba(124, 58, 237, 0.4);
          transform: translateY(-1px);
        }
        .shimmer-btn:active:not(:disabled) {
          transform: translateY(1px);
        }
      `}</style>

      {/* Background elements */}
      <div className="bg-rays"></div>
      <div className="orb-1"></div>
      <div className="orb-2"></div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik0wIDM5LjVoNDBWMGgtMXYzOXoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNCkiLz48L3N2Zz4=')" }}></div>

      {/* Content */}
      <div className={["relative z-10 w-full max-w-[420px]", fadeOut ? "anim-out" : "anim-in"].join(" ")}>
        {/* Logo / Header Icon above card */}
        <div className="flex justify-center mb-8">
          <div className="relative group float-icon">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-40 group-hover:opacity-60 transition duration-500"></div>
            <div className="relative h-16 w-16 rounded-2xl bg-slate-900/80 border border-white/10 flex items-center justify-center shadow-2xl backdrop-blur-sm">
              <Sparkles className="text-indigo-400" size={28} />
            </div>
          </div>
        </div>

        <div
          className={[
            "glass-card rounded-3xl p-8 sm:p-10",
            shake ? "anim-shake" : "",
          ].join(" ")}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
              Welcome back
            </h2>
            <p className="text-sm text-slate-400">
              Enter your credentials to access your dashboard
            </p>
          </div>

          {/* Username */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 ml-1">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                <User size={18} />
              </span>
              <input
                type="text"
                placeholder="Enter your username"
                className="glass-input w-full pl-11 pr-4 py-3.5 rounded-xl focus:outline-none"
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
          </div>

          {/* Password */}
          <div className="mb-6">
            <div className="flex justify-between items-end mb-2 ml-1">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Password
              </label>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                <Lock size={18} />
              </span>

              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="glass-input w-full pl-11 pr-12 py-3.5 rounded-xl focus:outline-none"
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
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                disabled={loading || success || !password}
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {capsOn && (
            <div className="flex items-center gap-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 mb-6 anim-pop">
              <AlertCircle size={14} className="text-amber-400" />
              Caps Lock is ON
            </div>
          )}

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={!canSubmit}
            className="shimmer-btn w-full relative overflow-hidden rounded-xl py-3.5 font-bold text-white
                        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
            title={!username.trim() || !password ? "Enter username and password" : ""}
          >
            <span className="relative flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="text-white anim-pop" size={20} />
                  Success!
                </>
              ) : (
                "Sign In"
              )}
            </span>
          </button>

          {/* Inline error */}
          {error && (
            <div className="mt-5 flex items-start gap-2 text-sm text-red-200 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 anim-pop">
              <AlertCircle className="mt-0.5 text-red-400 shrink-0" size={16} />
              <span className="leading-snug">{error}</span>
            </div>
          )}
        </div>

        {/* Footer subtle text */}
        <p className="mt-8 text-xs text-slate-500 text-center font-medium tracking-wide">
          SECURE ENCRYPTED LOGIN
        </p>
      </div>
    </div>
  );
}
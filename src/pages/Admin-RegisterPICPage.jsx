import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import { getBackendUrl } from "../config/backend";
import { 
  UserPlus2, 
  ArrowLeft, 
  User, 
  Mail, 
  Lock, 
  ShieldCheck, 
  Calendar,
  CheckCircle2,
  Loader2,
  AlertCircle
} from "lucide-react";
import { motion } from "framer-motion";

const TEMP_PASSWORD = "Password!123";
const MotionDiv = motion.div;

async function readJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function mapRegisterError(err) {
  const message = String(err?.message || "").trim();
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("failed to fetch")) {
    return "Could not reach the backend. Make sure the Flask backend is running and the header backend URL points to it.";
  }

  if (lowerMessage.includes("invalid or expired session")) {
    return "Your admin session expired. Please sign in again and retry.";
  }

  if (lowerMessage.includes("admin access required")) {
    return "This action requires an admin account.";
  }

  if (lowerMessage.includes("email signups are disabled")) {
    return "Supabase Email signups are disabled. Open Authentication > Providers > Email, enable Email signups, and keep Confirm email off if you do not want verification emails.";
  }

  return message || "An error occurred during registration.";
}

function RegisterPICPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: TEMP_PASSWORD,
    role: "user",
    validUntil: "",
  });

  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.name || !form.username || !form.email || !form.password) {
      toast.error("Please fill in all required fields.");
      return;
    }

    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id || !session?.access_token) {
        throw new Error("Your current admin session expired. Please sign in again and retry.");
      }

      const backendUrl = getBackendUrl();
      if (!backendUrl) {
        throw new Error("Backend URL is not configured. Set it from the header backend control and try again.");
      }

      const response = await fetch(`${backendUrl}/admin/register-pic`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: form.name,
          username: form.username,
          email: form.email,
          password: form.password,
          role: form.role,
          validUntil: form.validUntil,
        }),
      });

      const payload = await readJsonSafely(response);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to register the user.");
      }

      toast.success(payload?.message || "User successfully registered with a temporary password.");

      setTimeout(() => {
        navigate("/settings/admin/users");
      }, 1500);

    } catch (err) {
      console.error(err);
      toast.error(mapRegisterError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4">
      <Toaster position="top-right" />
      
      {/* Header aligned with AdminUsersPage */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 px-6 py-5 shadow-lg relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-emerald-500/5 opacity-50" />
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between relative z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <button 
                onClick={() => navigate(-1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-white transition hover:bg-white/20"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-200/80">Settings / Admin</div>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <UserPlus2 className="text-blue-400" size={24} />
              Register New PIC
            </h2>
            <p className="mt-0.5 text-xs text-slate-300">
              Create a new user account with distinct credentials and license validity.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-[58px] px-4 flex flex-col justify-center rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-blue-200/60 leading-none mb-1.5">Action</div>
              <div className="text-sm font-black text-white leading-none">Registration</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Form Section */}
        <div className="lg:col-span-2 space-y-4">
          <MotionDiv 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 backdrop-blur-sm"
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">
                    <User size={12} /> Full Name
                  </label>
                  <input
                    name="name"
                    required
                    placeholder="e.g. John Doe"
                    value={form.name}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-bold transition-all focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950/50 dark:focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">
                    <ShieldCheck size={12} /> Unique Username
                  </label>
                  <input
                    name="username"
                    required
                    placeholder="e.g. jdoe_01"
                    value={form.username}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-bold transition-all focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950/50 dark:focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">
                    <Mail size={12} /> Contact Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="jdoe@example.com"
                    value={form.email}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-bold transition-all focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950/50 dark:focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">
                    <Lock size={12} /> Account Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    required
                    placeholder={TEMP_PASSWORD}
                    value={form.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-bold transition-all focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950/50 dark:focus:border-indigo-500"
                  />
                  <div className="flex flex-col gap-2 px-1 pt-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      Default temporary password: <span className="font-black text-slate-700 dark:text-slate-200">{TEMP_PASSWORD}</span>. Ask the user to change it after first sign-in.
                    </p>
                    <button
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, password: TEMP_PASSWORD }))}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-indigo-500 dark:hover:text-indigo-300"
                    >
                      Reset Temp Password
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">
                    <ShieldCheck size={12} /> Access Level (Role)
                  </label>
                  <select
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-bold transition-all focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950/50 dark:focus:border-indigo-500"
                  >
                    <option value="user">User (Standard Access)</option>
                    <option value="viewer">Viewer (Read Only)</option>
                    <option value="admin">Administrator (Full Access)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">
                    <Calendar size={12} /> License Validity Until
                  </label>
                  <input
                    type="date"
                    name="validUntil"
                    value={form.validUntil}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-bold transition-all focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950/50 dark:focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  {loading ? "Processing..." : "Register Account"}
                </button>
              </div>
            </form>
          </MotionDiv>
        </div>

        {/* Side Section aligned with Admin density */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-2">
              <AlertCircle size={14} className="text-indigo-500" /> Account Policy
            </h3>
            <div className="space-y-3">
              {[
                "Credentials are created through the backend admin flow without signup emails.",
                `Default temporary password can be ${TEMP_PASSWORD}.`,
                "New PIC users must change that password after first sign-in.",
                "Username must be unique for identification.",
                "License Date controls automated expiry."
              ].map((text, i) => (
                <div key={i} className="flex gap-3">
                  <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[8px] font-bold text-slate-500 dark:bg-slate-800">
                    {i + 1}
                  </div>
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 leading-normal">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-5 shadow-sm dark:border-indigo-900/20 dark:bg-indigo-950/10">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-indigo-100 text-indigo-500 shadow-sm dark:bg-slate-950 dark:border-indigo-900/30">
                <ShieldCheck size={20} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 leading-none">Verified Security</div>
                <p className="mt-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-tight">
                  Secure multi-table persistence across Auth & Database layers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPICPage;

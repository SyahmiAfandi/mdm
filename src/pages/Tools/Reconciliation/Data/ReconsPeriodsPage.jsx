import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "../../../../supabaseClient";
import { Plus, RefreshCcw, Lock, Unlock, Archive, CheckCircle2, Trash2 } from "lucide-react";
import { useUser } from "../../../../context/UserContext";

const COL = "recon_periods";

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad2 = (n) => String(n).padStart(2, "0");
const makePeriodId = (year, monthNumber) => `${year}-${pad2(monthNumber)}`;
const toMonthName = (monthNumber) => monthNames[monthNumber - 1] || "";
const mapPeriod = (r) => ({
  ...r,
  id: r.id ?? r.period_id ?? r.periodId,
  periodId: r.period_id ?? r.periodId ?? r.id,
  monthName: r.month_name ?? r.monthName ?? "",
  createdAt: r.created_at ?? r.createdAt ?? null,
  createdBy: r.created_by ?? r.createdBy ?? null,
  updatedAt: r.updated_at ?? r.updatedAt ?? null,
  updatedBy: r.updated_by ?? r.updatedBy ?? null,
  lockedAt: r.locked_at ?? r.lockedAt ?? null,
  lockedBy: r.locked_by ?? r.lockedBy ?? null,
});

function statusBadge(status) {
  const base = "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold";
  if (status === "active") return `${base} bg-emerald-50 text-emerald-700 border border-emerald-200`;
  if (status === "locked") return `${base} bg-amber-50 text-amber-700 border border-amber-200`;
  if (status === "archived") return `${base} bg-slate-50 text-slate-700 border border-slate-200`;
  return `${base} bg-slate-50 text-slate-600 border border-slate-200`;
}

export default function ReconsPeriodsPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [allowedYears, setAllowedYears] = useState([]);

  const canManage = !!user;
  const actorName = user?.display_name?.trim() || user?.name?.trim() || user?.email || "unknown";

  async function fetchAllowedYears() {
    try {
      const { data, error } = await supabase.from("master_years").select("*").order("year", { ascending: true });
      if (error) throw error;
      const activeYears = (data || [])
        .filter((y) => y.active === true)
        .map((y) => y.year)
        .filter(Boolean);
      setAllowedYears(activeYears);
      if (activeYears.length && !activeYears.includes(year)) setYear(activeYears[0]);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load active years");
    }
  }

  async function fetchPeriods() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from(COL).select("*");
      if (error) throw error;
      const mapped = (data || []).map(mapPeriod).sort((a, b) => String(b.periodId || "").localeCompare(String(a.periodId || "")));
      setRows(mapped);
    } catch (e) {
      console.error(e);
      toast.error(`${e?.code || "error"}: ${e?.message || "Failed to load periods"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAllowedYears();
    fetchPeriods();
  }, []);

  async function createPeriod() {
    if (!canManage) return toast.error("No permission");
    const periodId = makePeriodId(year, month);
    setLoading(true);
    try {
      const { data: exists } = await supabase.from(COL).select("*").eq("id", periodId).maybeSingle();
      if (exists) {
        toast(`Period already exists: ${periodId}`, { icon: "ℹ️" });
        return;
      }
      const { error } = await supabase.from(COL).insert({
        id: periodId,
        period_id: periodId,
        year: Number(year),
        month: Number(month),
        month_name: toMonthName(Number(month)),
        status: "active",
        created_at: new Date().toISOString(),
        created_by: actorName,
        locked_at: null,
        locked_by: null,
        notes: "",
      });
      if (error) throw error;
      toast.success(`Created period ${periodId}`);
      await fetchPeriods();
    } catch (e) {
      console.error(e);
      toast.error(`${e?.code || "error"}: ${e?.message || "Failed to create period"}`);
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(periodId, status) {
    if (!canManage) return toast.error("No permission");
    setLoading(true);
    try {
      const { error } = await supabase.from(COL).update({ status, updated_at: new Date().toISOString(), updated_by: actorName }).eq("id", periodId);
      if (error) throw error;
      toast.success(`Updated ${periodId} → ${status}`);
      await fetchPeriods();
    } catch (e) {
      console.error(e);
      toast.error(`${e?.code || "error"}: ${e?.message || "Failed to update status"}`);
    } finally {
      setLoading(false);
    }
  }

  async function lockPeriod(periodId) {
    if (!canManage) return toast.error("No permission");
    setLoading(true);
    try {
      const { error } = await supabase.from(COL).update({
        status: "locked",
        locked_at: new Date().toISOString(),
        locked_by: actorName,
        updated_at: new Date().toISOString(),
        updated_by: actorName,
      }).eq("id", periodId);
      if (error) throw error;
      toast.success(`Locked ${periodId}`);
      await fetchPeriods();
    } catch (e) {
      console.error(e);
      toast.error(`${e?.code || "error"}: ${e?.message || "Failed to lock period"}`);
    } finally {
      setLoading(false);
    }
  }

  async function unlockPeriod(periodId) {
    if (!canManage) return toast.error("No permission");
    setLoading(true);
    try {
      const { error } = await supabase.from(COL).update({
        status: "active",
        locked_at: null,
        locked_by: null,
        updated_at: new Date().toISOString(),
        updated_by: actorName,
      }).eq("id", periodId);
      if (error) throw error;
      toast.success(`Unlocked ${periodId}`);
      await fetchPeriods();
    } catch (e) {
      console.error(e);
      toast.error(`${e?.code || "error"}: ${e?.message || "Failed to unlock period"}`);
    } finally {
      setLoading(false);
    }
  }

  async function deletePeriod(periodId) {
    if (!canManage) return toast.error("No permission");
    const row = rows.find((x) => x.id === periodId);
    if (row?.status === "locked") return toast.error("This period is locked. Unlock it before deleting.");
    if (!window.confirm(`Delete period ${periodId}?\n\nThis removes the period only. Existing reconCells for this period are not deleted automatically.`)) return;
    setLoading(true);
    try {
      const { error } = await supabase.from(COL).delete().eq("id", periodId);
      if (error) throw error;
      toast.success(`Deleted period ${periodId}`);
      await fetchPeriods();
    } catch (e) {
      console.error(e);
      toast.error(`${e?.code || "error"}: ${e?.message || "Failed to delete period"}`);
    } finally {
      setLoading(false);
    }
  }

  const countText = useMemo(() => `${rows.length} period(s)`, [rows.length]);

  return (
    <div className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Recons Period Setup</h1>
          <p className="text-sm text-slate-600">Create and manage reconciliation periods (YYYY-MM). Lock a period to prevent changes.</p>
          <div className="mt-2 text-xs text-slate-500">
            Signed in as: <span className="font-semibold">{actorName}</span> | canManage: <span className="font-semibold">{String(canManage)}</span>
          </div>
        </div>
        <button onClick={fetchPeriods} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50" disabled={loading}><RefreshCcw className="h-4 w-4" />Refresh</button>
      </div>

      <div className="mb-5 rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-slate-600">Year</label>
            <select className="mt-1 w-32 rounded-lg border px-3 py-2 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {allowedYears.length === 0 && <option value="">No active year</option>}
              {allowedYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-slate-600">Month</label>
            <select className="mt-1 w-52 rounded-lg border px-3 py-2 text-sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {monthNames.map((m, idx) => <option key={m} value={idx + 1}>{pad2(idx + 1)} — {m}</option>)}
            </select>
          </div>
          <div className="flex-1" />
          <button onClick={createPeriod} disabled={loading || !canManage} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"><Plus className="h-4 w-4" />Create Period</button>
        </div>
        <div className="mt-3 text-xs text-slate-500">Will create: <span className="font-semibold text-slate-700">{makePeriodId(year, month)}</span></div>
      </div>

      <div className="rounded-xl border bg-white">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div className="text-sm font-semibold">Existing Periods</div>
          <div className="text-xs text-slate-500">{countText}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Locked By</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3 font-semibold">{r.periodId || r.id}</td>
                  <td className="px-4 py-3">{r.year}</td>
                  <td className="px-4 py-3">{pad2(r.month)} — {r.monthName || toMonthName(Number(r.month))}</td>
                  <td className="px-4 py-3"><span className={statusBadge(r.status)}>{r.status === "active" && <CheckCircle2 className="h-4 w-4" />}{r.status === "locked" && <Lock className="h-4 w-4" />}{r.status === "archived" && <Archive className="h-4 w-4" />}{String(r.status || "unknown").toUpperCase()}</span></td>
                  <td className="px-4 py-3 text-xs text-slate-600">{r.lockedBy ? <><div className="font-semibold">{r.lockedBy}</div><div className="text-slate-500">{r.lockedAt ? new Date(r.lockedAt).toLocaleString() : ""}</div></> : <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {r.status !== "locked" ? <button onClick={() => lockPeriod(r.id)} disabled={loading || !canManage} className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-60"><Lock className="h-4 w-4" />Lock</button> : <button onClick={() => unlockPeriod(r.id)} disabled={loading || !canManage} className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-60"><Unlock className="h-4 w-4" />Unlock</button>}
                      <button onClick={() => setStatus(r.id, "active")} disabled={loading || !canManage} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-60">Set Active</button>
                      <button onClick={() => setStatus(r.id, "archived")} disabled={loading || !canManage} className="rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-60">Archive</button>
                      <button onClick={() => deletePeriod(r.id)} disabled={loading || !canManage} className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-60"><Trash2 className="h-4 w-4" />Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td className="px-4 py-6 text-center text-slate-500" colSpan={6}>No periods yet. Create your first period above.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 text-xs text-slate-500 border-t">Tip: Lock a period once the month is finalized to prevent edits.</div>
      </div>
    </div>
  );
}

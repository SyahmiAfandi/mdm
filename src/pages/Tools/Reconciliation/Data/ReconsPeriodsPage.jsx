import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../../../firebaseClient";
import {
  Plus,
  RefreshCcw,
  Lock,
  Unlock,
  Archive,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { useUser } from "../../../../context/UserContext";

const COL = "reconPeriods";

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function makePeriodId(year, monthNumber) {
  return `${year}-${pad2(monthNumber)}`;
}

function toMonthName(monthNumber) {
  return monthNames[monthNumber - 1] || "";
}

function statusBadge(status) {
  const base =
    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold";
  if (status === "active")
    return `${base} bg-emerald-50 text-emerald-700 border border-emerald-200`;
  if (status === "locked")
    return `${base} bg-amber-50 text-amber-700 border border-amber-200`;
  if (status === "archived")
    return `${base} bg-slate-50 text-slate-700 border border-slate-200`;
  return `${base} bg-slate-50 text-slate-600 border border-slate-200`;
}

export default function ReconsPeriodsPage() {
  const { user } = useUser();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultMonth = now.getMonth() + 1;

  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);

  const [allowedYears, setAllowedYears] = useState([]);

  // TEMP: allow any signed-in user
  const canManage = !!user;

  // Prefer name, fallback to email, fallback to "unknown"
  const actorName = user?.name?.trim() || user?.displayName?.trim() || user?.email || "unknown";

  async function fetchAllowedYears() {
    try {
      const snap = await getDocs(
        query(collection(db, "master_years"), orderBy("year", "asc"))
      );

      const activeYears = snap.docs
        .map(doc => doc.data())
        .filter(y => y.active === true)   // only active
        .map(y => y.year);

      setAllowedYears(activeYears);

      // auto set default year if current year not allowed
      if (!activeYears.includes(year)) {
        setYear(activeYears[0] || new Date().getFullYear());
      }

    } catch (e) {
      console.error(e);
      toast.error("Failed to load active years");
    }
  }

  useEffect(() => {
    fetchAllowedYears();
    fetchPeriods();
  }, []);

  async function fetchPeriods() {
    setLoading(true);
    try {
      const q = query(collection(db, COL), orderBy("periodId", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRows(data);
    } catch (e) {
      console.error(e);
      toast.error(`${e?.code || "error"}: ${e?.message || "Failed to load periods"}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createPeriod() {
    if (!canManage) return toast.error("No permission");

    const periodId = makePeriodId(year, month);
    const ref = doc(db, COL, periodId);

    setLoading(true);
    try {
      const exists = await getDoc(ref);
      if (exists.exists()) {
        toast(`Period already exists: ${periodId}`, { icon: "ℹ️" });
        return;
      }

      await setDoc(ref, {
        periodId,
        year: Number(year),
        month: Number(month),
        monthName: toMonthName(Number(month)),

        status: "active",

        createdAt: serverTimestamp(),
        createdBy: actorName,

        lockedAt: null,
        lockedBy: null,

        notes: "",
      });

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
      const ref = doc(db, COL, periodId);
      await updateDoc(ref, { status });
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
      const ref = doc(db, COL, periodId);
      await updateDoc(ref, {
        status: "locked",
        lockedAt: serverTimestamp(),
        lockedBy: actorName, // ✅ user name
      });
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
      const ref = doc(db, COL, periodId);
      await updateDoc(ref, {
        status: "active",
        lockedAt: null,
        lockedBy: null,
      });
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

    // Safety: do not delete locked periods
    const row = rows.find((x) => x.id === periodId);
    if (row?.status === "locked") {
      toast.error("This period is locked. Unlock it before deleting.");
      return;
    }

    const ok = window.confirm(
      `Delete period ${periodId}?\n\nThis will remove the period document.\n(If you already have reconCells for this period, they will NOT be deleted automatically.)`
    );
    if (!ok) return;

    setLoading(true);
    try {
      await deleteDoc(doc(db, COL, periodId));
      toast.success(`Deleted period ${periodId}`);
      await fetchPeriods();
    } catch (e) {
      console.error(e);
      toast.error(`${e?.code || "error"}: ${e?.message || "Failed to delete period"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Recons Period Setup</h1>
          <p className="text-sm text-slate-600">
            Create and manage reconciliation periods (YYYY-MM). Lock a period to prevent changes.
          </p>

          {/* Debug (optional) */}
          <div className="mt-2 text-xs text-slate-500">
            Signed in as: <span className="font-semibold">{actorName}</span>{" "}
            | canManage: <span className="font-semibold">{String(canManage)}</span>
          </div>
        </div>

        <button
          onClick={fetchPeriods}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
          disabled={loading}
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Create card */}
      <div className="mb-5 rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-slate-600">Year</label>
            <select
              className="mt-1 w-32 rounded-lg border px-3 py-2 text-sm"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {allowedYears.length === 0 && (
                <option value="">No active year</option>
              )}

              {allowedYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-slate-600">Month</label>
            <select
              className="mt-1 w-52 rounded-lg border px-3 py-2 text-sm"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {monthNames.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {pad2(idx + 1)} — {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          <button
            onClick={createPeriod}
            disabled={loading || !canManage}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            title={!canManage ? "No permission" : ""}
          >
            <Plus className="h-4 w-4" />
            Create Period
          </button>
        </div>

        <div className="mt-3 text-xs text-slate-500">
          Will create:{" "}
          <span className="font-semibold text-slate-700">
            {makePeriodId(year, month)}
          </span>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border bg-white">
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Existing Periods</div>
            <div className="text-xs text-slate-500">{rows.length} period(s)</div>
          </div>
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
                  <td className="px-4 py-3">
                    {pad2(r.month)} — {r.monthName}
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusBadge(r.status)} title={r.status}>
                      {r.status === "active" && <CheckCircle2 className="h-4 w-4" />}
                      {r.status === "locked" && <Lock className="h-4 w-4" />}
                      {r.status === "archived" && <Archive className="h-4 w-4" />}
                      {String(r.status || "unknown").toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {r.lockedBy ? (
                      <>
                        <div className="font-semibold">{r.lockedBy}</div>
                        <div className="text-slate-500">
                          {r.lockedAt?.toDate ? r.lockedAt.toDate().toLocaleString() : ""}
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {r.status !== "locked" ? (
                        <button
                          onClick={() => lockPeriod(r.id)}
                          disabled={loading || !canManage}
                          className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-60"
                        >
                          <Lock className="h-4 w-4" />
                          Lock
                        </button>
                      ) : (
                        <button
                          onClick={() => unlockPeriod(r.id)}
                          disabled={loading || !canManage}
                          className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-60"
                        >
                          <Unlock className="h-4 w-4" />
                          Unlock
                        </button>
                      )}

                      <button
                        onClick={() => setStatus(r.id, "active")}
                        disabled={loading || !canManage}
                        className="rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-60"
                      >
                        Set Active
                      </button>

                      <button
                        onClick={() => setStatus(r.id, "archived")}
                        disabled={loading || !canManage}
                        className="rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-60"
                      >
                        Archive
                      </button>

                      {/* ✅ Delete */}
                      <button
                        onClick={() => deletePeriod(r.id)}
                        disabled={loading || !canManage}
                        className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-60"
                        title={r.status === "locked" ? "Unlock first to delete" : "Delete period"}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!rows.length && (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={6}>
                    No periods yet. Create your first period above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 text-xs text-slate-500 border-t">
          Tip: Lock a period once the month is finalized to prevent edits.
        </div>
      </div>
    </div>
  );
}
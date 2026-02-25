import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { db } from "../../firebaseClient";
import { useUser } from "../../context/UserContext";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { Plus, RefreshCcw, Save, Trash2, Pencil, X, Search, Tag } from "lucide-react";

const COL = "master_reporttypes";
const STATUS = ["Active", "Inactive"];

function normalize(v = "") {
  return String(v).trim();
}
function makeIdFromCode(code) {
  return normalize(code).toUpperCase().replace(/\s+/g, "_");
}

export default function MasterReportTypePage() {
  const { user } = useUser();
  const email = user?.email || user?.uid || "unknown";

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  // search/sort
  const [qText, setQText] = useState("");
  const [sortKey, setSortKey] = useState("code"); // code | name | sortOrder | activeLabel
  const [sortDir, setSortDir] = useState("asc");

  // modal
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("create"); // create | edit
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    code: "",
    name: "",
    sortOrder: "", // optional number
    status: "Active", // UI only
  });

  async function load() {
    try {
      setLoading(true);
      const q = query(collection(db, COL), orderBy("code", "asc"));
      const snap = await getDocs(q);
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to load report types");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const t = normalize(qText).toLowerCase();

    let out = rows.map((r) => ({
      ...r,
      activeLabel: r.active === false ? "Inactive" : "Active",
    }));

    if (t) {
      out = out.filter((r) => {
        const hay = `${r.code || ""} ${r.name || ""} ${r.activeLabel || ""} ${r.sortOrder ?? ""}`.toLowerCase();
        return hay.includes(t);
      });
    }

    out.sort((a, b) => {
      // numeric sort for sortOrder
      if (sortKey === "sortOrder") {
        const av = Number(a?.sortOrder ?? 0);
        const bv = Number(b?.sortOrder ?? 0);
        return sortDir === "asc" ? av - bv : bv - av;
      }

      const av = (a?.[sortKey] ?? "").toString().toLowerCase();
      const bv = (b?.[sortKey] ?? "").toString().toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return out;
  }, [rows, qText, sortKey, sortDir]);

  function openCreate() {
    setMode("create");
    setEditingId(null);
    setForm({ code: "", name: "", sortOrder: "", status: "Active" });
    setOpen(true);
  }

  function openEdit(row) {
    setMode("edit");
    setEditingId(row.id);
    setForm({
      code: row.code || "",
      name: row.name || "",
      sortOrder: row.sortOrder ?? "",
      status: row.active === false ? "Inactive" : "Active",
    });
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
  }

  async function onSave() {
    const code = normalize(form.code).toUpperCase();
    const name = normalize(form.name);
    const active = form.status !== "Inactive";

    // optional number
    const sortOrder =
      form.sortOrder === "" || form.sortOrder === null || form.sortOrder === undefined
        ? null
        : Number(form.sortOrder);

    if (!code) return toast.error("Report Type Code is required");
    if (!name) return toast.error("Report Type Name is required");
    if (sortOrder !== null && Number.isNaN(sortOrder)) return toast.error("Sort Order must be a number");

    try {
      setLoading(true);

      if (mode === "create") {
        const id = makeIdFromCode(code);
        await setDoc(
          doc(db, COL, id),
          {
            code,
            name,
            active,
            sortOrder,
            createdAt: serverTimestamp(),
            createdBy: email,
            updatedAt: serverTimestamp(),
            updatedBy: email,
          },
          { merge: true }
        );
        toast.success("Report type created ✅");
      } else {
        if (!editingId) throw new Error("Missing editing id");
        await updateDoc(doc(db, COL, editingId), {
          name,
          active,
          sortOrder,
          updatedAt: serverTimestamp(),
          updatedBy: email,
        });
        toast.success("Report type updated ✅");
      }

      setOpen(false);
      await load();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(row) {
    const ok = confirm(`Delete report type "${row.code}"?`);
    if (!ok) return;

    try {
      setLoading(true);
      await deleteDoc(doc(db, COL, row.id));
      toast.success("Deleted ✅");
      await load();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Tag className="w-5 h-5 text-gray-900 dark:text-gray-100" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Master Data — Report Types
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Maintain report type codes used for filters and mapping.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            disabled={loading}
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            <Plus className="h-4 w-4" />
            New Report Type
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="Search code / name / status…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 shadow-sm outline-none focus:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="code">Sort: Code</option>
            <option value="name">Sort: Name</option>
            <option value="sortOrder">Sort: Sort Order</option>
            <option value="activeLabel">Sort: Status</option>
          </select>

          <button
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            title="Toggle sort direction"
          >
            {sortDir === "asc" ? "ASC" : "DESC"}
          </button>
        </div>

        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-end">
          {filtered.length} record(s)
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold w-[180px]">Code</th>
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold w-[140px]">Sort</th>
                <th className="px-4 py-3 text-left font-semibold w-[140px]">Status</th>
                <th className="px-4 py-3 text-right font-semibold w-[220px]">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((r) => (
                <tr key={r.id} className="text-gray-800 dark:text-gray-100">
                  <td className="px-4 py-3 font-mono">{r.code}</td>
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3">{r.sortOrder ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                        r.active === false
                          ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                          : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-200",
                      ].join(" ")}
                    >
                      {r.active === false ? "Inactive" : "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(r)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(r)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:bg-gray-900 dark:text-red-300 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!filtered.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                    {loading ? "Loading…" : "No records found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <div>
                <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {mode === "create" ? "Create Report Type" : "Edit Report Type"}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Fill in the fields below
                </div>
              </div>
              <button
                onClick={closeModal}
                className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Report Type Code (Doc ID)
                </label>
                <input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. OSDP / PBI / MDM"
                  disabled={mode === "edit"}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
                {mode === "edit" && (
                  <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                    Code is locked in edit mode (doc id is based on code).
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Report Type Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Online Sales Data Pack"
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    Sort Order (optional)
                  </label>
                  <input
                    value={form.sortOrder}
                    onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                    placeholder="e.g. 10"
                    inputMode="numeric"
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  >
                    {STATUS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
              <button
                onClick={closeModal}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>

              <button
                onClick={onSave}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
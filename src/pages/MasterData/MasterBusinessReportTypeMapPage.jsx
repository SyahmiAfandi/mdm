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
  where,
} from "firebase/firestore";
import { Plus, RefreshCcw, Save, Trash2, Pencil, X, Search, Link2 } from "lucide-react";

const MAP_COL = "map_business_reporttypes";
const BUSINESS_COL = "master_businesses";
const REPORTTYPE_COL = "master_reporttypes";
const STATUS = ["Active", "Inactive"];

function normalize(v = "") {
  return String(v).trim();
}
function makeMapId(businessCode, reportTypeCode) {
  const b = normalize(businessCode).toUpperCase().replace(/\s+/g, "_");
  const r = normalize(reportTypeCode).toUpperCase().replace(/\s+/g, "_");
  return `${b}__${r}`;
}

export default function MasterBusinessReportTypeMapPage() {
  const { user } = useUser();
  const email = user?.email || user?.uid || "unknown";

  const [loading, setLoading] = useState(false);

  // master options
  const [businessOptions, setBusinessOptions] = useState([]);
  const [reportTypeOptions, setReportTypeOptions] = useState([]);
  const [loadingBusiness, setLoadingBusiness] = useState(false);
  const [loadingReportTypes, setLoadingReportTypes] = useState(false);

  // mapping rows
  const [rows, setRows] = useState([]);

  // Search / sort
  const [qText, setQText] = useState("");
  const [sortKey, setSortKey] = useState("businessCode"); // businessCode | reportTypeCode | activeLabel
  const [sortDir, setSortDir] = useState("asc");

  // modal
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("create"); // create | edit
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    businessCode: "",
    reportTypeCode: "",
    status: "Active",
  });

  // ========= Loaders =========
  async function loadMappings() {
    try {
      setLoading(true);
      const q = query(collection(db, MAP_COL), orderBy("businessCode", "asc"));
      const snap = await getDocs(q);
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to load mappings");
    } finally {
      setLoading(false);
    }
  }

  async function loadBusinesses() {
    try {
      setLoadingBusiness(true);
      // Active only (requires index sometimes)
      const q = query(
        collection(db, BUSINESS_COL),
        where("active", "==", true),
        orderBy("businessCode", "asc")
      );
      const snap = await getDocs(q);
      setBusinessOptions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to load businesses");
    } finally {
      setLoadingBusiness(false);
    }
  }

  async function loadReportTypes() {
    try {
      setLoadingReportTypes(true);
      // Active only (requires index sometimes)
      const q = query(
        collection(db, REPORTTYPE_COL),
        where("active", "==", true),
        orderBy("code", "asc")
      );
      const snap = await getDocs(q);
      setReportTypeOptions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to load report types");
    } finally {
      setLoadingReportTypes(false);
    }
  }

  useEffect(() => {
    loadMappings();
    loadBusinesses();
    loadReportTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ========= Lookup maps for display =========
  const businessNameByCode = useMemo(() => {
    const m = new Map();
    businessOptions.forEach((b) => m.set(b.businessCode, b.businessName || ""));
    return m;
  }, [businessOptions]);

  const reportTypeNameByCode = useMemo(() => {
    const m = new Map();
    reportTypeOptions.forEach((r) => m.set(r.code, r.name || ""));
    return m;
  }, [reportTypeOptions]);

  // ========= Filter/sort =========
  const filtered = useMemo(() => {
    const t = normalize(qText).toLowerCase();

    let out = rows.map((r) => ({
      ...r,
      activeLabel: r.active === false ? "Inactive" : "Active",
    }));

    if (t) {
      out = out.filter((r) => {
        const bName = businessNameByCode.get(r.businessCode) || "";
        const rName = reportTypeNameByCode.get(r.reportTypeCode) || "";
        const hay = `${r.businessCode || ""} ${bName} ${r.reportTypeCode || ""} ${rName} ${r.activeLabel}`.toLowerCase();
        return hay.includes(t);
      });
    }

    out.sort((a, b) => {
      const av = (a?.[sortKey] ?? "").toString().toLowerCase();
      const bv = (b?.[sortKey] ?? "").toString().toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return out;
  }, [rows, qText, sortKey, sortDir, businessNameByCode, reportTypeNameByCode]);

  // ========= Modal controls =========
  function openCreate() {
    setMode("create");
    setEditingId(null);
    setForm({ businessCode: "", reportTypeCode: "", status: "Active" });
    setOpen(true);
  }

  function openEdit(row) {
    setMode("edit");
    setEditingId(row.id);
    setForm({
      businessCode: row.businessCode || "",
      reportTypeCode: row.reportTypeCode || "",
      status: row.active === false ? "Inactive" : "Active",
    });
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
  }

  // ========= Save / Delete =========
  async function onSave() {
    const businessCode = normalize(form.businessCode).toUpperCase();
    const reportTypeCode = normalize(form.reportTypeCode).toUpperCase();
    const active = form.status !== "Inactive";

    if (!businessCode) return toast.error("Business is required");
    if (!reportTypeCode) return toast.error("Report Type is required");

    try {
      setLoading(true);

      if (mode === "create") {
        const id = makeMapId(businessCode, reportTypeCode);

        await setDoc(
          doc(db, MAP_COL, id),
          {
            businessCode,
            reportTypeCode,
            active,
            createdAt: serverTimestamp(),
            createdBy: email,
            updatedAt: serverTimestamp(),
            updatedBy: email,
          },
          { merge: true }
        );

        toast.success("Mapping created ✅");
      } else {
        if (!editingId) throw new Error("Missing editing id");

        await updateDoc(doc(db, MAP_COL, editingId), {
          // keys locked in edit mode (doc id is based on both)
          active,
          updatedAt: serverTimestamp(),
          updatedBy: email,
        });

        toast.success("Mapping updated ✅");
      }

      setOpen(false);
      await loadMappings();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(row) {
    const ok = confirm(`Delete mapping "${row.businessCode} ↔ ${row.reportTypeCode}"?`);
    if (!ok) return;

    try {
      setLoading(true);
      await deleteDoc(doc(db, MAP_COL, row.id));
      toast.success("Deleted ✅");
      await loadMappings();
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
            <Link2 className="w-5 h-5 text-gray-900 dark:text-gray-100" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Master Mapping — Business ↔ Report Type
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Control which report types are available for each business type.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadMappings}
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
            New Mapping
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
            placeholder="Search business / report type / status…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 shadow-sm outline-none focus:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="businessCode">Sort: Business</option>
            <option value="reportTypeCode">Sort: Report Type</option>
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
                <th className="px-4 py-3 text-left font-semibold w-[220px]">Business</th>
                <th className="px-4 py-3 text-left font-semibold">Report Type</th>
                <th className="px-4 py-3 text-left font-semibold w-[140px]">Status</th>
                <th className="px-4 py-3 text-right font-semibold w-[220px]">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((r) => (
                <tr key={r.id} className="text-gray-800 dark:text-gray-100">
                  <td className="px-4 py-3">
                    <div className="font-mono">{r.businessCode}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {businessNameByCode.get(r.businessCode) || ""}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-mono">{r.reportTypeCode}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {reportTypeNameByCode.get(r.reportTypeCode) || ""}
                    </div>
                  </td>

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
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
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
                  {mode === "create" ? "Create Mapping" : "Edit Mapping"}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Select business & report type
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
                  Business
                </label>
                <select
                  value={form.businessCode}
                  onChange={(e) => setForm((f) => ({ ...f, businessCode: e.target.value }))}
                  disabled={mode === "edit"}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  <option value="">
                    {loadingBusiness ? "Loading..." : "Select business"}
                  </option>
                  {businessOptions.map((b) => (
                    <option key={b.id} value={b.businessCode}>
                      {b.businessCode} — {b.businessName}
                    </option>
                  ))}
                </select>
                {mode === "edit" && (
                  <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                    Keys are locked in edit mode (mapping doc id is based on both values).
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Report Type
                </label>
                <select
                  value={form.reportTypeCode}
                  onChange={(e) => setForm((f) => ({ ...f, reportTypeCode: e.target.value }))}
                  disabled={mode === "edit"}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  <option value="">
                    {loadingReportTypes ? "Loading..." : "Select report type"}
                  </option>
                  {reportTypeOptions.map((r) => (
                    <option key={r.id} value={r.code}>
                      {r.code} — {r.name}
                    </option>
                  ))}
                </select>
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
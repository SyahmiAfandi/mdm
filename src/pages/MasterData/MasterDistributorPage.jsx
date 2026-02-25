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
import {
  Plus,
  RefreshCcw,
  Save,
  Trash2,
  Pencil,
  X,
  Search,
  Building2,
} from "lucide-react";

const COL = "master_distributors";
const COUNTRY_COL = "master_countries";
const STATUS = ["Active", "Inactive"];

function normalize(v = "") {
  return String(v).trim();
}
function makeIdFromCode(code) {
  return normalize(code).toUpperCase().replace(/\s+/g, "_");
}

export default function MasterDistributorPage() {
  const { user } = useUser();
  const email = user?.email || user?.uid || "unknown";

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  // countries
  const [countryOptions, setCountryOptions] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(false);

  // business
  const [businessOptions, setBusinessOptions] = useState([]);
  const [loadingBusiness, setLoadingBusiness] = useState(false);

  // Search / sort
  const [qText, setQText] = useState("");
  const [sortKey, setSortKey] = useState("code"); // code | name | country | businessType | activeLabel
  const [sortDir, setSortDir] = useState("asc");

  // Modal
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("create"); // create | edit
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    code: "",
    name: "",
    country: "",
    businessType: "",
    status: "Active",
  });

  async function load() {
    try {
      setLoading(true);
      const q = query(collection(db, COL), orderBy("code", "asc"));
      const snap = await getDocs(q);
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to load distributors");
    } finally {
      setLoading(false);
    }
  }

  async function loadCountries() {
    try {
      setLoadingCountries(true);

      // NOTE: Firestore may require composite index: active ASC + code ASC
      const q = query(
        collection(db, COUNTRY_COL),
        where("active", "==", true),
        orderBy("code", "asc")
      );

      const snap = await getDocs(q);
      setCountryOptions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to load countries");
    } finally {
      setLoadingCountries(false);
    }
  }

  async function loadBusinesses() {
    try {
      setLoadingBusiness(true);

      const q = query(
        collection(db, "master_businesses"),
        where("active", "==", true),
        orderBy("businessCode", "asc")
      );

      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setBusinessOptions(list);
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to load businesses");
    } finally {
      setLoadingBusiness(false);
    }
  }

  useEffect(() => {
    load();
    loadCountries();
    loadBusinesses();
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
        const hay = `${r.code || ""} ${r.name || ""} ${r.country || ""} ${
          r.businessType || ""
        } ${r.activeLabel || ""}`.toLowerCase();
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
  }, [rows, qText, sortKey, sortDir]);

  function openCreate() {
    setMode("create");
    setEditingId(null);
    setForm({
      code: "",
      name: "",
      country: "",
      businessType: "",
      status: "Active",
    });
    setOpen(true);
  }

  function openEdit(row) {
    setMode("edit");
    setEditingId(row.id);
    setForm({
      code: row.code || "",
      name: row.name || "",
      country: row.country || "",
      businessType: row.businessType || "HPC",
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
    const country = normalize(form.country);
    const businessType = normalize(form.businessType) || "HPC";
    const active = form.status !== "Inactive";

    if (!code) return toast.error("Distributor Code is required");
    if (!name) return toast.error("Distributor Name is required");
    if (!country) return toast.error("Country is required");
    if (!businessType) return toast.error("Business Type is required");

    try {
      setLoading(true);

      if (mode === "create") {
        const id = makeIdFromCode(code);

        await setDoc(
          doc(db, COL, id),
          {
            code,
            name,
            country,
            businessType,
            active,
            createdAt: serverTimestamp(),
            createdBy: email,
            updatedAt: serverTimestamp(),
            updatedBy: email,
          },
          { merge: true }
        );

        toast.success("Distributor created ✅");
      } else {
        if (!editingId) throw new Error("Missing editing id");

        await updateDoc(doc(db, COL, editingId), {
          // code locked in edit mode (doc id = code)
          name,
          country,
          businessType,
          active,
          updatedAt: serverTimestamp(),
          updatedBy: email,
        });

        toast.success("Distributor updated ✅");
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
    const ok = confirm(`Delete distributor "${row.code}"?`);
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
            <Building2 className="w-5 h-5 text-gray-900 dark:text-gray-100" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Master Data — Distributors
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Maintain distributor list by country & business type.
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
            New Distributor
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
            placeholder="Search code / name / country / business / status…"
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
            <option value="country">Sort: Country</option>
            <option value="businessType">Sort: Business</option>
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
                <th className="px-4 py-3 text-left font-semibold w-[160px]">Code</th>
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold w-[160px]">Country</th>
                <th className="px-4 py-3 text-left font-semibold w-[130px]">Business</th>
                <th className="px-4 py-3 text-left font-semibold w-[130px]">Status</th>
                <th className="px-4 py-3 text-right font-semibold w-[220px]">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((r) => (
                <tr key={r.id} className="text-gray-800 dark:text-gray-100">
                  <td className="px-4 py-3 font-mono">{r.code}</td>
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3">{r.country || "-"}</td>
                  <td className="px-4 py-3">{r.businessType || "-"}</td>
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
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
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
                  {mode === "create" ? "Create Distributor" : "Edit Distributor"}
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
                  Distributor Code (Doc ID)
                </label>
                <input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. D001"
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
                  Distributor Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. ABC Distributor"
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Country
                </label>
                <select
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                >
                  <option value="">
                    {loadingCountries ? "Loading..." : "Select country"}
                  </option>
                  {countryOptions.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    Business Type
                  </label>
                  <select
                    value={form.businessType}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, businessType: e.target.value }))
                    }
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
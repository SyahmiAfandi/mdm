import React, { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "../../supabaseClient";
import { useUser } from "../../context/UserContext";
import { usePermissions } from "../../hooks/usePermissions";
import {
  Plus,
  RefreshCcw,
  Save,
  Trash2,
  Pencil,
  X,
  Search,
  Building2,
  Shield,
  Upload,
} from "lucide-react";

const COL = "master_distributors";
const COUNTRY_COL = "master_countries";
const BUSINESS_COL = "master_businesses";
const STATUS = ["Active", "Inactive"];

const EMPTY_FORM = {
  code: "",
  name: "",
  country: "",
  businessType: "",
  tvid: "",
  password: "",
  status: "Active",
};

const norm = (v = "") => String(v ?? "").trim();
const makeId = (code) => norm(code).toUpperCase().replace(/\s+/g, "_");
const normHeader = (v = "") => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function getImportValue(row, aliases) {
  const normalizedEntries = Object.entries(row || {}).map(([key, value]) => [
    normHeader(key),
    value,
  ]);

  for (const alias of aliases) {
    const hit = normalizedEntries.find(([key]) => key === normHeader(alias));
    if (hit) return hit[1];
  }
  return "";
}

const mapCountry = (r) => ({
  ...r,
  code: r.code ?? r.country_code ?? "",
  name: r.name ?? r.country_name ?? "",
});

const mapBusiness = (r) => ({
  ...r,
  businessCode: r.businessCode ?? r.business_code ?? "",
  businessName: r.businessName ?? r.business_name ?? "",
});

const mapRow = (r) => ({
  ...r,
  code: r.code ?? r.distributor_code ?? "",
  name: r.name ?? r.distributor_name ?? "",
  country: r.country ?? r.country_code ?? "",
  businessType: r.businessType ?? r.business_type ?? "",
  tvid: r.tvid ?? r.TVID ?? "",
  password: r.password ?? "",
});

export default function MasterDistributorPage() {
  const { user } = useUser();
  const actor =
    user?.display_name || user?.name || user?.email || user?.uid || "";
  const { can, role } = usePermissions();
  const canView = can("masterData.view") || can("masterData.*") || role === "admin";
  const canEdit =
    can("masterData.distributors.edit") || can("masterData.*") || role === "admin";

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [countryOptions, setCountryOptions] = useState([]);
  const [businessOptions, setBusinessOptions] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingBusiness, setLoadingBusiness] = useState(false);
  const [qText, setQText] = useState("");
  const [sortKey, setSortKey] = useState("code");
  const [sortDir, setSortDir] = useState("asc");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("create");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const importInputRef = useRef(null);

  async function load() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from(COL)
        .select("*")
        .order("code", { ascending: true });
      if (error) throw error;
      setRows((data || []).map(mapRow));
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
      const { data, error } = await supabase
        .from(COUNTRY_COL)
        .select("*")
        .eq("active", true)
        .order("code", { ascending: true });
      if (error) throw error;
      setCountryOptions((data || []).map(mapCountry));
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
      const { data, error } = await supabase
        .from(BUSINESS_COL)
        .select("*")
        .eq("active", true)
        .order("business_code", { ascending: true });
      if (error) throw error;
      setBusinessOptions((data || []).map(mapBusiness));
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to load businesses");
    } finally {
      setLoadingBusiness(false);
    }
  }

  useEffect(() => {
    if (!canView) return;
    load();
    loadCountries();
    loadBusinesses();
  }, [canView]);

  const filtered = useMemo(() => {
    const t = norm(qText).toLowerCase();
    const out = rows
      .map((r) => ({
        ...r,
        activeLabel: r.active === false ? "Inactive" : "Active",
      }))
      .filter((r) => {
        if (!t) return true;
        const haystack = [
          r.code,
          r.name,
          r.country,
          r.businessType,
          r.tvid,
          r.password,
          r.activeLabel,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(t);
      });

    out.sort((a, b) => {
      const av = String(a?.[sortKey] ?? "").toLowerCase();
      const bv = String(b?.[sortKey] ?? "").toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return out;
  }, [rows, qText, sortKey, sortDir]);

  const openCreate = () => {
    setMode("create");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (row) => {
    setMode("edit");
    setEditingId(row.id);
    setForm({
      code: row.code || "",
      name: row.name || "",
      country: row.country || "",
      businessType: row.businessType || "",
      tvid: row.tvid || "",
      password: row.password || "",
      status: row.active === false ? "Inactive" : "Active",
    });
    setOpen(true);
  };

  async function onSave() {
    if (!canEdit) return toast.error("No permission to edit master data");

    const code = norm(form.code).toUpperCase();
    const name = norm(form.name);
    const country = norm(form.country);
    const businessType = norm(form.businessType);
    const tvid = norm(form.tvid);
    const password = norm(form.password);

    if (!code || !name || !country || !businessType) {
      return toast.error("Code, name, country, and business type are required");
    }

    const payload = {
      name,
      country,
      business_type: businessType,
      tvid: tvid || null,
      password: password || null,
      active: form.status !== "Inactive",
      updated_at: new Date().toISOString(),
      updated_by: actor || null,
    };

    try {
      setLoading(true);
      if (mode === "create") {
        const { error } = await supabase.from(COL).insert({
          id: makeId(code),
          code,
          ...payload,
          created_at: new Date().toISOString(),
          created_by: actor || null,
        });
        if (error) throw error;
        toast.success("Distributor created");
      } else {
        const { error } = await supabase
          .from(COL)
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Distributor updated");
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
    if (!canEdit) return toast.error("No permission to edit master data");
    if (!confirm(`Delete distributor "${row.code}"?`)) return;

    try {
      setLoading(true);
      const { error } = await supabase.from(COL).delete().eq("id", row.id);
      if (error) throw error;
      toast.success("Deleted");
      await load();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  }

  async function importDistributorCredentials(file) {
    if (!canEdit) return toast.error("No permission to import distributor data");
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name || "")) {
      return toast.error("Please upload an Excel file (.xlsx or .xls)");
    }

    const toastId = toast.loading("Importing distributor TVID/password...");

    try {
      setLoading(true);

      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      if (!rawRows.length) {
        throw new Error("The file is empty.");
      }

      const normalizedMap = new Map();
      for (const rawRow of rawRows) {
        const code = norm(
          getImportValue(rawRow, [
            "DT code",
            "DT_CODE",
            "dt code",
            "dtcode",
            "Distributor Code",
            "distributor_code",
            "code",
          ])
        ).toUpperCase();

        const tvid = norm(
          getImportValue(rawRow, ["TVID", "tv id", "tv_id", "tvid"])
        );
        const password = norm(
          getImportValue(rawRow, ["Password", "password", "pwd", "pass"])
        );

        if (!code) continue;

        const prev = normalizedMap.get(code) || { code, tvid: "", password: "" };
        normalizedMap.set(code, {
          code,
          tvid: tvid || prev.tvid,
          password: password || prev.password,
        });
      }

      const importRows = Array.from(normalizedMap.values()).filter(
        (row) => row.tvid || row.password
      );

      if (!importRows.length) {
        throw new Error(
          "No valid rows found. Expected columns like DT code, TVID, and Password."
        );
      }

      const codes = importRows.map((row) => row.code);
      const { data: existingRows, error: existingErr } = await supabase
        .from(COL)
        .select("id, code, tvid, password")
        .in("code", codes);

      if (existingErr) throw existingErr;

      const existingByCode = new Map(
        (existingRows || []).map((row) => [norm(row.code).toUpperCase(), row])
      );

      let updated = 0;
      let unchanged = 0;
      const missingCodes = [];

      for (const row of importRows) {
        const existing = existingByCode.get(row.code);
        if (!existing) {
          missingCodes.push(row.code);
          continue;
        }

        const payload = {
          updated_at: new Date().toISOString(),
          updated_by: actor || null,
        };

        let changed = false;

        if (row.tvid && row.tvid !== norm(existing.tvid)) {
          payload.tvid = row.tvid;
          changed = true;
        }

        if (row.password && row.password !== norm(existing.password)) {
          payload.password = row.password;
          changed = true;
        }

        if (!changed) {
          unchanged += 1;
          continue;
        }

        const { error } = await supabase.from(COL).update(payload).eq("id", existing.id);
        if (error) throw error;
        updated += 1;
      }

      await load();

      const parts = [`Updated ${updated} distributor(s)`];
      if (unchanged) parts.push(`${unchanged} unchanged`);
      if (missingCodes.length) parts.push(`${missingCodes.length} code(s) not found`);

      toast.success(parts.join(" | "), { id: toastId });

      if (missingCodes.length) {
        console.warn("Distributor codes not found during import:", missingCodes);
      }
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Import failed", { id: toastId });
    } finally {
      setLoading(false);
    }
  }

  async function handleImportChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await importDistributorCredentials(file);
  }

  if (!canView) {
    return (
      <div className="p-6">
        <div className="flex gap-3 rounded-xl border p-6">
          <Shield className="h-5 w-5" />
          <div>You do not have permission to view Distributors master.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Master Data - Distributors</h1>
            <p className="text-sm text-gray-500">
              Maintain distributor list by country, business type, TVID, and password.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImportChange}
          />
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={!canEdit || loading}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            Import Excel
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={openCreate}
            disabled={!canEdit}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            New Distributor
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="Search code / name / country / business / TVID / password / status..."
            className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="code">Sort: Code</option>
            <option value="name">Sort: Name</option>
            <option value="country">Sort: Country</option>
            <option value="businessType">Sort: Business</option>
            <option value="tvid">Sort: TVID</option>
            <option value="password">Sort: Password</option>
            <option value="activeLabel">Sort: Status</option>
          </select>
          <button
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            {sortDir === "asc" ? "ASC" : "DESC"}
          </button>
        </div>

        <div className="flex items-center justify-end text-sm text-gray-500">
          {filtered.length} record(s)
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-300">
        Import format: first sheet with columns DT code, TVID, and Password.
        Matching uses DT code to distributor code. Blank TVID/password cells are ignored and will not overwrite existing data.
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Country</th>
                <th className="px-4 py-3 text-left">Business</th>
                <th className="px-4 py-3 text-left">TVID</th>
                <th className="px-4 py-3 text-left">Password</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-mono">{r.code}</td>
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3">{r.country}</td>
                  <td className="px-4 py-3">{r.businessType}</td>
                  <td className="px-4 py-3 font-mono">{r.tvid || "-"}</td>
                  <td className="px-4 py-3 font-mono">{r.password || "-"}</td>
                  <td className="px-4 py-3">
                    {r.active === false ? "Inactive" : "Active"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(r)}
                        disabled={!canEdit}
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(r)}
                        disabled={!canEdit}
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs text-red-700"
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
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">
                    {loading ? "Loading..." : "No records found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div className="text-base font-semibold">
                {mode === "create" ? "Create Distributor" : "Edit Distributor"}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold">Distributor Code</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  disabled={!canEdit || mode === "edit"}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Distributor Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold">TVID</label>
                <input
                  value={form.tvid}
                  onChange={(e) => setForm((f) => ({ ...f, tvid: e.target.value }))}
                  disabled={!canEdit}
                  autoComplete="off"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Password</label>
                <input
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  disabled={!canEdit}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold">Country</label>
                <select
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">
                    {loadingCountries ? "Loading..." : "Select country"}
                  </option>
                  {countryOptions.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold">Business Type</label>
                <select
                  value={form.businessType}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, businessType: e.target.value }))
                  }
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">
                    {loadingBusiness ? "Loading..." : "Select business"}
                  </option>
                  {businessOptions.map((b) => (
                    <option key={b.id} value={b.businessCode}>
                      {b.businessCode} - {b.businessName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-semibold">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {STATUS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={!canEdit || loading}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
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

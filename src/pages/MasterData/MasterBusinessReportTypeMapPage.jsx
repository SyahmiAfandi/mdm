import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "../../supabaseClient";
import { useUser } from "../../context/UserContext";
import { usePermissions } from "../../hooks/usePermissions";
import { Plus, RefreshCcw, Save, Trash2, Pencil, X, Search, Link2, Shield } from "lucide-react";

const MAP_COL = "map_business_reporttypes";
const BUSINESS_COL = "master_businesses";
const REPORTTYPE_COL = "master_reporttypes";
const STATUS = ["Active", "Inactive"];

const norm = (v = "") => String(v).trim();
const makeMapId = (businessCode, reportTypeCode) => `${norm(businessCode).toUpperCase().replace(/\s+/g, "_")}__${norm(reportTypeCode).toUpperCase().replace(/\s+/g, "_")}`;
const mapBusiness = (r) => ({ ...r, businessCode: r.businessCode ?? r.business_code ?? "", businessName: r.businessName ?? r.business_name ?? "" });
const mapReportType = (r) => ({ ...r, code: r.code ?? r.report_type_code ?? "", name: r.name ?? r.report_type_name ?? "" });
const mapMapping = (r) => ({ ...r, businessCode: r.businessCode ?? r.business_code ?? "", reportTypeCode: r.reportTypeCode ?? r.report_type_code ?? "" });

export default function MasterBusinessReportTypeMapPage() {
  const { user } = useUser();
  const actor = user?.email || user?.name || user?.uid || "";
  const { can, role } = usePermissions();
  const canView = can("masterData.view") || can("masterData.*") || role === "admin";
  const canEdit = can("masterData.mapping.edit") || can("masterData.*") || role === "admin";

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [businessOptions, setBusinessOptions] = useState([]);
  const [reportTypeOptions, setReportTypeOptions] = useState([]);
  const [loadingBusiness, setLoadingBusiness] = useState(false);
  const [loadingReportTypes, setLoadingReportTypes] = useState(false);
  const [qText, setQText] = useState("");
  const [sortKey, setSortKey] = useState("businessCode");
  const [sortDir, setSortDir] = useState("asc");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("create");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ businessCode: "", reportTypeCode: "", status: "Active" });

  async function loadMappings() {
    try {
      setLoading(true);
      const { data, error } = await supabase.from(MAP_COL).select("*").order("business_code", { ascending: true });
      if (error) throw error;
      setRows((data || []).map(mapMapping));
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
      const { data, error } = await supabase.from(BUSINESS_COL).select("*").eq("active", true).order("business_code", { ascending: true });
      if (error) throw error;
      setBusinessOptions((data || []).map(mapBusiness));
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
      const { data, error } = await supabase.from(REPORTTYPE_COL).select("*").eq("active", true).order("code", { ascending: true });
      if (error) throw error;
      setReportTypeOptions((data || []).map(mapReportType));
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to load report types");
    } finally {
      setLoadingReportTypes(false);
    }
  }

  useEffect(() => {
    if (!canView) return;
    loadMappings();
    loadBusinesses();
    loadReportTypes();
  }, [canView]);

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

  const filtered = useMemo(() => {
    const t = norm(qText).toLowerCase();
    const out = rows
      .map((r) => ({ ...r, activeLabel: r.active === false ? "Inactive" : "Active" }))
      .filter((r) => {
        if (!t) return true;
        const bName = businessNameByCode.get(r.businessCode) || "";
        const rtName = reportTypeNameByCode.get(r.reportTypeCode) || "";
        return `${r.businessCode} ${bName} ${r.reportTypeCode} ${rtName} ${r.activeLabel}`.toLowerCase().includes(t);
      });

    out.sort((a, b) => {
      const av = String(a?.[sortKey] ?? "").toLowerCase();
      const bv = String(b?.[sortKey] ?? "").toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return out;
  }, [rows, qText, sortKey, sortDir, businessNameByCode, reportTypeNameByCode]);

  const openCreate = () => {
    setMode("create");
    setEditingId(null);
    setForm({ businessCode: "", reportTypeCode: "", status: "Active" });
    setOpen(true);
  };

  const openEdit = (row) => {
    setMode("edit");
    setEditingId(row.id);
    setForm({
      businessCode: row.businessCode || "",
      reportTypeCode: row.reportTypeCode || "",
      status: row.active === false ? "Inactive" : "Active",
    });
    setOpen(true);
  };

  async function onSave() {
    if (!canEdit) return toast.error("No permission to edit master data");
    const businessCode = norm(form.businessCode).toUpperCase();
    const reportTypeCode = norm(form.reportTypeCode).toUpperCase();
    if (!businessCode || !reportTypeCode) return toast.error("Business and Report Type are required");

    const payload = {
      business_code: businessCode,
      report_type_code: reportTypeCode,
      active: form.status !== "Inactive",
      updated_at: new Date().toISOString(),
      updated_by: actor || null,
    };

    try {
      setLoading(true);
      if (mode === "create") {
        const { error } = await supabase.from(MAP_COL).insert({
          id: makeMapId(businessCode, reportTypeCode),
          ...payload,
          created_at: new Date().toISOString(),
          created_by: actor || null,
        });
        if (error) throw error;
        toast.success("Mapping created");
      } else {
        const { error } = await supabase.from(MAP_COL).update({
          active: payload.active,
          updated_at: payload.updated_at,
          updated_by: payload.updated_by,
        }).eq("id", editingId);
        if (error) throw error;
        toast.success("Mapping updated");
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
    if (!canEdit) return toast.error("No permission to edit master data");
    if (!confirm(`Delete mapping "${row.businessCode} ↔ ${row.reportTypeCode}"?`)) return;
    try {
      setLoading(true);
      const { error } = await supabase.from(MAP_COL).delete().eq("id", row.id);
      if (error) throw error;
      toast.success("Deleted");
      await loadMappings();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  }

  if (!canView) {
    return <div className="p-6"><div className="rounded-xl border p-6 flex gap-3"><Shield className="w-5 h-5" /><div>You do not have permission to view Business ↔ Report Type mapping.</div></div></div>;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center"><Link2 className="w-5 h-5" /></div>
          <div>
            <h1 className="text-xl font-semibold">Master Mapping - Business ↔ Report Type</h1>
            <p className="text-sm text-gray-500">Control which report types are available for each business type.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadMappings} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</button>
          <button onClick={openCreate} disabled={!canEdit} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"><Plus className="h-4 w-4" />New Mapping</button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input value={qText} onChange={(e) => setQText(e.target.value)} placeholder="Search business / report type / status..." className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm" /></div>
        <div className="flex gap-2"><select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm"><option value="businessCode">Sort: Business</option><option value="reportTypeCode">Sort: Report Type</option><option value="activeLabel">Sort: Status</option></select><button onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} className="rounded-lg border px-3 py-2 text-sm">{sortDir === "asc" ? "ASC" : "DESC"}</button></div>
        <div className="flex items-center justify-end text-sm text-gray-500">{filtered.length} record(s)</div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left">Business</th>
                <th className="px-4 py-3 text-left">Report Type</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3"><div className="font-mono">{r.businessCode}</div><div className="text-xs text-gray-500">{businessNameByCode.get(r.businessCode) || ""}</div></td>
                  <td className="px-4 py-3"><div className="font-mono">{r.reportTypeCode}</div><div className="text-xs text-gray-500">{reportTypeNameByCode.get(r.reportTypeCode) || ""}</div></td>
                  <td className="px-4 py-3">{r.active === false ? "Inactive" : "Active"}</td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-2"><button onClick={() => openEdit(r)} disabled={!canEdit} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs"><Pencil className="h-4 w-4" />Edit</button><button onClick={() => onDelete(r)} disabled={!canEdit} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs text-red-700"><Trash2 className="h-4 w-4" />Delete</button></div></td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500">{loading ? "Loading..." : "No records found."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b px-5 py-4"><div className="text-base font-semibold">{mode === "create" ? "Create Mapping" : "Edit Mapping"}</div><button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-5 w-5" /></button></div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="text-xs font-semibold">Business</label>
                <select value={form.businessCode} onChange={(e) => setForm((f) => ({ ...f, businessCode: e.target.value }))} disabled={!canEdit || mode === "edit"} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="">{loadingBusiness ? "Loading..." : "Select business"}</option>
                  {businessOptions.map((b) => <option key={b.id} value={b.businessCode}>{b.businessCode} - {b.businessName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold">Report Type</label>
                <select value={form.reportTypeCode} onChange={(e) => setForm((f) => ({ ...f, reportTypeCode: e.target.value }))} disabled={!canEdit || mode === "edit"} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                  <option value="">{loadingReportTypes ? "Loading..." : "Select report type"}</option>
                  {reportTypeOptions.map((r) => <option key={r.id} value={r.code}>{r.code} - {r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold">Status</label>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} disabled={!canEdit} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">
                  {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t px-5 py-4"><button onClick={() => setOpen(false)} className="rounded-lg border px-3 py-2 text-sm">Cancel</button><button onClick={onSave} disabled={!canEdit || loading} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"><Save className="h-4 w-4" />Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "../../supabaseClient";
import { useUser } from "../../context/UserContext";
import { usePermissions } from "../../hooks/usePermissions";
import { Plus, RefreshCcw, Save, Trash2, Pencil, X, Search, Tag, Shield } from "lucide-react";

const COL = "master_reporttypes";
const STATUS = ["Active", "Inactive"];
const norm = (v = "") => String(v).trim();
const makeId = (code) => norm(code).toUpperCase().replace(/\s+/g, "_");
const mapRow = (r) => ({ ...r, code: r.code ?? r.report_type_code ?? "", name: r.name ?? r.report_type_name ?? "", sortOrder: r.sortOrder ?? r.sort_order ?? null });

export default function MasterReportTypePage() {
  const { user } = useUser();
  const actor = user?.email || user?.name || user?.uid || "";
  const { can, role } = usePermissions();
  const canView = can("masterData.view") || can("masterData.*") || role === "admin";
  const canEdit = can("masterData.reportTypes.edit") || can("masterData.*") || role === "admin";

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [qText, setQText] = useState("");
  const [sortKey, setSortKey] = useState("code");
  const [sortDir, setSortDir] = useState("asc");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("create");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ code: "", name: "", sortOrder: "", status: "Active" });

  async function load() {
    try {
      setLoading(true);
      const { data, error } = await supabase.from(COL).select("*").order("code", { ascending: true });
      if (error) throw error;
      setRows((data || []).map(mapRow));
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to load report types");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) return;
    load();
  }, [canView]);

  const filtered = useMemo(() => {
    const t = norm(qText).toLowerCase();
    const out = rows.map((r) => ({ ...r, activeLabel: r.active === false ? "Inactive" : "Active" })).filter((r) => !t || `${r.code} ${r.name} ${r.activeLabel} ${r.sortOrder ?? ""}`.toLowerCase().includes(t));
    out.sort((a, b) => {
      if (sortKey === "sortOrder") {
        const av = Number(a?.sortOrder ?? 0);
        const bv = Number(b?.sortOrder ?? 0);
        return sortDir === "asc" ? av - bv : bv - av;
      }
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
    setForm({ code: "", name: "", sortOrder: "", status: "Active" });
    setOpen(true);
  };

  const openEdit = (row) => {
    setMode("edit");
    setEditingId(row.id);
    setForm({ code: row.code || "", name: row.name || "", sortOrder: row.sortOrder ?? "", status: row.active === false ? "Inactive" : "Active" });
    setOpen(true);
  };

  async function onSave() {
    if (!canEdit) return toast.error("No permission to edit master data");
    const code = norm(form.code).toUpperCase();
    const name = norm(form.name);
    const sortOrder = form.sortOrder === "" ? null : Number(form.sortOrder);
    if (!code || !name) return toast.error("Code and name are required");
    if (sortOrder !== null && Number.isNaN(sortOrder)) return toast.error("Sort Order must be a number");

    const payload = {
      name,
      sort_order: sortOrder,
      active: form.status !== "Inactive",
      updated_at: new Date().toISOString(),
      updated_by: actor || null,
    };

    try {
      setLoading(true);
      if (mode === "create") {
        const { error } = await supabase.from(COL).insert({ id: makeId(code), code, ...payload, created_at: new Date().toISOString(), created_by: actor || null });
        if (error) throw error;
        toast.success("Report type created");
      } else {
        const { error } = await supabase.from(COL).update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Report type updated");
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
    if (!confirm(`Delete report type "${row.code}"?`)) return;
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

  if (!canView) {
    return <div className="p-6"><div className="rounded-xl border p-6 flex gap-3"><Shield className="w-5 h-5" /><div>You do not have permission to view Report Types master.</div></div></div>;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3"><div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center"><Tag className="w-5 h-5" /></div><div><h1 className="text-xl font-semibold">Master Data - Report Types</h1><p className="text-sm text-gray-500">Maintain report type codes used for filters and mapping.</p></div></div>
        <div className="flex items-center gap-2"><button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</button><button onClick={openCreate} disabled={!canEdit} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"><Plus className="h-4 w-4" />New Report Type</button></div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3"><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" /><input value={qText} onChange={(e) => setQText(e.target.value)} placeholder="Search code / name / status..." className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm" /></div><div className="flex gap-2"><select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm"><option value="code">Sort: Code</option><option value="name">Sort: Name</option><option value="sortOrder">Sort: Sort Order</option><option value="activeLabel">Sort: Status</option></select><button onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} className="rounded-lg border px-3 py-2 text-sm">{sortDir === "asc" ? "ASC" : "DESC"}</button></div><div className="flex items-center justify-end text-sm text-gray-500">{filtered.length} record(s)</div></div>
      <div className="mt-4 overflow-hidden rounded-xl border bg-white shadow-sm dark:bg-gray-900"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-gray-50 dark:bg-gray-800"><tr><th className="px-4 py-3 text-left">Code</th><th className="px-4 py-3 text-left">Name</th><th className="px-4 py-3 text-left">Sort</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody>{filtered.map((r) => <tr key={r.id}><td className="px-4 py-3 font-mono">{r.code}</td><td className="px-4 py-3">{r.name}</td><td className="px-4 py-3">{r.sortOrder ?? "-"}</td><td className="px-4 py-3">{r.active === false ? "Inactive" : "Active"}</td><td className="px-4 py-3"><div className="flex justify-end gap-2"><button onClick={() => openEdit(r)} disabled={!canEdit} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs"><Pencil className="h-4 w-4" />Edit</button><button onClick={() => onDelete(r)} disabled={!canEdit} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs text-red-700"><Trash2 className="h-4 w-4" />Delete</button></div></td></tr>)}{!filtered.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">{loading ? "Loading..." : "No records found."}</td></tr>}</tbody></table></div></div>
      {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-gray-900"><div className="flex items-center justify-between border-b px-5 py-4"><div className="text-base font-semibold">{mode === "create" ? "Create Report Type" : "Edit Report Type"}</div><button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-5 w-5" /></button></div><div className="px-5 py-4 space-y-3"><div><label className="text-xs font-semibold">Code</label><input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} disabled={!canEdit || mode === "edit"} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></div><div><label className="text-xs font-semibold">Name</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} disabled={!canEdit} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></div><div><label className="text-xs font-semibold">Sort Order</label><input value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} disabled={!canEdit} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></div><div><label className="text-xs font-semibold">Status</label><select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} disabled={!canEdit} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">{STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select></div></div><div className="flex items-center justify-end gap-2 border-t px-5 py-4"><button onClick={() => setOpen(false)} className="rounded-lg border px-3 py-2 text-sm">Cancel</button><button onClick={onSave} disabled={!canEdit || loading} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"><Save className="h-4 w-4" />Save</button></div></div></div>}
    </div>
  );
}

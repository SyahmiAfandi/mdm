import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "../../supabaseClient";
import { useUser } from "../../context/UserContext";

import { Plus, RefreshCcw, Save, Trash2, Pencil, X, Globe, Shield, Search } from "lucide-react";
import { usePermissions } from "../../hooks/usePermissions";

const COL = "master_countries";
const STATUS = ["Active", "Inactive"];

function normalize(str = "") {
  return String(str).trim();
}

function makeIdFromCode(code) {
  return normalize(code).toUpperCase().replace(/\s+/g, "_");
}

function mapRow(row) {
  return {
    ...row,
    code: row.code ?? row.country_code ?? "",
    name: row.name ?? row.country_name ?? "",
  };
}

export default function MasterCountryPage() {
  const { user } = useUser();
  const CURRENT_USER = user?.email || user?.name || user?.uid || "";

  const { can, role } = usePermissions();
  const canView = can("masterData.view") || can("masterData.*") || role === "admin";
  const canEdit = can("masterData.countries.edit") || can("masterData.*") || role === "admin";

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  const [qText, setQText] = useState("");
  const [sortKey, setSortKey] = useState("code");
  const [sortDir, setSortDir] = useState("asc");

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("create");
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    code: "",
    name: "",
    status: "Active",
  });

  async function fetchRows() {
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
      toast.error(e?.message || "Failed to load countries");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) return;
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const filtered = useMemo(() => {
    const t = normalize(qText).toLowerCase();

    let out = rows.map((r) => ({
      ...r,
      activeLabel: r.active === false ? "Inactive" : "Active",
    }));

    if (t) {
      out = out.filter((r) => {
        const hay = `${r.code || ""} ${r.name || ""} ${r.activeLabel || ""}`.toLowerCase();
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
    setForm({ code: "", name: "", status: "Active" });
    setOpen(true);
  }

  function openEdit(row) {
    setMode("edit");
    setEditingId(row.id);
    setForm({
      code: row.code || "",
      name: row.name || "",
      status: row.active === false ? "Inactive" : "Active",
    });
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
  }

  async function onSave() {
    if (!canEdit) return toast.error("No permission to edit master data");

    const code = normalize(form.code).toUpperCase();
    const name = normalize(form.name);
    const active = form.status !== "Inactive";

    if (!code) return toast.error("Country Code is required");
    if (!name) return toast.error("Country Name is required");

    try {
      setLoading(true);

      if (mode === "create") {
        const id = makeIdFromCode(code);
        const { error: insErr } = await supabase.from(COL).insert({
          id,
          code,
          name,
          active,
          created_at: new Date().toISOString(),
          created_by: CURRENT_USER || null,
          updated_at: new Date().toISOString(),
          updated_by: CURRENT_USER || null,
        });
        if (insErr) throw insErr;
        toast.success("Country created");
      } else {
        if (!editingId) throw new Error("Missing editing id");
        const { error: updErr } = await supabase
          .from(COL)
          .update({
            name,
            active,
            updated_at: new Date().toISOString(),
            updated_by: CURRENT_USER || null,
          })
          .eq("id", editingId);
        if (updErr) throw updErr;
        toast.success("Country updated");
      }

      setOpen(false);
      await fetchRows();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(row) {
    if (!canEdit) return toast.error("No permission to edit master data");

    const ok = confirm(`Delete country "${row.code}"?`);
    if (!ok) return;

    try {
      setLoading(true);
      const { error } = await supabase.from(COL).delete().eq("id", row.id);
      if (error) throw error;
      toast.success("Deleted");
      await fetchRows();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  }

  if (!canView) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Shield className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </div>
            <div>
              <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Access restricted
              </div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                You do not have permission to view Countries master.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Globe className="w-5 h-5 text-gray-900 dark:text-gray-100" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Master Data - Countries
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Maintain country codes and names for dropdowns and reporting filters.
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Mode:{" "}
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                {canEdit ? "Editable" : "Read only"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchRows}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            disabled={loading}
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            onClick={openCreate}
            disabled={!canEdit}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-black disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            <Plus className="h-4 w-4" />
            New Country
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="Search code / name / status..."
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

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold w-[140px]">Code</th>
                <th className="px-4 py-3 text-left font-semibold">Name</th>
                <th className="px-4 py-3 text-left font-semibold w-[140px]">Status</th>
                <th className="px-4 py-3 text-right font-semibold w-[220px]">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((r) => (
                <tr key={r.id} className="text-gray-800 dark:text-gray-100">
                  <td className="px-4 py-3 font-mono">{r.code}</td>
                  <td className="px-4 py-3">{r.name}</td>
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
                        disabled={!canEdit}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>

                      <button
                        onClick={() => onDelete(r)}
                        disabled={!canEdit}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/40 dark:bg-gray-900 dark:text-red-300 dark:hover:bg-red-900/20"
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
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <div>
                <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {mode === "create" ? "Create Country" : "Edit Country"}
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
                  Country Code (Doc ID)
                </label>
                <input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="MY / JP / SG"
                  disabled={!canEdit || mode === "edit"}
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
                  Country Name
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Malaysia"
                  disabled={!canEdit}
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
                  disabled={!canEdit}
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
                disabled={!canEdit || loading}
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

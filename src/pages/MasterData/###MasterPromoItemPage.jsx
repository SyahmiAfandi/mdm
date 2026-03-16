import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "../../supabaseClient";
import { useUser } from "../../context/UserContext";

import { Plus, RefreshCcw, Save, Trash2, Pencil, X, Boxes, Shield, Search } from "lucide-react";
import { usePermissions } from "../../hooks/usePermissions";

const COL = "master_promo_items"; // Note: Changed to master_promo_items
const STATUS = ["Active", "Inactive"];

function normalize(str = "") {
  return String(str).trim();
}

function makeIdFromCode(code) {
  return normalize(code).toUpperCase().replace(/\s+/g, "_");
}

export default function MasterPromoItemPage() {
  const { user } = useUser();
  const CURRENT_USER = user?.email || user?.name || user?.uid || "";

  const { can, role } = usePermissions();

  const canView = can("masterData.promoItems.view") || can("masterData.*") || role === "admin";
  const canEdit =
    can("masterData.promoItems.edit") || can("masterData.*") || role === "admin";

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);

  // Search / sort
  const [qText, setQText] = useState("");
  const [sortKey, setSortKey] = useState("itemCode");
  const [sortDir, setSortDir] = useState("asc");

  // Modal
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("create"); // create | edit
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    itemCode: "",
    itemName: "",
    itemDescription: "",
    itemDimension: "",
    itemShortForm: "",
    pcsPerCase: "",
    status: "Active",
  });

  async function fetchRows() {
    try {
      setLoading(true);
      const { data: _itemsSnap, error: _itemsSnapErr } = await supabase.from(COL).select("*").order("itemCode", { ascending: "asc" === "asc" });
      if (_itemsSnapErr) throw _itemsSnapErr;
      const itemsSnap = { docs: _itemsSnap.map(d => ({ id: d.id, data: () => d })) };
      const itemsData = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRows(itemsData);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to load Data");
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
        const hay = `${r.itemCode || ""} ${r.itemName || ""} ${r.activeLabel || ""}`.toLowerCase();
        return hay.includes(t);
      });
    }

    out.sort((a, b) => {
      const av =
        (a?.[sortKey] ?? "")
          .toString()
          .toLowerCase();
      const bv =
        (b?.[sortKey] ?? "")
          .toString()
          .toLowerCase();

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
      itemCode: "", 
      itemName: "", 
      itemDescription: "", 
      itemDimension: "", 
      itemShortForm: "", 
      pcsPerCase: "", 
      status: "Active" 
    });
    setOpen(true);
  }

  function openEdit(row) {
    setMode("edit");
    setEditingId(row.id);
    setForm({
      itemCode: row.itemCode || "",
      itemName: row.itemName || "",
      itemDescription: row.itemDescription || "",
      itemDimension: row.itemDimension || "",
      itemShortForm: row.itemShortForm || "",
      pcsPerCase: row.pcsPerCase || "",
      status: row.active === false ? "Inactive" : "Active",
    });
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
  }

  async function onSave() {
    if (!canEdit) return toast.error("No permission to edit master data");

    const itemCode = normalize(form.itemCode).toUpperCase();
    const itemName = normalize(form.itemName);
    const itemDescription = normalize(form.itemDescription);
    const itemDimension = normalize(form.itemDimension);
    const itemShortForm = normalize(form.itemShortForm);
    const pcsPerCase = parseInt(form.pcsPerCase, 10) || 0; // ensure int
    const active = form.status !== "Inactive";

    if (!itemCode) return toast.error("Item Code is required");
    if (!itemName) return toast.error("Item Name is required");

    try {
      setLoading(true);

      if (mode === "create") {
        const id = makeIdFromCode(itemCode);
        const { error: insErr } = await supabase.from(COL).insert({ id, itemCode,
            itemName,
            itemDescription,
            itemDimension,
            itemShortForm,
            pcsPerCase,
            active,
            createdAt: new Date().toISOString(),
            createdBy: CURRENT_USER,
            updatedAt: new Date().toISOString(),
            updatedBy: CURRENT_USER, });
        if (insErr) throw insErr;
        toast.success("Promo Item created ✅");
      } else {
        if (!editingId) throw new Error("Missing editing id");
        const { error: updErr } = await supabase.from(COL).update({
          itemName,
          itemDescription,
          itemDimension,
          itemShortForm,
          pcsPerCase,
          active,
          updated_at: new Date().toISOString(),
          updatedBy: CURRENT_USER,
        }).eq("id", editingId);
        if (updErr) throw updErr;
        toast.success("Promo Item updated ✅");
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

    const ok = confirm(`Delete Promotion Item "${row.itemCode}"?`);
    if (!ok) return;

    try {
      setLoading(true);
      const { error: _delErr } = await supabase.from(COL).delete().eq("id", row.id);
      if (_delErr) throw _delErr;
      toast.success("Deleted ✅");
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
                You don’t have permission to view Promotion Item master.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Boxes className="w-5 h-5 text-gray-900 dark:text-gray-100" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Master Data — Promotion Items
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Maintain Promotion Item details used in the system.
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
            New Promo Item
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
            placeholder="Search code / name…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 shadow-sm outline-none focus:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="itemCode">Sort: Code</option>
            <option value="itemName">Sort: Name</option>
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
          <table className="min-w-full text-sm w-full table-fixed">
            <thead className="bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold w-[15%]">Promo Item Code</th>
                <th className="px-4 py-3 text-left font-semibold w-[20%]">Promo Item Name</th>
                <th className="px-4 py-3 text-left font-semibold w-[15%]">Dimension</th>
                <th className="px-4 py-3 text-left font-semibold w-[10%]">ShortForm</th>
                <th className="px-4 py-3 text-left font-semibold w-[10%]">Pcs/Case</th>
                <th className="px-4 py-3 text-left font-semibold w-[10%]">Status</th>
                <th className="px-4 py-3 text-right font-semibold w-[20%]">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((r) => (
                <tr key={r.id} className="text-gray-800 dark:text-gray-100">
                  <td className="px-4 py-3 font-mono truncate" title={r.itemCode}>{r.itemCode}</td>
                  <td className="px-4 py-3 truncate" title={r.itemName}>{r.itemName}</td>
                  <td className="px-4 py-3 truncate" title={r.itemDimension}>{r.itemDimension}</td>
                  <td className="px-4 py-3 font-mono truncate" title={r.itemShortForm}>{r.itemShortForm}</td>
                  <td className="px-4 py-3 truncate" title={r.pcsPerCase}>{r.pcsPerCase}</td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
                        r.active === false
                          ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                          : "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200",
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
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                    {loading ? "Loading…" : "No Promotion Item records found."}
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
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800 shrink-0 bg-white dark:bg-gray-900 rounded-t-2xl">
              <div>
                <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {mode === "create" ? "Create Promotion Item" : "Edit Promotion Item"}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Fill in promo item details
                </div>
              </div>
              <button
                onClick={closeModal}
                className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 no-scrollbar">
              
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">Basic Info</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                      Item Code (Doc ID) <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={form.itemCode}
                      onChange={(e) => setForm((f) => ({ ...f, itemCode: e.target.value }))}
                      placeholder="e.g. ITEM123"
                      disabled={!canEdit || mode === "edit"}
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                      Item Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={form.itemName}
                      onChange={(e) => setForm((f) => ({ ...f, itemName: e.target.value }))}
                      placeholder="e.g. Standard Widget"
                      disabled={!canEdit}
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                      Item Description
                    </label>
                    <textarea
                      value={form.itemDescription}
                      onChange={(e) => setForm((f) => ({ ...f, itemDescription: e.target.value }))}
                      placeholder="Full description of the item"
                      disabled={!canEdit}
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                      Item Dimension
                    </label>
                    <input
                      value={form.itemDimension}
                      onChange={(e) => setForm((f) => ({ ...f, itemDimension: e.target.value }))}
                      placeholder="e.g. 5x5x5"
                      disabled={!canEdit}
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                      Item ShortForm
                    </label>
                    <input
                      value={form.itemShortForm}
                      onChange={(e) => setForm((f) => ({ ...f, itemShortForm: e.target.value }))}
                      placeholder="e.g. SW"
                      disabled={!canEdit}
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                      PCS / CS
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.pcsPerCase}
                      onChange={(e) => setForm((f) => ({ ...f, pcsPerCase: e.target.value }))}
                      placeholder="e.g. 24"
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
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800 shrink-0 bg-white dark:bg-gray-900 rounded-b-2xl">
              <button
                onClick={closeModal}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>

              <button
                onClick={onSave}
                disabled={!canEdit || loading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-blue-200"
              >
                <Save className="h-4 w-4" />
                Save Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

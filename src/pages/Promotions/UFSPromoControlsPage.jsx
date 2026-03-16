import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Save, Undo2, Database, RefreshCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { supabase } from "../../supabaseClient";
import {
  DEFAULT_PROMOTION_CONTROL_SCHEME_ID,
  PROMOTION_CONTROL_DEFAULTS,
} from "./ufsPromotionControlDefaults";

const TABLE_NAME = "promo_scheme_controls";

function buildControlsFromRow(row) {
  return PROMOTION_CONTROL_DEFAULTS.map((item) => ({
    ...item,
    value: row?.[item.field] != null ? String(row[item.field]) : item.value,
  }));
}

export default function UFSPromoControlsPage() {
  const navigate = useNavigate();
  const [controls, setControls] = useState(buildControlsFromRow());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState("");

  useEffect(() => {
    loadControls();
  }, []);

  async function loadControls() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select("*")
        .eq("scheme_id", DEFAULT_PROMOTION_CONTROL_SCHEME_ID)
        .maybeSingle();

      if (error) throw error;

      setControls(buildControlsFromRow(data));
      setLastSavedAt(data?.updated_at || "");
    } catch (error) {
      console.error("Failed to load promotion controls:", error);
      toast.error("Using local defaults. Apply the SQL table before saving.");
      setControls(buildControlsFromRow());
      setLastSavedAt("");
    } finally {
      setLoading(false);
    }
  }

  function handleValueChange(field, nextValue) {
    setControls((current) =>
      current.map((item) =>
        item.field === field ? { ...item, value: nextValue } : item
      )
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = controls.reduce(
        (acc, item) => {
          const nextValue =
            item.type === "number" && item.value !== ""
              ? Number(item.value)
              : item.value;

          return {
            ...acc,
            [item.field]: nextValue,
          };
        },
        {
          scheme_id: DEFAULT_PROMOTION_CONTROL_SCHEME_ID,
          active: true,
        }
      );

      const { error } = await supabase.from(TABLE_NAME).upsert(payload, {
        onConflict: "scheme_id",
      });

      if (error) throw error;

      setLastSavedAt(new Date().toISOString());
      toast.success("Promotion controls saved.");
    } catch (error) {
      console.error("Failed to save promotion controls:", error);
      toast.error("Save failed. Please check the Supabase table first.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full min-h-[calc(100vh-140px)] flex flex-col gap-4 p-2">
      <div className="shrink-0">
        <div className="flex items-center justify-between gap-4 rounded-[24px] border border-slate-200 dark:border-slate-800 bg-slate-900 px-6 py-4 shadow-2xl">
          <div className="flex items-center gap-5 min-w-0">
            <button
              onClick={() => navigate("/promotions/auto-ufs")}
              className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white group shrink-0"
            >
              <Undo2 size={18} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div className="h-10 w-px bg-white/10 hidden sm:block" />
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <Save className="w-5 h-5 text-rose-400 shrink-0" />
                <h1 className="text-lg md:text-xl font-black text-white tracking-tight uppercase truncate">
                  UFS Promotion Controls
                </h1>
              </div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.18em]">
                Editable default values for blueprint generation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={loadControls}
              disabled={loading || saving}
              className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white text-[10px] font-black uppercase tracking-[0.18em] flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCcw size={13} />
              Reload
            </button>
            <button
              onClick={handleSave}
              disabled={loading || saving}
              className="px-5 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-600 transition-all text-white text-[10px] font-black uppercase tracking-[0.18em] flex items-center gap-2 shadow-lg disabled:opacity-50"
            >
              <Save size={13} />
              {saving ? "Saving..." : "Save Controls"}
            </button>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-xl p-4 md:p-5 flex flex-col gap-4"
      >
        <div className="px-6 py-4 rounded-[24px] border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/80 dark:bg-slate-900/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-slate-900/10 text-slate-700 flex items-center justify-center shrink-0">
              <Database size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-[0.14em]">
                Promotion Control Fields
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.16em]">
                Template Row: {DEFAULT_PROMOTION_CONTROL_SCHEME_ID}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.16em]">
              Last Saved
            </div>
            <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              {lastSavedAt ? new Date(lastSavedAt).toLocaleString("en-GB") : "Not yet"}
            </div>
          </div>
        </div>

        <div className="px-1 pb-1 md:px-2 md:pb-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {controls.map((item) => (
              <div
                key={item.field}
                className="rounded-[22px] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3 shadow-sm"
              >
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.16em] mb-2">
                  {item.label}
                </label>
                <input
                  type={item.type === "number" ? "number" : "text"}
                  inputMode={item.type === "number" ? "numeric" : "text"}
                  value={item.value}
                  onChange={(e) => handleValueChange(item.field, e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-3 text-base font-black text-slate-800 dark:text-slate-100 shadow-sm outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10"
                />
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

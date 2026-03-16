import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Eye, Info, Plus, RefreshCcw, Save, Search, Trash2, Undo2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../../supabaseClient';
import UfsPromoBlueprintDetailModal from './UfsPromoBlueprintDetailModal';

const GENERATED_PROMOTION_TABLE = 'ufs_promotion_blueprints';
const GENERATED_PROMOTION_ROW_TABLE = 'ufs_promotion_blueprint_rows';

function mapStoredBlueprint(record) {
  return {
    id: record.id,
    schemeId: record.scheme_id,
    sequenceNumber: record.sequence_number,
    promoNumber: record.promo_number,
    promoType: record.promo_type,
    uom: record.uom,
    regionCode: record.region_code,
    regionName: record.region_name,
    itemCode: record.item_code,
    itemName: record.item_name,
    itemDimension: record.item_dimension,
    promoPeriod: record.promo_period,
    promoMechanics: record.promo_mechanics,
    description: record.description,
    periodFrom: record.period_from,
    periodTo: record.period_to,
    slabs: Array.isArray(record.slabs) ? record.slabs : [],
    freeSkus: Array.isArray(record.free_skus) ? record.free_skus : [],
    criteriaMappings: Array.isArray(record.criteria_mappings) ? record.criteria_mappings : [],
    createdAt: record.created_at,
  };
}

export default function UFSPromoListPage() {
  const navigate = useNavigate();
  const MotionDiv = motion.div;
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingSchemeIds, setDeletingSchemeIds] = useState([]);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  useEffect(() => {
    loadPromotions();
  }, []);

  async function loadPromotions() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from(GENERATED_PROMOTION_TABLE)
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRows((data || []).map(mapStoredBlueprint));
    } catch (error) {
      console.error('Failed to load UFS promotion blueprints:', error);
      toast.error('Unable to load saved promos. Apply the blueprint SQL table first.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePromotion(row) {
    const confirmed = window.confirm(`Delete promotion ${row.schemeId}? This will remove the saved blueprint and its slab rows.`);
    if (!confirmed) return;

    setDeletingSchemeIds((current) => [...new Set([...current, row.schemeId])]);

    try {
      const { error: rowDeleteError } = await supabase
        .from(GENERATED_PROMOTION_ROW_TABLE)
        .delete()
        .eq('OPSOID', row.schemeId);

      if (rowDeleteError) throw rowDeleteError;

      const { error: promotionDeleteError } = await supabase
        .from(GENERATED_PROMOTION_TABLE)
        .delete()
        .eq('scheme_id', row.schemeId);

      if (promotionDeleteError) throw promotionDeleteError;

      setRows((current) => current.filter((item) => item.schemeId !== row.schemeId));
      if (selectedDetail?.schemeId === row.schemeId) {
        setIsInfoModalOpen(false);
        setSelectedDetail(null);
      }
      toast.success(`Promotion ${row.schemeId} deleted.`);
    } catch (error) {
      console.error('Failed to delete UFS promotion blueprint:', error);
      toast.error('Delete failed. Please check the saved blueprint tables.');
    } finally {
      setDeletingSchemeIds((current) => current.filter((schemeId) => schemeId !== row.schemeId));
    }
  }

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredRows = normalizedSearch
    ? rows.filter((row) => [
      row.schemeId,
      row.promoNumber,
      row.description,
      row.regionCode,
      row.regionName,
      row.itemCode,
      row.itemName,
      row.promoType,
      row.uom
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch)))
    : rows;

  return (
    <div className="w-full h-[calc(100vh-140px)] flex flex-col gap-6 p-2">
      <div className="relative overflow-hidden bg-slate-900 rounded-[32px] px-8 py-5 shadow-2xl border border-white/5 shrink-0">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-rose-500/10 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-pink-500/10 blur-[80px] rounded-full -translate-x-1/2 translate-y-1/2" />

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <button
              onClick={() => navigate('/promotions')}
              className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white group shrink-0"
            >
              <Undo2 size={20} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div className="h-10 w-px bg-white/10 mx-1 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Database className="w-5 h-5 text-rose-400 shrink-0" />
                <h1 className="text-xl font-black text-white tracking-tight uppercase italic truncate">
                  UFS <span className="text-rose-500 font-extrabold not-italic">Blueprints</span>
                </h1>
                <div className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/30 text-[10px] font-black text-rose-400 uppercase tracking-tighter">LIVE</div>
              </div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Saved Promotion Blueprint Registry</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigate('/promotions/auto-ufs/controls')}
              className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2"
            >
              <Save size={14} />
              Control Defaults
            </button>
            <button
              onClick={() => navigate('/promotions/auto-ufs/add')}
              className="px-4 py-2 rounded-2xl bg-rose-500 hover:bg-rose-600 transition-all text-white text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-lg"
            >
              <Plus size={14} />
              Add Promo
            </button>
          </div>
        </div>
      </div>

      <MotionDiv
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 min-h-0 flex flex-col bg-slate-50 dark:bg-slate-900/50 rounded-[40px] border border-slate-200 dark:border-slate-800/50 shadow-inner overflow-hidden relative"
      >
        <div className="absolute inset-0 opacity-[0.015] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />

          <div className="px-10 py-5 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between bg-white/50 dark:bg-slate-900/50 backdrop-blur-md shrink-0 z-10">
            <h3 className="text-xs font-black text-slate-600 dark:text-slate-300 flex items-center gap-3 uppercase tracking-widest">
              <Eye className="w-5 h-5 text-rose-500" />
              Promotion Blueprint List
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search scheme, promo, description..."
                  className="w-[280px] pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
                />
              </div>
              <button
                onClick={() => setSearchTerm('')}
                disabled={!searchTerm}
                className="px-3 py-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all text-[10px] font-black uppercase tracking-[0.2em] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset
              </button>
              <div className="px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                {filteredRows.length} / {rows.length} Saved
              </div>
              <button
                onClick={loadPromotions}
                disabled={loading}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-blue-500 hover:text-white transition-all shadow-sm disabled:opacity-60"
                title="Reload list"
              >
                <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 relative z-10 overflow-hidden">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="relative mb-8 text-slate-200 dark:text-slate-800">
                <div className="absolute inset-0 bg-rose-500/10 blur-3xl rounded-full" />
                <Database size={64} className="relative opacity-20 animate-pulse" />
              </div>
              <h4 className="text-sm font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em] mb-2">Loading Registry</h4>
              <p className="text-[10px] font-bold text-slate-400/60 uppercase tracking-widest max-w-[260px]">
                Reading saved promotions from database
              </p>
            </div>
          ) : rows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="relative mb-8 text-slate-200 dark:text-slate-800">
                <div className="absolute inset-0 bg-rose-500/10 blur-3xl rounded-full" />
                <Eye size={64} className="relative opacity-20" />
              </div>
              <h4 className="text-sm font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em] mb-2">No Saved Blueprint</h4>
              <p className="text-[10px] font-bold text-slate-400/60 uppercase tracking-widest max-w-[300px] mb-6">
                Use Add Promo to build a new UFS blueprint and save it into the registry
              </p>
              <button
                onClick={() => navigate('/promotions/auto-ufs/add')}
                className="px-4 py-2 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-lg"
              >
                <Plus size={14} />
                Add Promo
              </button>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="relative mb-8 text-slate-200 dark:text-slate-800">
                <div className="absolute inset-0 bg-rose-500/10 blur-3xl rounded-full" />
                <Search size={64} className="relative opacity-20" />
              </div>
              <h4 className="text-sm font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em] mb-2">No Matching Result</h4>
              <p className="text-[10px] font-bold text-slate-400/60 uppercase tracking-widest max-w-[320px] mb-6">
                Try another keyword or reset the filter to see all saved blueprints again
              </p>
              <button
                onClick={() => setSearchTerm('')}
                className="px-4 py-2 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] shadow-lg"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className="h-full overflow-auto custom-scrollbar">
              <table className="w-full min-w-[980px] text-left border-collapse bg-white">
                <thead className="sticky top-0 text-slate-100 z-20">
                  <tr className="uppercase tracking-widest">
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] bg-slate-800 border-b border-r border-slate-700/80">Scheme ID</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] bg-slate-700 border-b border-r border-slate-600/80">Promotion Number</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] bg-slate-800 border-b border-r border-slate-700/80">Description</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] bg-slate-700 border-b border-r border-slate-600/80">Period From</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] bg-slate-800 border-b border-r border-slate-700/80">Period To</th>
                    <th className="px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-right bg-slate-700 border-b border-slate-600/80">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {filteredRows.map((row) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="group hover:bg-slate-100/70 dark:hover:bg-slate-900/70 transition-colors"
                    >
                      <td className="px-8 py-5 bg-white border-r border-slate-200 dark:border-slate-800/60">
                        <span className="font-mono font-black text-rose-500 text-sm tracking-tighter">
                          {row.schemeId}
                        </span>
                      </td>
                      <td className="px-8 py-5 bg-white border-r border-slate-200 dark:border-slate-800/60">
                        <div className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">
                          {row.promoNumber}
                        </div>
                      </td>
                      <td className="px-8 py-5 bg-white border-r border-slate-200 dark:border-slate-800/60">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed min-w-[300px]">
                          {row.description}
                        </div>
                      </td>
                      <td className="px-8 py-5 bg-white border-r border-slate-200 dark:border-slate-800/60">
                        <div className="font-mono text-[10px] font-black text-slate-400 dark:text-slate-500">
                          {row.periodFrom ? new Date(row.periodFrom).toLocaleDateString('en-GB') : '-'}
                        </div>
                      </td>
                      <td className="px-8 py-5 bg-white border-r border-slate-200 dark:border-slate-800/60">
                        <div className="font-mono text-[10px] font-black text-slate-400 dark:text-slate-500">
                          {row.periodTo ? new Date(row.periodTo).toLocaleDateString('en-GB') : '-'}
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right bg-white">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedDetail(row);
                              setIsInfoModalOpen(true);
                            }}
                            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                            title="View blueprint detail"
                          >
                            <Info size={14} />
                          </button>
                          <button
                            onClick={() => handleDeletePromotion(row)}
                            disabled={deletingSchemeIds.includes(row.schemeId)}
                            className="p-2 rounded-lg bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            title="Delete saved blueprint"
                          >
                            <Trash2 size={14} className={deletingSchemeIds.includes(row.schemeId) ? 'animate-pulse' : ''} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-10 py-4 bg-white/50 dark:bg-slate-900/50 border-t border-slate-200/50 dark:border-slate-800/50 flex justify-center text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] z-10">
          System Identifier: UFS-GEN-01-REGISTRY
        </div>
      </MotionDiv>

      <UfsPromoBlueprintDetailModal
        isOpen={isInfoModalOpen}
        selectedDetail={selectedDetail}
        onClose={() => setIsInfoModalOpen(false)}
      />
    </div>
  );
}

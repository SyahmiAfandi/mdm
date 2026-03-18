import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from "../../supabaseClient";
import {
  Plus, Search, Edit2, Trash2, X, AlertCircle, Save, CalendarClock, Undo2, Layout, Sparkles, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { usePermissions } from '../../hooks/usePermissions';
import { useUser } from "../../context/UserContext";

const TABLE = 'promo_periods';
const YEARS_TABLE = 'master_years';

const MONTHS = [
  { name: 'January', val: '01' },
  { name: 'February', val: '02' },
  { name: 'March', val: '03' },
  { name: 'April', val: '04' },
  { name: 'May', val: '05' },
  { name: 'June', val: '06' },
  { name: 'July', val: '07' },
  { name: 'August', val: '08' },
  { name: 'September', val: '09' },
  { name: 'October', val: '10' },
  { name: 'November', val: '11' },
  { name: 'December', val: '12' },
];

function mapRow(row = {}) {
  return {
    ...row,
    id: row.period_id || '', // Use period_id as the primary identifier
    year: row.year || '',
    month: row.month || '',
    promoPeriod: row.promo_period || '',
    displayId: row.period_id || '',
    startDate: row.start_date || '',
    endDate: row.end_date || '',
    createdBy: row.created_by || '',
    createdAt: row.created_at || '',
    updatedBy: row.updated_by || '',
    updatedAt: row.updated_at || '',
    active: row.active ?? true,
  };
}

export default function PromoPeriodPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const actor = user?.email || user?.name || '';
  
  const { can } = usePermissions();
  const canEdit = can('promotions.promoPeriod.edit');

  const [dataList, setDataList] = useState([]);
  const [yearList, setYearList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    year: '',
    month: '',
    startDate: '',
    endDate: '',
    active: true,
  });

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: rows, error: err } = await supabase
        .from(TABLE)
        .select('*')
        .order('year', { ascending: false });
      
      if (err) throw err;

      // Custom chronological month sort (Descending: Dec -> Jan)
      const sortedRows = (rows || []).sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        
        const monthA = MONTHS.find(m => m.name === a.month)?.val || '00';
        const monthB = MONTHS.find(m => m.name === b.month)?.val || '00';
        
        return monthB.localeCompare(monthA);
      });

      setDataList(sortedRows.map(mapRow));

      const { data: yRows, error: yErr } = await supabase
        .from(YEARS_TABLE)
        .select('year')
        .eq('active', true)
        .order('year', { ascending: false });
      if (yErr) throw yErr;
      setYearList(yRows || []);
    } catch (error) {
      console.error("Error fetching promo periods:", error);
      toast.error("Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter Data
  const filteredData = useMemo(() => {
    if (!searchTerm) return dataList;
    const lowerSearch = searchTerm.toLowerCase();
    return dataList.filter(item => 
      String(item.year).includes(lowerSearch) ||
      (item.month || '').toLowerCase().includes(lowerSearch) ||
      (item.promoPeriod || '').toLowerCase().includes(lowerSearch)
    );
  }, [dataList, searchTerm]);

  // Handlers
  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingId(item.id); // item.id is now period_id
      setFormData({
        year: item.year || '',
        month: item.month || '',
        startDate: item.startDate || '',
        endDate: item.endDate || '',
        active: item.active ?? true,
      });
    } else {
      setEditingId(null);
      setFormData({
        year: yearList.length > 0 ? yearList[0].year : '',
        month: MONTHS[0].name,
        startDate: '',
        endDate: '',
        active: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleOpenDetailModal = (item) => {
    setDetailItem(item);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setDetailItem(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.year || !formData.month) {
      toast.error("Year and Month are required.");
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const monthObj = MONTHS.find(m => m.name === formData.month);
      const promo_period = `${monthObj.val}.${String(formData.year).slice(-2)}`;

      // Duplicate Check
      const isDuplicate = dataList.some(item => 
        item.promoPeriod === promo_period && item.id !== editingId
      );

      if (isDuplicate) {
        toast.error(`The promo period "${promo_period}" already exists.`);
        setSaving(false);
        return;
      }

      const payload = {
        year: parseInt(formData.year),
        month: formData.month,
        promo_period,
        period_id: `${String(formData.year).slice(-2)}${monthObj.val}`,
        start_date: formData.startDate || null,
        end_date: formData.endDate || null,
        active: formData.active,
        updated_at: now,
        updated_by: actor,
      };

      if (!editingId) {
        payload.created_at = now;
        payload.created_by = actor;
        const { error } = await supabase.from(TABLE).insert(payload);
        if (error) throw error;
        toast.success("Added successfully.");
      } else {
        const { error } = await supabase.from(TABLE).update(payload).eq('period_id', editingId);
        if (error) throw error;
        toast.success("Updated successfully.");
      }
      
      handleCloseModal();
      fetchData();
    } catch (error) {
      console.error("Save error:", error);
      toast.error(error.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this promo period?")) return;
    try {
      const { error } = await supabase.from(TABLE).delete().eq('period_id', id);
      if (error) throw error;
      toast.success("Deleted successfully.");
      fetchData();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/50">
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden bg-slate-900 mx-6 mt-6 rounded-[32px] px-8 py-5 shadow-2xl border border-white/5 shrink-0">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-500/10 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-teal-500/10 blur-[80px] rounded-full -translate-x-1/2 translate-y-1/2" />
        
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => navigate('/promotions/config')}
              className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white group"
              title="Back to Config"
            >
              <Undo2 size={20} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div className="h-10 w-px bg-white/10 mx-1" />
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/20">
                <CalendarClock size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h1 className="text-xl font-black text-white tracking-tight uppercase italic">
                    Promotion <span className="text-emerald-500 font-extrabold not-italic">Period</span>
                  </h1>
                </div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Fiscal Calendars & Timelines</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative group/search">
               <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                  <Search className="w-4 h-4 text-slate-500 group-focus-within/search:text-emerald-400 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Search periods..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full sm:w-64 bg-white/5 border border-white/10 rounded-2xl text-[11px] font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 transition-all shadow-sm"
                />
            </div>

            {canEdit && (
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                <Plus size={16} />
                Add Period
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-amber-500 animate-spin" />
              <p className="text-sm text-slate-500 mt-4">Loading promo periods...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">No Periods Found</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">No promo period configurations match your search.</p>
            </div>
          ) : (
            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 sticky top-0 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">ID</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Year</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Month</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Promo Period</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Start Date</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">End Date</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Status</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100 font-mono italic text-amber-600 dark:text-amber-500">{item.displayId}</td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{item.year}</td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{item.month}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800 rounded-md text-xs font-bold font-mono">
                          {item.promoPeriod}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300 font-mono text-xs">
                        {item.startDate ? new Date(item.startDate).toLocaleDateString('en-GB') : '-'}
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300 font-mono text-xs">
                        {item.endDate ? new Date(item.endDate).toLocaleDateString('en-GB') : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          item.active 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800' 
                            : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                        }`}>
                          {item.active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleOpenDetailModal(item)}
                            className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="View Details"
                          >
                            <Info size={16} />
                          </button>
                          {canEdit && (
                            <>
                              <button
                                onClick={() => handleOpenModal(item)}
                                className="p-2 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="Edit Period"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete Period"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal overlay ── */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-amber-500" />
                  {editingId ? 'Edit Promo Period' : 'Add Promo Period'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6">
                <form id="periodForm" onSubmit={handleSave} className="space-y-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Year <span className="text-red-500">*</span></label>
                    <select
                      name="year"
                      required
                      value={formData.year}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                    >
                      {yearList.length === 0 ? (
                        <option value="">No active years</option>
                      ) : (
                        yearList.map(y => (
                          <option key={y.year} value={y.year}>{y.year}</option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Month <span className="text-red-500">*</span></label>
                    <select
                      name="month"
                      required
                      value={formData.month}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                    >
                      {MONTHS.map(m => (
                        <option key={m.name} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Start Date</label>
                      <input
                        type="date"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">End Date</label>
                      <input
                        type="date"
                        name="endDate"
                        value={formData.endDate}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl font-mono text-center">
                    <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Generated Promo Period</div>
                    <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                      {MONTHS.find(m => m.name === formData.month)?.val || '00'}.{String(formData.year || '0000').slice(-2)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="active"
                      name="active"
                      checked={formData.active}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-amber-500 border-slate-300 rounded focus:ring-amber-500"
                    />
                    <label htmlFor="active" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                      Active Status
                    </label>
                  </div>
                </form>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="periodForm"
                  disabled={saving || yearList.length === 0}
                  className="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95"
                >
                  {saving ? (
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin dark:border-slate-900/30 dark:border-t-slate-900" />
                  ) : (
                    <Save size={16} />
                  )}
                  {saving ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {isDetailModalOpen && detailItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseDetailModal}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-500" />
                  Period Details
                </h3>
                <button
                  onClick={handleCloseDetailModal}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">ID (YYMM)</span>
                  <span className="font-mono font-bold text-rose-500">{detailItem.displayId}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Promo Period</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{detailItem.promoPeriod}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Start Date</div>
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      {detailItem.startDate ? new Date(detailItem.startDate).toLocaleDateString('en-GB') : '-'}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">End Date</div>
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      {detailItem.endDate ? new Date(detailItem.endDate).toLocaleDateString('en-GB') : '-'}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Status</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    detailItem.active 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {detailItem.active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Creation Info</span>
                    <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-slate-500">Created By</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{detailItem.createdBy || '-'}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-slate-500">Created At</span>
                        <span className="text-slate-600 dark:text-slate-400">{detailItem.createdAt ? new Date(detailItem.createdAt).toLocaleString() : '-'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Last Update Info</span>
                    <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-slate-500">Updated By</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{detailItem.updatedBy || '-'}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1">
                        <span className="text-slate-500">Updated At</span>
                        <span className="text-slate-600 dark:text-slate-400">{detailItem.updatedAt ? new Date(detailItem.updatedAt).toLocaleString() : '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 text-right">
                <button
                  onClick={handleCloseDetailModal}
                  className="px-4 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';

import { supabase } from "../../supabaseClient";
import {
  Search, Plus, Save, X, Edit2, AlertCircle, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { usePermissions } from '../../hooks/usePermissions';

const REGION_TABLE = 'promo_region_distributors';

function mapRegion(row = {}) {
  return {
    ...row,
    id: row.id ?? row.dt_code ?? row.dtCode ?? '',
    dtCode: row.dtCode ?? row.dt_code ?? '',
    dtName: row.dtName ?? row.dt_name ?? '',
    dtAlias: row.dtAlias ?? row.dt_alias ?? '',
    dtShortform: row.dtShortform ?? row.dt_shortform ?? '',
    active: row.active !== false,
  };
}

export default function PromoRegionDistributorPage() {
  const { can } = usePermissions();
  const canEdit = can('promotions.regionDistributor.edit');

  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    dtCode: '',
    dtName: '',
    dtAlias: '',
    dtShortform: '',
    active: true
  });

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(REGION_TABLE)
        .select('*')
        .order('dt_code', { ascending: true });
      if (error) throw error;
      const items = (data || []).map(mapRegion);
      setDataList(items);
    } catch (error) {
      console.error("Error fetching promo region config:", error);
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
      (item.dtCode || '').toLowerCase().includes(lowerSearch) ||
      (item.dtName || '').toLowerCase().includes(lowerSearch) ||
      (item.dtAlias || '').toLowerCase().includes(lowerSearch)
    );
  }, [dataList, searchTerm]);

  // Handlers
  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        dtCode: item.dtCode || '',
        dtName: item.dtName || '',
        dtAlias: item.dtAlias || '',
        dtShortform: item.dtShortform || '',
        active: item.active !== false
      });
    } else {
      setEditingId(null);
      setFormData({
        dtCode: '',
        dtName: '',
        dtAlias: '',
        dtShortform: '',
        active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Constraint logic for shortform
    if (name === 'dtShortform') {
      const formattedValue = value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
      setFormData(prev => ({ ...prev, [name]: formattedValue }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.dtCode.trim() || !formData.dtName.trim()) {
      toast.error("Region Code and Name are required.");
      return;
    }

    setSaving(true);
    try {
      const docId = editingId || formData.dtCode.trim().toUpperCase();
      const now = new Date().toISOString();

      const payload = {
        dt_code: formData.dtCode.trim().toUpperCase(),
        dt_name: formData.dtName.trim(),
        dt_alias: formData.dtAlias.trim(),
        dt_shortform: formData.dtShortform.trim(),
        active: formData.active,
        updated_at: now,
      };

      if (!editingId) {
        payload.id = docId;
        payload.created_at = now;
      }

      if (editingId) {
        const { error } = await supabase.from(REGION_TABLE).update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success("Updated successfully.");
      } else {
        const { error } = await supabase.from(REGION_TABLE).insert(payload);
        if (error) throw error;
        toast.success("Added successfully.");
      }
      
      handleCloseModal();
      fetchData();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/50">
      <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl">
            <MapPin size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Region & Distributor Config</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Map and configure region codes and shortforms.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by code or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full sm:w-64 bg-slate-100 dark:bg-slate-800/50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all"
            />
          </div>
          {canEdit && (
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm active:scale-95"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Add Region</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-blue-500 animate-spin" />
              <p className="text-sm text-slate-500 mt-4">Loading regions...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">No Regions Found</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">No region configurations map to your search, or the database is currently empty.</p>
            </div>
          ) : (
            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 sticky top-0 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Region DT Code</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Region DT Name</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Region DT Alias</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Shortform</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Status</th>
                    {canEdit && <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px] text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-6 py-4 font-mono font-medium text-slate-900 dark:text-slate-100">{item.dtCode}</td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{item.dtName}</td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{item.dtAlias || '-'}</td>
                      <td className="px-6 py-4 font-mono text-slate-700 dark:text-slate-300">
                        {item.dtShortform ? (
                          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-600 dark:text-slate-300 font-bold tracking-wider">{item.dtShortform}</span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold ${item.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                          {item.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleOpenModal(item)}
                            className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="Edit Region"
                          >
                            <Edit2 size={16} />
                          </button>
                        </td>
                      )}
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
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-500" />
                  {editingId ? 'Edit Region Configuration' : 'Add Region Configuration'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[70vh]">
                <form id="regionForm" onSubmit={handleSave} className="space-y-5">
                  
                  {/* Row 1 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Region DT Code <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="dtCode"
                        required
                        disabled={!!editingId}
                        value={formData.dtCode}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border ${editingId ? 'border-slate-200 text-slate-400 cursor-not-allowed' : 'border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'} rounded-lg text-sm transition-colors`}
                        placeholder="e.g. R01"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Region DT Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="dtName"
                        required
                        value={formData.dtName}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                        placeholder="e.g. North Region"
                      />
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Region DT Alias</label>
                    <input
                      type="text"
                      name="dtAlias"
                      value={formData.dtAlias}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      placeholder="e.g. NR"
                    />
                  </div>

                  {/* Row 3 - Important constraints */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                      Region DT Shortform
                      <span className="text-[10px] normal-case bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md font-bold tracking-tight">max: 2 chars (A-Z)</span>
                    </label>
                    <input
                      type="text"
                      name="dtShortform"
                      value={formData.dtShortform}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors font-mono tracking-widest text-lg"
                      placeholder="e.g. NR"
                      maxLength={2}
                    />
                    <p className="text-xs text-slate-400 mt-1.5">For promo matching constraints. Must be exactly 2 uppercase letters.</p>
                  </div>

                  {/* Row 4 */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label className="flex items-center gap-3 cursor-pointer group w-max">
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          name="active"
                          checked={formData.active}
                          onChange={handleInputChange}
                          className="peer sr-only"
                        />
                        <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-500"></div>
                      </div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-blue-600 transition-colors">Active Status</span>
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
                  form="regionForm"
                  disabled={saving}
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
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';

import { supabase } from "../../supabaseClient";
import {
  Plus, Search, Edit2, Trash2, X, AlertCircle, Save, PackageOpen, Undo2, Layout, Sparkles, Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { usePermissions } from '../../hooks/usePermissions';

const ITEM_TABLE = 'promo_items_config';
const SKU_TABLE = 'master_sku';

function mapPromoItem(row = {}) {
  return {
    ...row,
    id: row.id ?? row.item_code ?? row.itemCode ?? '',
    itemCode: row.itemCode ?? row.item_code ?? '',
    itemName: row.itemName ?? row.item_name ?? '',
    itemDimension: row.itemDimension ?? row.item_dimension ?? '',
    itemShortform: row.itemShortform ?? row.item_shortform ?? '',
    pcsPerCase: row.pcsPerCase ?? row.pcs_per_case ?? '',
    mappedSkus: row.mappedSkus ?? row.mapped_skus ?? [],
    active: row.active !== false,
  };
}

function mapSku(row = {}) {
  return {
    code: row.code ?? row.sku_code ?? row.id ?? '',
    description: row.description ?? row.sku_description ?? row.name ?? '',
  };
}

export default function PromoItemConfigPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canEdit = can('promotions.promoItem.edit');

  const [dataList, setDataList] = useState([]);
  const [skuList, setSkuList] = useState([]); // from master_sku
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [skuSearchTerm, setSkuSearchTerm] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    itemCode: '',
    itemName: '',
    itemDimension: '',
    itemShortform: '',
    pcsPerCase: '',
    mappedSkus: [], // Array of skuCodes
    active: true
  });

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: itemRows, error: itemErr } = await supabase
        .from(ITEM_TABLE)
        .select('*')
        .order('item_code', { ascending: true });
      if (itemErr) throw itemErr;
      const items = (itemRows || []).map(mapPromoItem);
      setDataList(items);

      const { data: skuRows, error: skuErr } = await supabase
        .from(SKU_TABLE)
        .select('*')
        .order('code', { ascending: true });
      if (skuErr) throw skuErr;
      const skus = (skuRows || []).map(mapSku).filter((sku) => sku.code);
      setSkuList(skus);
    } catch (error) {
      console.error("Error fetching promo item config:", error);
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
      (item.itemCode || '').toLowerCase().includes(lowerSearch) ||
      (item.itemName || '').toLowerCase().includes(lowerSearch) ||
      (item.itemShortform || '').toLowerCase().includes(lowerSearch)
    );
  }, [dataList, searchTerm]);

  // Filter SKUs
  const filteredSkuList = useMemo(() => {
    if (!skuSearchTerm) return skuList;
    const lowerSearch = skuSearchTerm.toLowerCase();
    return skuList.filter(sku => 
      (sku.code || '').toLowerCase().includes(lowerSearch) ||
      (sku.description || '').toLowerCase().includes(lowerSearch)
    );
  }, [skuList, skuSearchTerm]);

  // Handlers
  const handleOpenModal = (item = null) => {
    setSkuSearchTerm('');
    if (item) {
      setEditingId(item.id);
      setFormData({
        itemCode: item.itemCode || '',
        itemName: item.itemName || '',
        itemDimension: item.itemDimension || '',
        itemShortform: item.itemShortform || '',
        pcsPerCase: item.pcsPerCase || '',
        mappedSkus: item.mappedSkus || [],
        active: item.active !== false
      });
    } else {
      setEditingId(null);
      setFormData({
        itemCode: '',
        itemName: '',
        itemDimension: '',
        itemShortform: '',
        pcsPerCase: '',
        mappedSkus: [],
        active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleAddItem = () => handleOpenModal(null);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Constraint logic for shortform
    if (name === 'itemShortform') {
      const formattedValue = value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
      setFormData(prev => ({ ...prev, [name]: formattedValue }));
      return;
    }

    if (name === 'mappedSkus') {
      // Handle multi-select
      const options = e.target.options;
      const selected = [];
      for (let i = 0; i < options.length; i++) {
        if (options[i].selected) {
          selected.push(options[i].value);
        }
      }
      setFormData(prev => ({ ...prev, mappedSkus: selected }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.itemCode.trim() || !formData.itemName.trim()) {
      toast.error("Item Code and Name are required.");
      return;
    }

    setSaving(true);
    try {
      const docId = editingId || formData.itemCode.trim().toUpperCase();
      const now = new Date().toISOString();

      const payload = {
        item_code: formData.itemCode.trim().toUpperCase(),
        item_name: formData.itemName.trim(),
        item_dimension: formData.itemDimension.trim(),
        item_shortform: formData.itemShortform.trim(),
        pcs_per_case: formData.pcsPerCase,
        mapped_skus: formData.mappedSkus,
        active: formData.active,
        updated_at: now,
      };

      if (!editingId) {
        payload.id = docId;
        payload.created_at = now;
      }

      if (editingId) {
        const { error } = await supabase.from(ITEM_TABLE).update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success("Updated successfully.");
      } else {
        const { error } = await supabase.from(ITEM_TABLE).insert(payload);
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

  // Helper for rendering mapped SKUs in table cell
  const renderMappedSkus = (skus) => {
    if (!skus || skus.length === 0) return <span className="text-slate-400 italic">None</span>;
    if (skus.length <= 2) {
      return (
        <div className="flex flex-wrap gap-1">
          {skus.map(s => <span key={s} className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 rounded-md text-[10px] font-bold">{s}</span>)}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1">
        <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 rounded-md text-[10px] font-bold">{skus[0]}</span>
        <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 rounded-md text-[10px] font-bold">{skus[1]}</span>
        <span className="text-xs font-bold text-slate-500">+{skus.length - 2} more</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/50">
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden bg-slate-900 mx-6 mt-6 rounded-[32px] px-8 py-5 shadow-2xl border border-white/5 shrink-0">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-orange-500/10 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-amber-500/10 blur-[80px] rounded-full -translate-x-1/2 translate-y-1/2" />
        
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
              <div className="p-3 bg-orange-500/20 text-orange-400 rounded-2xl border border-orange-500/20">
                <PackageOpen size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h1 className="text-xl font-black text-white tracking-tight uppercase italic">
                    Promotion <span className="text-orange-500 font-extrabold not-italic">Items</span>
                  </h1>
                </div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">SKU Groups & Item Shortforms</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative group/search">
               <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                  <Search className="w-4 h-4 text-slate-500 group-focus-within/search:text-orange-400 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full sm:w-64 bg-white/5 border border-white/10 rounded-2xl text-[11px] font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500/50 transition-all shadow-sm"
                />
            </div>

            {canEdit && (
              <button
                onClick={() => handleAddItem()}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-orange-500/20 active:scale-95"
              >
                <Plus size={16} />
                Add Item
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-emerald-500 animate-spin" />
              <p className="text-sm text-slate-500 mt-4">Loading promo items...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">No Items Found</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">No promo item configurations map to your search, or the database is currently empty.</p>
            </div>
          ) : (
            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 sticky top-0 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Item Code</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Item Name</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Shortform</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Dimension</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">PCS/CS</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Mapped SKUs</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Status</th>
                    {canEdit && <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px] text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-6 py-4 font-mono font-medium text-slate-900 dark:text-slate-100">{item.itemCode}</td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                        <div className="max-w-[200px] truncate" title={item.itemName}>{item.itemName}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-700 dark:text-slate-300">
                        {item.itemShortform ? (
                          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-600 dark:text-slate-300 font-bold tracking-wider">{item.itemShortform}</span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{item.itemDimension || '-'}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{item.pcsPerCase || '-'}</td>
                      <td className="px-6 py-4">
                        {renderMappedSkus(item.mappedSkus)}
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
                            className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="Edit Item"
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
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <PackageOpen className="w-5 h-5 text-emerald-500" />
                  {editingId ? 'Edit Promo Item Configuration' : 'Add Promo Item Configuration'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[75vh]">
                <form id="itemForm" onSubmit={handleSave} className="space-y-6">
                  
                  {/* Grid 1: Basic Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Item Code <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="itemCode"
                        required
                        disabled={!!editingId}
                        value={formData.itemCode}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border ${editingId ? 'border-slate-200 text-slate-400 cursor-not-allowed' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'} rounded-lg text-sm transition-colors`}
                        placeholder="e.g. PI-101"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Item Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="itemName"
                        required
                        value={formData.itemName}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                        placeholder="e.g. Promo Bundle A"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Dimension</label>
                      <input
                        type="text"
                        name="itemDimension"
                        value={formData.itemDimension}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                        placeholder="e.g. 10x10x5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">PCS / CS</label>
                      <input
                        type="number"
                        name="pcsPerCase"
                        value={formData.pcsPerCase}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                        placeholder="e.g. 24"
                        min="1"
                      />
                    </div>
                  </div>

                  {/* Grid 2: Constraints & Mappings */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-xl space-y-5">
                    
                    {/* Shortform logic */}
                    <div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                        Item Shortform
                        <span className="text-[10px] normal-case bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md font-bold tracking-tight">max: 2 chars (A-Z)</span>
                      </label>
                      <input
                        type="text"
                        name="itemShortform"
                        value={formData.itemShortform}
                        onChange={handleInputChange}
                        className="w-32 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors font-mono tracking-widest text-lg text-center"
                        placeholder="e.g. AB"
                        maxLength={2}
                      />
                      <p className="text-xs text-slate-400 mt-2">Must be exactly 2 uppercase letters. Used for report generation strings.</p>
                    </div>

                    <div className="h-px bg-slate-200 dark:bg-slate-700" />

                    {/* SKU Mapping */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                          <Tag className="w-3.5 h-3.5" />
                          Map to Master SKUs
                          <span className="text-[10px] normal-case bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md font-bold tracking-tight">Multiple Selection</span>
                        </label>
                      </div>

                      <div className="relative mb-2">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search SKUs to attach..."
                          value={skuSearchTerm}
                          onChange={(e) => setSkuSearchTerm(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                        />
                      </div>

                      <select
                        multiple
                        name="mappedSkus"
                        value={formData.mappedSkus}
                        onChange={handleInputChange}
                        size={6}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors custom-scrollbar"
                      >
                        {filteredSkuList.map(sku => (
                          <option key={sku.code} value={sku.code} className="py-1.5 px-2 border-b border-slate-50 dark:border-slate-800 last:border-0 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                            {sku.code} — {sku.description}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-400 mt-2 flex items-center justify-between">
                        <span className="flex items-center gap-1">Hold <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">Ctrl</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">Cmd</kbd> to select multiple.</span>
                        <span>Showing {filteredSkuList.length} of {skuList.length}</span>
                      </p>
                    </div>

                  </div>

                  {/* Active Toggle */}
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
                        <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-500"></div>
                      </div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-emerald-600 transition-colors">Active Status</span>
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
                  form="itemForm"
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

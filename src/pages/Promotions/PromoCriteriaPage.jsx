import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from "../../supabaseClient";
import {
  Search, Plus, Save, X, Edit2, AlertCircle, ListFilter, Trash2, Info, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { usePermissions } from '../../hooks/usePermissions';
import { useUser } from "../../context/UserContext";

const TYPE_TABLE = 'promo_criteria_type';
const VALUE_TABLE = 'promo_criteria_value';

function mapTypeRow(row = {}) {
  return {
    ...row,
    id: row.criteria_type_code, // use code as id/key
    code: row.criteria_type_code || '',
    description: row.criteria_type_description || '',
    active: row.active ?? true,
    createdBy: row.created_by || '',
    createdAt: row.created_at || '',
    updatedBy: row.updated_by || '',
    updatedAt: row.updated_at || '',
  };
}

function mapValueRow(row = {}) {
  return {
    ...row,
    id: row.criteria_value_code,
    code: row.criteria_value_code || '',
    description: row.criteria_value_description || '',
    typeCode: row.criteria_type_code || '',
    typeName: row.promo_criteria_type?.criteria_type_description || '',
    active: row.active ?? true,
    createdBy: row.created_by || '',
    createdAt: row.created_at || '',
    updatedBy: row.updated_by || '',
    updatedAt: row.updated_at || '',
  };
}

export default function PromoCriteriaPage() {
  const { user } = useUser();
  const actor = user?.email || user?.name || '';
  
  const { can } = usePermissions();
  const canEdit = can('promotions.promoCriteria.edit');

  const [activeTab, setActiveTab] = useState('TYPE'); // 'TYPE' or 'VALUE'
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [typeList, setTypeList] = useState([]);
  const [valueList, setValueList] = useState([]);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    typeCode: '', // for value mode
    active: true,
  });

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'TYPE') {
        const { data, error } = await supabase
          .from(TYPE_TABLE)
          .select('*')
          .order('criteria_type_code', { ascending: true });
        if (error) throw error;
        setTypeList(data.map(mapTypeRow));
      } else {
        const { data, error } = await supabase
          .from(VALUE_TABLE)
          .select('*, promo_criteria_type(criteria_type_description)')
          .order('criteria_value_code', { ascending: true });
        if (error) throw error;
        setValueList(data.map(mapValueRow));
        
        // Also fetch types for dropdown if not already loaded
        if (typeList.length === 0) {
           const { data: tData } = await supabase.from(TYPE_TABLE).select('*').eq('active', true);
           setTypeList((tData || []).map(mapTypeRow));
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Filter Data
  const filteredData = useMemo(() => {
    const list = activeTab === 'TYPE' ? typeList : valueList;
    if (!searchTerm) return list;
    const lowerSearch = searchTerm.toLowerCase();
    return list.filter(item => 
      (item.code || '').toLowerCase().includes(lowerSearch) ||
      (item.description || '').toLowerCase().includes(lowerSearch) ||
      (item.typeCode || '').toLowerCase().includes(lowerSearch) ||
      (item.typeName || '').toLowerCase().includes(lowerSearch)
    );
  }, [typeList, valueList, activeTab, searchTerm]);

  // Handlers
  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        code: item.code || '',
        description: item.description || '',
        typeCode: item.typeCode || '',
        active: item.active ?? true,
      });
    } else {
      setEditingId(null);
      setFormData({
        code: '',
        description: '',
        typeCode: activeTab === 'VALUE' && typeList.length > 0 ? typeList[0].code : '',
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
    if (!formData.code || !formData.description || (activeTab === 'VALUE' && !formData.typeCode)) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const table = activeTab === 'TYPE' ? TYPE_TABLE : VALUE_TABLE;
      const codeField = activeTab === 'TYPE' ? 'criteria_type_code' : 'criteria_value_code';
      
      const payload = {
        description: formData.description,
        active: formData.active,
        updated_at: now,
        updated_by: actor,
      };

      if (activeTab === 'TYPE') {
        payload.criteria_type_description = formData.description;
        delete payload.description;
      } else {
        payload.criteria_value_description = formData.description;
        payload.criteria_type_code = formData.typeCode;
        delete payload.description;
      }

      if (!editingId) {
        // Duplicate Check for NEW
        const { data: existing } = await supabase
          .from(table)
          .select(codeField)
          .eq(codeField, formData.code)
          .maybeSingle();
        
        if (existing) {
          toast.error(`${activeTab === 'TYPE' ? 'Type' : 'Value'} code "${formData.code}" already exists.`);
          setSaving(false);
          return;
        }

        payload[codeField] = formData.code;
        payload.created_at = now;
        payload.created_by = actor;
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
        toast.success("Added successfully.");
      } else {
        const { error } = await supabase.from(table).update(payload).eq(codeField, editingId);
        if (error) throw error;
        toast.success("Updated successfully.");
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

  const handleDelete = async (id) => {
    if (!window.confirm(`Are you sure you want to delete this ${activeTab === 'TYPE' ? 'Type' : 'Value'}?`)) return;
    try {
      const table = activeTab === 'TYPE' ? TYPE_TABLE : VALUE_TABLE;
      const codeField = activeTab === 'TYPE' ? 'criteria_type_code' : 'criteria_value_code';
      const { error } = await supabase.from(table).delete().eq(codeField, id);
      if (error) throw error;
      toast.success("Deleted successfully.");
      fetchData();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete. It might be in use.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/50 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded-xl">
            <ListFilter size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Promo Criteria Config</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage promotion criteria types and their corresponding values.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full sm:w-64 bg-slate-100 dark:bg-slate-800/50 border-none rounded-xl text-sm focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 transition-all"
            />
          </div>
          {canEdit && (
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm active:scale-95"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Add {activeTab === 'TYPE' ? 'Type' : 'Value'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Toggle */}
      <div className="shrink-0 px-6 py-4 bg-white/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full max-w-md">
          <button
            onClick={() => { setActiveTab('TYPE'); setSearchTerm(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'TYPE' 
                ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            Criteria Type
          </button>
          <button
            onClick={() => { setActiveTab('VALUE'); setSearchTerm(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'VALUE' 
                ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            Criteria Value
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-purple-500 animate-spin" />
              <p className="text-sm text-slate-500 mt-4">Loading data...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">No Records Found</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">No criteria {activeTab === 'TYPE' ? 'types' : 'values'} match your search.</p>
            </div>
          ) : (
            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 sticky top-0 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">{activeTab === 'TYPE' ? 'Type Code' : 'Value Code'}</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Description</th>
                    {activeTab === 'VALUE' && (
                       <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Type</th>
                    )}
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Status</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">{item.code}</td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-300 max-w-xs truncate">{item.description}</td>
                      {activeTab === 'VALUE' && (
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.typeName}</span>
                            <span className="text-[10px] text-slate-400 font-mono italic">{item.typeCode}</span>
                          </div>
                        </td>
                      )}
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
                                title="Edit"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete"
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

      {/* Main Modal */}
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
                  <ListFilter className="w-5 h-5 text-purple-500" />
                  {editingId ? `Edit Criteria ${activeTab === 'TYPE' ? 'Type' : 'Value'}` : `Add Criteria ${activeTab === 'TYPE' ? 'Type' : 'Value'}`}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6">
                <form id="criteriaForm" onSubmit={handleSave} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">{activeTab === 'TYPE' ? 'Type Code' : 'Value Code'} <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      name="code"
                      required
                      disabled={!!editingId} // Code is primary key, don't edit
                      value={formData.code}
                      onChange={handleInputChange}
                      placeholder={activeTab === 'TYPE' ? "e.g. 01" : "e.g. V001"}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors disabled:opacity-60 disabled:bg-slate-100 cursor-not-allowed"
                    />
                  </div>

                  {activeTab === 'VALUE' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Criteria Type <span className="text-red-500">*</span></label>
                      <select
                        name="typeCode"
                        required
                        value={formData.typeCode}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
                      >
                        <option value="">Select Type...</option>
                        {typeList.map(type => (
                          <option key={type.code} value={type.code}>{type.code} - {type.description}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Description <span className="text-red-500">*</span></label>
                    <textarea
                      name="description"
                      required
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Enter description..."
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="activeStatus"
                      name="active"
                      checked={formData.active}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-purple-500 border-slate-300 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="activeStatus" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
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
                  form="criteriaForm"
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

      {/* Detail Modal */}
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
                  {activeTab === 'TYPE' ? 'Type' : 'Value'} Details
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
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Code</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{detailItem.code}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Description</span>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300">
                    {detailItem.description}
                  </div>
                </div>

                {activeTab === 'VALUE' && (
                  <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Type</span>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{detailItem.typeName}</div>
                      <div className="text-[10px] text-slate-400 font-mono italic">{detailItem.typeCode}</div>
                    </div>
                  </div>
                )}

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

                <div className="grid grid-cols-1 gap-3 pt-2">
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

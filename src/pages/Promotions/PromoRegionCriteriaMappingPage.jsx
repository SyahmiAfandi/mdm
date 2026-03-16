import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from "../../supabaseClient";
import {
  Search, Plus, Save, X, Edit2, AlertCircle, MapPin, Trash2, Info, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { usePermissions } from '../../hooks/usePermissions';
import { useUser } from "../../context/UserContext";

const MAPPING_TABLE = 'promo_region_criteria_mapping';
const REGION_TABLE = 'promo_region_distributors';
const CRITERIA_VALUE_TABLE = 'promo_criteria_value';

function transformData(rawList = []) {
  const grouped = {};

  rawList.forEach(row => {
    const regionCode = row.region_dt_code || '';
    const criteriaValue = row.promo_criteria_value || {};
    const typeCode = row.criteria_type_code || criteriaValue.criteria_type_code || '';
    const key = `${regionCode}-${typeCode}`;

    if (!grouped[key]) {
      grouped[key] = {
        id: key,
        regionCode,
        regionName: row.promo_region_distributors?.dt_name || '',
        typeCode,
        typeName: criteriaValue.promo_criteria_type?.criteria_type_description || '',
        values: [],
        active: row.active ?? true,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedBy: row.updated_by,
        updatedAt: row.updated_at,
        rawIds: [],
      };
    }

    grouped[key].values.push({
      code: row.criteria_value_code,
      name: criteriaValue.criteria_value_description,
    });
    grouped[key].rawIds.push(row.id);
  });

  return Object.values(grouped).map(item => ({
    ...item,
    criteriaDisplay: item.values.map(v => v.name).join(', '),
    criteriaCodes: item.values.map(v => v.code).join(', ')
  }));
}

export default function PromoRegionCriteriaMappingPage() {
  const { user } = useUser();
  const actor = user?.email || user?.name || '';
  
  const { can } = usePermissions();
  const canEdit = can('promotions.regionCriteriaMapping.edit');

  const [dataList, setDataList] = useState([]);
  const [regionList, setRegionList] = useState([]);
  const [criteriaList, setCriteriaList] = useState([]);
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
    regionCode: '',
    criteriaType: '', // new selection
    selectedCriterias: [], // for add mode (array of codes)
    active: true,
  });
  const [modalSearchTerm, setModalSearchTerm] = useState('');

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(MAPPING_TABLE)
        .select(`
          *,
          promo_region_distributors(dt_name),
          promo_criteria_value(
            criteria_value_description,
            criteria_type_code,
            promo_criteria_type(criteria_type_description)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setDataList(transformData(data || []));

      // Fetch Dropdowns
      const [regions, criterias] = await Promise.all([
        supabase.from(REGION_TABLE).select('dt_code, dt_name').eq('active', true).order('dt_code'),
        supabase.from(CRITERIA_VALUE_TABLE).select('*, promo_criteria_type(criteria_type_description)').eq('active', true).order('criteria_value_code')
      ]);

      setRegionList(regions.data || []);
      const mappedCriterias = (criterias.data || []).map(val => ({
        ...val,
        code: val.criteria_value_code,
        name: val.criteria_value_description,
        typeCode: val.criteria_type_code,
        type: val.promo_criteria_type?.criteria_type_description || 'No Type',
        displayLabel: `${val.criteria_value_code} - ${val.criteria_value_description} (${val.promo_criteria_type?.criteria_type_description || 'No Type'})`
      }));
      setCriteriaList(mappedCriterias);

    } catch (error) {
      console.error("Error fetching mapping data:", error);
      toast.error("Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const uniqueTypes = useMemo(() => {
    const typesMap = {};
    criteriaList.forEach(c => {
      if (!typesMap[c.typeCode]) {
        typesMap[c.typeCode] = c.type;
      }
    });
    return Object.entries(typesMap).map(([code, name]) => ({ code, name }));
  }, [criteriaList]);

  // Filter Data
  const filteredData = useMemo(() => {
    if (!searchTerm) return dataList;
    const lowerSearch = searchTerm.toLowerCase();
    return dataList.filter(item => 
      (item.regionCode || '').toLowerCase().includes(lowerSearch) ||
      (item.regionName || '').toLowerCase().includes(lowerSearch) ||
      (item.typeCode || '').toLowerCase().includes(lowerSearch) ||
      (item.typeName || '').toLowerCase().includes(lowerSearch) ||
      (item.criteriaDisplay || '').toLowerCase().includes(lowerSearch)
    );
  }, [dataList, searchTerm]);

  const filteredCriterias = useMemo(() => {
    let list = criteriaList;
    // Always filter by selected type if present
    if (formData.criteriaType) {
      list = list.filter(c => c.typeCode === formData.criteriaType);
    }
    
    if (!modalSearchTerm) return list;
    const lower = modalSearchTerm.toLowerCase();
    return list.filter(c => 
      c.code.toLowerCase().includes(lower) || 
      c.name.toLowerCase().includes(lower) || 
      c.type.toLowerCase().includes(lower)
    );
  }, [criteriaList, modalSearchTerm, formData.criteriaType]);

  // Handlers
  const handleOpenModal = (item = null) => {
    setModalSearchTerm('');
    if (item) {
      setEditingId(item.id);
      setFormData({
        regionCode: item.regionCode || '',
        criteriaType: item.typeCode || '', // Lock type in edit mode
        selectedCriterias: item.values.map(v => v.code),
        active: item.active ?? true,
      });
    } else {
      setEditingId(null);
      setFormData({
        regionCode: regionList.length > 0 ? regionList[0].dt_code : '',
        criteriaType: '',
        selectedCriterias: [],
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
    setFormData(prev => {
      const newState = { ...prev, [name]: type === 'checkbox' ? checked : value };
      // If type changes, clear selected values
      if (name === 'criteriaType') {
        newState.selectedCriterias = [];
      }
      return newState;
    });
  };

  const toggleCriteria = (code) => {
    setFormData(prev => {
      const isSelected = prev.selectedCriterias.includes(code);
      if (isSelected) {
        return { ...prev, selectedCriterias: prev.selectedCriterias.filter(c => c !== code) };
      } else {
        return { ...prev, selectedCriterias: [...prev.selectedCriterias, code] };
      }
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.regionCode || (editingId ? !formData.criteriaCode : formData.selectedCriterias.length === 0)) {
      toast.error("Please select Region and at least one Criteria Value.");
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      
      if (!editingId) {
        // MULTI INSERT logic... (stays the same or slightly adjusted)
        const payloads = formData.selectedCriterias.map(cCode => {
          const criteriaObj = criteriaList.find(c => c.criteria_value_code === cCode);
          return {
            region_dt_code: formData.regionCode,
            criteria_value_code: cCode,
            criteria_type_code: criteriaObj?.criteria_type_code || '',
            active: formData.active,
            created_at: now,
            created_by: actor,
            updated_at: now,
            updated_by: actor,
          };
        });

        const { error } = await supabase.from(MAPPING_TABLE).insert(payloads);
        if (error) throw error;
        toast.success(`Successfully mapped ${payloads.length} items.`);
      } else {
        // GROUP UPDATE/REPLACE
        // Delete old IDs in the group and insert new ones
        const oldItem = dataList.find(i => i.id === editingId);
        if (oldItem) {
          await supabase.from(MAPPING_TABLE).delete().in('id', oldItem.rawIds);
        }

        const payloads = formData.selectedCriterias.map(cCode => {
          const criteriaObj = criteriaList.find(c => c.criteria_value_code === cCode);
          return {
            region_dt_code: formData.regionCode,
            criteria_value_code: cCode,
            criteria_type_code: criteriaObj?.criteria_type_code || '',
            active: formData.active,
            created_at: oldItem?.createdAt || now,
            created_by: oldItem?.createdBy || actor,
            updated_at: now,
            updated_by: actor,
          };
        });

        const { error } = await supabase.from(MAPPING_TABLE).insert(payloads);
        if (error) throw error;
        toast.success("Updated mapping group successfully.");
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

  const handleDelete = async (item) => {
    if (!window.confirm(`Are you sure you want to delete all mappings for ${item.regionName} - ${item.typeName}?`)) return;
    try {
      const { error } = await supabase.from(MAPPING_TABLE).delete().in('id', item.rawIds);
      if (error) throw error;
      toast.success("Deleted group successfully.");
      fetchData();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/50 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl">
            <MapPin size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Region & Criteria Mapping</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Map Region DT codes to Promo Criteria values.</p>
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
              className="pl-9 pr-4 py-2 w-full sm:w-64 bg-slate-100 dark:bg-slate-800/50 border-none rounded-xl text-sm focus:ring-2 focus:ring-rose-500 dark:focus:ring-rose-400 transition-all"
            />
          </div>
          {canEdit && (
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm active:scale-95"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Add Mapping</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-rose-500 animate-spin" />
              <p className="text-sm text-slate-500 mt-4">Loading data...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">No Mappings Found</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">No region-to-criteria mappings match your search.</p>
            </div>
          ) : (
            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 sticky top-0 backdrop-blur-sm z-10 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Region DT</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Criteria Type</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Type Code</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Criteria Value</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Status</th>
                    <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{item.regionName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{item.regionCode}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{item.typeName}</span>
                          <span className="text-[10px] text-slate-400 font-mono tracking-tight underline decoration-rose-500/30">Criteria Type</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg font-mono text-xs font-bold border border-slate-200 dark:border-slate-700 w-fit">
                            {item.typeCode}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col max-w-[300px]">
                          <span className="font-bold text-slate-700 dark:text-slate-300 whitespace-normal break-words line-clamp-2" title={item.criteriaDisplay}>
                            {item.criteriaDisplay}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono tracking-tight">{item.criteriaCodes}</span>
                        </div>
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
                                title="Edit Group"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(item)}
                                className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete Group"
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
                  <MapPin className="w-5 h-5 text-rose-500" />
                  {editingId ? 'Edit Mapping Group' : 'Add New Mapping'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6">
                <form id="mappingForm" onSubmit={handleSave} className="space-y-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Region DT <span className="text-red-500">*</span></label>
                    <select
                      name="regionCode"
                      required
                      disabled={!!editingId} // Disable region change in edit mode
                      value={formData.regionCode}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors disabled:opacity-50"
                    >
                      <option value="">Select Region...</option>
                      {regionList.map(r => (
                        <option key={r.dt_code} value={r.dt_code}>{r.dt_code} - {r.dt_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Criteria Type <span className="text-red-500">*</span></label>
                    <select
                      name="criteriaType"
                      required
                      disabled={!!editingId}
                      value={formData.criteriaType}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-colors disabled:opacity-50"
                    >
                      <option value="">Select Type...</option>
                      {uniqueTypes.map(t => (
                        <option key={t.code} value={t.code}>{t.name} ({t.code})</option>
                      ))}
                    </select>
                  </div>

                  <div className={`space-y-3 transition-opacity ${!formData.criteriaType ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Criteria Values <span className="text-red-500">*</span></label>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-600 rounded-full">{formData.selectedCriterias.length} Selected</span>
                    </div>
                    
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search values..."
                        value={modalSearchTerm}
                        onChange={(e) => setModalSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:ring-1 focus:ring-rose-500 outline-none transition-all"
                      />
                    </div>

                    <div className="max-h-[200px] overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl divide-y divide-slate-50 dark:divide-slate-800 bg-slate-50/30 dark:bg-slate-900/30 p-1">
                      {filteredCriterias.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400">
                          {!formData.criteriaType ? 'Select a type first.' : 'No values found for this type.'}
                        </div>
                      ) : (
                        filteredCriterias.map(c => (
                          <label key={c.code} className="flex items-start gap-3 p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors group">
                            <input
                              type="checkbox"
                              checked={formData.selectedCriterias.includes(c.code)}
                              onChange={() => toggleCriteria(c.code)}
                              className="mt-0.5 w-4 h-4 text-rose-500 border-slate-300 rounded focus:ring-rose-500"
                            />
                            <div className="flex flex-col gap-0.5">
                              <span className={`text-xs font-bold transition-colors ${formData.selectedCriterias.includes(c.code) ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                {c.name}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-slate-400">{c.code}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                <span className="text-[10px] text-slate-500 italic">{c.type}</span>
                              </div>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="mappingActiveStatus"
                      name="active"
                      checked={formData.active}
                      onChange={handleInputChange}
                      className="w-4 h-4 text-rose-500 border-slate-300 rounded focus:ring-rose-500"
                    />
                    <label htmlFor="mappingActiveStatus" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
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
                  form="mappingForm"
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
                  Mapping Details
                </h3>
                <button
                  onClick={handleCloseDetailModal}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Region DT</span>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                    <div className="font-bold text-slate-900 dark:text-white">{detailItem.regionName}</div>
                    <div className="text-xs text-slate-400 font-mono tracking-wider">{detailItem.regionCode}</div>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Criteria Type</span>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700">
                    <div className="font-bold text-slate-900 dark:text-white">{detailItem.typeName}</div>
                    <div className="text-xs text-slate-400 font-mono tracking-wider">{detailItem.typeCode}</div>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Criteria Values</span>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-700 space-y-2">
                    {detailItem.values.map(v => (
                      <div key={v.code} className="flex flex-col border-b border-slate-100 dark:border-slate-700 last:border-0 pb-1 last:pb-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-white">{v.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{v.code}</div>
                      </div>
                    ))}
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

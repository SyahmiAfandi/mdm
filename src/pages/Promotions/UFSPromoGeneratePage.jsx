import React, { useState, useEffect, useRef } from 'react';
import { supabase } from "../../supabaseClient";
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Undo2, 
  Database, 
  Hash, 
  MapPin, 
  PackageOpen, 
  CalendarClock, 
  FileText,
  Save,
  Eye,
  Layout,
  Sparkles,
  Trash2,
  Info,
  Filter,
  X,
  Plus,
  Check,
  Loader2,
  Search
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  formatNumericDisplay, 
  formatDisplayDate,
  parseNumericToken, 
  formatMechanicReward, 
  deriveMechanicsProfile, 
  parseMechanicsToSlabs, 
  compareAlphaNumeric 
} from './ufsPromoUtils';

const GENERATED_PROMOTION_TABLE = 'ufs_promotion_blueprints';
const GENERATED_PROMOTION_ROW_TABLE = 'ufs_promotion_blueprint_rows';

// --- Sub-component: Searchable Select ---
const SearchableSelect = ({ 
  label, 
  icon: Icon, 
  value, 
  onSelect, 
  options, 
  placeholder, 
  searchTerm, 
  onSearchChange,
  displayCount,
  totalCount,
  renderOption
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="min-w-0 relative" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-8 bg-white dark:bg-slate-900 border ${isOpen ? 'border-rose-500 ring-4 ring-rose-500/10' : 'border-slate-200 dark:border-slate-800'} rounded-lg pl-8 pr-2 flex items-center justify-between cursor-pointer transition-all shadow-sm`}
      >
        <Icon size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
        <span className={`text-[11px] font-bold truncate ${selectedOption ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>
          {selectedOption ? selectedOption.label : `${label} (${displayCount}/${totalCount})`}
        </span>
        <Search size={12} className="text-slate-400 shrink-0 ml-2" />
      </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-full left-0 right-0 mt-2 z-[60] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[280px]"
            >
              <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={10} />
                  <input
                    autoFocus
                    type="text"
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Type to filter..."
                    className="w-full h-[28px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-md pl-7 pr-2 text-[10px] font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-rose-500/50 transition-all"
                  />
                </div>
              </div>
              <div className="overflow-auto custom-scrollbar p-1">
                {options.length > 0 ? (
                  options.map((opt) => (
                    <div
                      key={opt.value}
                      onClick={() => {
                        onSelect(opt.value);
                        setIsOpen(false);
                      }}
                      className={`group px-3 py-2 rounded-lg cursor-pointer transition-colors flex flex-col gap-0.5 ${value === opt.value ? 'bg-rose-50 dark:bg-rose-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                    >
                      {renderOption ? renderOption(opt) : (
                        <>
                          <div className={`text-[10px] font-black uppercase tracking-tight ${value === opt.value ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}>
                            {opt.code}
                          </div>
                          <div className="text-[9px] font-bold text-slate-400 group-hover:text-slate-500 transition-colors">
                            {opt.name}
                          </div>
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">
                    No results found
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  );
};

export default function UFSPromoGeneratePage() {
  const navigate = useNavigate();
  const MotionDiv = motion.div;
  const MotionTr = motion.tr;
  const [loading, setLoading] = useState(false);
  const defaultPurchaseLimit = 9999999999999;
  
  // Data lists
  const [allRegions, setAllRegions] = useState([]);
  const [regions, setRegions] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [items, setItems] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [previewData, setPreviewData] = useState([]); // New state for preview
  const [selectedDetail, setSelectedDetail] = useState(null); // State for info modal
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [savingSchemeIds, setSavingSchemeIds] = useState([]);
  const [savedSchemeIds, setSavedSchemeIds] = useState([]);
  const [regionSearchTerm, setRegionSearchTerm] = useState('');
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    promoNumber: '01',
    region: '',
    promoItem: '',
    promoPeriod: '',
    promoMechanics: ''
  });

  const promoNumbers = Array.from({ length: 5 }, (_, i) => (i + 1).toString().padStart(2, '0'));

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const { data: mappingData } = await supabase
          .from('promo_region_criteria_mapping')
          .select(`
            region_dt_code,
            promo_region_distributors(dt_name, dt_shortform, dt_alias)
          `)
          .order('region_dt_code', { ascending: true });
        
        const uniqueRegions = Array.from(new Set((mappingData || []).map(m => m.region_dt_code)))
          .map(code => {
            const match = mappingData.find(m => m.region_dt_code === code);
            return {
              code,
              name: match?.promo_region_distributors?.dt_name || code,
              shortform: match?.promo_region_distributors?.dt_shortform || '',
              dt_alias: match?.promo_region_distributors?.dt_alias || ''
            };
          })
          .sort((leftRegion, rightRegion) => compareAlphaNumeric(leftRegion.code, rightRegion.code));
        setAllRegions(uniqueRegions);
        setRegions(uniqueRegions);

        const { data: itemData } = await supabase
          .from('promo_items_config')
          .select('id, item_code, item_name, item_shortform, item_dimension, mapped_skus, pcs_per_case')
          .eq('active', true);
        const sortedItems = (itemData || []).sort((leftItem, rightItem) =>
          compareAlphaNumeric(leftItem.id || leftItem.item_code, rightItem.id || rightItem.item_code)
          || compareAlphaNumeric(leftItem.item_name, rightItem.item_name)
        );
        setAllItems(sortedItems);
        setItems(sortedItems);

        const { data: periodData } = await supabase
          .from('promo_periods')
          .select('promo_period, period_id, start_date, end_date')
          .eq('active', true)
          .order('year', { ascending: false });
        setPeriods(periodData || []);

      } catch (error) {
        console.error("Error fetching form data:", error);
        toast.error("Failed to load configuration data.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  useEffect(() => {
    const selectedRegionOption = allRegions.find((region) => region.code === formData.region) || null;
    const normalizedSearch = regionSearchTerm.trim().toLowerCase();
    const filteredRegionList = allRegions.filter((region) => {
      if (!normalizedSearch) return true;

      return [
        region.code,
        region.name,
        region.shortform,
        region.dt_alias
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });

    setRegions(
      selectedRegionOption && !filteredRegionList.some((region) => region.code === selectedRegionOption.code)
        ? [selectedRegionOption, ...filteredRegionList]
        : filteredRegionList
    );
  }, [allRegions, formData.region, regionSearchTerm]);

  useEffect(() => {
    const selectedItemOption = allItems.find((item) => item.item_code === formData.promoItem) || null;
    const normalizedSearch = itemSearchTerm.trim().toLowerCase();
    const filteredItemList = allItems.filter((item) => {
      if (!normalizedSearch) return true;

      return [
        item.id,
        item.item_code,
        item.item_name,
        item.item_shortform,
        item.item_dimension
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });

    setItems(
      selectedItemOption && !filteredItemList.some((item) => item.item_code === selectedItemOption.item_code)
        ? [selectedItemOption, ...filteredItemList]
        : filteredItemList
    );
  }, [allItems, formData.promoItem, itemSearchTerm]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'region') {
      setRegionSearchTerm('');
    }
    if (name === 'promoItem') {
      setItemSearchTerm('');
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const clearForm = () => {
    setFormData({
      promoNumber: '01',
      region: '',
      promoItem: '',
      promoPeriod: '',
      promoMechanics: ''
    });
    setRegionSearchTerm('');
    setItemSearchTerm('');
    toast.success("Form cleared");
  };

  const buildPromotionPayload = (row) => ({
    scheme_id: row.schemeId,
    sequence_number: row.sequenceNumber,
    promo_number: row.promoNumber,
    promo_type: row.promoType,
    uom: row.uom,
    region_code: row.regionCode,
    region_name: row.regionName,
    item_code: row.itemCode,
    item_name: row.itemName,
    item_dimension: row.itemDimension,
    promo_period: row.promoPeriod,
    promo_mechanics: row.promoMechanics,
    description: row.description,
    period_from: row.periodFrom,
    period_to: row.periodTo,
    slabs: row.slabs || [],
    free_skus: row.freeSkus || [],
    criteria_mappings: row.criteriaMappings || [],
    active: true,
    source: 'auto-ufs'
  });

  const buildBlueprintRowPayload = (row) => {
    const rawCriteriaMappings = Array.isArray(row.criteriaRawMappings) ? row.criteriaRawMappings : [];
    const criteriaType = [...new Set(
      rawCriteriaMappings
        .map((item) => item.criteriaType?.trim())
        .filter(Boolean)
    )].join(', ');
    const criteriaValue = [...new Set(
      rawCriteriaMappings
        .map((item) => item.criteriaValue?.trim())
        .filter(Boolean)
    )].join(',');
    const mappedSkuCodes = [...new Set(
      (Array.isArray(row.mappedSkuCodes) && row.mappedSkuCodes.length > 0
        ? row.mappedSkuCodes
        : (row.freeSkus || []).map((sku) => sku.code))
        .map((skuCode) => skuCode?.trim())
        .filter(Boolean)
    )];
    const groupDefinitions = row.promoType === 'FOC'
      ? (mappedSkuCodes.length > 0
          ? [
              ...mappedSkuCodes.map((skuCode) => ({
                groupType: 'Q',
                productHierarchyCode: skuCode
              })),
              ...mappedSkuCodes.map((skuCode) => ({
                groupType: 'A',
                productHierarchyCode: skuCode
              }))
            ]
          : [{ groupType: 'Q', productHierarchyCode: row.itemCode }])
      : (mappedSkuCodes.length > 0
          ? mappedSkuCodes.map((skuCode) => ({
              groupType: 'Q',
              productHierarchyCode: skuCode
            }))
          : [{ groupType: 'Q', productHierarchyCode: row.itemCode }]);

    return groupDefinitions.flatMap((groupDefinition) =>
      (row.slabs || []).map((slab) => ({
        PromotionCode: row.promoNumber,
        PromotionDescription: row.description,
        GetBase: row.promoType === 'FOC' ? '4' : '5',
        StartDate: row.periodFrom,
        EndDate: row.periodTo,
        OPSOID: row.schemeId,
        PromotionUOM: row.uom === 'PC' ? '3' : '1',
        AlternatePromotionDescription: row.description,
        PromotionSlab: slab.serialNo,
        PromotionSlabDescription: row.description,
        RangeLow: slab.quantityFrom,
        RangeHigh: slab.quantityTo,
        PromotionReturn: slab.discountQty,
        ForEvery: slab.forEvery,
        ProductHierarchyCode: groupDefinition.productHierarchyCode,
        GroupType: groupDefinition.groupType,
        CriteriaType: criteriaType,
        CriteriaValue: criteriaValue
      }))
    );
  };

  const handleSavePromotion = async (row) => {
    setSavingSchemeIds((current) => [...new Set([...current, row.schemeId])]);

    try {
      // Duplicate Check
      const { data: existing, error: checkError } = await supabase
        .from(GENERATED_PROMOTION_TABLE)
        .select('scheme_id')
        .eq('scheme_id', row.schemeId)
        .maybeSingle();
      
      if (checkError) throw checkError;
      if (existing) {
        toast.error(`Scheme ID ${row.schemeId} already exists in registry. Cannot overwrite.`);
        return;
      }

      const { error: promotionError } = await supabase.from(GENERATED_PROMOTION_TABLE).upsert(
        buildPromotionPayload(row),
        { onConflict: 'scheme_id' }
      );

      if (promotionError) throw promotionError;

      const blueprintRows = buildBlueprintRowPayload(row);
      const { error: deleteRowError } = await supabase
        .from(GENERATED_PROMOTION_ROW_TABLE)
        .delete()
        .eq('OPSOID', row.schemeId);

      if (deleteRowError) throw deleteRowError;

      if (blueprintRows.length > 0) {
        const { error: rowInsertError } = await supabase
          .from(GENERATED_PROMOTION_ROW_TABLE)
          .insert(blueprintRows);

        if (rowInsertError) throw rowInsertError;
      }

      setSavedSchemeIds((current) => [...new Set([...current, row.schemeId])]);
      toast.success(`Promotion ${row.schemeId} saved.`);
    } catch (error) {
      console.error('Failed to save generated promotion:', error);
      toast.error('Save failed. Please apply the blueprint SQL table first.');
    } finally {
      setSavingSchemeIds((current) => current.filter((schemeId) => schemeId !== row.schemeId));
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!formData.region || !formData.promoItem || !formData.promoPeriod || !formData.promoMechanics) {
      toast.error("Please provide all campaign parameters.");
      return;
    }

    setLoading(true);
    try {
      const selectedRegion = allRegions.find(r => r.code === formData.region);
      const selectedItem = allItems.find(i => i.item_code === formData.promoItem);
      const selectedPeriod = periods.find(p => p.promo_period === formData.promoPeriod);
      const mechanicsProfile = deriveMechanicsProfile(formData.promoMechanics);
      const derivedPromoType = mechanicsProfile.promoType;
      const derivedUom = mechanicsProfile.uom;

      if (!selectedRegion?.shortform || !selectedItem?.item_shortform) {
        toast.error("Configuration missing shortforms for selected region or item.");
        return;
      }

      if (!derivedPromoType || !derivedUom) {
        toast.error("Mechanics must include a value after + to detect promo type and UOM.");
        return;
      }

      // Fetch Actual Criteria Mapping for the region
      const { data: mappings, error: mappingErr } = await supabase
        .from('promo_region_criteria_mapping')
        .select(`
          criteria_type_code,
          criteria_value_code,
          promo_criteria_value(
            criteria_value_description,
            criteria_type_code,
            promo_criteria_type(criteria_type_description)
          )
        `)
        .eq('region_dt_code', selectedRegion.code)
        .eq('active', true);

      if (mappingErr) throw mappingErr;

      // Group by Criteria Type
      const groupedCriteria = {};
      (mappings || []).forEach(m => {
        const typeDesc = m.promo_criteria_value?.promo_criteria_type?.criteria_type_description || m.criteria_type_code || 'Unknown Attribute';
        const valueDisplay = `${m.criteria_value_code} - ${m.promo_criteria_value?.criteria_value_description || ''}`;
        
        if (!groupedCriteria[typeDesc]) {
          groupedCriteria[typeDesc] = [];
        }
        groupedCriteria[typeDesc].push(valueDisplay);
      });

      const criteriaRawMappings = (mappings || []).map((mapping) => ({
        criteriaType: mapping.criteria_type_code || mapping.promo_criteria_value?.criteria_type_code || '',
        criteriaValue: mapping.criteria_value_code || ''
      }));

      const criteriaList = Object.entries(groupedCriteria).map(([attribute, values]) => ({
        attribute,
        values
      }));

      let freeSkus = [];

      // Resolve free SKU rows from promo_items_config.mapped_skus and master_sku
      const { data: promoItemConfig, error: promoItemConfigErr } = await supabase
        .from('promo_items_config')
        .select('mapped_skus, pcs_per_case')
        .eq('item_code', selectedItem.item_code)
        .maybeSingle();

      if (promoItemConfigErr) throw promoItemConfigErr;

      const pcsPerCase = Number(promoItemConfig?.pcs_per_case ?? selectedItem?.pcs_per_case);
      const { slabs, invalidSegments, totalSegments, requiresPcsPerCase, requiresRmToken, containsInvalidRmToken } = parseMechanicsToSlabs(
        formData.promoMechanics,
        derivedPromoType,
        pcsPerCase
      );

      if (requiresRmToken) {
        toast.error("DISC mechanics must use RM after +, for example 100+RM20.");
        return;
      }

      if (containsInvalidRmToken) {
        toast.error("FOC mechanics cannot use RM after +. Use quantity or pc/pcs instead.");
        return;
      }

      if (requiresPcsPerCase) {
        toast.error("pcs_per_case is required for mechanics without pc/pcs in Discount Qty.");
        return;
      }

      if (!slabs.length || invalidSegments.length > 0 || slabs.length !== totalSegments) {
        toast.error("Mechanics must use slab format like 3+1pcs, 20+1, 100+20 or 100+RM20.");
        return;
      }

      const mappedSkuCodes = Array.isArray(promoItemConfig?.mapped_skus) ? promoItemConfig.mapped_skus : [];
      if (mappedSkuCodes.length > 0) {
        const { data: skuMaster, error: skuMasterErr } = await supabase
          .from('master_sku')
          .select('code, description')
          .in('code', mappedSkuCodes);

        if (skuMasterErr) throw skuMasterErr;

        if (skuMaster && skuMaster.length > 0) {
          freeSkus = mappedSkuCodes
            .map((code) => skuMaster.find((sku) => sku.code === code))
            .filter(Boolean)
            .map((sku) => ({
              code: sku.code,
              description: sku.description || '-'
            }));

          const skuDisplayList = freeSkus.map((sku) => `${sku.code} - ${sku.description}`);
          criteriaList.push({
            attribute: 'SKU',
            values: skuDisplayList
          });
        }
      }

      // Scheme ID: period_id + item_shortform + dt_shortform + number
      const schemeId = `${selectedPeriod.period_id}${selectedItem.item_shortform}${selectedRegion.shortform}${formData.promoNumber}`;

      // Promotion Number: period_id + item_code + dt_shortform + number
      const promoNumberStr = `${selectedPeriod.period_id}${selectedItem.item_code}${selectedRegion.shortform}${formData.promoNumber}`;

      // Description: dt_alias + "_" + item_name + "_" + item_dimension + "_" + mechanics + "_BM" + promo_period
      const description = `${selectedRegion.dt_alias || selectedRegion.code}_${selectedItem.item_name}_${selectedItem.item_dimension || ''}_${formData.promoMechanics}_BM${selectedPeriod.promo_period}`;

      const newPreviewItem = {
        id: Date.now(),
        schemeId,
        sequenceNumber: formData.promoNumber,
        promoNumber: promoNumberStr,
        promoType: derivedPromoType,
        uom: derivedUom,
        regionCode: selectedRegion.code,
        regionName: selectedRegion.name,
        itemCode: selectedItem.item_code,
        itemName: selectedItem.item_name,
        itemDimension: selectedItem.item_dimension || '-',
        promoPeriod: selectedPeriod.promo_period,
        promoMechanics: formData.promoMechanics,
        slabs,
        mappedSkuCodes,
        freeSkus,
        description: description,
        periodFrom: selectedPeriod.start_date,
        periodTo: selectedPeriod.end_date,
        criteriaMappings: criteriaList, // Pass real mappings to modal
        criteriaRawMappings
      };

      setPreviewData([newPreviewItem]);
      setSavedSchemeIds((current) => current.filter((schemeId) => schemeId !== newPreviewItem.schemeId));
      toast.success("Promotion blueprint projected!");
    } catch (error) {
      console.error("Generation error:", error);
      toast.error("Pipeline failed to generate blueprint.");
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, opacity: 1,
      transition: { type: "spring", stiffness: 100 }
    }
  };

  const currentSchemeInfo = selectedDetail ? [
    { label: 'Project Code - Name', value: selectedDetail.description || '-' },
    { label: 'Date From', value: formatDisplayDate(selectedDetail.periodFrom) },
    { label: 'Date To', value: formatDisplayDate(selectedDetail.periodTo) },
    { label: 'Scheme Promotion Number', value: selectedDetail.promoNumber || '-' },
    { label: 'Scheme ID', value: selectedDetail.schemeId || '-' },
    { label: 'Scheme On Unit', value: selectedDetail.uom || '-' },
    { label: 'Promo Type', value: selectedDetail.promoType || '-' },
    { label: 'Target Region', value: selectedDetail.regionName ? `${selectedDetail.regionCode} - ${selectedDetail.regionName}` : '-' },
    { label: 'Asset / Item', value: selectedDetail.itemName ? `${selectedDetail.itemCode} - ${selectedDetail.itemName}` : '-' },
  ] : [];
  const mechanicsProfile = deriveMechanicsProfile(formData.promoMechanics);
  const showFreeSkuColumn = selectedDetail?.promoType !== 'DISC';



  return (
    <div className="w-full h-[calc(100vh-140px)] flex flex-col gap-3 px-2 pb-2">
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden bg-slate-900 rounded-[28px] px-6 py-3 md:py-4 shadow-xl border border-white/5 shrink-0">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-rose-500/10 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-pink-500/10 blur-[80px] rounded-full -translate-x-1/2 translate-y-1/2" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => navigate('/promotions/auto-ufs')}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white group"
            >
              <Undo2 size={18} className="group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div className="h-10 w-px bg-white/10 mx-1" />
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Layout className="w-5 h-5 text-rose-400" />
                <h1 className="text-xl font-black text-white tracking-tight uppercase italic">
                  UFS <span className="text-rose-500 font-extrabold not-italic">Blueprint Builder</span>
                </h1>
                <div className="px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-[10px] font-black text-blue-400 uppercase tracking-tighter">AUTO</div>
              </div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Create New Promotion Blueprint</p>
            </div>
          </div>
          
           <div className="flex items-center gap-4">
             <button
               onClick={() => navigate('/promotions/auto-ufs/controls')}
               className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2"
             >
               <Save size={14} />
               Control Defaults
             </button>
              <div className="flex flex-col items-end">
                 <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Status</div>
                 <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </div>
             </div>
          </div>
        </div>
      </div>

      <MotionDiv
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 flex flex-col gap-6"
      >
        {/* ── Configuration Dashboard ── */}
        <MotionDiv variants={itemVariants} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-[24px] border border-slate-200/80 dark:border-slate-800 p-2 md:p-3 shadow-lg relative shrink-0 z-20">
          <div className="absolute top-0 right-0 p-2 opacity-[0.03] pointer-events-none">
            <Sparkles size={64} />
          </div>
          
          <div className="flex flex-col xl:flex-row items-center gap-3 relative z-10 w-full pl-2 pr-1">
            {/* Seq # */}
            <div className="w-[80px] flex-shrink-0 relative">
              <Hash size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" />
              <select 
                name="promoNumber"
                value={formData.promoNumber}
                onChange={handleInputChange}
                className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-7 pr-2 text-[11px] font-black text-slate-800 dark:text-slate-100 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all cursor-pointer shadow-sm appearance-none"
              >
                {promoNumbers.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            {/* Region */}
            <div className="w-[180px] flex-shrink-0">
              <SearchableSelect
                label="Region"
                icon={MapPin}
                value={formData.region}
                onSelect={(val) => setFormData(prev => ({ ...prev, region: val }))}
                placeholder="Region..."
                searchTerm={regionSearchTerm}
                onSearchChange={setRegionSearchTerm}
                displayCount={regions.length}
                totalCount={allRegions.length}
                options={regions.map(r => ({ value: r.code, code: r.code, name: r.name, label: `${r.code} — ${r.name}` }))}
              />
            </div>

            {/* Item */}
            <div className="w-[180px] flex-shrink-0">
              <SearchableSelect
                label="Asset"
                icon={PackageOpen}
                value={formData.promoItem}
                onSelect={(val) => setFormData(prev => ({ ...prev, promoItem: val }))}
                placeholder="SKU Target..."
                searchTerm={itemSearchTerm}
                onSearchChange={setItemSearchTerm}
                displayCount={items.length}
                totalCount={allItems.length}
                options={items.map(i => ({ value: i.item_code, code: i.item_code, name: i.item_name, label: `${i.item_code} — ${i.item_name}` }))}
              />
            </div>

            {/* Period */}
            <div className="w-[130px] flex-shrink-0 relative">
              <CalendarClock size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" />
              <select 
                name="promoPeriod"
                value={formData.promoPeriod}
                onChange={handleInputChange}
                className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-7 pr-3 text-[10px] font-bold text-slate-800 dark:text-slate-100 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all cursor-pointer shadow-sm appearance-none"
              >
                <option value="">Timeline...</option>
                {periods.map(p => <option key={p.promo_period} value={p.promo_period}>{p.promo_period}</option>)}
              </select>
            </div>

            {/* Mechanics */}
            <div className="flex-1 min-w-[200px] flex items-center gap-2">
              <div className="relative flex-1">
                <FileText size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" />
                <input 
                  type="text"
                  name="promoMechanics"
                  value={formData.promoMechanics}
                  onChange={handleInputChange}
                  placeholder="Logic..."
                  className="w-full h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-7 pr-3 text-[11px] font-medium text-slate-700 dark:text-slate-200 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 transition-all shadow-sm"
                />
              </div>

              {/* Status Chips */}
              <div className="hidden 2xl:flex items-center gap-1.5 shrink-0">
                <span className="rounded-md bg-white dark:bg-slate-900 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500 shadow-sm border border-slate-100 dark:border-slate-800">
                  {mechanicsProfile.promoType || 'Type'}
                </span>
                <span className="rounded-md bg-white dark:bg-slate-900 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500 shadow-sm border border-slate-100 dark:border-slate-800">
                  {mechanicsProfile.uom || 'UOM'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0 pl-1 border-l border-slate-200 dark:border-slate-800">
              <button 
                onClick={clearForm}
                className="h-8 px-2 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 hover:text-rose-500 transition-colors shadow-sm"
                title="Reset Parameters"
              >
                <Trash2 size={12} />
              </button>
              
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="relative h-8 px-4 bg-rose-500 hover:bg-rose-600 dark:bg-slate-900 dark:hover:bg-slate-800 text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {loading ? 'WAIT' : 'BUILD'}
              </button>
            </div>
          </div>
        </MotionDiv>

        {/* ── Output / Preview Dashboard ── */}
        <MotionDiv variants={itemVariants} className="flex-1 min-h-0 flex flex-col bg-slate-50 dark:bg-slate-900/50 rounded-[40px] border border-slate-200 dark:border-slate-800/50 shadow-inner overflow-hidden relative group">
          
          {/* Decorative Grid Background */}
          <div className="absolute inset-0 opacity-[0.015] pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
          
          <div className="px-10 py-5 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between bg-white/50 dark:bg-slate-900/50 backdrop-blur-md shrink-0 z-10">
            <h3 className="text-xs font-black text-slate-600 dark:text-slate-300 flex items-center gap-3 uppercase tracking-widest">
              <Eye className="w-5 h-5 text-rose-500" />
              Generated Blueprint Preview
            </h3>
            <div className="flex items-center gap-2">
               <div className="px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-tighter">Preview</div>
            </div>
          </div>
          
          <div className="flex-1 min-h-0 relative z-10 overflow-hidden">
            {previewData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                <div className="relative mb-8 text-slate-200 dark:text-slate-800">
                  <div className="absolute inset-0 bg-rose-500/10 blur-3xl rounded-full" />
                  <Database size={64} className="relative opacity-20" />
                </div>
                <h4 className="text-sm font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em] mb-2">No Blueprint Generated</h4>
                <p className="text-[10px] font-bold text-slate-400/50 uppercase tracking-widest max-w-[280px]">
                  Fill in the parameters above and click "Generate" to preview your blueprint
                </p>
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
                    {previewData.map((row) => (
                      <MotionTr 
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
                              onClick={() => handleSavePromotion(row)}
                              disabled={savingSchemeIds.includes(row.schemeId)}
                              className={`p-2 rounded-lg transition-all shadow-sm ${
                                savedSchemeIds.includes(row.schemeId)
                                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-blue-500 hover:text-white'
                              } disabled:opacity-60 disabled:cursor-not-allowed`}
                              title={savedSchemeIds.includes(row.schemeId) ? 'Saved to database' : 'Save to database'}
                            >
                              {savingSchemeIds.includes(row.schemeId) ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : savedSchemeIds.includes(row.schemeId) ? (
                                <Check size={14} />
                              ) : (
                                <Plus size={14} />
                              )}
                            </button>
                            <button 
                              onClick={() => { setSelectedDetail(row); setIsInfoModalOpen(true); }}
                              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                              title="View blueprint detail"
                            >
                              <Info size={14} />
                            </button>
                          </div>
                        </td>
                      </MotionTr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="px-10 py-4 bg-white/50 dark:bg-slate-900/50 border-t border-slate-200/50 dark:border-slate-800/50 flex justify-center text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] z-10">
            UFS Blueprint Builder
          </div>
        </MotionDiv>
      </MotionDiv>
      {/* ── Info Detail Modal ── */}
      <AnimatePresence>
        {isInfoModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsInfoModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-7xl h-[85vh] bg-white dark:bg-slate-950 rounded-[40px] shadow-2xl border border-white/10 flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="shrink-0 px-10 py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500">
                    <Database size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Blueprint Details</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{selectedDetail?.schemeId}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsInfoModalOpen(false)}
                  className="p-3 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-auto p-10 custom-scrollbar space-y-12 bg-white dark:bg-slate-950">

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-900/10 flex items-center justify-center">
                        <Database size={16} className="text-slate-700" />
                      </div>
                      <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-[0.1em]">Promotion Overview</h4>
                    </div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.16em]">
                      {selectedDetail?.regionName || 'UFS Blueprint'}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-950">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                      {currentSchemeInfo.map((item, index) => (
                        <div
                          key={item.label}
                          className={`${index % 2 === 0 ? 'bg-white dark:bg-slate-950' : 'bg-slate-50 dark:bg-slate-900/40'} px-5 py-5 border-b border-r border-slate-100 dark:border-slate-800`}
                        >
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.16em] mb-1.5">
                            {item.label}
                          </div>
                          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 break-words leading-relaxed">
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Scheme Details Section ── */}
                <div className="space-y-6">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Layout size={16} className="text-blue-500" />
                      </div>
                      <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-[0.1em]">Slab Configuration</h4>
                   </div>

                   <div className="rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead className="text-white">
                          <tr className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                            <th className="px-5 py-3 border-r border-white/10 text-center bg-[#2E5FA8] text-white">Slab No</th>
                            <th className="px-5 py-3 border-r border-white/10 text-center bg-[#2E5FA8] text-white">Quantity From</th>
                            <th className="px-5 py-3 border-r border-white/10 text-center bg-[#2E5FA8] text-white">Quantity To</th>
                            <th className="px-5 py-3 border-r border-white/10 text-center bg-[#2E5FA8] text-white">Discount Qty</th>
                            <th className="px-5 py-3 border-r border-white/10 text-center bg-[#2E5FA8] text-white">For Every</th>
                            <th className={`px-6 py-3 text-center bg-[#2E5FA8] text-white ${showFreeSkuColumn ? 'border-r border-white/10' : ''}`}>Purchase Limit</th>
                            {showFreeSkuColumn ? (
                              <th className="px-8 py-3 text-center bg-[#2E5FA8] text-white">Free SKU</th>
                            ) : null}
                          </tr>
                        </thead>
                        <tbody className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          {selectedDetail?.slabs?.length > 0 ? selectedDetail.slabs.map((slab, i) => (
                            <tr key={`${slab.serialNo}-${slab.raw}`} className={i % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-900/40"}>
                              <td className="px-5 py-5 border-r border-slate-100 dark:border-slate-800 text-center italic">{slab.serialNo}</td>
                              <td className="px-5 py-5 border-r border-slate-100 dark:border-slate-800 text-center font-black">{formatNumericDisplay(slab.quantityFrom)}</td>
                              <td className="px-5 py-5 border-r border-slate-100 dark:border-slate-800 text-center font-black">{formatNumericDisplay(slab.quantityTo)}</td>
                              <td className="px-5 py-5 border-r border-slate-100 dark:border-slate-800 text-center font-black text-blue-600">{slab.discountDisplay || formatNumericDisplay(slab.discountQty)}</td>
                              <td className="px-5 py-5 border-r border-slate-100 dark:border-slate-800 text-center">{formatNumericDisplay(slab.forEvery, 2)}</td>
                              <td className={`px-6 py-5 text-center font-mono tracking-tighter ${showFreeSkuColumn ? 'border-r border-slate-100 dark:border-slate-800' : ''}`}>{formatNumericDisplay(slab.purchaseLimit, 2)}</td>
                              {showFreeSkuColumn ? (
                                <td className="px-4 py-3 min-w-[280px]">
                                   <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm">
                                       <table className="w-full">
                                         <thead className="text-white">
                                            <tr className="text-[9px] font-black uppercase tracking-tighter">
                                               <th className="px-3 py-2 border-r border-white/10 bg-[#2E5FA8] text-white">SKU</th>
                                               <th className="px-3 py-2 bg-[#2E5FA8] text-white">Description</th>
                                            </tr>
                                         </thead>
                                          <tbody className="bg-white dark:bg-slate-800/50 text-[10px]">
                                             {selectedDetail?.freeSkus?.length > 0 ? (
                                               selectedDetail.freeSkus.map((sku, skuIdx) => (
                                                 <tr
                                                  key={`${slab.serialNo}-${sku.code}`}
                                                  className={skuIdx !== selectedDetail.freeSkus.length - 1 ? "border-b border-slate-100 dark:border-slate-700" : ""}
                                                 >
                                                   <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 font-mono text-blue-600">{sku.code}</td>
                                                  <td className="px-3 py-2 font-black">{sku.description}</td>
                                                </tr>
                                              ))
                                            ) : (
                                              <tr>
                                                <td colSpan={2} className="px-3 py-3 text-center text-slate-400 italic">No SKU mapped</td>
                                              </tr>
                                            )}
                                          </tbody>
                                       </table>
                                    </div>
                                 </td>
                              ) : null}
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={showFreeSkuColumn ? 7 : 6} className="px-6 py-10 text-center text-slate-400 italic">
                                No slab logic parsed from mechanics.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                   </div>
                </div>

                {/* ── Additional Criteria Section ── */}
                <div className="space-y-6">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center">
                        <Filter size={16} className="text-rose-500" />
                      </div>
                      <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-[0.1em]">Additional Target Attributes</h4>
                   </div>

                   <div className="rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead className="text-white">
                          <tr className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                            <th className="px-5 py-3 border-r border-slate-500/60 bg-[#2E5FA8] text-white">Attributes</th>
                            <th className="px-5 py-3 border-r border-slate-500/60 text-center bg-[#2E5FA8] text-white">Condition</th>
                            <th className="px-5 py-3 bg-[#2E5FA8] text-white">Criteria</th>
                          </tr>
                        </thead>
                        <tbody className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          {selectedDetail?.criteriaMappings?.length > 0 ? (
                             selectedDetail.criteriaMappings.map((cm, idx) => (
                               <tr key={idx} className={idx % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-900/40"}>
                                 <td className="px-5 py-5 border-r border-slate-100 dark:border-slate-800">{cm.attribute}</td>
                                 <td className="text-center px-5 py-5 border-r border-slate-100 dark:border-slate-800 text-blue-600">Include</td>
                                 <td className="px-5 py-5 leading-relaxed text-slate-700 dark:text-slate-200">
                                    {cm.values.map((v, i) => (
                                      <React.Fragment key={i}>
                                        {v} <br/>
                                      </React.Fragment>
                                    ))}
                                 </td>
                               </tr>
                             ))
                          ) : (
                            <tr>
                              <td colSpan={3} className="px-6 py-10 text-center text-slate-400 italic">No additional attributes mapped for this region.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                   </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="shrink-0 px-10 py-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center z-10">
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 font-black text-[9px] uppercase tracking-tighter">
                       UFS Blueprint System
                   </div>
                </div>
                <button
                  onClick={() => setIsInfoModalOpen(false)}
                  className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
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

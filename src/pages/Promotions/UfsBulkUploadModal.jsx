import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, CheckCircle2, AlertCircle, FileText, Loader2, Save, Download, RefreshCcw } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import { 
  deriveMechanicsProfile, 
  parseMechanicsToSlabs, 
  formatNumericDisplay 
} from './ufsPromoUtils';

const GENERATED_PROMOTION_TABLE = 'ufs_promotion_blueprints';
const GENERATED_PROMOTION_ROW_TABLE = 'ufs_promotion_blueprint_rows';

export default function UfsBulkUploadModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, projecting, ready, saving, complete
  const fileInputRef = useRef(null);
  const [resetting, setResetting] = useState(false);

  const handleReset = () => {
    setFile(null);
    setPreviewData([]);
    setUploadStatus('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    toast.success("Upload reset");
  };

  // Reset state when modal closes to ensure fresh state on next open
  React.useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setPreviewData([]);
      setUploadStatus('idle');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen]);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.match(/\.(xlsx|xls|csv)$/)) {
      toast.error("Please upload an Excel or CSV file.");
      return;
    }

    setFile(selectedFile);
    processFile(selectedFile);
  };

  const processFile = async (file) => {
    setUploadStatus('projecting');
    setLoading(true);

    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();

      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (!jsonData.length) {
          toast.error("The file appears to be empty.");
          setUploadStatus('idle');
          setLoading(false);
          return;
        }

        // Fetch required configuration data for projection
        const { data: regionData } = await supabase.from('promo_region_distributors').select('dt_code, dt_name, dt_shortform, dt_alias');
        const { data: itemRows } = await supabase.from('promo_items_config').select('item_code, item_name, item_shortform, item_dimension, mapped_skus, pcs_per_case, active');
        const itemData = (itemRows || []).filter(i => i.active !== false);
        const { data: periodData } = await supabase.from('promo_periods').select('promo_period, period_id, start_date, end_date').eq('active', true);
        const { data: skuMaster } = await supabase.from('master_sku').select('code, description');
        const { data: allCriteriaMappings } = await supabase.from('promo_region_criteria_mapping').select(`
          region_dt_code,
          criteria_type_code,
          criteria_value_code,
          promo_criteria_value(
            criteria_value_description,
            promo_criteria_type(criteria_type_description)
          )
        `).eq('active', true);
        
        // Fetch existing scheme IDs to prevent duplicates
        const { data: existingSchemes } = await supabase.from(GENERATED_PROMOTION_TABLE).select('scheme_id');
        const existingSchemeIds = new Set((existingSchemes || []).map(s => s.scheme_id));

        const projected = jsonData.map((row, index) => {
          const promoNumber = String(row['Promo Number'] || row['promo_number'] || '').padStart(2, '0');
          const regionCode = String(row['Region Code'] || row['region_code'] || '').trim();
          const itemCode = String(row['Item Code'] || row['item_code'] || '').trim();
          const promoPeriodName = String(row['Promo Period'] || row['promo_period'] || '').trim();
          const mechanics = String(row['Mechanics'] || row['mechanics'] || '').trim();

          // Validation - More flexible matching (Case-insensitive + Shortform)
          const region = regionData?.find(r => 
            r.dt_code?.toLowerCase() === regionCode.toLowerCase() || 
            r.dt_shortform?.toLowerCase() === regionCode.toLowerCase()
          );
          const item = itemData?.find(i => 
            i.item_code?.toLowerCase() === itemCode.toLowerCase() || 
            i.item_shortform?.toLowerCase() === itemCode.toLowerCase()
          );
          const period = periodData?.find(p => p.promo_period?.toLowerCase() === promoPeriodName.toLowerCase());

          const errors = [];
          if (!region) errors.push(`Region ${regionCode} not found`);
          if (!item) errors.push(`Item ${itemCode} not found`);
          if (!period) errors.push(`Period ${promoPeriodName} not found`);
          if (!mechanics) errors.push(`Mechanics missing`);
          if (!promoNumber || promoNumber === '00') errors.push(`Invalid Promo Number`);

          if (errors.length > 0) {
             return { id: index, row, errors, status: 'error' };
          }

          // Projection Logic (Mirroring UFSPromoGeneratePage)
          const mechanicsProfile = deriveMechanicsProfile(mechanics);
          const derivedPromoType = mechanicsProfile.promoType;
          const derivedUom = mechanicsProfile.uom;

          if (!derivedPromoType || !derivedUom) {
            errors.push("Invalid Mechanics format (missing type/UOM)");
            return { id: index, row, errors, status: 'error' };
          }

          const { slabs, invalidSegments, requiresPcsPerCase, requiresRmToken, containsInvalidRmToken } = parseMechanicsToSlabs(mechanics, derivedPromoType, item.pcs_per_case);
          
          if (requiresRmToken) errors.push("DISC requires RM token");
          if (containsInvalidRmToken) errors.push("FOC cannot use RM");
          if (requiresPcsPerCase) errors.push("Item missing Pcs/Case");
          if (invalidSegments.length > 0 || slabs.length === 0) {
            if (errors.length === 0) errors.push("Mechanics parsing failed");
          }

          if (errors.length > 0) {
             return { id: index, row, errors, status: 'error' };
          }

          const schemeId = `${period.period_id}${item.item_shortform}${region.dt_shortform}${promoNumber}`;
          if (existingSchemeIds.has(schemeId)) {
            errors.push("Duplicate Scheme ID (exists in registry)");
          }

          if (errors.length > 0) {
            return { id: index, row, errors, status: 'error' };
          }

          const promoNumberStr = `${period.period_id}${item.item_code}${region.dt_shortform}${promoNumber}`;
          const description = `${region.dt_alias || region.dt_code}_${item.item_name}_${item.item_dimension || ''}_${mechanics}_BM${period.promo_period}`;

          // Resolve Free SKUs
          const mappedSkuCodes = Array.isArray(item.mapped_skus) ? item.mapped_skus : [];
          const freeSkus = mappedSkuCodes.map(code => {
            const master = skuMaster?.find(s => s.code === code);
            return { code, description: master?.description || '-' };
          });

          // Resolve Criteria Mappings (Display and Raw)
          const regionCriteria = (allCriteriaMappings || []).filter(m => m.region_dt_code === region.dt_code);
          const groupedCriteria = {};
          regionCriteria.forEach(m => {
            const typeDesc = m.promo_criteria_value?.promo_criteria_type?.criteria_type_description || m.criteria_type_code || 'Attribute';
            const valueDisplay = `${m.criteria_value_code} - ${m.promo_criteria_value?.criteria_value_description || ''}`;
            if (!groupedCriteria[typeDesc]) groupedCriteria[typeDesc] = [];
            groupedCriteria[typeDesc].push(valueDisplay);
          });

          const criteriaMappings = Object.entries(groupedCriteria).map(([attribute, values]) => ({ attribute, values }));
          
          // Append SKU attribute if mapped SKUs exist
          if (freeSkus.length > 0) {
            const skuDisplayList = freeSkus.map((sku) => `${sku.code} - ${sku.description}`);
            criteriaMappings.push({
              attribute: 'SKU',
              values: skuDisplayList
            });
          }

          const criteriaRawMappings = regionCriteria.map(m => ({
            criteriaType: m.criteria_type_code || '',
            criteriaValue: m.criteria_value_code || ''
          }));

          return {
            id: index,
            row,
            status: 'success',
            projection: {
              schemeId,
              promoNumber: promoNumberStr,
              promoType: derivedPromoType,
              uom: derivedUom,
              regionCode: region.dt_code,
              regionName: region.dt_name,
              itemCode: item.item_code,
              itemName: item.item_name,
              itemDimension: item.item_dimension || '-',
              promoPeriod: period.promo_period,
              promoMechanics: mechanics,
              slabs,
              description,
              periodFrom: period.start_date,
              periodTo: period.end_date,
              sequenceNumber: promoNumber,
              freeSkus,
              criteriaMappings,
              criteriaRawMappings,
              mappedSkuCodes
            }
          };
        });

        setPreviewData(projected);
        setUploadStatus('ready');
        setLoading(false);
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("Bulk process error:", err);
      toast.error("Failed to process file.");
      setUploadStatus('idle');
      setLoading(false);
    }
  };

  const buildBlueprintRowPayload = (row) => {
    const rawCriteriaMappings = Array.isArray(row.criteriaRawMappings) ? row.criteriaRawMappings : [];
    const criteriaType = [...new Set(rawCriteriaMappings.map(m => m.criteriaType).filter(Boolean))].join(', ');
    const criteriaValue = [...new Set(rawCriteriaMappings.map(m => m.criteriaValue).filter(Boolean))].join(',');
    
    const mappedSkuCodes = row.mappedSkuCodes || [];
    
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

  const handleBulkSave = async () => {
    const validItems = previewData.filter(item => item.status === 'success');
    if (!validItems.length) {
      toast.error("No valid items to save.");
      return;
    }

    setUploadStatus('saving');
    setLoading(true);

    try {
      const blueprintPayloads = validItems.map(item => ({
        scheme_id: item.projection.schemeId,
        sequence_number: item.projection.sequenceNumber,
        promo_number: item.projection.promoNumber,
        promo_type: item.projection.promoType,
        uom: item.projection.uom,
        region_code: item.projection.regionCode,
        region_name: item.projection.regionName,
        item_code: item.projection.itemCode,
        item_name: item.projection.itemName,
        item_dimension: item.projection.itemDimension,
        promo_period: item.projection.promoPeriod,
        promo_mechanics: item.projection.promoMechanics,
        description: item.projection.description,
        period_from: item.projection.periodFrom,
        period_to: item.projection.periodTo,
        slabs: item.projection.slabs || [],
        free_skus: item.projection.freeSkus || [],
        criteria_mappings: item.projection.criteriaMappings || [],
        active: true,
        source: 'bulk-upload'
      }));

      // Upsert Blueprints
      const { error: blueprintError } = await supabase
        .from(GENERATED_PROMOTION_TABLE)
        .upsert(blueprintPayloads, { onConflict: 'scheme_id' });

      if (blueprintError) throw blueprintError;

      // Upsert Rows
      const allRowPayloads = validItems.flatMap(item => buildBlueprintRowPayload(item.projection));
      
      // Delete existing rows for these schemes first
      const schemeIds = validItems.map(item => item.projection.schemeId);
      await supabase.from(GENERATED_PROMOTION_ROW_TABLE).delete().in('OPSOID', schemeIds);

      if (allRowPayloads.length > 0) {
        // Chunk inserts for stability
        const chunkSize = 100;
        for (let i = 0; i < allRowPayloads.length; i += chunkSize) {
          const chunk = allRowPayloads.slice(i, i + chunkSize);
          const { error: rowError } = await supabase.from(GENERATED_PROMOTION_ROW_TABLE).insert(chunk);
          if (rowError) throw rowError;
        }
      }

      toast.success(`Successfully uploaded ${validItems.length} promotions!`);
      setUploadStatus('complete');
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Bulk save error:", err);
      toast.error("Save failed. Part of the record might be missing.");
      setUploadStatus('ready');
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setLoading(true);
      
      // Fetch active regions
      const { data: regionData } = await supabase
        .from('promo_region_distributors')
        .select('dt_code, dt_alias, dt_name')
        .order('dt_code', { ascending: true });

      // Fetch active items
      const { data: itemData } = await supabase
        .from('promo_items_config')
        .select('item_code, item_shortform, item_name')
        .eq('active', true)
        .order('item_code', { ascending: true });

      // Fetch active periods
      const { data: periodData } = await supabase
        .from('promo_periods')
        .select('promo_period, start_date, end_date')
        .eq('active', true);

      // Get real sample data from fetched references
      const sampleRegion = regionData && regionData.length > 0 ? regionData[0].dt_code : 'REG01';
      const sampleItem1 = itemData && itemData.length > 0 ? itemData[0].item_code : 'ITEM123';
      const sampleItem2 = itemData && itemData.length > 1 ? itemData[1].item_code : sampleItem1;
      const samplePeriod = periodData && periodData.length > 0 ? periodData[0].promo_period : 'P3 2024';

      // Main Template Structure
      const template = [
        {
          'Promo Number': '01',
          'Region Code': sampleRegion,
          'Item Code': sampleItem1,
          'Promo Period': samplePeriod,
          'Mechanics': '100+RM20, 200+RM50'
        },
        {
          'Promo Number': '01',
          'Region Code': sampleRegion,
          'Item Code': sampleItem2,
          'Promo Period': samplePeriod,
          'Mechanics': '3+1pcs'
        }
      ];

      // Format Reference Data
      const refRegions = (regionData || []).map(r => ({
        'Region / DT Code': r.dt_code || '',
        'Alias': r.dt_alias || '',
        'Name': r.dt_name || ''
      }));

      const refItems = (itemData || []).map(i => ({
        'Item Code': i.item_code || '',
        'Shortform': i.item_shortform || '',
        'Description': i.item_name || ''
      }));

      const refPeriods = (periodData || []).map(p => ({
        'Period': p.promo_period || '',
        'Start Date': p.start_date ? new Date(p.start_date).toLocaleDateString('en-GB') : '',
        'End Date': p.end_date ? new Date(p.end_date).toLocaleDateString('en-GB') : ''
      }));

      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Append Template Sheet
      const wsTemplate = XLSX.utils.json_to_sheet(template);
      wsTemplate['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 40 }];
      XLSX.utils.book_append_sheet(wb, wsTemplate, "Template");

      // Append Reference Regions
      if (refRegions.length > 0) {
        const wsRegions = XLSX.utils.json_to_sheet(refRegions);
        wsRegions['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, wsRegions, "Ref_Regions");
      }

      // Append Reference Items
      if (refItems.length > 0) {
        const wsItems = XLSX.utils.json_to_sheet(refItems);
        wsItems['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 50 }];
        XLSX.utils.book_append_sheet(wb, wsItems, "Ref_Items");
      }

      // Append Reference Periods
      if (refPeriods.length > 0) {
        const wsPeriods = XLSX.utils.json_to_sheet(refPeriods);
        wsPeriods['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsPeriods, "Ref_Periods");
      }

      XLSX.writeFile(wb, "bulk_promo_upload_template.xlsx");
      setLoading(false);
    } catch (err) {
      console.error("Template generation error:", err);
      toast.error("Failed to generate complete template.");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          onClick={onClose}
        />
      </AnimatePresence>

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-8 py-6 bg-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/20">
              <Upload size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white italic uppercase tracking-tight">
                Bulk <span className="text-rose-500 not-italic">Upload</span>
              </h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Promotion Batch Processing</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(uploadStatus === 'ready' || uploadStatus === 'complete' || previewData.some(i => i.status === 'error')) && (
               <button
                 onClick={handleReset}
                 className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2"
               >
                 <RefreshCcw size={14} />
                 Reset
               </button>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8">
          {uploadStatus === 'idle' && (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[28px] bg-slate-50 dark:bg-slate-950/20 space-y-6">
              <div className="p-6 bg-rose-50 dark:bg-rose-500/10 rounded-full text-rose-500">
                <FileText size={48} />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Select Upload File</h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">XLSX, XLS or CSV files supported</p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  className="px-8 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-rose-500/20 active:scale-95 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Upload size={16} />
                  Choose File
                </button>
                <button
                  onClick={handleDownloadTemplate}
                  disabled={loading}
                  className="px-6 py-3 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed relative"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  Template
                </button>
              </div>
              <p className="text-[10px] font-bold text-slate-400 max-w-[280px] text-center italic">
                Template includes active Reference Sheets for Regions, Items, and Periods to make copy-pasting easier.
              </p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
            </div>
          )}

          {uploadStatus === 'projecting' && (
            <div className="flex flex-col items-center justify-center py-20 space-y-6">
              <Loader2 size={48} className="text-rose-500 animate-spin" />
              <div className="text-center">
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest animate-pulse">Projecting Plans...</h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">Validating regions, items, and mechanics</p>
              </div>
            </div>
          )}

          {(uploadStatus === 'ready' || uploadStatus === 'saving' || uploadStatus === 'complete') && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {previewData.filter(i => i.status === 'success').length} Valid
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-rose-100 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-[10px] font-black text-rose-500 uppercase tracking-widest">
                    {previewData.filter(i => i.status === 'error').length} Errors
                  </div>
                </div>
                {uploadStatus === 'ready' && (
                  <button
                    onClick={handleBulkSave}
                    className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center gap-2"
                  >
                    <Save size={16} />
                    Commit Upload
                  </button>
                )}
              </div>

              <div className="rounded-[24px] border border-slate-200 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left bg-slate-50/50 dark:bg-slate-900/50">
                  <thead className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Scheme ID (Projected)</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Errors / Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {previewData.map((item) => (
                      <tr key={item.id} className="group hover:bg-white dark:hover:bg-slate-900 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.status === 'success' ? (
                            <CheckCircle2 size={18} className="text-emerald-500" />
                          ) : (
                            <AlertCircle size={18} className="text-rose-500" />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono font-black text-[11px] text-slate-700 dark:text-slate-200 tracking-tighter uppercase">
                            {item.status === 'success' ? item.projection.schemeId : 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 line-clamp-2 max-w-sm">
                            {item.status === 'success' ? item.projection.description : `Orig: ${item.row['Item Code'] || '?'}`}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          {item.status === 'error' ? (
                            <div className="flex flex-wrap gap-1">
                              {item.errors.map((err, i) => (
                                <span key={i} className="px-2 py-0.5 bg-rose-500/10 text-rose-500 rounded-md text-[8px] font-black uppercase border border-rose-500/20 whitespace-nowrap">
                                  {err}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Validated</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {uploadStatus === 'complete' && (
            <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-10 flex flex-col items-center justify-center space-y-6">
               <motion.div
                 initial={{ scale: 0 }}
                 animate={{ scale: 1 }}
                 className="p-8 bg-emerald-500 text-white rounded-full shadow-2xl shadow-emerald-500/40"
               >
                 <CheckCircle2 size={64} />
               </motion.div>
               <div className="text-center">
                 <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Upload Complete!</h3>
                 <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-2 italic">Blueprints have been projected to the registry.</p>
               </div>
               <button
                 onClick={() => {
                   handleReset();
                   onClose();
                 }}
                 className="px-10 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[24px] text-xs font-black uppercase tracking-[0.2em] transition-all shadow-2xl shadow-emerald-500/40 active:scale-95 flex items-center gap-3"
               >
                 <CheckCircle2 size={18} />
                 Return to Registry
               </button>
            </div>
          )}
        </div>

        {uploadStatus === 'saving' && (
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] z-[70] flex flex-col items-center justify-center space-y-4">
            <Loader2 size={48} className="text-white animate-spin" />
            <p className="text-white text-[10px] font-black uppercase tracking-[0.3em]">Committing to Database...</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

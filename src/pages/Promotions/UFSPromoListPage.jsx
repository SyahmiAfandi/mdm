import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Database, Download, Eye, Info, Plus, RefreshCcw, Save, Search, Trash2, Undo2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../../supabaseClient';
import UfsPromoBlueprintDetailModal from './UfsPromoBlueprintDetailModal';
import UfsBulkUploadModal from './UfsBulkUploadModal';
import {
  DEFAULT_PROMOTION_CONTROL_SCHEME_ID,
  PROMOTION_CONTROL_DEFAULTS,
} from './ufsPromotionControlDefaults';

const GENERATED_PROMOTION_TABLE = 'ufs_promotion_blueprints';
const GENERATED_PROMOTION_ROW_TABLE = 'ufs_promotion_blueprint_rows';
const PROMOTION_CONTROL_TABLE = 'promo_scheme_controls';
const BLUEPRINT_EXPORT_COLUMNS = [
  'PromotionCode',
  'PromotionDescription',
  'PromotionType',
  'NationalBudget',
  'TestScheme',
  'BuyBase',
  'GetBase',
  'MultiplicationFactor',
  'StartDate',
  'EndDate',
  'PromotionStatus',
  'PromotionQuotaLevel',
  'PromotionQuotaOn',
  'PromotionClaimable',
  'OPSOID',
  'MaxInvoicesperOutlet',
  'MinBuySKUs',
  'PromotionUOM',
  'AlternatePromotionDescription',
  'UserExpire',
  'PromotionSlab',
  'PromotionSlabDescription',
  'RangeLow',
  'RangeHigh',
  'PromotionReturn',
  'ForEvery',
  'PurchaseLimit',
  'ProductHierarchyLevel',
  'ProductHierarchyCode',
  'Exclude',
  'ConditionGroup',
  'GroupType',
  'MinimumQty',
  'BasketPromotion',
  'CriteriaType',
  'CriteriaValue',
  'CriteriaExclude',
];
const DEFAULT_CONTROL_VALUES = PROMOTION_CONTROL_DEFAULTS.reduce((accumulator, item) => ({
  ...accumulator,
  [item.label]: item.type === 'number' && item.value !== '' ? Number(item.value) : item.value,
}), {});
const GROUP_TYPE_ORDER = { Q: 0, A: 1 };

function pickFirstValue(...values) {
  const match = values.find((value) => value !== '' && value != null);
  return match ?? '';
}

function readBlueprintField(record, fieldName) {
  if (!record || typeof record !== 'object') return '';
  if (record[fieldName] != null) return record[fieldName];

  const lowerFieldName = fieldName.toLowerCase();
  if (record[lowerFieldName] != null) return record[lowerFieldName];

  return '';
}

function normalizeExportDate(value) {
  if (!value) return '';

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toISOString().slice(0, 10);
}

function buildControlValues(controlRow) {
  return PROMOTION_CONTROL_DEFAULTS.reduce((accumulator, item) => ({
    ...accumulator,
    [item.label]: controlRow?.[item.field] != null ? controlRow[item.field] : DEFAULT_CONTROL_VALUES[item.label],
  }), DEFAULT_CONTROL_VALUES);
}

function buildExportFilename() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `ufs_promotion_blueprints_${timestamp}.xlsx`;
}

function buildExportRow(record, blueprint, controlValues) {
  const slabId = Number(pickFirstValue(readBlueprintField(record, 'PromotionSlab'), ''));
  const matchedSlab = Array.isArray(blueprint?.slabs)
    ? blueprint.slabs.find((slab) => Number(slab.serialNo) === slabId)
    : null;
  const promoDescription = pickFirstValue(
    readBlueprintField(record, 'PromotionDescription'),
    blueprint?.description,
    ''
  );

  return {
    PromotionCode: pickFirstValue(readBlueprintField(record, 'PromotionCode'), blueprint?.promoNumber, ''),
    PromotionDescription: promoDescription,
    PromotionType: pickFirstValue(readBlueprintField(record, 'PromotionType'), controlValues.PromotionType),
    NationalBudget: pickFirstValue(readBlueprintField(record, 'NationalBudget'), controlValues.NationalBudget),
    TestScheme: pickFirstValue(readBlueprintField(record, 'TestScheme'), controlValues.TestScheme),
    BuyBase: pickFirstValue(readBlueprintField(record, 'BuyBase'), controlValues.BuyBase),
    GetBase: pickFirstValue(
      readBlueprintField(record, 'GetBase'),
      blueprint?.promoType ? (blueprint.promoType === 'FOC' ? '4' : '5') : '',
      ''
    ),
    MultiplicationFactor: pickFirstValue(readBlueprintField(record, 'MultiplicationFactor'), controlValues.MultiplicationFactor),
    StartDate: normalizeExportDate(
      pickFirstValue(readBlueprintField(record, 'StartDate'), blueprint?.periodFrom, '')
    ),
    EndDate: normalizeExportDate(
      pickFirstValue(readBlueprintField(record, 'EndDate'), blueprint?.periodTo, '')
    ),
    PromotionStatus: pickFirstValue(readBlueprintField(record, 'PromotionStatus'), controlValues.PromotionStatus),
    PromotionQuotaLevel: pickFirstValue(readBlueprintField(record, 'PromotionQuotaLevel'), controlValues.PromotionQuotaLevel),
    PromotionQuotaOn: pickFirstValue(readBlueprintField(record, 'PromotionQuotaOn'), controlValues.PromotionQuotaOn),
    PromotionClaimable: pickFirstValue(readBlueprintField(record, 'PromotionClaimable'), controlValues.PromotionClaimable),
    OPSOID: pickFirstValue(readBlueprintField(record, 'OPSOID'), blueprint?.schemeId, ''),
    MaxInvoicesperOutlet: pickFirstValue(readBlueprintField(record, 'MaxInvoicesperOutlet'), controlValues.MaxInvoicesperOutlet),
    MinBuySKUs: pickFirstValue(readBlueprintField(record, 'MinBuySKUs'), controlValues.MinBuySKUs),
    PromotionUOM: pickFirstValue(
      readBlueprintField(record, 'PromotionUOM'),
      blueprint?.uom ? (blueprint.uom === 'PC' ? '3' : '1') : '',
      ''
    ),
    AlternatePromotionDescription: pickFirstValue(
      readBlueprintField(record, 'AlternatePromotionDescription'),
      promoDescription,
      ''
    ),
    UserExpire: pickFirstValue(readBlueprintField(record, 'UserExpire'), controlValues.UserExpire),
    PromotionSlab: pickFirstValue(readBlueprintField(record, 'PromotionSlab'), matchedSlab?.serialNo, ''),
    PromotionSlabDescription: pickFirstValue(
      readBlueprintField(record, 'PromotionSlabDescription'),
      promoDescription,
      ''
    ),
    RangeLow: pickFirstValue(readBlueprintField(record, 'RangeLow'), matchedSlab?.quantityFrom, ''),
    RangeHigh: pickFirstValue(readBlueprintField(record, 'RangeHigh'), matchedSlab?.quantityTo, ''),
    PromotionReturn: pickFirstValue(readBlueprintField(record, 'PromotionReturn'), matchedSlab?.discountQty, ''),
    ForEvery: pickFirstValue(readBlueprintField(record, 'ForEvery'), matchedSlab?.forEvery, ''),
    PurchaseLimit: pickFirstValue(readBlueprintField(record, 'PurchaseLimit'), controlValues.PurchaseLimit, matchedSlab?.purchaseLimit),
    ProductHierarchyLevel: pickFirstValue(readBlueprintField(record, 'ProductHierarchyLevel'), controlValues.ProductHierarchyLevel),
    ProductHierarchyCode: pickFirstValue(readBlueprintField(record, 'ProductHierarchyCode'), ''),
    Exclude: pickFirstValue(readBlueprintField(record, 'Exclude'), controlValues.Exclude),
    ConditionGroup: pickFirstValue(readBlueprintField(record, 'ConditionGroup'), controlValues.ConditionGroup),
    GroupType: pickFirstValue(readBlueprintField(record, 'GroupType'), ''),
    MinimumQty: pickFirstValue(readBlueprintField(record, 'MinimumQty'), controlValues.MinimumQty),
    BasketPromotion: pickFirstValue(readBlueprintField(record, 'BasketPromotion'), controlValues.BasketPromotion),
    CriteriaType: pickFirstValue(readBlueprintField(record, 'CriteriaType'), ''),
    CriteriaValue: pickFirstValue(readBlueprintField(record, 'CriteriaValue'), ''),
    CriteriaExclude: pickFirstValue(readBlueprintField(record, 'CriteriaExclude'), controlValues.CriteriaExclude),
  };
}

function compareBlueprintRows(leftRecord, rightRecord, schemeOrder) {
  const leftSchemeId = pickFirstValue(readBlueprintField(leftRecord, 'OPSOID'), '');
  const rightSchemeId = pickFirstValue(readBlueprintField(rightRecord, 'OPSOID'), '');
  const leftGroupType = String(pickFirstValue(readBlueprintField(leftRecord, 'GroupType'), ''));
  const rightGroupType = String(pickFirstValue(readBlueprintField(rightRecord, 'GroupType'), ''));

  return (schemeOrder.get(leftSchemeId) ?? Number.MAX_SAFE_INTEGER)
    - (schemeOrder.get(rightSchemeId) ?? Number.MAX_SAFE_INTEGER)
    || Number(pickFirstValue(readBlueprintField(leftRecord, 'PromotionSlab'), 0))
    - Number(pickFirstValue(readBlueprintField(rightRecord, 'PromotionSlab'), 0))
    || (GROUP_TYPE_ORDER[leftGroupType] ?? 99) - (GROUP_TYPE_ORDER[rightGroupType] ?? 99)
    || String(pickFirstValue(readBlueprintField(leftRecord, 'ProductHierarchyCode'), '')).localeCompare(
      String(pickFirstValue(readBlueprintField(rightRecord, 'ProductHierarchyCode'), ''))
    );
}

function buildWorksheetColumns(exportRows) {
  return BLUEPRINT_EXPORT_COLUMNS.map((columnName) => {
    const widestValue = exportRows.reduce((maxWidth, row) => {
      const cellValue = row?.[columnName];
      return Math.max(maxWidth, String(cellValue ?? '').length);
    }, columnName.length);

    return { wch: Math.min(Math.max(widestValue + 2, 14), 36) };
  });
}

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
  const [exporting, setExporting] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

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

  async function handleResetRegistry() {
    const confirmed = window.confirm('Are you sure you want to CLEAR ALL saved blueprints? This will permanently delete every blueprint and its slab rows from the database.');
    if (!confirmed) return;

    setLoading(true);
    try {
      // Delete all rows first (due to potential FK or just cleaner logic)
      const { error: rowDeleteError } = await supabase
        .from(GENERATED_PROMOTION_ROW_TABLE)
        .delete()
        .neq('OPSOID', 'DUMMY_NON_EXISTENT_VALUE'); // Hack to delete all rows as Supabase requires a filter

      if (rowDeleteError) throw rowDeleteError;

      // Delete all blueprints
      const { error: promotionDeleteError } = await supabase
        .from(GENERATED_PROMOTION_TABLE)
        .delete()
        .neq('scheme_id', 'DUMMY_NON_EXISTENT_VALUE');

      if (promotionDeleteError) throw promotionDeleteError;

      setRows([]);
      setSearchTerm('');
      toast.success('Registry has been completely reset.');
    } catch (error) {
      console.error('Failed to reset UFS promotion registry:', error);
      toast.error('Reset failed. Please check the database connection.');
    } finally {
      setLoading(false);
    }
  }

  async function handleExportExcel() {
    const visibleSchemeIds = filteredRows
      .map((row) => row.schemeId)
      .filter(Boolean);

    if (!visibleSchemeIds.length) {
      toast.error('No promotion rows available to export.');
      return;
    }

    setExporting(true);

    try {
      let controlRow = null;
      try {
        const { data, error } = await supabase
          .from(PROMOTION_CONTROL_TABLE)
          .select('*')
          .eq('scheme_id', DEFAULT_PROMOTION_CONTROL_SCHEME_ID)
          .maybeSingle();

        if (error) throw error;
        controlRow = data;
      } catch (controlError) {
        console.warn('Failed to load promotion controls for export. Using local defaults.', controlError);
      }

      const controlValues = buildControlValues(controlRow);
      const blueprintRows = [];
      const chunkSize = 25;

      for (let index = 0; index < visibleSchemeIds.length; index += chunkSize) {
        const schemeChunk = visibleSchemeIds.slice(index, index + chunkSize);
        const { data, error } = await supabase
          .from(GENERATED_PROMOTION_ROW_TABLE)
          .select('*')
          .in('OPSOID', schemeChunk);

        if (error) throw error;

        blueprintRows.push(...(data || []));
      }

      if (!blueprintRows.length) {
        toast.error('No saved blueprint detail rows found for export.');
        return;
      }

      const schemeOrder = new Map(visibleSchemeIds.map((schemeId, index) => [schemeId, index]));
      const blueprintBySchemeId = new Map(filteredRows.map((row) => [row.schemeId, row]));
      const exportRows = [...blueprintRows]
        .sort((leftRecord, rightRecord) => compareBlueprintRows(leftRecord, rightRecord, schemeOrder))
        .map((record) => {
          const schemeId = pickFirstValue(readBlueprintField(record, 'OPSOID'), '');
          return buildExportRow(record, blueprintBySchemeId.get(schemeId), controlValues);
        });

      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.json_to_sheet(exportRows, {
        header: BLUEPRINT_EXPORT_COLUMNS,
      });
      worksheet['!cols'] = buildWorksheetColumns(exportRows);

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'UFS Blueprints');
      XLSX.writeFile(workbook, buildExportFilename());

      toast.success(`Exported ${exportRows.length} template row${exportRows.length === 1 ? '' : 's'} to Excel.`);
    } catch (error) {
      console.error('Failed to export UFS promotion blueprint rows:', error);
      toast.error('Export failed. Please check the saved blueprint rows and try again.');
    } finally {
      setExporting(false);
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
                  UFS <span className="text-rose-500 font-extrabold not-italic">Promotion Blueprints</span>
                </h1>
                <div className="px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-[10px] font-black text-blue-400 uppercase tracking-tighter">AUTO</div>
              </div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Saved Promotion Blueprints</p>
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
              Create Blueprint
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

          <div className="px-10 py-5 border-b border-slate-200/50 dark:border-slate-800/50 flex flex-wrap items-center justify-between gap-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md shrink-0 z-10">
            {/* Left: Branding & Status */}
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-3 uppercase tracking-widest mb-1">
                  <Eye className="w-5 h-5 text-rose-500" />
                  Saved Blueprints
                </h3>
                <div className="flex items-center gap-2">
                  <div className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                    {filteredRows.length} / {rows.length} Records
                  </div>
                  <button
                    onClick={loadPromotions}
                    disabled={loading}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-400 hover:text-blue-500 hover:border-blue-200 border border-slate-200 dark:border-slate-700 transition-all shadow-sm disabled:opacity-60"
                    title="Refresh data from registry"
                  >
                    <RefreshCcw size={12} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>
            </div>

            {/* Center: Search / Filter */}
            <div className="flex-1 max-w-xl mx-auto">
              <div className="relative group/search">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                  <Search className="w-4 h-4 text-slate-400 group-focus-within/search:text-rose-500 transition-colors" />
                  <span className="h-3 w-px bg-slate-200 dark:bg-slate-700" />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest hidden sm:inline">Filter</span>
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Scheme ID, Promo #, Region, Item..."
                  className="w-full pl-24 pr-10 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-[11px] font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-rose-500/5 focus:border-rose-500 transition-all shadow-sm"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 transition-all"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm shadow-sm">
                <button
                  onClick={handleExportExcel}
                  disabled={loading || exporting || filteredRows.length === 0}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 text-emerald-600 hover:bg-emerald-600 hover:text-white border border-slate-200 dark:border-slate-700 transition-all text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  title={normalizedSearch ? 'Export current filtered blueprint rows' : 'Export all saved blueprint rows'}
                >
                  <Download size={14} className={exporting ? 'animate-bounce' : ''} />
                  {exporting ? 'Exporting...' : 'Export to Excel'}
                </button>
                
                <button
                  onClick={() => setIsBulkUploadOpen(true)}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 text-rose-600 hover:bg-rose-600 hover:text-white border border-slate-200 dark:border-slate-700 transition-all text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-sm"
                  title="Bulk upload promotions via Excel"
                >
                  <Upload size={14} />
                  Bulk Upload
                </button>

                <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

                <button
                  onClick={handleResetRegistry}
                  disabled={loading || rows.length === 0}
                  className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-100 dark:border-rose-900/30 transition-all text-[10px] font-black uppercase tracking-[0.2em] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  title="Permanently wipe entire registry data"
                >
                  Clear All
                </button>
              </div>
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
              <h4 className="text-sm font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em] mb-2">No Blueprints Yet</h4>
              <p className="text-[10px] font-bold text-slate-400/60 uppercase tracking-widest max-w-[300px] mb-6">
                Click "Create Blueprint" to generate your first UFS promotion blueprint
              </p>
              <button
                onClick={() => navigate('/promotions/auto-ufs/add')}
                className="px-4 py-2 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-lg"
              >
                <Plus size={14} />
                Create Blueprint
              </button>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="relative mb-8 text-slate-200 dark:text-slate-800">
                <div className="absolute inset-0 bg-rose-500/10 blur-3xl rounded-full" />
                <Search size={64} className="relative opacity-20" />
              </div>
              <h4 className="text-sm font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em] mb-2">No Matching Results</h4>
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
          UFS Promotion Blueprint Manager
        </div>
      </MotionDiv>

      <UfsPromoBlueprintDetailModal
        isOpen={isInfoModalOpen}
        selectedDetail={selectedDetail}
        onClose={() => setIsInfoModalOpen(false)}
      />

      <UfsBulkUploadModal
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        onSuccess={loadPromotions}
      />
    </div>
  );
}

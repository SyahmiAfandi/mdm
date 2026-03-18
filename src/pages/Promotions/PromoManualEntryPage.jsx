import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BadgeInfo,
  Check,
  Eye,
  Minus,
  PackageSearch,
  Plus,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  SquarePen,
  Waypoints
} from 'lucide-react';
import toast from 'react-hot-toast';
import { usePermissions } from '../../hooks/usePermissions';

const MODE_OPTIONS = [
  { value: 'hpc-ic', label: 'HPC & IC' },
  { value: 'ufs', label: 'UFS' }
];

const MODE_THEME = {
  'hpc-ic': {
    banner: 'from-sky-900 via-sky-800 to-cyan-700',
    tint: 'from-sky-500/12 via-transparent to-cyan-500/18',
    pill: 'bg-sky-500/15 text-sky-200 border border-sky-300/20',
    button: 'bg-sky-600 hover:bg-sky-500'
  },
  ufs: {
    banner: 'from-stone-900 via-stone-800 to-amber-800',
    tint: 'from-amber-500/12 via-transparent to-orange-500/18',
    pill: 'bg-amber-500/15 text-amber-100 border border-amber-300/20',
    button: 'bg-emerald-500 hover:bg-emerald-400'
  }
};

const PROMO_UNIT_OPTIONS = ['Case', 'Carton', 'Piece', 'KG', 'Liter'];
const CRITERIA_TYPE_OPTIONS = ['Sub Element', 'Brand', 'SKU', 'Region', 'Distributor'];

function createSkuRow(overrides = {}) {
  return {
    id: `sku-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sku: '',
    exclude: false,
    ...overrides
  };
}

function createCriteriaRow(overrides = {}) {
  return {
    id: `criteria-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'Sub Element',
    exclude: false,
    value: '',
    ...overrides
  };
}

function createSlabRow(overrides = {}) {
  return {
    id: `slab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: '',
    rangeLow: '',
    rangeHigh: '',
    promoReturn: '',
    purchaseLimit: '0',
    forEvery: '',
    ...overrides
  };
}

export default function PromoManualEntryPage() {
  const { can, role } = usePermissions();
  const canEdit = can('tools.promotions.edit') || can('tools.*') || role === 'admin';

  const [mode, setMode] = useState('ufs');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState({
    promotionCode: '',
    opsoId: '',
    description: '',
    startDate: '',
    endDate: '',
    maxInvoice: '99999',
    promotionUnit: '',
    buyBase: 'quantity',
    getBase: 'percentage',
    basketMode: false
  });

  const [skuRows, setSkuRows] = useState([]);
  const [selectedSkuId, setSelectedSkuId] = useState(null);
  const [skuDraft, setSkuDraft] = useState({ sku: '', exclude: false });
  const [excludeSku, setExcludeSku] = useState(false);

  const initialCriteria = useMemo(
    () => createCriteriaRow({ type: 'Sub Element', value: 'C10687' }),
    []
  );
  const [criteriaRows, setCriteriaRows] = useState([initialCriteria]);
  const [selectedCriteriaId, setSelectedCriteriaId] = useState(initialCriteria.id);
  const [criteriaDraft, setCriteriaDraft] = useState({
    type: initialCriteria.type,
    exclude: initialCriteria.exclude,
    value: initialCriteria.value
  });

  const [slabRows, setSlabRows] = useState([]);
  const [selectedSlabId, setSelectedSlabId] = useState(null);
  const [slabDraft, setSlabDraft] = useState({
    description: '',
    rangeLow: '',
    rangeHigh: '',
    promoReturn: '',
    purchaseLimit: '0',
    forEvery: ''
  });

  const theme = MODE_THEME[mode];
  const selectedSku = skuRows.find((row) => row.id === selectedSkuId) || null;
  const selectedCriteria = criteriaRows.find((row) => row.id === selectedCriteriaId) || null;
  const selectedSlab = slabRows.find((row) => row.id === selectedSlabId) || null;
  const summaryLabel = `${skuRows.length} SKU | ${criteriaRows.length} Criteria | ${slabRows.length} Slab`;

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSkuAddOrUpdate = () => {
    if (!canEdit) return toast.error('No permission to edit promotions');
    if (!skuDraft.sku.trim()) return toast.error('SKU is required');

    if (selectedSku) {
      setSkuRows((current) =>
        current.map((row) =>
          row.id === selectedSku.id
            ? { ...row, sku: skuDraft.sku.trim(), exclude: skuDraft.exclude }
            : row
        )
      );
      toast.success('SKU line updated');
    } else {
      const next = createSkuRow({
        sku: skuDraft.sku.trim(),
        exclude: skuDraft.exclude || excludeSku
      });
      setSkuRows((current) => [...current, next]);
      setSelectedSkuId(next.id);
      toast.success('SKU line added');
    }

    setSkuDraft({ sku: '', exclude: false });
    setExcludeSku(false);
  };

  const handleSkuSelect = (row) => {
    setSelectedSkuId(row.id);
    setSkuDraft({ sku: row.sku, exclude: row.exclude });
    setExcludeSku(row.exclude);
  };

  const handleSkuRemove = () => {
    if (!canEdit) return toast.error('No permission to edit promotions');
    if (!selectedSku) return toast.error('Select a SKU row to remove');

    setSkuRows((current) => current.filter((row) => row.id !== selectedSku.id));
    setSelectedSkuId(null);
    setSkuDraft({ sku: '', exclude: false });
    setExcludeSku(false);
    toast.success('SKU line removed');
  };

  const handleCriteriaAddOrUpdate = () => {
    if (!canEdit) return toast.error('No permission to edit promotions');
    if (!criteriaDraft.value.trim()) return toast.error('Criteria value is required');

    if (selectedCriteria) {
      setCriteriaRows((current) =>
        current.map((row) =>
          row.id === selectedCriteria.id
            ? {
                ...row,
                type: criteriaDraft.type,
                exclude: criteriaDraft.exclude,
                value: criteriaDraft.value.trim()
              }
            : row
        )
      );
      toast.success('Criteria row updated');
    } else {
      const next = createCriteriaRow({
        type: criteriaDraft.type,
        exclude: criteriaDraft.exclude,
        value: criteriaDraft.value.trim()
      });
      setCriteriaRows((current) => [...current, next]);
      setSelectedCriteriaId(next.id);
      toast.success('Criteria row added');
    }
  };

  const handleCriteriaSelect = (row) => {
    setSelectedCriteriaId(row.id);
    setCriteriaDraft({
      type: row.type,
      exclude: row.exclude,
      value: row.value
    });
  };

  const handleCriteriaRemove = () => {
    if (!canEdit) return toast.error('No permission to edit promotions');
    if (!selectedCriteria) return toast.error('Select a criteria row to remove');

    const remaining = criteriaRows.filter((row) => row.id !== selectedCriteria.id);
    setCriteriaRows(remaining);
    if (remaining[0]) {
      setSelectedCriteriaId(remaining[0].id);
      setCriteriaDraft({
        type: remaining[0].type,
        exclude: remaining[0].exclude,
        value: remaining[0].value
      });
    } else {
      setSelectedCriteriaId(null);
      setCriteriaDraft({ type: 'Sub Element', exclude: false, value: '' });
    }
    toast.success('Criteria row removed');
  };

  const handleSlabAddOrUpdate = () => {
    if (!canEdit) return toast.error('No permission to edit promotions');
    if (!slabDraft.description.trim()) return toast.error('Slab description is required');

    if (selectedSlab) {
      setSlabRows((current) =>
        current.map((row) =>
          row.id === selectedSlab.id
            ? {
                ...row,
                description: slabDraft.description.trim(),
                rangeLow: slabDraft.rangeLow,
                rangeHigh: slabDraft.rangeHigh,
                promoReturn: slabDraft.promoReturn,
                purchaseLimit: slabDraft.purchaseLimit,
                forEvery: slabDraft.forEvery
              }
            : row
        )
      );
      toast.success('Promotion slab updated');
    } else {
      const next = createSlabRow({
        description: slabDraft.description.trim(),
        rangeLow: slabDraft.rangeLow,
        rangeHigh: slabDraft.rangeHigh,
        promoReturn: slabDraft.promoReturn,
        purchaseLimit: slabDraft.purchaseLimit,
        forEvery: slabDraft.forEvery
      });
      setSlabRows((current) => [...current, next]);
      setSelectedSlabId(next.id);
      toast.success('Promotion slab added');
    }
  };

  const handleSlabSelect = (row) => {
    setSelectedSlabId(row.id);
    setSlabDraft({
      description: row.description,
      rangeLow: row.rangeLow,
      rangeHigh: row.rangeHigh,
      promoReturn: row.promoReturn,
      purchaseLimit: row.purchaseLimit,
      forEvery: row.forEvery
    });
  };

  const handleSlabRemove = () => {
    if (!canEdit) return toast.error('No permission to edit promotions');
    if (!selectedSlab) return toast.error('Select a slab row to remove');

    setSlabRows((current) => current.filter((row) => row.id !== selectedSlab.id));
    setSelectedSlabId(null);
    setSlabDraft({
      description: '',
      rangeLow: '',
      rangeHigh: '',
      promoReturn: '',
      purchaseLimit: '0',
      forEvery: ''
    });
    toast.success('Promotion slab removed');
  };

  const handlePreview = () => {
    toast.success(
      `${form.description || 'Untitled promotion'} ready for preview. ${summaryLabel}.`,
      { duration: 3500 }
    );
  };

  const handleConfirm = () => {
    if (!canEdit) return toast.error('No permission to edit promotions');
    toast.success('Manual entry layout is ready for integration with save logic.');
  };

  return (
    <div className="h-[calc(100vh-140px)] w-full min-w-0 px-5 pb-5">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="flex h-full flex-col overflow-hidden rounded-[28px] border border-stone-200 bg-[linear-gradient(180deg,#fafaf9_0%,#f5f5f4_100%)] shadow-[0_24px_70px_-32px_rgba(28,25,23,0.45)]"
      >
        <div className={`relative border-b border-stone-300 bg-gradient-to-r ${theme.banner} px-6 py-4 text-white`}>
          <div className={`absolute inset-0 bg-gradient-to-r ${theme.tint}`} />
          <div className="relative flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-white/75">
                <SquarePen size={12} />
                Manual Entry Workspace
              </div>
              <h1 className="mt-3 font-serif text-[clamp(2rem,3vw,3rem)] font-black tracking-[-0.05em]">
                Promotion Tools
              </h1>
              <div className="mt-3 h-px w-full max-w-4xl bg-white/35" />
              <p className="mt-3 max-w-3xl text-xs text-stone-200/90">
                Structured to match the original desktop form: promotion info first, SKU and criteria on the right,
                slab setup below, and action controls kept at the bottom.
              </p>
            </div>

            <div className="flex flex-col items-start gap-2 lg:items-end">
              <div className="inline-flex rounded-2xl border border-white/10 bg-black/15 p-1.5 backdrop-blur-sm">
                {MODE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMode(option.value)}
                    className={`min-w-[102px] rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                      mode === option.value
                        ? 'bg-white text-stone-900 shadow-lg'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold ${theme.pill}`}>
                <Sparkles size={12} />
                {summaryLabel}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-4 md:p-5">
          <div className="grid min-h-0 gap-4 xl:grid-cols-[1.5fr,0.95fr]">
            <div className="min-h-0 space-y-4">
              <SectionFrame title="Promotion Info" icon={Settings2}>
                <div className="grid gap-4 xl:grid-cols-[1fr_1fr_0.92fr]">
                  <div className="space-y-3 xl:col-span-2">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Promotion Code">
                        <TextInput
                          value={form.promotionCode}
                          onChange={(e) => updateForm('promotionCode', e.target.value)}
                          placeholder="Enter promo code"
                          disabled={!canEdit}
                        />
                      </Field>
                      <Field label="OPSO ID">
                        <TextInput
                          value={form.opsoId}
                          onChange={(e) => updateForm('opsoId', e.target.value)}
                          placeholder="Enter OPSO ID"
                          disabled={!canEdit}
                        />
                      </Field>
                    </div>

                    <Field label="Promotion Description">
                      <TextInput
                        value={form.description}
                        onChange={(e) => updateForm('description', e.target.value)}
                        placeholder="Describe the promotion"
                        disabled={!canEdit}
                      />
                    </Field>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Start Date">
                        <TextInput
                          type="date"
                          value={form.startDate}
                          onChange={(e) => updateForm('startDate', e.target.value)}
                          disabled={!canEdit}
                        />
                      </Field>
                      <Field label="End Date">
                        <TextInput
                          type="date"
                          value={form.endDate}
                          onChange={(e) => updateForm('endDate', e.target.value)}
                          disabled={!canEdit}
                        />
                      </Field>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Max Invoice">
                        <TextInput
                          value={form.maxInvoice}
                          onChange={(e) => updateForm('maxInvoice', e.target.value)}
                          disabled={!canEdit}
                        />
                      </Field>
                      <Field label="Promotion Unit">
                        <SelectInput
                          value={form.promotionUnit}
                          onChange={(e) => updateForm('promotionUnit', e.target.value)}
                          disabled={!canEdit}
                        >
                          <option value="">Select unit</option>
                          {PROMO_UNIT_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </SelectInput>
                      </Field>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <OptionCard title="Buy Base">
                      <RadioOption
                        label="Value"
                        checked={form.buyBase === 'value'}
                        onChange={() => updateForm('buyBase', 'value')}
                        disabled={!canEdit}
                      />
                      <RadioOption
                        label="Quantity"
                        checked={form.buyBase === 'quantity'}
                        onChange={() => updateForm('buyBase', 'quantity')}
                        disabled={!canEdit}
                      />
                      <RadioOption
                        label="Weight"
                        checked={form.buyBase === 'weight'}
                        onChange={() => updateForm('buyBase', 'weight')}
                        disabled={!canEdit}
                      />
                    </OptionCard>

                    <OptionCard title="Get Base">
                      <RadioOption
                        label="Percentage %"
                        checked={form.getBase === 'percentage'}
                        onChange={() => updateForm('getBase', 'percentage')}
                        disabled={!canEdit}
                      />
                      <RadioOption
                        label="Free Goods #"
                        checked={form.getBase === 'free-goods'}
                        onChange={() => updateForm('getBase', 'free-goods')}
                        disabled={!canEdit}
                      />
                      <RadioOption
                        label="Value $"
                        checked={form.getBase === 'value'}
                        onChange={() => updateForm('getBase', 'value')}
                        disabled={!canEdit}
                      />
                    </OptionCard>
                  </div>
                </div>
              </SectionFrame>

              <SectionFrame title="Promotion Slab" icon={SlidersHorizontal}>
                <div className="space-y-3">
                  <DataTable
                    headers={['No', 'Slab Description', 'Range Low', 'Range High', 'Promo Return', 'Purchase Limit', 'For Every']}
                    emptyLabel="No slab rows added yet."
                  >
                    {slabRows.map((row, index) => (
                      <tr
                        key={row.id}
                        onClick={() => handleSlabSelect(row)}
                        className={`cursor-pointer border-b border-stone-200/80 transition-colors hover:bg-stone-50 ${
                          selectedSlabId === row.id ? 'bg-amber-50/80' : 'bg-white/80'
                        }`}
                      >
                        <Cell className="w-14 text-center font-semibold text-stone-500">{index + 1}</Cell>
                        <Cell className="font-medium text-stone-700">{row.description || '-'}</Cell>
                        <Cell>{row.rangeLow || '-'}</Cell>
                        <Cell>{row.rangeHigh || '-'}</Cell>
                        <Cell>{row.promoReturn || '-'}</Cell>
                        <Cell>{row.purchaseLimit || '-'}</Cell>
                        <Cell>{row.forEvery || '-'}</Cell>
                      </tr>
                    ))}
                  </DataTable>

                  <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                    <Field label="Promotion Slab Description">
                      <TextInput
                        value={slabDraft.description}
                        onChange={(e) => setSlabDraft((current) => ({ ...current, description: e.target.value }))}
                        placeholder="Enter slab description"
                        disabled={!canEdit}
                      />
                    </Field>

                    <div className="flex items-end gap-2">
                      <ActionSquareButton
                        icon={Plus}
                        label={selectedSlab ? 'Update slab' : 'Add slab'}
                        onClick={handleSlabAddOrUpdate}
                        disabled={!canEdit}
                      />
                      <ActionSquareButton
                        icon={Minus}
                        label="Remove slab"
                        onClick={handleSlabRemove}
                        disabled={!canEdit}
                        tone="muted"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <Field label="Range">
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-2">
                        <TextInput
                          value={slabDraft.rangeLow}
                          onChange={(e) => setSlabDraft((current) => ({ ...current, rangeLow: e.target.value }))}
                          placeholder="Low"
                          disabled={!canEdit}
                        />
                        <div className="flex items-center justify-center text-sm font-bold text-stone-500">to</div>
                        <TextInput
                          value={slabDraft.rangeHigh}
                          onChange={(e) => setSlabDraft((current) => ({ ...current, rangeHigh: e.target.value }))}
                          placeholder="High"
                          disabled={!canEdit}
                        />
                      </div>
                    </Field>
                    <Field label="For Every">
                      <TextInput
                        value={slabDraft.forEvery}
                        onChange={(e) => setSlabDraft((current) => ({ ...current, forEvery: e.target.value }))}
                        placeholder="0"
                        disabled={!canEdit}
                      />
                    </Field>
                    <Field label="Promotion Return">
                      <TextInput
                        value={slabDraft.promoReturn}
                        onChange={(e) => setSlabDraft((current) => ({ ...current, promoReturn: e.target.value }))}
                        placeholder="0"
                        disabled={!canEdit}
                      />
                    </Field>
                    <Field label="Purchase Limit">
                      <TextInput
                        value={slabDraft.purchaseLimit}
                        onChange={(e) => setSlabDraft((current) => ({ ...current, purchaseLimit: e.target.value }))}
                        disabled={!canEdit}
                      />
                    </Field>
                    <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50/80 px-3.5 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-stone-400">Selection</div>
                      <div className="mt-2 text-sm font-semibold text-stone-700">
                        {selectedSlab ? selectedSlab.description : 'Create a slab row'}
                      </div>
                      <p className="mt-1 text-xs text-stone-500">
                        Add or edit rows while keeping the original desktop slab pattern.
                      </p>
                    </div>
                  </div>
                </div>
              </SectionFrame>
            </div>

            <div className="min-h-0 space-y-4">
              <SectionFrame title="SKU" icon={PackageSearch}>
                <div className="grid gap-3 xl:grid-cols-[1fr_108px]">
                  <div className="space-y-3">
                    <DataTable headers={['No', 'SKU', 'Exclude']} emptyLabel="No SKU rows added yet.">
                      {skuRows.map((row, index) => (
                        <tr
                          key={row.id}
                          onClick={() => handleSkuSelect(row)}
                          className={`cursor-pointer border-b border-stone-200/80 transition-colors hover:bg-stone-50 ${
                            selectedSkuId === row.id ? 'bg-sky-50/80' : 'bg-white/80'
                          }`}
                        >
                          <Cell className="w-14 text-center font-semibold text-stone-500">{index + 1}</Cell>
                          <Cell className="font-medium text-stone-700">{row.sku}</Cell>
                          <Cell>{row.exclude ? 'Y' : 'N'}</Cell>
                        </tr>
                      ))}
                    </DataTable>

                    <div className="grid gap-2.5 lg:grid-cols-[1fr_auto] lg:items-end">
                      <Field label="SKU">
                        <TextInput
                          value={skuDraft.sku}
                          onChange={(e) => setSkuDraft((current) => ({ ...current, sku: e.target.value }))}
                          placeholder="Enter SKU code"
                          disabled={!canEdit}
                        />
                      </Field>

                      <div className="flex items-end gap-2">
                        <ActionSquareButton
                          icon={Plus}
                          label={selectedSku ? 'Update SKU' : 'Add SKU'}
                          onClick={handleSkuAddOrUpdate}
                          disabled={!canEdit}
                        />
                        <ActionSquareButton
                          icon={Minus}
                          label="Remove SKU"
                          onClick={handleSkuRemove}
                          disabled={!canEdit}
                          tone="muted"
                        />
                      </div>
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm font-medium text-stone-700">
                      <input
                        type="checkbox"
                        checked={excludeSku}
                        onChange={(e) => {
                          setExcludeSku(e.target.checked);
                          setSkuDraft((current) => ({ ...current, exclude: e.target.checked }));
                        }}
                        disabled={!canEdit}
                        className="h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900/20"
                      />
                      Exclude SKU
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => canEdit && updateForm('basketMode', !form.basketMode)}
                    className={`flex min-h-[188px] flex-col items-center justify-center rounded-[22px] border px-3 py-4 text-center transition-all ${
                      form.basketMode
                        ? 'border-stone-900 bg-stone-900 text-white shadow-[0_16px_40px_-24px_rgba(28,25,23,0.8)]'
                        : 'border-stone-300 bg-white/90 text-stone-700 hover:border-stone-400'
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-current/70">Mode</div>
                    <div className="mt-3 text-xl font-black tracking-tight">Basket</div>
                    <p className="mt-2 text-[11px] leading-relaxed text-current/75">
                      Toggle to enable basket-mode behavior while keeping the original side-panel position.
                    </p>
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-current/15 bg-current/10 px-3 py-1 text-[11px] font-semibold">
                      {form.basketMode ? 'Enabled' : 'Disabled'}
                    </div>
                  </button>
                </div>
              </SectionFrame>
              <SectionFrame title="Criteria" icon={Waypoints}>
                <div className="space-y-3">
                  <DataTable headers={['No', 'Criteria Type', 'Exclude', 'Criteria Value']} emptyLabel="No criteria rows added yet.">
                    {criteriaRows.map((row, index) => (
                      <tr
                        key={row.id}
                        onClick={() => handleCriteriaSelect(row)}
                        className={`cursor-pointer border-b border-stone-200/80 transition-colors hover:bg-stone-50 ${
                          selectedCriteriaId === row.id ? 'bg-emerald-50/80' : 'bg-white/80'
                        }`}
                      >
                        <Cell className="w-14 text-center font-semibold text-stone-500">{index + 1}</Cell>
                        <Cell className="font-medium text-stone-700">{row.type}</Cell>
                        <Cell>{row.exclude ? 'Y' : 'N'}</Cell>
                        <Cell className="font-mono text-[12px] tracking-tight">{row.value}</Cell>
                      </tr>
                    ))}
                  </DataTable>

                  <div className="grid gap-2.5 lg:grid-cols-[1fr_auto] lg:items-end">
                    <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                      <Field label="Criteria Type">
                        <SelectInput
                          value={criteriaDraft.type}
                          onChange={(e) => setCriteriaDraft((current) => ({ ...current, type: e.target.value }))}
                          disabled={!canEdit}
                        >
                          {CRITERIA_TYPE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </SelectInput>
                      </Field>

                      <label className="inline-flex items-center gap-2 pb-3 text-sm font-medium text-stone-700">
                        <input
                          type="checkbox"
                          checked={criteriaDraft.exclude}
                          onChange={(e) => setCriteriaDraft((current) => ({ ...current, exclude: e.target.checked }))}
                          disabled={!canEdit}
                          className="h-4 w-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900/20"
                        />
                        Exclude Criteria
                      </label>
                    </div>

                    <div className="flex items-end gap-2">
                      <ActionSquareButton
                        icon={Plus}
                        label={selectedCriteria ? 'Update criteria' : 'Add criteria'}
                        onClick={handleCriteriaAddOrUpdate}
                        disabled={!canEdit}
                      />
                      <ActionSquareButton
                        icon={Minus}
                        label="Remove criteria"
                        onClick={handleCriteriaRemove}
                        disabled={!canEdit}
                        tone="muted"
                      />
                    </div>
                  </div>

                  <Field label="Criteria Value">
                    <textarea
                      value={criteriaDraft.value}
                      onChange={(e) => setCriteriaDraft((current) => ({ ...current, value: e.target.value }))}
                      disabled={!canEdit}
                      rows={5}
                      placeholder="Enter criteria value"
                      className="min-h-[92px] w-full rounded-[16px] border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition focus:border-stone-500 focus:ring-4 focus:ring-stone-900/5 disabled:cursor-not-allowed disabled:bg-stone-100/70"
                    />
                  </Field>
                </div>
              </SectionFrame>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {showAdvanced ? (
              <motion.div
                initial={{ opacity: 0, y: 12, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 rounded-[20px] border border-stone-300 bg-white/90 px-4 py-3 shadow-[0_14px_35px_-24px_rgba(28,25,23,0.35)]">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-stone-600">
                      <Settings2 size={12} />
                      Advance Settings
                    </div>
                    {[
                      'Promotion Status: Active',
                      'Claimable: Yes',
                      'Quota Level: SR',
                      'Condition Group: 1'
                    ].map((item) => (
                      <div
                        key={item}
                        className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-600"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setShowAdvanced((current) => !current)}
              className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-stone-400 bg-white px-5 py-3 text-sm font-semibold text-stone-700 shadow-[4px_4px_0_rgba(120,113,108,0.25)] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_rgba(120,113,108,0.22)]"
            >
              <BadgeInfo size={16} />
              {showAdvanced ? 'Hide Advance Settings' : 'Advance Settings'}
            </button>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handlePreview}
                className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-stone-400 bg-white px-6 py-3 text-sm font-semibold text-stone-800 shadow-[4px_4px_0_rgba(120,113,108,0.25)] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_rgba(120,113,108,0.22)]"
              >
                <Eye size={16} />
                Preview
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canEdit}
                className={`inline-flex items-center justify-center gap-2 rounded-[20px] px-6 py-3 text-sm font-semibold text-white shadow-[4px_4px_0_rgba(120,113,108,0.25)] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_rgba(120,113,108,0.22)] disabled:cursor-not-allowed disabled:bg-stone-300 ${theme.button}`}
              >
                <Check size={16} />
                Confirm
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function SectionFrame({ title, icon: Icon, children }) {
  return (
    <fieldset className="rounded-[22px] border border-stone-300 bg-white/75 p-3 shadow-[0_18px_40px_-28px_rgba(28,25,23,0.45)]">
      <legend className="px-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-[13px] font-black tracking-tight text-stone-800">
          <Icon size={14} className="text-stone-500" />
          {title}
        </div>
      </legend>
      {children}
    </fieldset>
  );
}

function OptionCard({ title, children }) {
  return (
    <div className="rounded-[18px] border border-stone-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,245,244,0.95)_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
      <div className="text-sm font-black tracking-tight text-stone-800">{title}</div>
      <div className="mt-2.5 space-y-2.5">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-1 text-[13px] font-semibold text-stone-800">{label}</div>
      {children}
    </label>
  );
}

function RadioOption({ label, checked, onChange, disabled }) {
  return (
    <label className="flex items-center gap-2.5 text-[13px] font-medium text-stone-700">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="h-4 w-4 border-stone-300 text-stone-900 focus:ring-stone-900/20"
      />
      <span>{label}</span>
    </label>
  );
}

function TextInput({ className = '', ...props }) {
  return (
    <input
      {...props}
      className={`h-10 w-full rounded-[14px] border border-stone-300 bg-white px-3.5 text-sm text-stone-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition focus:border-stone-500 focus:ring-4 focus:ring-stone-900/5 disabled:cursor-not-allowed disabled:bg-stone-100/70 ${className}`}
    />
  );
}

function SelectInput({ children, className = '', ...props }) {
  return (
    <select
      {...props}
      className={`h-10 w-full rounded-[14px] border border-stone-300 bg-white px-3.5 text-sm text-stone-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition focus:border-stone-500 focus:ring-4 focus:ring-stone-900/5 disabled:cursor-not-allowed disabled:bg-stone-100/70 ${className}`}
    >
      {children}
    </select>
  );
}

function ActionSquareButton({ icon: Icon, label, tone = 'default', ...props }) {
  const toneClass =
    tone === 'muted'
      ? 'bg-white text-stone-700 border-stone-300 hover:border-stone-400'
      : 'bg-stone-900 text-white border-stone-900 hover:bg-stone-800';

  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-[14px] border shadow-[4px_4px_0_rgba(120,113,108,0.2)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:border-stone-200 disabled:bg-stone-100 disabled:text-stone-400 ${toneClass}`}
      title={label}
      aria-label={label}
    >
      <Icon size={18} />
    </button>
  );
}

function DataTable({ headers, children, emptyLabel }) {
  const rowCount = React.Children.count(children);

  return (
    <div className="overflow-hidden rounded-[18px] border border-stone-300 bg-white">
      <div className="max-h-[132px] overflow-auto">
        <table className="w-full min-w-[500px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-stone-100/95 backdrop-blur-sm">
            <tr className="border-b border-stone-300">
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-stone-500"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowCount > 0 ? (
              children
            ) : (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-4 py-5 text-center text-sm font-medium text-stone-400"
                >
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cell({ className = '', children }) {
  return <td className={`px-3 py-2.5 text-[13px] text-stone-600 ${className}`}>{children}</td>;
}

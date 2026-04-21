import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { BarChart2, Table, Search, Eye, EyeOff } from 'lucide-react';
import annotationPlugin from 'chartjs-plugin-annotation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

const RECON_CELLS_TABLE = 'recon_cells';
const SUPABASE_PAGE_SIZE = 1000;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December',
];
const BASE_VISIBLE_COLS = {
  Year: true,
  Month: true,
  BusinessType: true,
  Distributor: true,
  DistributorName: true,
};

function normalizeText(value = '') {
  return String(value ?? '').trim();
}

function titleCaseWords(value = '') {
  const clean = normalizeText(value);
  if (!clean) return '';
  return clean
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function monthNumberToName(monthValue) {
  const monthNum = Number(monthValue);
  if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) return '';
  return MONTH_NAMES[monthNum - 1];
}

function monthNameToNumber(monthName) {
  if (!monthName) return undefined;
  const normalized = normalizeText(monthName).toLowerCase();
  const idx = MONTH_NAMES.findIndex((month) => month.toLowerCase() === normalized);
  return idx >= 0 ? idx + 1 : undefined;
}

function normalizeReconStatus(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'match') return 'Match';
  if (normalized === 'mismatch') return 'Mismatch';
  if (['no_data', 'no data', 'nodata'].includes(normalized)) return 'No Data';
  return titleCaseWords(value);
}

function formatTimestamp(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
}

function inferPeriodParts(row = {}) {
  const year = Number(row?.year);
  const month = Number(row?.month);
  if (Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12) {
    return { year: String(year), month };
  }

  const periodId = normalizeText(row?.period_id ?? row?.periodId ?? '');
  const match = periodId.match(/^(\d{4})-(\d{1,2})$/);
  if (!match) return { year: '', month: undefined };

  return {
    year: match[1],
    month: Number(match[2]),
  };
}

async function fetchAllSupabaseRows(buildQuery) {
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await buildQuery().range(from, to);
    if (error) throw error;

    const chunk = data || [];
    rows.push(...chunk);

    if (chunk.length < SUPABASE_PAGE_SIZE) break;
    from += SUPABASE_PAGE_SIZE;
  }

  return rows;
}

function mapReconCellToSummaryRow(row = {}) {
  const { year, month } = inferPeriodParts(row);
  return {
    id: row.id ?? '',
    Year: year,
    Month: monthNumberToName(month),
    'Business Type': normalizeText(row.business_type ?? row.businessType ?? ''),
    'Distributor Code': normalizeText(row.distributor_code ?? row.distributorCode ?? ''),
    'Distributor Name': normalizeText(row.distributor_name ?? row.distributorName ?? ''),
    'Report Type': normalizeText(row.report_type_name ?? row.reportTypeName ?? row.report_type_id ?? row.reportTypeId ?? ''),
    'Report Status': normalizeReconStatus(row.status ?? row.Status ?? ''),
    PIC: normalizeText(row.updated_by ?? row.updatedBy ?? ''),
    Timestamp: formatTimestamp(row.updated_at ?? row.updatedAt ?? ''),
    Remark: normalizeText(row.remark ?? ''),
  };
}

// Helper: prettify “hpc-retail” → “Hpc Retail”
function prettifyBusinessType(b) {
  if (!b) return '';
  return b.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

// Predefined background colors for business-type shading
const businessTypeBgColors = [
  'rgba(253,230,138,0.5)',
  'rgba(59,130,246,0.12)',
  'rgba(196,181,253,0.5)',
  'rgba(187,247,208,0.5)',
  'rgba(254,249,195,0.5)',
];


// Horizontal padding reserved for the business-group “chips” on the right
const CLASSIC_LABEL_WIDTH = 100;

// Plugin to draw a rounded “chip” showing each BusinessType label
const businessGroupLabelPlugin = {
  id: 'businessGroupLabelPlugin',
  afterDraw: (chart) => {
    const { ctx, chartArea, scales, config } = chart;
    if (!scales.y || !chartArea) return;
    const businessGroupMeta = config.options.plugins.businessGroupMeta || [];
    const chipWidth = CLASSIC_LABEL_WIDTH;

    businessGroupMeta.forEach((meta) => {
      const yScale = scales.y;
      const yStart = yScale.getPixelForValue(meta.start);
      const yEnd = yScale.getPixelForValue(meta.end);
      const yCenter = (yStart + yEnd) / 2;
      const text = meta.business;

      ctx.save();
      ctx.font = '11px "Inter", "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const boxWidth = chipWidth;
      const boxHeight = 18;
      const x = chartArea.right + 10;
      const y = yCenter - boxHeight / 2;

      // Draw rounded rectangle background
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 1.1;
      const r = 8;

      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + boxWidth - r, y);
      ctx.quadraticCurveTo(x + boxWidth, y, x + boxWidth, y + r);
      ctx.lineTo(x + boxWidth, y + boxHeight - r);
      ctx.quadraticCurveTo(
        x + boxWidth,
        y + boxHeight,
        x + boxWidth - r,
        y + boxHeight
      );
      ctx.lineTo(x + r, y + boxHeight);
      ctx.quadraticCurveTo(x, y + boxHeight, x, y + boxHeight - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();

      ctx.fill();
      ctx.stroke();

      // Draw the business text inside the chip
      ctx.fillStyle = '#2563eb';
      ctx.font = '11px "Inter", "Segoe UI", Arial, sans-serif';
      ctx.fillText(text, x + boxWidth / 2, yCenter + 1);
      ctx.restore();
    });
  },
};
ChartJS.register(businessGroupLabelPlugin);

// Plugin to draw numeric labels inside each stacked bar if there's enough space
const barStackValueLabelPlugin = {
  id: 'barStackValueLabelPlugin',
  afterDatasetsDraw: (chart) => {
    const { ctx, data, scales } = chart;
    if (!scales.x || !scales.y) return;
    ctx.save();
    data.datasets.forEach((dataset, datasetIdx) => {
      const meta = chart.getDatasetMeta(datasetIdx);
      data.labels.forEach((_, idx) => {
        const bar = meta.data[idx];
        if (!bar) return;
        const value = dataset.data[idx] || 0;
        if (!value) return;

        const { x, y, base } = bar;
        const width = Math.abs(x - base);

        ctx.font = '11px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.textAlign = width > 14 ? 'center' : 'left';
        ctx.textBaseline = 'middle';

        const txt = value.toString();
        ctx.fillStyle = width > 14 ? '#fff' : '#1e293b';

        const tx = width > 14 ? (base + x) / 2 : Math.max(x, base) + 6;
        const ty = y;
        ctx.fillText(txt, tx, ty);
      });
    });
    ctx.restore();
  },
};
ChartJS.register(barStackValueLabelPlugin);


export default function ReportSummaryPage() {
  const MotionDiv = motion.div;

  // ---- Default filters to “previous month” of current year ----
  const currentDate = new Date();
  let defaultMonthIdx = currentDate.getMonth() - 1;
  let defaultYear = currentDate.getFullYear();
  if (defaultMonthIdx < 0) {
    defaultMonthIdx = 11;
    defaultYear = defaultYear - 1;
  }
  // ---- Main state hooks ----
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [yearOptions, setYearOptions] = useState([]);
  const [filters, setFilters] = useState({
    month: MONTH_NAMES[defaultMonthIdx],
    year: defaultYear.toString(),
    status: '',
    type: '',
    business: '',
  });
  const [viewMode, setViewMode] = useState(true); // true = Chart, false = Table

  // ---- Column visibility state ----
  const [visibleCols, setVisibleCols] = useState(BASE_VISIBLE_COLS);

  // ---- Show/Hide the “Show Columns” dropdown ----
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef();

  // ---- Search + Sort state for table view ----
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // ---- Show/Hide search bar in Table View ----
  const [showSearchBar, setShowSearchBar] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // ---------------- Fetch available years from recon_cells ----------------
  useEffect(() => {
    let alive = true;

    async function loadYearOptions() {
      try {
        const rows = await fetchAllSupabaseRows(() =>
          supabase
            .from(RECON_CELLS_TABLE)
            .select('year')
            .order('year', { ascending: false })
        );

        if (!alive) return;

        const options = Array.from(
          new Set(
            rows
              .map((row) => normalizeText(row?.year))
              .filter(Boolean)
          )
        ).sort((a, b) => Number(b) - Number(a));

        setYearOptions(options.length ? options : [String(defaultYear)]);
      } catch (error) {
        console.error('Failed to load recon summary year options:', error);
        if (alive) setYearOptions([String(defaultYear)]);
      }
    }

    loadYearOptions();
    return () => {
      alive = false;
    };
  }, [defaultYear]);

  // ---------------- Fetch summary data from Supabase recon_cells ----------------
  useEffect(() => {
    let alive = true;

    async function loadSummaryRows() {
      setLoading(true);
      setLoadError('');
      setData([]);

      try {
        const selectedYear = filters.year ? Number(filters.year) : undefined;
        const selectedMonth = monthNameToNumber(filters.month);

        const rows = await fetchAllSupabaseRows(() => {
          let query = supabase
            .from(RECON_CELLS_TABLE)
            .select('id,period_id,year,month,business_type,distributor_code,distributor_name,report_type_id,report_type_name,status,remark,updated_by,updated_at')
            .order('id', { ascending: true });

          if (Number.isFinite(selectedYear)) query = query.eq('year', selectedYear);
          if (selectedMonth) query = query.eq('month', selectedMonth);

          return query;
        });

        const mappedRows = rows
          .map(mapReconCellToSummaryRow)
          .filter((row) => row['Distributor Code'] && row['Report Type']);

        if (!alive) return;

        const allReportTypes = Array.from(
          new Set(mappedRows.map((row) => row['Report Type']).filter(Boolean))
        ).sort();

        setData(mappedRows);
        setVisibleCols((prev) => {
          const next = {
            Year: prev.Year ?? true,
            Month: prev.Month ?? true,
            BusinessType: prev.BusinessType ?? true,
            Distributor: prev.Distributor ?? true,
            DistributorName: prev.DistributorName ?? true,
          };
          allReportTypes.forEach((reportType) => {
            next[reportType] = prev[reportType] ?? true;
          });
          return next;
        });
      } catch (error) {
        console.error('Failed to load recon summary rows from Supabase:', error);
        if (!alive) return;
        setData([]);
        setVisibleCols(BASE_VISIBLE_COLS);
        setLoadError(error?.message || 'Failed to load reconciliation summary from Supabase.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadSummaryRows();
    return () => {
      alive = false;
    };
  }, [filters.year, filters.month]);

  // ---------------- Close “Show Columns” dropdown on outside click ----------------
  useEffect(() => {
    if (!showDropdown) return;
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  // ---------------- Apply filters ----------------
  const filtered = data.filter((row) => {
    return (
      (!filters.month || row.Month === filters.month) &&
      (!filters.year || row.Year?.toString() === filters.year) &&
      (!filters.status || row['Report Status'] === filters.status) &&
      (!filters.type || row['Report Type'] === filters.type) &&
      (!filters.business || row['Business Type'] === filters.business)
    );
  });
  const reportTypeOptions = useMemo(
    () => Array.from(new Set(data.map((row) => row['Report Type']).filter(Boolean))).sort(),
    [data]
  );
  const businessOptions = useMemo(
    () =>
      Array.from(new Set(data.map((row) => row['Business Type']).filter(Boolean))).sort((a, b) =>
        prettifyBusinessType(a).localeCompare(prettifyBusinessType(b))
      ),
    [data]
  );
  const resolvedYearOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...yearOptions,
          normalizeText(filters.year) || String(defaultYear),
        ].filter(Boolean))
      ).sort((a, b) => Number(b) - Number(a)),
    [yearOptions, filters.year, defaultYear]
  );

  // ---------------- Build counts for chart ----------------
  const counts = {};
  filtered.forEach((d) => {
    const business = d['Business Type'] || 'Unknown';
    const report = d['Report Type'] || 'Unknown';
    const status = d['Report Status'];
    if (!counts[business]) counts[business] = {};
    if (!counts[business][report]) {
      counts[business][report] = { Match: 0, Mismatch: 0, 'No Data': 0 };
    }
    if (status === 'Match' || status === 'Mismatch' || status === 'No Data') {
      counts[business][report][status]++;
    }
  });

  const businessLabels = Object.keys(counts).sort();
  const onlyReportTypeLabels = [];
  const actualPairs = [];
  const businessGroupMeta = [];

  businessLabels.forEach((b, idx) => {
    const reportsForThisBusiness = Object.keys(counts[b]).sort();
    const startIdx = onlyReportTypeLabels.length;
    reportsForThisBusiness.forEach((r) => {
      onlyReportTypeLabels.push(r);
      actualPairs.push([b, r]);
    });
    const endIdx = onlyReportTypeLabels.length - 1;
    businessGroupMeta.push({
      business: prettifyBusinessType(b),
      start: startIdx,
      end: endIdx,
      bgColor: businessTypeBgColors[idx % businessTypeBgColors.length],
    });
  });

  const matchData = actualPairs.map(([b, r]) => counts[b][r]?.Match || 0);
  const mismatchData = actualPairs.map(([b, r]) => counts[b][r]?.Mismatch || 0);
  const noDataSeries = actualPairs.map(([b, r]) => counts[b][r]?.['No Data'] || 0);

  const chartData = {
    labels: onlyReportTypeLabels,
    datasets: [
      {
        label: 'Match',
        data: matchData,
        backgroundColor: '#4ade80',
        stack: 'stack1',
      },
      {
        label: 'Mismatch',
        data: mismatchData,
        backgroundColor: '#f87171',
        stack: 'stack1',
      },
      {
        label: 'No Data',
        data: noDataSeries,
        backgroundColor: '#fbbf24',
        stack: 'stack1',
      },
    ],
  };

  // Build Chart.js annotations (colored backgrounds + dividing lines)
  const annotations = {};
  businessGroupMeta.forEach((meta, idx) => {
    annotations[`bg${idx}`] = {
      type: 'box',
      yMin: meta.start - 0.5,
      yMax: meta.end + 0.5,
      xMin: 0,
      xMax: 'max',
      backgroundColor: meta.bgColor,
      borderWidth: 0,
      drawTime: 'beforeDatasetsDraw',
    };
    if (idx < businessGroupMeta.length - 1) {
      annotations[`divider${idx}`] = {
        type: 'line',
        yMin: meta.end + 0.5,
        yMax: meta.end + 0.5,
        borderColor: '#a1a1aa',
        borderWidth: 1.2,
        scaleID: 'y',
      };
    }
  });

  // ---------------- Prepare table rows (grouped) ----------------
  const allReportTypes = Array.from(
    new Set(filtered.map((row) => row['Report Type'] || ''))
  ).sort();

  const grouped = {};
  filtered.forEach((row) => {
    const key = [row.Year, row.Month, row['Business Type'], row['Distributor Code']].join('||');
    if (!grouped[key]) {
      grouped[key] = {
        Year: row.Year,
        Month: row.Month,
        BusinessTypeRaw: row['Business Type'],
        BusinessType: prettifyBusinessType(row['Business Type']),
        Distributor: row['Distributor Code'],
        DistributorName: '',
        reports: {},
      };
    }
    const nameFromRow = row['Distributor Name'];
    if (nameFromRow && nameFromRow.trim() !== '' && grouped[key].DistributorName.trim() === '') {
      grouped[key].DistributorName = nameFromRow.trim();
    }
    grouped[key].reports[row['Report Type']] = {
      status: row['Report Status'],
      pic: row.PIC,
      timestamp: row.Timestamp,
      remark: row.Remark,
    };
  });
  let tableRows = Object.values(grouped);

  // --- Apply search filter (Distributor Code or Distributor Name) ---
  if (searchTerm.trim() !== '') {
    const lower = searchTerm.toLowerCase();
    tableRows = tableRows.filter(
      (r) =>
        r.Distributor.toString().toLowerCase().includes(lower) ||
        (r.DistributorName || '').toLowerCase().includes(lower)
    );
  }

  // --- Apply sort if requested ---
  if (sortConfig.key) {
    tableRows.sort((a, b) => {
      const aVal = (a[sortConfig.key] || '').toString().toLowerCase();
      const bVal = (b[sortConfig.key] || '').toString().toLowerCase();
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Sort handler
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Toggle column visibility
  function handleToggleCol(col) {
    setVisibleCols((prev) => ({ ...prev, [col]: !prev[col] }));
  }

  const totalRows = tableRows.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);

  const paginatedRows = tableRows.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filters, sortConfig]);
  return (
    <>
      <MotionDiv
        className="p-6 space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <h1 className="text-2xl font-bold">Reconciliation Summary Report</h1>

        {/* ========================================= */}
        {/* 1) Filter “Card” Container (Selects Row)  */}
        {/* ========================================= */}
        <div className="bg-white p-4 rounded-lg shadow-md flex flex-wrap gap-4">
          {/* Month Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Month
            </label>
            <select
              className="block w-36 bg-gray-50 border border-gray-300 text-gray-700 text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 px-3 py-1.5"
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: e.target.value })}
            >
              <option value="">All Months</option>
              {MONTH_NAMES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Year</label>
            <select
              className="block w-24 bg-gray-50 border border-gray-300 text-gray-700 text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 px-3 py-1.5"
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: e.target.value })}
            >
              <option value="">All Years</option>
              {resolvedYearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
            <select
              className="block w-28 bg-gray-50 border border-gray-300 text-gray-700 text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 px-3 py-1.5"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All Status</option>
              <option value="Match">Match</option>
              <option value="Mismatch">Mismatch</option>
              <option value="No Data">No Data</option>
            </select>
          </div>

          {/* Report Type Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Report Type
            </label>
            <select
              className="block w-full bg-gray-50 border border-gray-300 text-gray-700 text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 px-3 py-1.5"
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            >
              <option value="">All Types</option>
              {reportTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Business Type Filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Business Type
            </label>
            <select
              className="block w-full bg-gray-50 border border-gray-300 text-gray-700 text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 px-3 py-1.5"
              value={filters.business}
              onChange={(e) => setFilters({ ...filters, business: e.target.value })}
            >
              <option value="">All Business Types</option>
              {businessOptions.map((b) => (
                <option key={b} value={b}>
                  {prettifyBusinessType(b)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(loading || loadError || (!loading && !loadError && data.length === 0)) && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              loadError
                ? 'border-red-200 bg-red-50 text-red-700'
                : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            {loading
              ? 'Loading reconciliation summary from Supabase...'
              : loadError || 'No reconciliation cells found for the selected period.'}
          </div>
        )}

        {/* =============================================================== */}
        {/* 2) Combined: Hide/Show Search, Search Input, + Chart/Table Toggle */}
        {/* =============================================================== */}
        <div className="flex items-center justify-between">
          {/* LEFT: Hide/Show Search & Search Bar (Table view only) */}
          <div className="flex items-center gap-4">
            {!viewMode && (
              <>
                <button
                  type="button"
                  onClick={() => setShowSearchBar((v) => !v)}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-1.5 rounded-md shadow-sm transition-colors duration-150"
                >
                  {showSearchBar ? <EyeOff size={16} /> : <Eye size={16} />}
                  {showSearchBar ? 'Hide Search' : 'Show Search'}
                </button>
                <AnimatePresence initial={false}>
                  {showSearchBar && (
                    <MotionDiv
                      key="search"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="relative"
                    >
                      <Search
                        size={18}
                        className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="text"
                        placeholder="Search Distributor code or name…"
                        className="pl-10 pr-2 py-1.5 w-64 bg-white border border-gray-300 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-colors duration-150"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </MotionDiv>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>

          {/* RIGHT: Show Columns + Toggle */}
          <div className="flex items-center gap-3">
            {/* Show Columns: only in Table View */}
            {!viewMode && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown((v) => !v)}
                  className="flex items-center gap-1 bg-white border border-gray-300 rounded-md px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 shadow transition"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Show Columns
                </button>
                {showDropdown && (
                  <div className="absolute left-0 z-50 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg p-2 space-y-1">
                    {Object.entries(visibleCols).map(([col, val]) => (
                      <label key={col} className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-gray-100">
                        <input
                          type="checkbox"
                          checked={val}
                          onChange={() => handleToggleCol(col)}
                          className="form-checkbox"
                        />
                        <span className="text-xs">
                          {col === 'BusinessType' ? 'Business Type'
                            : col === 'Distributor' ? 'Distributor Code'
                              : col === 'DistributorName' ? 'Distributor Name'
                                : col}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Chart/Table Toggle: always visible, always at the end/right */}
            <button
              type="button"
              onClick={() => setViewMode((v) => !v)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-1.5 rounded-md shadow-sm transition-colors duration-150"
            >
              {viewMode ? (
                <>
                  <Table size={18} className="inline-block mr-1" />
                  Table View
                </>
              ) : (
                <>
                  <BarChart2 size={18} className="inline-block mr-1" />
                  Chart View
                </>
              )}
            </button>
          </div>
        </div>



        {/* ================================================= */}
        {/* 3) Chart or Table Rendering */}
        {/* ================================================= */}
        <AnimatePresence mode="wait">
          {viewMode ? (
            <MotionDiv
              key="chart"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4 }}
              className="overflow-x-auto"
              style={{
                minHeight: 310,
                position: 'relative',
                width: '100%',
                minWidth: 0,
              }}
            >
              <Bar
                data={chartData}
                options={{
                  indexAxis: 'y',
                  responsive: true,
                  layout: {
                    padding: { right: CLASSIC_LABEL_WIDTH + 30 },
                  },
                  barThickness: 13,
                  plugins: {
                    annotation: { annotations },
                    businessGroupMeta,
                    legend: {
                      position: 'top',
                      labels: {
                        font: {
                          size: 11,
                          family: '"Inter","Segoe UI",Arial,sans-serif',
                          weight: 'normal',
                        },
                      },
                    },
                    title: {
                      display: true,
                      text: 'Status by Report Type (Grouped by Business)',
                      font: {
                        size: 12,
                        family: '"Inter","Segoe UI",Arial,sans-serif',
                        weight: 'normal',
                      },
                    },
                  },
                  scales: {
                    x: {
                      title: {
                        display: true,
                        text: 'Count',
                        font: {
                          size: 11,
                          family: '"Inter","Segoe UI",Arial,sans-serif',
                          weight: 'normal',
                        },
                      },
                      beginAtZero: true,
                      stacked: true,
                      ticks: {
                        font: {
                          size: 11,
                          family: '"Inter","Segoe UI",Arial,sans-serif',
                          weight: 'normal',
                        },
                      },
                    },
                    y: {
                      title: {
                        display: true,
                        text: 'Report Type',
                        font: {
                          size: 11,
                          family: '"Inter","Segoe UI",Arial,sans-serif',
                          weight: 'normal',
                        },
                      },
                      stacked: true,
                      ticks: {
                        callback: function (val) {
                          return this.getLabelForValue(val);
                        },
                        font: {
                          size: 11,
                          family: '"Inter","Segoe UI",Arial,sans-serif',
                          weight: 'normal',
                        },
                      },
                    },
                  },
                  maintainAspectRatio: false,
                }}
                plugins={[barStackValueLabelPlugin, businessGroupLabelPlugin]}
              />
            </MotionDiv>
          ) : (
            <MotionDiv
              key="table"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.4 }}
              className=""
            >
              <table className="w-full mt-1 border text-xs">
                <thead className="bg-gray-200 text-xs">
                  <tr>
                    {visibleCols.Year && <th className="px-3 py-2">Year</th>}
                    {visibleCols.Month && <th className="px-3 py-2">Month</th>}
                    {visibleCols.BusinessType && <th className="px-3 py-2">Business Type</th>}
                    {visibleCols.Distributor && (
                      <th
                        className="px-3 py-2 cursor-pointer select-none"
                        onClick={() => requestSort('Distributor')}
                      >
                        Distributor Code
                        {sortConfig.key === 'Distributor' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </th>
                    )}
                    {visibleCols.DistributorName && (
                      <th
                        className="px-3 py-2 cursor-pointer select-none"
                        onClick={() => requestSort('DistributorName')}
                      >
                        Distributor Name
                        {sortConfig.key === 'DistributorName' && (
                          <span className="ml-1">
                            {sortConfig.direction === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </th>
                    )}
                    {allReportTypes.map((report) =>
                      visibleCols[report] ? (
                        <th
                          key={report}
                          className="px-2 py-2 w-24"
                        //style={{ minWidth: 90, maxWidth: 90 }}
                        >
                          {report}
                        </th>
                      ) : null
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row, i) => (
                    <motion.tr
                      key={i}
                      className="border-t"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.01, duration: 0.3 }}
                      whileHover={{ scale: 1.000, backgroundColor: '#f1f5f9' }}
                    >
                      {visibleCols.Year && <td className="px-2 py-1 text-center">{row.Year}</td>}
                      {visibleCols.Month && <td className="px-2 py-1 text-center">{row.Month}</td>}
                      {visibleCols.BusinessType && (
                        <td className="px-2 py-1 text-center">{row.BusinessType}</td>
                      )}
                      {visibleCols.Distributor && (
                        <td className="px-2 py-1 text-center">{row.Distributor}</td>
                      )}
                      {visibleCols.DistributorName && (
                        <td className="px-2 py-1 text-left">{row.DistributorName || '—'}</td>
                      )}
                      {allReportTypes.map((report, colIdx) => {
                        if (!visibleCols[report]) return null;
                        const reportEntry = row.reports[report];
                        const status = reportEntry?.status;
                        const hasType = Boolean(reportEntry);

                        let cellClass = "w-24 px-2 py-1 text-center font-medium relative"; // note: relative for tooltip positioning
                        let display = "";

                        // Tooltip content preparation
                        let tooltip = null;
                        if (hasType && (status === "Match" || status === "Mismatch" || status === "No Data")) {
                          tooltip = (
                            <div
                              className={
                                "absolute top-full mt-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg p-3 z-50 whitespace-pre-line pointer-events-none opacity-0 group-hover:opacity-100 transition text-left " +
                                (colIdx >= allReportTypes.length - 2
                                  ? "right-0 left-auto translate-x-0"
                                  : "left-1/2 -translate-x-1/2")
                              }
                              style={{ minWidth: 220, whiteSpace: "pre-line" }}
                            >
                              <div><b>Report Type:</b> {report}</div>
                              <div>
                                <b>Status:</b>{' '}
                                <span className={status === "Match" ? "text-green-400 font-semibold" : status === "Mismatch" ? "text-red-400 font-semibold" : status === "No Data" ? "text-amber-300 font-semibold" : ""}>
                                  {status}
                                </span>
                              </div>
                              <div><b>User:</b> {reportEntry?.pic || '-'}</div>
                              <div><b>Last Update:</b> {reportEntry?.timestamp || '-'}</div>
                            </div>
                          );
                        }

                        if (!hasType) {
                          cellClass += " bg-gray-200 text-gray-400 italic";
                          display = "Not Applicable";
                        } else if (status === undefined || status === null || /^\s*$/.test(status) || status === "No Data") {
                          cellClass += " bg-yellow-100 text-yellow-700 italic group";
                          display = tooltip ? (
                            <div className="hover-tooltip relative group cursor-pointer">
                              No Data
                              {tooltip}
                            </div>
                          ) : "No Data";
                        } else if (status === "Match") {
                          cellClass += " bg-green-100 text-green-700 group";
                          display = (
                            <div className="hover-tooltip relative group cursor-pointer">
                              Match
                              {tooltip}
                            </div>
                          );
                        } else if (status === "Mismatch") {
                          cellClass += " bg-red-100 text-red-700 group";
                          display = (
                            <div className="hover-tooltip relative group cursor-pointer">
                              Mismatch
                              {tooltip}
                            </div>
                          );
                        } else {
                          display = status;
                        }

                        return (
                          <td
                            key={report}
                            className={cellClass}
                          //style={{ minWidth: 90, maxWidth: 90 }}
                          >
                            {display}
                          </td>
                        );
                      })}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {/* Pagination Controls */}
              <div className="flex justify-between items-center mt-4 flex-wrap gap-2">
                <div className="text-xs text-gray-600">
                  Showing {Math.min((currentPage - 1) * rowsPerPage + 1, totalRows)}-
                  {Math.min(currentPage * rowsPerPage, totalRows)} of {totalRows} results
                </div>

                <div className="flex items-center gap-3">
                  {/* Rows per page dropdown */}
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <label htmlFor="rowsPerPage">Rows per page:</label>
                    <select
                      id="rowsPerPage"
                      value={rowsPerPage}
                      onChange={(e) => {
                        setRowsPerPage(Number(e.target.value));
                        setCurrentPage(1); // Reset to page 1
                      }}
                      className="border text-xs px-1 py-0.5 rounded bg-white"
                    >
                      {[10, 20, 50].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>

                  {/* Pagination buttons */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-100 disabled:opacity-60"
                    >
                      Prev
                    </button>
                    {[...Array(totalPages)].map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentPage(idx + 1)}
                        className={`px-2 py-1 text-xs rounded border ${currentPage === idx + 1
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white hover:bg-gray-100'
                          }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2 py-1 text-xs rounded border bg-white hover:bg-gray-100 disabled:opacity-60"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>

            </MotionDiv>
          )}
        </AnimatePresence>
      </MotionDiv>
    </>
  );
}

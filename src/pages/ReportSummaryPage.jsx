import React, { useEffect, useState, useRef } from 'react';
import DashboardLayout from '../components/DashboardLayout';
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

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
  // ---- Default filters to “previous month” of current year ----
  const currentDate = new Date();
  let defaultMonthIdx = currentDate.getMonth() - 1;
  let defaultYear = currentDate.getFullYear();
  if (defaultMonthIdx < 0) {
    defaultMonthIdx = 11;
    defaultYear = defaultYear - 1;
  }
  const monthNames = [
    'January','February','March','April','May','June','July',
    'August','September','October','November','December',
  ];

  // ---- Main state hooks ----
  const [data, setData] = useState([]);
  const [filters, setFilters] = useState({
    month: monthNames[defaultMonthIdx],
    year: defaultYear.toString(),
    status: '',
    type: '',
    business: '',
  });
  const [viewMode, setViewMode] = useState(true); // true = Chart, false = Table

  // ---- Column visibility state ----
  const [visibleCols, setVisibleCols] = useState({
    Year: true,
    Month: true,
    BusinessType: true,
    Distributor: true,
    DistributorName: true,
    // Report types will be added dynamically after data loads
  });

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
  const pageSize = 10; // You can make this configurable if you want

  // ---------------- Fetch data ----------------
  useEffect(() => {
    fetch(
      'https://script.google.com/macros/s/AKfycbwDPtUd-pz85z8SJOPfHI0tJAr2LsJtFs_EH9w62-FJ6GZ_Fcxl31jle6eUWj8EQWxG/exec'
    )
      .then((res) => res.json())
      .then((rows) => {
        setData(rows);
        // Dynamically add each Report Type to visibleCols
        const allReportTypes = Array.from(new Set(rows.map((row) => row['Report Type'] || ''))).sort();
        setVisibleCols((prev) => {
          const updated = { ...prev };
          allReportTypes.forEach((r) => {
            if (!(r in updated)) updated[r] = true;
          });
          return updated;
        });
      });
  }, []);

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

  // ---------------- Build counts for chart ----------------
  const counts = {};
  filtered.forEach((d) => {
    const business = d['Business Type'] || 'Unknown';
    const report = d['Report Type'] || 'Unknown';
    const status = d['Report Status'];
    if (!counts[business]) counts[business] = {};
    if (!counts[business][report]) {
      counts[business][report] = { Match: 0, Mismatch: 0 };
    }
    if (status === 'Match' || status === 'Mismatch') {
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
    // Store all report statuses as raw value (could be "", null, etc.)
    grouped[key].reports[row['Report Type']] = row['Report Status'];
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
    // Helper for rendering status cell
  function getStatusCell(status, hasType) {
    if (!hasType) return <span className="text-gray-400 italic">Not Applicable</span>;
    if (status === undefined || status === null || /^\s*$/.test(status)) {
      // If the report type exists for this distributor but status is blank/null/empty
      return <span className="text-yellow-500 italic">No Data</span>;
    }
    return status;
  }

  const totalRows = tableRows.length;
  const totalPages = Math.ceil(totalRows / pageSize);

  const paginatedRows = tableRows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  useEffect(() => { setCurrentPage(1); }, [searchTerm, filters, sortConfig]);

  // Add this just above your component (or in your CSS)
const tooltipStyle = `
  .custom-tooltip {
    position: absolute;
    z-index: 40;
    background: #1e293b;
    color: white;
    font-size: 0.75rem;
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.16);
    min-width: 180px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.1s;
    left: 50%; top: 100%; transform: translateX(-50%) translateY(10px);
    white-space: pre-line;
  }
  .hover-tooltip:hover .custom-tooltip { opacity: 1; pointer-events: auto; }
`;


<style>{tooltipStyle}</style>
  return (
    <DashboardLayout>
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <h1 className="text-2xl font-bold">Report Summary</h1>

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
              {monthNames.map((m) => (
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
              {[2023, 2024, 2025].map((y) => (
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
              {[...new Set(data.map((d) => d['Report Type']))].map((type) => (
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
              {[...new Set(data.map((d) => d['Business Type']))].map((b) => (
                <option key={b} value={b}>
                  {prettifyBusinessType(b)}
                </option>
              ))}
            </select>
          </div>
        </div>

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
                  <motion.div
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
                  </motion.div>
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
            <motion.div
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
            </motion.div>
          ) : (
            <motion.div
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
                          style={{ minWidth: 90, maxWidth: 90 }}
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
                      {allReportTypes.map((report) => {
                        if (!visibleCols[report]) return null;
                        const status = row.reports[report];
                        const hasType = report in row.reports;

                        let cellClass = "w-24 px-2 py-1 text-center font-medium relative"; // note: relative for tooltip positioning
                        let display = "";

                        // Tooltip content preparation
                        let tooltip = null;
                        if (hasType && (status === "Match" || status === "Mismatch")) {
                          // Find the original row for more info
                          const detailRow = filtered.find(
                            d =>
                              d.Year === row.Year &&
                              d.Month === row.Month &&
                              d['Business Type'] === row.BusinessType && // might need .toLowerCase() fix
                              d['Distributor Code'] === row.Distributor &&
                              d['Report Type'] === report
                          );
                          tooltip = (
                            <div className="custom-tooltip absolute left-1/2 top-full mt-2 transform -translate-x-1/2 bg-slate-800 text-white text-xs rounded-lg shadow-lg p-3 z-50 whitespace-pre-line pointer-events-none opacity-0 group-hover:opacity-100 transition text-left"
                              style={{ minWidth: 220, whiteSpace: "pre-line" }}
                            >
                              <div><b>Report Type:</b> {report}</div>
                              <div>
                                <b>Status:</b>{' '}
                                <span className={status === "Match" ? "text-green-400 font-semibold" : status === "Mismatch" ? "text-red-400 font-semibold" : ""}>
                                  {status}
                                </span>
                              </div>
                              <div><b>User:</b> {detailRow?.PIC || '-'}</div>
                              <div><b>Last Update:</b> {detailRow?.Timestamp || '-'}</div>
                            </div>
                          );
                        }

                        if (!hasType) {
                          cellClass += " bg-gray-200 text-gray-400 italic";
                          display = "Not Applicable";
                        } else if (status === undefined || status === null || /^\s*$/.test(status)) {
                          cellClass += " bg-yellow-100 text-yellow-700 italic";
                          display = "No Data";
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
                            style={{ minWidth: 90, maxWidth: 90 }}
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
              <div className="flex justify-between items-center mt-4">
                <span className="text-xs text-gray-600">
                  Showing {Math.min((currentPage - 1) * pageSize + 1, totalRows)}-
                  {Math.min(currentPage * pageSize, totalRows)} of {totalRows} results
                </span>
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
                      className={`px-2 py-1 text-xs rounded border ${
                        currentPage === idx + 1
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
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </DashboardLayout>
  );
}
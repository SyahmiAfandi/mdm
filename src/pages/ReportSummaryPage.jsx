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
import { BarChart2, Table } from 'lucide-react';
import annotationPlugin from 'chartjs-plugin-annotation';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

const businessTypeBgColors = [
  'rgba(253,230,138,0.5)',
  'rgba(59,130,246,0.12)',
  'rgba(196,181,253,0.5)',
  'rgba(187,247,208,0.5)',
  'rgba(254,249,195,0.5)',
];

const CLASSIC_LABEL_WIDTH = 100;

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
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 1.1;
      const r = 8;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + boxWidth - r, y);
      ctx.quadraticCurveTo(x + boxWidth, y, x + boxWidth, y + r);
      ctx.lineTo(x + boxWidth, y + boxHeight - r);
      ctx.quadraticCurveTo(x + boxWidth, y + boxHeight, x + boxWidth - r, y + boxHeight);
      ctx.lineTo(x + r, y + boxHeight);
      ctx.quadraticCurveTo(x, y + boxHeight, x, y + boxHeight - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2563eb';
      ctx.font = '11px "Inter", "Segoe UI", Arial, sans-serif';
      ctx.fillText(text, x + boxWidth / 2, yCenter + 1);
      ctx.restore();
    });
  },
};
ChartJS.register(businessGroupLabelPlugin);

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
        let tx = width > 14 ? (base + x) / 2 : Math.max(x, base) + 6;
        let ty = y;
        ctx.fillText(txt, tx, ty);
      });
    });
    ctx.restore();
  }
};
ChartJS.register(barStackValueLabelPlugin);

function prettifyBusinessType(b) {
  if (!b) return '';
  return b.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function ReportSummaryPage() {
  // ---- Filter defaults to previous month of current year ----
  const currentDate = new Date();
  let defaultMonthIdx = currentDate.getMonth() - 1;
  let defaultYear = currentDate.getFullYear();
  if (defaultMonthIdx < 0) {
    defaultMonthIdx = 11;
    defaultYear = defaultYear - 1;
  }
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const [data, setData] = useState([]);
  const [filters, setFilters] = useState({
    month: monthNames[defaultMonthIdx],
    year: defaultYear.toString(),
    status: '',
    type: '',
    business: '',
  });
  const [viewMode, setViewMode] = useState(true);

  // -------- COLUMN VISIBILITY STATE ---------
  const [visibleCols, setVisibleCols] = useState({
    Year: true,
    Month: true,
    BusinessType: true,
    Distributor: true,
    DistributorName: true,
    // Report types will be added dynamically after data is loaded
  });

  useEffect(() => {
    fetch(
      'https://script.google.com/macros/s/AKfycbwDPtUd-pz85z8SJOPfHI0tJAr2LsJtFs_EH9w62-FJ6GZ_Fcxl31jle6eUWj8EQWxG/exec'
    )
      .then((res) => res.json())
      .then((rows) => {
        setData(rows);
        // Setup report type columns as visible by default
        const allReportTypes = Array.from(new Set(rows.map(row => row['Report Type'] || ''))).sort();
        setVisibleCols((prev) => {
          const updated = { ...prev };
          allReportTypes.forEach(r => {
            if (!(r in updated)) updated[r] = true;
          });
          return updated;
        });
      });
  }, []);

  const filtered = data.filter((row) => {
    return (
      (!filters.month || row.Month === filters.month) &&
      (!filters.year || row.Year?.toString() === filters.year) &&
      (!filters.status || row['Report Status'] === filters.status) &&
      (!filters.type || row['Report Type'] === filters.type) &&
      (!filters.business || row['Business Type'] === filters.business)
    );
  });

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

  const matchData = actualPairs.map(
    ([b, r]) => counts[b][r]?.Match || 0
  );
  const mismatchData = actualPairs.map(
    ([b, r]) => counts[b][r]?.Mismatch || 0
  );

  const chartData = {
    labels: onlyReportTypeLabels,
    datasets: [
      {
        label: 'Match',
        data: matchData,
        backgroundColor: '#4ade80',
        stack: 'stack1'
      },
      {
        label: 'Mismatch',
        data: mismatchData,
        backgroundColor: '#f87171',
        stack: 'stack1'
      },
    ],
  };

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
      drawTime: 'beforeDatasetsDraw'
    };
    if (idx < businessGroupMeta.length - 1) {
      annotations[`divider${idx}`] = {
        type: 'line',
        yMin: meta.end + 0.5,
        yMax: meta.end + 0.5,
        borderColor: '#a1a1aa',
        borderWidth: 1.2,
        scaleID: 'y'
      };
    }
  });

  // --------- TABLE VIEW LOGIC --------------
  const allReportTypes = Array.from(new Set(filtered.map(row => row['Report Type'] || ''))).sort();

  function handleToggleCol(col) {
    setVisibleCols(prev => ({ ...prev, [col]: !prev[col] }));
  }

  // ---- COLUMN CHECKBOXES DROPDOWN ----
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef();

  useEffect(() => {
    if (!showDropdown) return;
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Report Summary</h1>
        {/* Filters + Toggle + Show Columns */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex flex-wrap gap-2">
            {/* Month Filter */}
            <select
              className="border px-3 py-1.5 rounded-md text-sm shadow-sm focus:ring-2 focus:ring-blue-400"
              value={filters.month}
              onChange={(e) =>
                setFilters({ ...filters, month: e.target.value })
              }
            >
              <option value="">All Months</option>
              {monthNames.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {/* Year Filter */}
            <select
              className="border px-3 py-1.5 rounded-md text-sm shadow-sm focus:ring-2 focus:ring-blue-400"
              value={filters.year}
              onChange={(e) =>
                setFilters({ ...filters, year: e.target.value })
              }
            >
              <option value="">All Years</option>
              {[2023, 2024, 2025].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            {/* Status Filter */}
            <select
              className="border px-3 py-1.5 rounded-md text-sm shadow-sm focus:ring-2 focus:ring-blue-400"
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
            >
              <option value="">All Status</option>
              <option value="Match">Match</option>
              <option value="Mismatch">Mismatch</option>
            </select>
            {/* Report Type Filter */}
            <select
              className="border px-3 py-1.5 rounded-md text-sm shadow-sm focus:ring-2 focus:ring-blue-400"
              value={filters.type}
              onChange={(e) =>
                setFilters({ ...filters, type: e.target.value })
              }
            >
              <option value="">All Types</option>
              {[...new Set(data.map((d) => d['Report Type']))].map(
                (type) => (
                  <option key={type} value={type}>{type}</option>
                )
              )}
            </select>
            {/* Business Type Filter */}
            <select
              className="border px-3 py-1.5 rounded-md text-sm shadow-sm focus:ring-2 focus:ring-blue-400"
              value={filters.business}
              onChange={(e) =>
                setFilters({ ...filters, business: e.target.value })
              }
            >
              <option value="">All Business Types</option>
              {[...new Set(data.map((d) => d['Business Type']))].map(
                (b) => (
                  <option key={b} value={b}>{prettifyBusinessType(b)}</option>
                )
              )}
            </select>
          </div>
          {/* Show Columns & Toggle between Chart / Table View */}
          <div className="flex items-center gap-3">
            {!viewMode && ( // <-- Show only when in Table view
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDropdown((v) => !v)}
                className="px-3 py-1.5 bg-gray-100 rounded border text-sm font-medium shadow-sm hover:bg-gray-200"
              >
                Show Columns
              </button>
              {showDropdown && (
                <div
                  ref={dropdownRef}
                  className="absolute z-30 bg-white border rounded shadow-lg p-3 mt-2 left-0 min-w-[200px]"
                  style={{ maxHeight: 270, overflowY: 'auto' }}
                >
                  <div className="font-semibold text-xs text-gray-500 mb-1">Toggle columns</div>
                  {['Year','Month','BusinessType','Distributor','DistributorName',...allReportTypes].map(col => (
                    <label key={col} className="flex items-center gap-1 text-xs py-0.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleCols[col] !== false}
                        onChange={() => handleToggleCol(col)}
                      />
                      {col === 'BusinessType'
                        ? 'Business Type'
                        : col}
                    </label>
                  ))}
                </div>
              )}
            </div>
            )}
            {/* Toggle Button */}
            <label
              htmlFor="viewToggle"
              className="relative inline-block w-10 h-6 cursor-pointer"
            >
              <input
                type="checkbox"
                id="viewToggle"
                className="sr-only"
                checked={viewMode}
                onChange={() => setViewMode(!viewMode)}
              />
              <div className="absolute inset-0 bg-blue-500 rounded-full transition duration-300 w-10 h-6"></div>
              <div
                className={`dot absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white flex items-center justify-center transition-transform duration-300 ease-in-out ${
                  viewMode ? 'translate-x-0' : 'translate-x-4'
                }`}
              >
                {viewMode ? (
                  <BarChart2 size={16} className="text-blue-500" />
                ) : (
                  <Table size={16} className="text-blue-500" />
                )}
              </div>
            </label>
            <span className="text-sm text-gray-700 font-medium">
              {viewMode ? 'Chart View' : 'Table View'}
            </span>
          </div>
        </div>
        {/* Chart or Table */}
        {viewMode ? (
          <div
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
                      font: { size: 11, family: '"Inter","Segoe UI",Arial,sans-serif', weight: 'normal' }
                    }
                  },
                  title: {
                    display: true,
                    text: 'Status by Report Type (Grouped by Business)',
                    font: { size: 12, family: '"Inter","Segoe UI",Arial,sans-serif', weight: 'normal' }
                  },
                },
                scales: {
                  x: {
                    title: { display: true, text: 'Count', font: { size: 11, family: '"Inter","Segoe UI",Arial,sans-serif', weight: 'normal' } },
                    beginAtZero: true,
                    stacked: true,
                    ticks: { font: { size: 11, family: '"Inter","Segoe UI",Arial,sans-serif', weight: 'normal' } }
                  },
                  y: {
                    title: { display: true, text: 'Report Type', font: { size: 11, family: '"Inter","Segoe UI",Arial,sans-serif', weight: 'normal' } },
                    stacked: true,
                    ticks: {
                      callback: function (val, idx) {
                        return this.getLabelForValue(val);
                      },
                      font: { size: 11, family: '"Inter","Segoe UI",Arial,sans-serif', weight: 'normal' }
                    },
                  },
                },
                maintainAspectRatio: false,
              }}
              plugins={[barStackValueLabelPlugin, businessGroupLabelPlugin]}
            />
          </div>
        ) : (
          // ---------- TABLE VIEW START ----------
          <div className="overflow-x-auto">
            {/* ---- COLUMN CHECKBOXES ---- */}
            {/* Already included in top bar */}
            {/* ---- TABLE ---- */}
            {(() => {
              // Group rows by unique (Year, Month, Business Type, Distributor)
              const grouped = {};
              filtered.forEach(row => {
                const key = [
                  row.Year,
                  row.Month,
                  row['Business Type'],
                  row['Distributor Code']
                ].join('||');

                // Initialize group if not exists
                if (!grouped[key]) {
                  grouped[key] = {
                    Year: row.Year,
                    Month: row.Month,
                    BusinessType: prettifyBusinessType(row['Business Type']),
                    Distributor: row['Distributor Code'],
                    DistributorName: '', // start empty
                    reports: {},
                  };
                }

                // ✅ Always prefer non-empty name values
                const nameFromRow = row['Distributor Name'];
                if (nameFromRow && nameFromRow.trim() !== '' && grouped[key].DistributorName.trim() === '') {
                  grouped[key].DistributorName = nameFromRow.trim();
                }

                // Always record the report-status into that bucket’s reports object:
                grouped[key].reports[row['Report Type']] = row['Report Status'];
              });

              console.log('Grouped result:', grouped);
              
              const tableRows = Object.values(grouped);

              return (
                <table className="min-w-fit mt-4 border text-xs">
                  <thead className="bg-gray-200 text-xs">
                    <tr>
                      {visibleCols.Year && <th className="px-3 py-2">Year</th>}
                      {visibleCols.Month && <th className="px-3 py-2">Month</th>}
                      {visibleCols.BusinessType && <th className="px-3 py-2">Business Type</th>}
                      {visibleCols.Distributor && <th className="px-3 py-2">Distributor</th>}
                      {visibleCols.DistributorName && <th className="px-3 py-2">Distributor Name</th>}
                      {allReportTypes.map(report => (
                        visibleCols[report] &&
                        <th
                          key={report}
                          className="px-2 py-2 w-24"
                          style={{ minWidth: 90, maxWidth: 90 }}
                        >
                          {report}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row, i) => (
                      <tr key={i} className="border-t">
                        {visibleCols.Year && <td className="px-2 py-1 text-center">{row.Year}</td>}
                        {visibleCols.Month && <td className="px-2 py-1 text-center">{row.Month}</td>}
                        {visibleCols.BusinessType && <td className="px-2 py-1 text-center">{row.BusinessType}</td>}
                        {visibleCols.Distributor && <td className="px-2 py-1 text-center">{row.Distributor}</td>}
                        {visibleCols.DistributorName && (
                          <td className="px-2 py-1 text-left">
                            {row.DistributorName || '—'}            {/* show a dash or “N/A” if still blank */}
                          </td>
                        )}
                        {allReportTypes.map(report => {
                          if (!visibleCols[report]) return null;
                          const status = row.reports[report];
                          return (
                            <td
                              key={report}
                              className={
                                "w-24 px-2 py-1 text-center font-medium " +
                                (status === 'Match'
                                  ? 'bg-green-100 text-green-700'
                                  : status === 'Mismatch'
                                  ? 'bg-red-100 text-red-700'
                                  : '')
                              }
                              style={{ minWidth: 90, maxWidth: 90 }}
                            >
                              {status || ''}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
          // ---------- TABLE VIEW END ----------
        )}
      </div>
    </DashboardLayout>
  );
}

export default ReportSummaryPage;

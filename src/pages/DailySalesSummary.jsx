import React, { useEffect, useMemo, useRef, useState } from "react";
import { CSVLink } from "react-csv";
import toast, { Toaster } from "react-hot-toast";
import { Download, SlidersHorizontal } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import { APP_FULL_NAME } from '../config';

const REPORT_URL = import.meta.env.VITE_GAS_REPORT_URL;
/** Fixed widths (px) — keep CSS in sync if you style sticky cols */
const CODE_COL_WIDTH = 100;   // Distributor Code
const NAME_COL_WIDTH = 150;   // Distributor Name
const OTHER_COL_WIDTH = 110;  // All other columns incl. variance

const GROUP_ORDER = [
  "Sales Qty CS",
  "Sale Qty PC",
  "Free Total Qty",
  "GSV Amount",
  "NIV Total",
  "Sales Turn Over",
];

const META_KEYS = ["Year", "Month", "Business Type"];

const toNum = (v) => {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function detectNivPair(headers) {
  const keys = headers;
  const exactOsdp =
    keys.find((k) => k.toLowerCase() === "niv total osdp") ??
    keys.find((k) => k.toLowerCase() === "niv_total_osdp");
  const exactCsdp =
    keys.find((k) => k.toLowerCase() === "niv total csdp") ??
    keys.find((k) => k.toLowerCase() === "niv_total_csdp");

  const osdp =
    exactOsdp ??
    keys.find((k) => /(^|\s|_)?niv(\s|_).*osdp/i.test(k)) ??
    keys.find((k) => /osdp/i.test(k) && /niv/i.test(k));

  const csdp =
    exactCsdp ??
    keys.find((k) => /(^|\s|_)?niv(\s|_).*csdp/i.test(k)) ??
    keys.find((k) => /csdp/i.test(k) && /niv/i.test(k));

  return { osdp, csdp };
}

function findPairByWords(headers, words) {
  const hasAll = (k, extra) =>
    words.every((w) => new RegExp(w, "i").test(k)) && new RegExp(extra, "i").test(k);
  let osdp = headers.find((k) => hasAll(k, "osdp"));
  let csdp = headers.find((k) => hasAll(k, "csdp"));
  if (!osdp) osdp = headers.find((k) => words.every((w) => new RegExp(w, "i").test(k)) && /osdp/i.test(k));
  if (!csdp) csdp = headers.find((k) => words.every((w) => new RegExp(w, "i").test(k)) && /csdp/i.test(k));
  return { osdp, csdp };
}

export default function DailySalesSummary() {
  const [data, setData] = useState([]);
  const [augmentedData, setAugmentedData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [date, setDate] = useState("");

  const [years, setYears] = useState([]);
  const [months, setMonths] = useState([]);
  const [businessList, setBusinessList] = useState([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState("");

  const COMPULSORY_KEYS = ["Distributor Code", "Distributor Name"];
  const [visibleCols, setVisibleCols] = useState(new Set(COMPULSORY_KEYS));
  const [columnsPanelOpen, setColumnsPanelOpen] = useState(false);

  // groupMap[label] = { osdp, csdp, varianceKey }
  const [groupMap, setGroupMap] = useState({});

  const nivCheckboxRef = useRef(null);
  const selectAllRef = useRef(null);

  // under other useState
  const [dtFilter, setDtFilter] = useState("");
  const [dtFilterField, setDtFilterField] = useState("both"); // "both" | "code" | "name"


  useEffect(() => {
    setLoading(true);
    fetch(REPORT_URL)
      .then((res) => res.json())
      .then((res) => {
        const rawData = res.data || res;
        setData(rawData || []);
        const yearsList = Array.from(new Set(rawData.map((r) => r.Year))).filter(Boolean);
        const monthsList = Array.from(new Set(rawData.map((r) => r.Month))).filter(Boolean);
        const bizList = Array.from(new Set(rawData.map((r) => r["Business Type"]))).filter(Boolean);

        setYears(yearsList);
        setMonths(monthsList);
        setBusinessList(bizList);
        setSelectedYear(yearsList[yearsList.length - 1] || "");
        setSelectedMonth(monthsList[0] || "");
        setSelectedBusiness(bizList[0] || "");
        setDate(res.date || new Date().toLocaleDateString());
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load report.");
        setLoading(false);
      });
  }, []);

  // Build groups & add variance (CSDP - OSDP) for each detected group
  useEffect(() => {
    if (!data?.length) {
      setAugmentedData([]);
      setGroupMap({});
      return;
    }
    const headers = Object.keys(data[0]);

    const groupsToDetect = [
      { label: "NIV Total", detector: () => detectNivPair(headers) },
      { label: "Sales Qty CS", detector: () => findPairByWords(headers, ["sales", "qty", "cs"]) },
      { label: "Sale Qty PC", detector: () => findPairByWords(headers, ["sale|sales", "qty", "pc"]) },
      { label: "Free Total Qty", detector: () => findPairByWords(headers, ["free", "total", "qty"]) },
      { label: "GSV Amount", detector: () => findPairByWords(headers, ["gsv", "amount|amt"]) },
      { label: "Sales Turn Over", detector: () => findPairByWords(headers, ["sales", "turn|turnover|turn-over"]) },
    ];

    const map = {};
    let augmented = [...data];

    groupsToDetect.forEach(({ label, detector }) => {
      let { osdp, csdp } = detector();
      if (!osdp || !csdp) {
        const normalize = (w) => w.split("|")[0];
        const words =
          label === "Sales Qty CS" ? ["sales", "qty", "cs"]
          : label === "Sale Qty PC" ? ["sales", "qty", "pc"]
          : label === "Free Total Qty" ? ["free", "total", "qty"]
          : label === "GSV Amount" ? ["gsv", "amount"]
          : label === "Sales Turn Over" ? ["sales", "turn"]
          : ["niv"];
        ({ osdp, csdp } = findPairByWords(headers, words.map(normalize)));
      }
      if (osdp && csdp) {
        const varianceKey = `Variance ${label}`;
        augmented = augmented.map((row) => ({
          ...row,
          [varianceKey]: toNum(row[csdp]) - toNum(row[osdp]),
        }));
        map[label] = { osdp, csdp, varianceKey };
      }
    });

    setGroupMap(map);
    setAugmentedData(augmented);

    // default visible: compulsory + NIV Total if available
    setVisibleCols((prev) => {
      const next = new Set(prev);
      next.add("Distributor Code");
      next.add("Distributor Name");
      if (map["NIV Total"]) {
        next.add(map["NIV Total"].csdp);
        next.add(map["NIV Total"].osdp);
        next.add(map["NIV Total"].varianceKey);
      }
      return next;
    });
  }, [data]);

  // Apply filters
  useEffect(() => {
    let filtered = augmentedData;
    if (selectedYear)   filtered = filtered.filter((row) => row.Year === selectedYear);
    if (selectedMonth)  filtered = filtered.filter((row) => row.Month === selectedMonth);
    if (selectedBusiness) filtered = filtered.filter((row) => row["Business Type"] === selectedBusiness);

    // NEW: DT Code/Name filter
    if (dtFilter.trim()) {
      const q = dtFilter.trim().toLowerCase();
      filtered = filtered.filter((row) => {
        const code = String(row["Distributor Code"] ?? "").toLowerCase();
        const name = String(row["Distributor Name"] ?? "").toLowerCase();
        if (dtFilterField === "code") return code.includes(q);
        if (dtFilterField === "name") return name.includes(q);
        return code.includes(q) || name.includes(q); // both
      });
    }
    setFilteredData(filtered);
  }, [augmentedData, selectedYear, selectedMonth, selectedBusiness, dtFilter, dtFilterField]);

  // All headers
  const allHeaders = useMemo(() => {
    if (!filteredData.length && !augmentedData.length) return [];
    const row = (filteredData[0] || augmentedData[0]) ?? {};
    return Object.keys(row);
  }, [filteredData, augmentedData]);

  // groupedKeys[label] = [CSDP, OSDP, VAR] in the order we render
  const groupedKeys = useMemo(() => {
    const out = {};
    Object.entries(groupMap).forEach(([label, { osdp, csdp, varianceKey }]) => {
      out[label] = [csdp, osdp, varianceKey];
    });
    return out;
  }, [groupMap]);

  // Optional non-grouped (meta removed)
  const allGroupControlled = useMemo(() => Object.values(groupedKeys).flat(), [groupedKeys]);
  const optionalColumns = useMemo(() => {
    const exclude = new Set([...COMPULSORY_KEYS, ...allGroupControlled, ...META_KEYS]);
    return allHeaders.filter((k) => !exclude.has(k));
  }, [allHeaders, allGroupControlled]);

  // Ordered visible headers:
  const orderedVisibleHeaders = useMemo(() => {
    const essentials = ["Distributor Code", "Distributor Name"];
    const result = [];
    essentials.forEach((k) => visibleCols.has(k) && result.push(k));
    GROUP_ORDER.forEach((label) => {
      const keys = groupedKeys[label] || [];
      keys.forEach((k) => visibleCols.has(k) && result.push(k));
    });
    allHeaders.forEach((k) => {
      if (!visibleCols.has(k)) return;
      if (result.includes(k)) return;
      if (META_KEYS.includes(k)) return;
      result.push(k);
    });
    return result;
  }, [visibleCols, groupedKeys, allHeaders]);

  // CSV headers
  const csvHeaders = useMemo(
    () =>
      orderedVisibleHeaders.map((key) => ({
        label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        key,
      })),
    [orderedVisibleHeaders]
  );

  const distributorIdx = orderedVisibleHeaders.findIndex((k) => k === "Distributor Code");
  const distributorNameIdx = orderedVisibleHeaders.findIndex((k) => k === "Distributor Name");

  // Fixed widths — header + cell (+ left offsets for sticky)
  const headerStyleForIndex = (idx) => {
    if (idx === distributorIdx) {
      return { minWidth: CODE_COL_WIDTH, width: CODE_COL_WIDTH, left: 0 };
    }
    if (idx === distributorNameIdx) {
      return { minWidth: NAME_COL_WIDTH, width: NAME_COL_WIDTH, left: CODE_COL_WIDTH };
    }
    return { minWidth: OTHER_COL_WIDTH, width: OTHER_COL_WIDTH };
  };
  const cellStyleForIndex = headerStyleForIndex;

  // Variance coloring — now **background** like Excel
  const varianceSet = useMemo(() => new Set(Object.values(groupMap).map((g) => g.varianceKey)), [groupMap]);
  const isVarianceKey = (key) => varianceSet.has(key);
  const varianceBg = (val) =>
    toNum(val).toFixed(2) === "0.00"
      ? "bg-green-100 text-green-800 font-semibold"
      : "bg-red-100 text-red-800 font-semibold";

  // NIV checkbox indeterminate
  useEffect(() => {
    const keys = groupedKeys["NIV Total"] || [];
    if (!nivCheckboxRef.current) return;
    const present = keys.map((k) => visibleCols.has(k));
    nivCheckboxRef.current.indeterminate = present.some(Boolean) && !present.every(Boolean);
  }, [groupedKeys, visibleCols]);

  // --- Select All (master) ---
  const allToggleableKeys = useMemo(() => {
    const ks = [];
    GROUP_ORDER.forEach((label) => {
      const trio = groupedKeys[label] || [];
      ks.push(...trio);
    });
    ks.push(...optionalColumns);
    return ks;
  }, [groupedKeys, optionalColumns]);

  const allShown = useMemo(
    () => allToggleableKeys.length > 0 && allToggleableKeys.every((k) => visibleCols.has(k)),
    [allToggleableKeys, visibleCols]
  );
  const anyShown = useMemo(
    () => allToggleableKeys.some((k) => visibleCols.has(k)),
    [allToggleableKeys, visibleCols]
  );

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = anyShown && !allShown;
  }, [anyShown, allShown]);

  const toggleSelectAll = () => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (allShown) {
        allToggleableKeys.forEach((k) => next.delete(k));
      } else {
        allToggleableKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  // Toggles
  const toggleGroup = (label) => {
    const keys = groupedKeys[label] || [];
    if (!keys.length) return;
    setVisibleCols((prev) => {
      const next = new Set(prev);
      const showAll = !keys.every((k) => next.has(k));
      keys.forEach((k) => (showAll ? next.add(k) : next.delete(k)));
      return next;
    });
  };
  const toggleColumn = (key) => {
    if (COMPULSORY_KEYS.includes(key)) return;
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <DashboardLayout pageTitle={APP_FULL_NAME} breadcrumbs={["Reports", "Daily Sales Summary Report"]}>
      <Toaster position="top-right" />

      <div className="p-4 text-xs overflow-x-hidden min-w-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Daily Sales Summary Report</h2>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setColumnsPanelOpen((s) => !s)}
              className="flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50 text-xs"
              title="Show/Hide Columns"
            >
              <SlidersHorizontal size={14} />
              Columns
            </button>

            <CSVLink
              data={filteredData.map((row) => {
                const picked = {};
                orderedVisibleHeaders.forEach((k) => (picked[k] = row[k]));
                return picked;
              })}
              headers={csvHeaders}
              filename={`Daily_Sales_Summary_${date}.csv`}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
              onClick={() => toast.success("CSV Download Started")}
            >
              <Download size={14} /> Export CSV
            </CSVLink>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-3">
          <div className="bg-gray-50 p-2 rounded shadow flex flex-col min-w-[150px]">
            <label className="font-semibold text-gray-600 mb-1">Year</label>
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="border rounded px-2 py-1 text-xs">
              {years.map((y) => (<option key={y} value={y}>{y}</option>))}
            </select>
          </div>
          <div className="bg-gray-50 p-2 rounded shadow flex flex-col min-w-[150px]">
            <label className="font-semibold text-gray-600 mb-1">Month</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border rounded px-2 py-1 text-xs">
              {months.map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
          </div>
          <div className="bg-gray-50 p-2 rounded shadow flex flex-col min-w-[180px]">
            <label className="font-semibold text-gray-600 mb-1">Business Type</label>
            <select value={selectedBusiness} onChange={(e) => setSelectedBusiness(e.target.value)} className="border rounded px-2 py-1 text-xs">
              {businessList.map((b) => (<option key={b} value={b}>{b}</option>))}
            </select>
          </div>
          <div className="bg-gray-50 p-2 rounded shadow flex flex-col min-w-[220px]">
            <label className="font-semibold text-gray-600 mb-1">Distributor Filter</label>
            <div className="flex gap-2">
              <input
                value={dtFilter}
                onChange={(e) => setDtFilter(e.target.value)}
                className="border rounded px-2 py-1 text-xs flex-1"
                placeholder="Search code or name..."
              />
              <select
                value={dtFilterField}
                onChange={(e) => setDtFilterField(e.target.value)}
                className="border rounded px-2 py-1 text-xs"
                title="Filter field"
              >
                <option value="both">Both</option>
                <option value="code">Code</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>
        </div>

        {/* Columns panel */}
        {columnsPanelOpen && (
          <div className="mb-3 rounded border bg-white p-2 shadow-sm text-xs">
            <div className="mb-1 font-semibold">Choose columns to display</div>

            {/* Select All */}
            <label className="flex items-center gap-2 mb-2 font-medium text-gray-800">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="h-3 w-3"
                checked={allShown}
                onChange={toggleSelectAll}
              />
              Select all
            </label>

            <div className="grid md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-1 max-h-48 overflow-auto pr-1">
              {["Distributor Code", "Distributor Name"].map((k) => (
                <label key={k} className="flex items-center gap-1 text-gray-700 bg-gray-50 border rounded px-2 py-1 opacity-80 cursor-not-allowed" title="Compulsory column">
                  <input type="checkbox" checked readOnly disabled className="h-3 w-3" />
                  {k}
                </label>
              ))}
              {GROUP_ORDER.map((label) => {
                const g = groupMap[label];
                const keys = g ? [g.csdp, g.osdp, g.varianceKey] : [];
                const available = keys.length > 0;
                const checked = available && keys.every((k) => visibleCols.has(k));
                const disabled = !available;
                return (
                  <label
                    key={label}
                    className={`flex items-center gap-1 text-gray-700 border rounded px-2 py-1 ${
                      available ? "bg-gray-50 cursor-pointer" : "bg-gray-100 opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <input
                      ref={label === "NIV Total" ? nivCheckboxRef : undefined}
                      type="checkbox"
                      className="h-3 w-3"
                      disabled={disabled}
                      checked={checked}
                      onChange={() => toggleGroup(label)}
                    />
                    {label}
                  </label>
                );
              })}
              {/* Any other non-grouped columns (meta excluded) */}
              {optionalColumns.map((k) => (
                <label key={k} className="flex items-center gap-1 text-gray-700 bg-gray-50 border rounded px-2 py-1">
                  <input
                    type="checkbox"
                    className="h-3 w-3"
                    checked={visibleCols.has(k)}
                    onChange={() => toggleColumn(k)}
                  />
                  {k}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* TABLE: its own scroller; page won't widen */}
        <div className="rounded border border-gray-100 shadow-sm h-[70vh] w-full max-w-full overflow-auto min-w-0">
          <table className="w-max text-[11px] border-separate border-spacing-0">
            <thead>
              <tr>
                {orderedVisibleHeaders.map((key, idx) => {
                  const isCode = idx === distributorIdx;
                  const isName = idx === distributorNameIdx;
                  const align = !isCode && !isName ? "text-center" : "text-left";
                  const z = isCode ? 60 : isName ? 59 : 55;

                  return (
                    <th
                      key={key}
                      className={`px-1 py-1 border-b font-semibold whitespace-nowrap sticky top-0
                                  ${isCode ? "sticky-col" : ""} ${isName ? "sticky-col-2" : ""}
                                  ${align} bg-gray-100`}
                      style={{ ...headerStyleForIndex(idx), zIndex: z }}
                    >
                      {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={orderedVisibleHeaders.length} className="py-4 text-center text-gray-400 text-xs">
                    No sales data available.
                  </td>
                </tr>
              )}

              {filteredData.map((row, rIdx) => (
                <tr key={rIdx}>
                  {orderedVisibleHeaders.map((key, cIdx) => {
                    const isCode = cIdx === distributorIdx;
                    const isName = cIdx === distributorNameIdx;

                    const val = row[key];
                    const isVar = isVarianceKey(key);
                    const displayed = isVar && val != null ? toNum(val).toFixed(2) : row[key];

                    const alignCls = !isCode && !isName ? "text-center" : "text-left";
                    const baseTint = !isCode && !isName ? "bg-yellow-50" : "bg-white";
                    // variance cells override the base tint with Excel-like bg
                    const bgClass = isVar ? varianceBg(val) : baseTint;

                    const z = isCode ? 50 : isName ? 49 : "auto";

                    return (
                      <td
                        key={`${rIdx}-${key}`}
                        className={`px-1 py-1 border-b whitespace-nowrap text-[11px]
                                    ${isCode ? "sticky-col" : ""} ${isName ? "sticky-col-2" : ""}
                                    ${alignCls} ${bgClass}`}
                        style={{ ...cellStyleForIndex(cIdx), zIndex: z }}
                        title={String(row[key] ?? "")}
                      >
                        {displayed}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CSVLink } from "react-csv";
import { saveAs } from "file-saver";
import toast, { Toaster } from "react-hot-toast";
import {
  Download,
  SlidersHorizontal,
  BarChart3,
  Users,
  TrendingUp,
  TrendingDown,
  Calendar,
  Building2,
  Search,
  ChevronDown,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { APP_FULL_NAME } from "../config";
import { getBackendUrl } from "../config/backend";
import { supabase } from "../supabaseClient";

const DSS_TABLE = "daily_sales_summary_reports";

const CODE_COL_WIDTH = 100;
const NAME_COL_WIDTH = 160;
const OTHER_COL_WIDTH = 110;
const HEADER_GROUP_ROW_HEIGHT = 30;

const GROUP_ORDER = [
  "Sales Qty CS",
  "Sale Qty PC",
  "Free Total Qty",
  "GSV Amount",
  "NIV Total",
  "Sales Turn Over",
];

const GROUP_COLORS = {
  "Sales Qty CS":    { bg: "bg-sky-50",    header: "bg-sky-100 text-sky-700",    border: "border-sky-200" },
  "Sale Qty PC":     { bg: "bg-violet-50", header: "bg-violet-100 text-violet-700", border: "border-violet-200" },
  "Free Total Qty":  { bg: "bg-teal-50",   header: "bg-teal-100 text-teal-700",  border: "border-teal-200" },
  "GSV Amount":      { bg: "bg-amber-50",  header: "bg-amber-100 text-amber-700", border: "border-amber-200" },
  "NIV Total":       { bg: "bg-indigo-50", header: "bg-indigo-100 text-indigo-700", border: "border-indigo-200" },
  "Sales Turn Over": { bg: "bg-rose-50",   header: "bg-rose-100 text-rose-700",  border: "border-rose-200" },
};

const META_KEYS = ["Year", "Month", "Business Type"];
const MONTH_LABELS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const toNum = (v) => {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const fmt = (n) =>
  toNum(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function detectNivPair(headers) {
  const exactOsdp =
    headers.find((k) => k.toLowerCase() === "niv total osdp") ??
    headers.find((k) => k.toLowerCase() === "niv_total_osdp");
  const exactCsdp =
    headers.find((k) => k.toLowerCase() === "niv total csdp") ??
    headers.find((k) => k.toLowerCase() === "niv_total_csdp");
  const osdp =
    exactOsdp ??
    headers.find((k) => /(^\s|_)?niv(\s|_).*osdp/i.test(k)) ??
    headers.find((k) => /osdp/i.test(k) && /niv/i.test(k));
  const csdp =
    exactCsdp ??
    headers.find((k) => /(^\s|_)?niv(\s|_).*csdp/i.test(k)) ??
    headers.find((k) => /csdp/i.test(k) && /niv/i.test(k));
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

function monthLabelFromRow(row) {
  const rawMonth = Number(row?.month);
  if (Number.isFinite(rawMonth) && rawMonth >= 1 && rawMonth <= 12)
    return MONTH_LABELS[rawMonth - 1];
  return row?.month_label || "";
}

function mapDssRowToDisplayRecord(row) {
  return {
    Year: String(row?.year ?? ""),
    Month: monthLabelFromRow(row),
    "Business Type": row?.business_type || "",
    "Distributor Code": row?.distributor_code || "",
    "Distributor Name": row?.distributor_name || "",
    "CSDP Sales Qty CS": row?.csdp_sales_qty_cs ?? 0,
    "OSDP Sales Qty CS": row?.osdp_sales_qty_cs ?? 0,
    "CSDP Sale Qty PC": row?.csdp_sale_qty_pc ?? 0,
    "OSDP Sale Qty PC": row?.osdp_sale_qty_pc ?? 0,
    "CSDP Free Total Qty": row?.csdp_free_total_qty ?? 0,
    "OSDP Free Total Qty": row?.osdp_free_total_qty ?? 0,
    "CSDP GSV Amount": row?.csdp_gsv_amount ?? 0,
    "OSDP GSV Amount": row?.osdp_gsv_amount ?? 0,
    "CSDP NIV Total": row?.csdp_niv_total ?? 0,
    "OSDP NIV Total": row?.osdp_niv_total ?? 0,
    "CSDP Sales Turn Over": row?.csdp_sales_turn_over ?? 0,
    "OSDP Sales Turn Over": row?.osdp_sales_turn_over ?? 0,
  };
}

// ── Skeleton rows ────────────────────────────────────────────────────────────
function SkeletonRow({ cols }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-2 py-2 border-b border-gray-100">
          <div className="h-3 rounded bg-gray-200" style={{ width: i < 2 ? "80%" : "60%" }} />
        </td>
      ))}
    </tr>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className={`flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 min-w-[160px] flex-1`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
        <Icon size={17} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide leading-tight truncate">{label}</p>
        <p className="text-sm font-bold text-gray-800 leading-snug truncate">{value}</p>
        {sub && <p className="text-[10px] text-gray-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ── Select wrapper ───────────────────────────────────────────────────────────
function FilterSelect({ icon: Icon, label, value, onChange, options }) {
  return (
    <div className="relative flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 shadow-sm hover:border-indigo-300 transition-colors min-w-[130px]">
      {Icon && <Icon size={13} className="text-gray-400 shrink-0" />}
      <div className="flex flex-col min-w-0">
        <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide leading-none">{label}</span>
        <select
          value={value}
          onChange={onChange}
          className="text-xs font-semibold text-gray-700 bg-transparent border-none outline-none cursor-pointer pr-4 mt-0.5"
        >
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
      <ChevronDown size={11} className="text-gray-300 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function DailySalesSummary() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [augmentedData, setAugmentedData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [date, setDate] = useState("");
  const backendUrl = getBackendUrl();

  const [years, setYears] = useState([]);
  const [months, setMonths] = useState([]);
  const [businessList, setBusinessList] = useState([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState("");

  const COMPULSORY_KEYS = ["Distributor Code", "Distributor Name"];
  const [visibleCols, setVisibleCols] = useState(new Set(COMPULSORY_KEYS));
  const [columnsPanelOpen, setColumnsPanelOpen] = useState(false);
  const [groupMap, setGroupMap] = useState({});

  const nivCheckboxRef = useRef(null);
  const selectAllRef = useRef(null);

  const [dtFilter, setDtFilter] = useState("");
  const [dtFilterField, setDtFilterField] = useState("both");

  const requireBackend = () => {
    if (!backendUrl) {
      throw new Error("Backend URL not set. Please set Tunnel URL in Header.");
    }
    return backendUrl;
  };

  // ── Load data ──
  useEffect(() => {
    let mounted = true;
    async function loadReport() {
      setLoading(true);
      setError("");
      try {
        const { data: rows, error: fetchError } = await supabase
          .from(DSS_TABLE)
          .select("*")
          .order("year", { ascending: false })
          .order("month", { ascending: false })
          .order("distributor_code", { ascending: true });

        if (fetchError) throw fetchError;
        const rawData = (rows || []).map(mapDssRowToDisplayRecord);
        if (!mounted) return;

        const yearsList = Array.from(new Set(rawData.map((r) => r.Year))).filter(Boolean).sort((a, b) => Number(b) - Number(a));
        const monthsFound = new Set(rawData.map((r) => r.Month).filter(Boolean));
        const monthsList = MONTH_LABELS.filter((label) => monthsFound.has(label));
        const bizList = Array.from(new Set(rawData.map((r) => r["Business Type"]))).filter(Boolean).sort();
        const latestMonth = rawData[0]?.Month || monthsList[0] || "";
        const latestBusiness = rawData[0]?.["Business Type"] || bizList[0] || "";
        const latestUpdatedAt = (rows || []).map((r) => r?.updated_at).filter(Boolean).sort().at(-1);

        setData(rawData);
        setYears(yearsList);
        setMonths(monthsList);
        setBusinessList(bizList);
        setSelectedYear(yearsList[0] || "");
        setSelectedMonth(latestMonth);
        setSelectedBusiness(bizList.includes("HPC") ? "HPC" : latestBusiness);
        setDate(latestUpdatedAt ? new Date(latestUpdatedAt).toLocaleDateString() : new Date().toLocaleDateString());
      } catch (loadError) {
        if (!mounted) return;
        const message = String(loadError?.message || loadError || "");
        setError(
          message.toLowerCase().includes("daily_sales_summary_reports")
            ? "Daily Sales Summary table is not ready yet. Create the Supabase table first, then export from Reconciliation Summary."
            : "Failed to load Daily Sales Summary report."
        );
        setData([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadReport();
    return () => { mounted = false; };
  }, []);

  // ── Build groups & variance ──
  useEffect(() => {
    if (!data?.length) { setAugmentedData([]); setGroupMap({}); return; }
    const headers = Object.keys(data[0]);
    const groupsToDetect = [
      { label: "NIV Total",       detector: () => detectNivPair(headers) },
      { label: "Sales Qty CS",    detector: () => findPairByWords(headers, ["sales", "qty", "cs"]) },
      { label: "Sale Qty PC",     detector: () => findPairByWords(headers, ["sale|sales", "qty", "pc"]) },
      { label: "Free Total Qty",  detector: () => findPairByWords(headers, ["free", "total", "qty"]) },
      { label: "GSV Amount",      detector: () => findPairByWords(headers, ["gsv", "amount|amt"]) },
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
    const augmentedHeaders = Object.keys(augmented[0] || {});
    setVisibleCols(new Set(augmentedHeaders.filter((key) => !META_KEYS.includes(key))));
  }, [data]);

  // ── Apply filters ──
  useEffect(() => {
    let filtered = augmentedData;
    if (selectedYear)     filtered = filtered.filter((r) => r.Year === selectedYear);
    if (selectedMonth)    filtered = filtered.filter((r) => r.Month === selectedMonth);
    if (selectedBusiness) filtered = filtered.filter((r) => r["Business Type"] === selectedBusiness);
    if (dtFilter.trim()) {
      const q = dtFilter.trim().toLowerCase();
      filtered = filtered.filter((r) => {
        const code = String(r["Distributor Code"] ?? "").toLowerCase();
        const name = String(r["Distributor Name"] ?? "").toLowerCase();
        if (dtFilterField === "code") return code.includes(q);
        if (dtFilterField === "name") return name.includes(q);
        return code.includes(q) || name.includes(q);
      });
    }
    setFilteredData(filtered);
  }, [augmentedData, selectedYear, selectedMonth, selectedBusiness, dtFilter, dtFilterField]);

  const templateExportRows = useMemo(() => {
    let rows = augmentedData;
    if (selectedYear) rows = rows.filter((r) => r.Year === selectedYear);
    if (selectedMonth) rows = rows.filter((r) => r.Month === selectedMonth);
    if (selectedBusiness) rows = rows.filter((r) => r["Business Type"] === selectedBusiness);
    return rows;
  }, [augmentedData, selectedYear, selectedMonth, selectedBusiness]);

  // ── Headers ──
  const allHeaders = useMemo(() => {
    if (!filteredData.length && !augmentedData.length) return [];
    return Object.keys((filteredData[0] || augmentedData[0]) ?? {});
  }, [filteredData, augmentedData]);

  const groupedKeys = useMemo(() => {
    const out = {};
    Object.entries(groupMap).forEach(([label, { osdp, csdp, varianceKey }]) => {
      out[label] = [csdp, osdp, varianceKey];
    });
    return out;
  }, [groupMap]);

  const allGroupControlled = useMemo(() => Object.values(groupedKeys).flat(), [groupedKeys]);
  const optionalColumns = useMemo(() => {
    const exclude = new Set([...COMPULSORY_KEYS, ...allGroupControlled, ...META_KEYS]);
    return allHeaders.filter((k) => !exclude.has(k));
  }, [allHeaders, allGroupControlled]);

  const orderedVisibleHeaders = useMemo(() => {
    const essentials = ["Distributor Code", "Distributor Name"];
    const result = [];
    essentials.forEach((k) => visibleCols.has(k) && result.push(k));
    GROUP_ORDER.forEach((label) => {
      const keys = groupedKeys[label] || [];
      keys.forEach((k) => visibleCols.has(k) && result.push(k));
    });
    allHeaders.forEach((k) => {
      if (!visibleCols.has(k) || result.includes(k) || META_KEYS.includes(k)) return;
      result.push(k);
    });
    return result;
  }, [visibleCols, groupedKeys, allHeaders]);

  // ── CSV ──
  const csvHeaders = useMemo(
    () => orderedVisibleHeaders.map((key) => ({ label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), key })),
    [orderedVisibleHeaders]
  );

  // ── Column indices ──
  const distributorIdx = orderedVisibleHeaders.findIndex((k) => k === "Distributor Code");
  const distributorNameIdx = orderedVisibleHeaders.findIndex((k) => k === "Distributor Name");

  const headerStyleForIndex = (idx) => {
    if (idx === distributorIdx)     return { minWidth: CODE_COL_WIDTH, width: CODE_COL_WIDTH, left: 0 };
    if (idx === distributorNameIdx) return { minWidth: NAME_COL_WIDTH, width: NAME_COL_WIDTH, left: CODE_COL_WIDTH };
    return { minWidth: OTHER_COL_WIDTH, width: OTHER_COL_WIDTH };
  };

  // ── Variance ──
  const varianceSet = useMemo(() => new Set(Object.values(groupMap).map((g) => g.varianceKey)), [groupMap]);
  const isVarianceKey = (key) => varianceSet.has(key);

  // ── Group row for table header ──
  // Maps each visible column index → { label, span, isFirst } or null
  const groupSpans = useMemo(() => {
    const spans = [];
    let i = 0;
    while (i < orderedVisibleHeaders.length) {
      const key = orderedVisibleHeaders[i];
      // find which group this key belongs to
      const foundLabel = GROUP_ORDER.find((lbl) => {
        const g = groupedKeys[lbl];
        return g && g.includes(key);
      });
      if (foundLabel) {
        const groupCols = groupedKeys[foundLabel] || [];
        // count visible consecutive group cols starting here
        let span = 0;
        while (i + span < orderedVisibleHeaders.length && groupCols.includes(orderedVisibleHeaders[i + span])) {
          span++;
        }
        spans.push({ label: foundLabel, span, isGroup: true });
        i += span;
      } else {
        spans.push({ label: key === "Distributor Code" ? "Code" : key === "Distributor Name" ? "Distributor" : "", span: 1, isGroup: false });
        i++;
      }
    }
    return spans;
  }, [orderedVisibleHeaders, groupedKeys]);

  // ── Select All checkbox ──
  const allToggleableKeys = useMemo(() => {
    const ks = [];
    GROUP_ORDER.forEach((label) => ks.push(...(groupedKeys[label] || [])));
    ks.push(...optionalColumns);
    return ks;
  }, [groupedKeys, optionalColumns]);

  const allShown = useMemo(() => allToggleableKeys.length > 0 && allToggleableKeys.every((k) => visibleCols.has(k)), [allToggleableKeys, visibleCols]);
  const anyShown = useMemo(() => allToggleableKeys.some((k) => visibleCols.has(k)), [allToggleableKeys, visibleCols]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = anyShown && !allShown;
  }, [anyShown, allShown]);

  useEffect(() => {
    const keys = groupedKeys["NIV Total"] || [];
    if (!nivCheckboxRef.current) return;
    const present = keys.map((k) => visibleCols.has(k));
    nivCheckboxRef.current.indeterminate = present.some(Boolean) && !present.every(Boolean);
  }, [groupedKeys, visibleCols]);

  const toggleSelectAll = () => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (allShown) allToggleableKeys.forEach((k) => next.delete(k));
      else allToggleableKeys.forEach((k) => next.add(k));
      return next;
    });
  };
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
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ── Stat card values ──
  const stats = useMemo(() => {
    const dtCount = new Set(filteredData.map((r) => r["Distributor Code"])).size;
    const nivGroup = groupMap["NIV Total"];
    let csdpNiv = 0, osdpNiv = 0;
    if (nivGroup) {
      filteredData.forEach((r) => {
        csdpNiv += toNum(r[nivGroup.csdp]);
        osdpNiv += toNum(r[nivGroup.osdp]);
      });
    }
    const variance = csdpNiv - osdpNiv;
    return { dtCount, csdpNiv, osdpNiv, variance };
  }, [filteredData, groupMap]);

  // ── Subheader label formatter ──
  const subLabel = (key) => {
    if (/csdp/i.test(key)) return "CSDP";
    if (/osdp/i.test(key)) return "OSDP";
    if (/variance/i.test(key)) return "VAR";
    return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getGroupColor = (key) => {
    const label = GROUP_ORDER.find((lbl) => (groupedKeys[lbl] || []).includes(key));
    return GROUP_COLORS[label] || {};
  };

  const getGroupLabel = (key) =>
    GROUP_ORDER.find((lbl) => (groupedKeys[lbl] || []).includes(key)) || "";

  const shouldRenderTwoDecimals = (key) => {
    const label = getGroupLabel(key);
    return label === "GSV Amount" || label === "NIV Total" || label === "Sales Turn Over";
  };

  const formatCellValue = (key, value) => {
    if (shouldRenderTwoDecimals(key)) return fmt(value);
    return value;
  };

  const handleExportTemplate = async () => {
    const toastId = toast.loading("Generating DSS template...");
    try {
      if ((selectedBusiness || "").toUpperCase() !== "HPC") {
        throw new Error("Template export currently supports the first sheet only: HPC Daily Sales Summary.");
      }
      if (!templateExportRows.length) {
        throw new Error("No Daily Sales Summary rows available for the selected filters.");
      }

      const response = await fetch(`${requireBackend()}/export_dss_template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType: selectedBusiness,
          year: selectedYear,
          month: selectedMonth,
          rows: templateExportRows,
        }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || "Failed to generate DSS template.");
      }

      const blob = await response.blob();
      const matchedRows = Number(response.headers.get("X-DSS-Matched-Rows") || 0);
      const filename = `HPC_DSS_Recon_Template_${selectedYear || "All"}_${selectedMonth || "All"}.xlsx`
        .replace(/\s+/g, "_");
      saveAs(blob, filename);
      toast.success(
        matchedRows > 0
          ? `Template downloaded. ${matchedRows} DT rows filled.`
          : "Template downloaded.",
        { id: toastId }
      );
    } catch (exportError) {
      toast.error(exportError?.message || "Failed to export DSS template.", { id: toastId });
    }
  };

  // ── Render ──
  return (
    <>
      <Toaster position="top-right" />

      <div className="p-4 text-xs overflow-x-hidden min-w-0 flex flex-col gap-3">

        {/* ── Hero Banner ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 shadow-md shadow-blue-200 px-5 py-4">
          <div className="pointer-events-none absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-10 right-24 w-24 h-24 rounded-full bg-white/10" />

          <div className="relative flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center">
                <BarChart3 size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-extrabold text-white tracking-tight leading-tight">Daily Sales Summary Report</h1>
                <p className="text-blue-200 text-[10px]">CSDP vs OSDP performance across all distributors</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {date && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/15 border border-white/25 text-white text-[10px] font-semibold">
                  <RefreshCw size={10} /> Updated {date}
                </span>
              )}
              <button
                onClick={() => setColumnsPanelOpen((s) => !s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                  ${columnsPanelOpen ? "bg-white text-indigo-700 shadow" : "bg-white/20 text-white border border-white/30 hover:bg-white/30"}`}
              >
                <SlidersHorizontal size={13} /> Columns
              </button>

              <button
                onClick={handleExportTemplate}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 font-semibold rounded-lg hover:bg-amber-100 text-xs shadow-sm transition-all border border-amber-200"
              >
                <Download size={13} /> Export Template
              </button>

              <button
                onClick={() => navigate("/reports/DSS/template-config")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 text-white font-semibold rounded-lg hover:bg-white/20 text-xs shadow-sm transition-all border border-white/20"
              >
                <Settings2 size={13} /> Template Config
              </button>

              <CSVLink
                data={filteredData.map((row) => {
                  const picked = {};
                  orderedVisibleHeaders.forEach((k) => (picked[k] = row[k]));
                  return picked;
                })}
                headers={csvHeaders}
                filename={`Daily_Sales_Summary_${date}.csv`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-indigo-700 font-semibold rounded-lg hover:bg-blue-50 text-xs shadow-sm transition-all"
                onClick={() => toast.success("CSV Download Started")}
              >
                <Download size={13} /> Export CSV
              </CSVLink>
            </div>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="flex flex-wrap gap-3">
          <StatCard
            icon={Users}
            label="Distributors"
            value={loading ? "—" : stats.dtCount}
            sub={selectedBusiness || "All business"}
            accent="bg-gradient-to-br from-indigo-500 to-blue-600"
          />
          <StatCard
            icon={TrendingUp}
            label="CSDP NIV Total"
            value={loading ? "—" : fmt(stats.csdpNiv)}
            accent="bg-gradient-to-br from-blue-500 to-cyan-500"
          />
          <StatCard
            icon={TrendingDown}
            label="OSDP NIV Total"
            value={loading ? "—" : fmt(stats.osdpNiv)}
            accent="bg-gradient-to-br from-violet-500 to-purple-600"
          />
          <StatCard
            icon={stats.variance < 0 ? TrendingDown : TrendingUp}
            label="NIV Variance"
            value={loading ? "—" : (stats.variance >= 0 ? "+" : "") + fmt(stats.variance)}
            sub={stats.variance === 0 ? "Balanced ✓" : stats.variance > 0 ? "CSDP higher" : "OSDP higher"}
            accent={stats.variance < -0.005 ? "bg-gradient-to-br from-orange-500 to-red-500" : "bg-gradient-to-br from-emerald-500 to-green-600"}
          />
        </div>

        {/* ── Filter Bar ── */}
        <div className="flex flex-wrap items-end gap-2 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
          <FilterSelect
            icon={Calendar}
            label="Year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            options={years}
          />
          <FilterSelect
            icon={Calendar}
            label="Month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            options={months}
          />
          <FilterSelect
            icon={Building2}
            label="Business Type"
            value={selectedBusiness}
            onChange={(e) => setSelectedBusiness(e.target.value)}
            options={businessList}
          />
          {/* Distributor search */}
          <div className="relative flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 shadow-sm hover:border-indigo-300 transition-colors flex-1 min-w-[200px]">
            <Search size={13} className="text-gray-400 shrink-0" />
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide leading-none">Search Distributor</span>
              <input
                value={dtFilter}
                onChange={(e) => setDtFilter(e.target.value)}
                className="text-xs font-semibold text-gray-700 bg-transparent border-none outline-none mt-0.5 w-full"
                placeholder="Code or name..."
              />
            </div>
            <select
              value={dtFilterField}
              onChange={(e) => setDtFilterField(e.target.value)}
              className="text-[10px] text-gray-400 bg-transparent border-l border-gray-200 pl-2 ml-1 outline-none cursor-pointer"
            >
              <option value="both">Both</option>
              <option value="code">Code</option>
              <option value="name">Name</option>
            </select>
          </div>

          <div className="ml-auto text-[10px] text-gray-400 self-center whitespace-nowrap">
            {!loading && <span><strong className="text-gray-600">{filteredData.length}</strong> records</span>}
          </div>
        </div>

        {/* ── Column Panel ── */}
        {columnsPanelOpen && (
          <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm text-xs">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-semibold text-gray-700">Choose columns to display</span>
              <label className="flex items-center gap-1.5 text-gray-500 cursor-pointer">
                <input ref={selectAllRef} type="checkbox" className="h-3 w-3 accent-indigo-500" checked={allShown} onChange={toggleSelectAll} />
                Select all
              </label>
            </div>
            <div className="grid md:grid-cols-4 sm:grid-cols-3 grid-cols-2 gap-1.5">
              {["Distributor Code", "Distributor Name"].map((k) => (
                <label key={k} className="flex items-center gap-1 text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 opacity-70 cursor-not-allowed text-[10px]">
                  <input type="checkbox" checked readOnly disabled className="h-3 w-3" />
                  {k}
                </label>
              ))}
              {GROUP_ORDER.map((label) => {
                const g = groupMap[label];
                const keys = g ? [g.csdp, g.osdp, g.varianceKey] : [];
                const available = keys.length > 0;
                const checked = available && keys.every((k) => visibleCols.has(k));
                const colors = GROUP_COLORS[label] || {};
                return (
                  <label
                    key={label}
                    className={`flex items-center gap-1.5 border rounded-lg px-2 py-1.5 text-[10px] font-semibold transition-colors
                      ${available ? `cursor-pointer ${colors.border || "border-gray-200"} ${colors.header || "bg-gray-50"}` : "bg-gray-100 border-gray-100 opacity-50 cursor-not-allowed"}`}
                  >
                    <input
                      ref={label === "NIV Total" ? nivCheckboxRef : undefined}
                      type="checkbox"
                      className="h-3 w-3 accent-indigo-500"
                      disabled={!available}
                      checked={checked}
                      onChange={() => toggleGroup(label)}
                    />
                    {label}
                  </label>
                );
              })}
              {optionalColumns.map((k) => (
                <label key={k} className="flex items-center gap-1 text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 text-[10px] cursor-pointer hover:border-indigo-200">
                  <input type="checkbox" className="h-3 w-3 accent-indigo-500" checked={visibleCols.has(k)} onChange={() => toggleColumn(k)} />
                  {k}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── Error state ── */}
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700 flex items-start gap-2">
            <span className="text-red-400 text-base">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* ── Table ── */}
        <div className="rounded-xl border border-gray-100 shadow-sm h-[60vh] w-full max-w-full overflow-auto min-w-0 bg-white">
          <table className="w-max text-[11px] border-separate border-spacing-0">
            <thead>
              {/* Group label row */}
              <tr>
                {groupSpans.map((span, si) => {
                  const isCode = !span.isGroup && span.label === "Code";
                  const isName = !span.isGroup && span.label === "Distributor";
                  const colors = span.isGroup ? (GROUP_COLORS[span.label] || {}) : {};
                  const z = isCode ? 74 : isName ? 73 : 72;

                  return (
                    <th
                      key={`gh-${si}`}
                      colSpan={span.span}
                      className={`sticky top-0 h-[30px] px-1 py-1 border-b text-center text-[10px] font-bold whitespace-nowrap
                        ${span.isGroup
                          ? `${colors.header || "bg-gray-100"} border-x border-t`
                          : isCode || isName
                            ? "bg-gray-50"
                            : "bg-gray-50"
                        }
                        ${isCode ? "sticky-col" : ""} ${isName ? "sticky-col-2" : ""}
                      `}
                      style={{
                        top: 0,
                        zIndex: z,
                        ...(isCode ? { left: 0 } : isName ? { left: CODE_COL_WIDTH } : {}),
                      }}
                    >
                      {span.label}
                    </th>
                  );
                })}
              </tr>

              {/* Sub-header row (CSDP / OSDP / VAR + col names) */}
              <tr>
                {orderedVisibleHeaders.map((key, idx) => {
                  const isCode = idx === distributorIdx;
                  const isName = idx === distributorNameIdx;
                  const z = isCode ? 70 : isName ? 69 : 68;
                  const colors = getGroupColor(key);
                  const isVar = isVarianceKey(key);

                  return (
                    <th
                      key={key}
                      className={`sticky px-1.5 py-1.5 border-b font-semibold whitespace-nowrap
                        ${isCode ? "sticky-col text-left" : ""}
                        ${isName ? "sticky-col-2 text-left" : ""}
                        ${!isCode && !isName ? "text-center" : ""}
                        ${isVar ? "bg-gray-100" : colors.bg || "bg-gray-50"}
                      `}
                      style={{ ...headerStyleForIndex(idx), top: HEADER_GROUP_ROW_HEIGHT, zIndex: z }}
                    >
                      <span className={`block text-[9px] font-bold mb-0.5 ${isVar ? "text-gray-500" : "text-gray-400"}`}>
                        {!isCode && !isName ? subLabel(key) : ""}
                      </span>
                      <span className="block text-[10px] text-gray-700">
                        {isCode ? "Code" : isName ? "Distributor Name" : key.replace(/^(CSDP|OSDP)\s*/i, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {/* Loading skeleton */}
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} cols={Math.max(orderedVisibleHeaders.length, 5)} />
              ))}

              {/* Empty state */}
              {!loading && filteredData.length === 0 && (
                <tr>
                  <td colSpan={orderedVisibleHeaders.length} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <BarChart3 size={28} className="text-gray-300" />
                      <p className="font-semibold text-gray-500">No data available</p>
                      <p className="text-[10px]">Try adjusting your filters, or export data from Reconciliation Summary first.</p>
                    </div>
                  </td>
                </tr>
              )}

              {/* Data rows */}
              {!loading && filteredData.map((row, rIdx) => {
                const isEven = rIdx % 2 === 0;
                return (
                  <tr
                    key={rIdx}
                    className={`group transition-colors ${isEven ? "bg-white" : "bg-gray-50/50"} hover:bg-indigo-50/40`}
                  >
                    {orderedVisibleHeaders.map((key, cIdx) => {
                      const isCode = cIdx === distributorIdx;
                      const isName = cIdx === distributorNameIdx;
                      const val = row[key];
                      const displayValue = formatCellValue(key, val);
                      const isVar = isVarianceKey(key);
                      const num = isVar ? toNum(val) : null;
                      const isZero = isVar && Math.abs(num) < 0.005;
                      const colors = getGroupColor(key);
                      const z = isCode ? 50 : isName ? 49 : "auto";

                      // Choose cell background
                      let bgClass = "";
                      if (isCode || isName) bgClass = isEven ? "bg-white" : "bg-gray-50/70";
                      else if (isVar) bgClass = isZero ? "bg-white" : "bg-red-50";
                      else bgClass = isEven ? (colors.bg || "bg-white") : "bg-gray-50/30";

                      return (
                        <td
                          key={`${rIdx}-${key}`}
                          className={`px-1.5 py-1.5 border-b border-gray-100 whitespace-nowrap text-[11px]
                            ${isCode ? "sticky-col font-semibold text-gray-700" : ""}
                            ${isName ? "sticky-col-2 text-gray-700" : ""}
                            ${!isCode && !isName ? "text-center text-gray-600" : ""}
                            ${bgClass}
                          `}
                          style={{ ...headerStyleForIndex(cIdx), zIndex: z }}
                          title={String(displayValue ?? "")}
                        >
                          {isVar ? (
                            <span
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold
                                ${isZero
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                                }`}
                            >
                              {isZero ? "✓" : num < 0 ? "▼" : "▲"} {num.toFixed(2)}
                            </span>
                          ) : (
                            displayValue
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </>
  );
}

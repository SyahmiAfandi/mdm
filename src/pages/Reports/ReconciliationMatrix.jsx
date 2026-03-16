// ReconciliationMatrix.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import toast from "react-hot-toast";
import { supabase } from "../../supabaseClient";
import { Copy, Eye, EyeOff } from "lucide-react";

const CELLS_TABLE = "recon_cells";
const REPORT_TYPES_TABLE = "master_reporttypes";
const DISTRIBUTORS_TABLE = "master_distributors";

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDefaultMonthYear() {
  const now = new Date();
  let year = now.getFullYear();
  let prevMonthIndex = now.getMonth() - 1;
  if (prevMonthIndex < 0) {
    prevMonthIndex = 11;
    year -= 1;
  }
  return { month: monthNames[prevMonthIndex], year: String(year) };
}

// Match > Mismatch > No Data (sheet-style)
const statusOrder = (status) => {
  if (!status) return 2;
  if (status.trim() === "Match") return 0;
  if (status.trim() === "Mismatch") return 1;
  return 2;
};

// ---------- Tooltip ----------
function TableTooltip({ children, content, enabled }) {
  const [visible, setVisible] = useState(false);
  const [direction, setDirection] = useState("top");
  const ref = useRef();

  const handleMouseEnter = () => {
    if (!enabled || !ref.current) return;
    const cellRect = ref.current.getBoundingClientRect();
    const tableRect = ref.current.closest("table").getBoundingClientRect();
    const rowIndex = ref.current.parentElement.rowIndex;
    const cellMidY = cellRect.top + cellRect.height / 2;
    const tableMidY = tableRect.top + tableRect.height / 2;
    if (cellMidY < tableMidY || rowIndex === 1) setDirection("bottom");
    else setDirection("top");
    setVisible(true);
  };

  const handleMouseLeave = () => setVisible(false);

  return (
    <span
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="inline-block relative w-full"
    >
      {children}
      {visible && enabled && (
        <div
          className={
            "absolute left-1/2 z-50 -translate-x-1/2 bg-white border border-gray-300 text-gray-900 text-[11px] rounded-lg p-2 shadow-xl min-w-[220px] max-w-sm pointer-events-none text-left" +
            (direction === "top" ? " bottom-full mb-1" : " top-full mt-1")
          }
          style={{ whiteSpace: "pre-line" }}
        >
          {content}
        </div>
      )}
    </span>
  );
}

function TooltipToggle({ enabled, setEnabled }) {
  return (
    <button
      title={enabled ? "Disable tooltip" : "Enable tooltip"}
      onClick={() => setEnabled((e) => !e)}
      className={classNames(
        "ml-3 flex items-center px-2 py-1 rounded-full border border-gray-300 transition",
        enabled ? "bg-blue-500 border-blue-600" : "bg-gray-200 border-gray-300"
      )}
      style={{ fontSize: "11px", height: "25px", minWidth: "38px" }}
    >
      <span
        className={
          "block w-3 h-3 rounded-full mr-1 " +
          (enabled ? "bg-white border border-blue-700" : "bg-gray-400 border border-gray-500")
        }
      />
      <span className={enabled ? "text-white" : "text-gray-600"}>
        {enabled ? "Tooltip On" : "Tooltip Off"}
      </span>
    </button>
  );
}

function CopyToggle({ enabled, setEnabled }) {
  return (
    <button
      title={enabled ? "Hide copy buttons" : "Show copy buttons"}
      onClick={() => setEnabled((e) => !e)}
      className={classNames(
        "ml-3 flex items-center px-2 py-1 rounded-full border transition",
        enabled ? "bg-indigo-500 border-indigo-600 text-white" : "bg-gray-200 border-gray-300 text-gray-600"
      )}
      style={{ fontSize: "11px", height: "25px" }}
    >
      <span className="mr-1">
        {enabled ? <Eye size={12} /> : <EyeOff size={12} />}
      </span>
      <span>{enabled ? "Hide Copy" : "Show Copy"}</span>
    </button>
  );
}

// ---------- helpers ----------
function normalize(str = "") {
  return String(str ?? "").trim();
}
function mapReportType(row = {}) {
  return {
    id: normalize(row.code ?? row.report_type_code ?? row.reportTypeId ?? row.id),
    name: normalize(row.name ?? row.report_type_name ?? row.reportTypeName ?? row.code ?? row.report_type_code ?? row.reportTypeId ?? row.id),
    active: row.active === undefined ? true : !!row.active,
    status: normalize(row.status).toLowerCase(),
  };
}
function mapDistributor(row = {}) {
  return {
    code: normalize(row.code ?? row.distributor_code ?? row.distributorCode ?? row.id),
    name: normalize(row.name ?? row.distributor_name ?? row.distributorName ?? row.code ?? row.distributor_code ?? row.distributorCode ?? row.id),
  };
}
function mapCell(row = {}) {
  return {
    periodId: normalize(row.period_id ?? row.periodId ?? row.id),
    businessType: normalize(row.business_type ?? row.businessType ?? ""),
    distributorCode: normalize(row.distributor_code ?? row.distributorCode ?? ""),
    distributorName: normalize(row.distributor_name ?? row.distributorName ?? ""),
    reportTypeId: normalize(row.report_type_id ?? row.reportTypeId ?? row.report_type_code ?? row.reportTypeCode ?? ""),
    reportTypeName: normalize(row.report_type_name ?? row.reportTypeName ?? ""),
    status: normalize(row.status),
    updatedBy: normalize(row.updated_by ?? row.updatedBy ?? ""),
    updatedAt: row.updated_at ?? row.updatedAt ?? null,
    reconsNo: Number(row.recons_no ?? row.reconsNo ?? 0),
  };
}
function toSheetLikeStatus(s) {
  // Firestore uses: match/mismatch/no_data
  // UI expects: Match/Mismatch/No Data
  const v = normalize(s).toLowerCase();
  if (v === "match") return "Match";
  if (v === "mismatch") return "Mismatch";
  return "No Data";
}
function toPeriodId(selectedYear, selectedMonth) {
  const m = monthNames.indexOf(selectedMonth) + 1;
  const mm = String(m).padStart(2, "0");
  return `${selectedYear}-${mm}`;
}

export default function ReconciliationMatrix() {
  const { month: defaultMonth, year: defaultYear } = getDefaultMonthYear();

  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedBusinessType, setSelectedBusinessType] = useState("HPC");

  const [sortConfig, setSortConfig] = useState({ key: "code", direction: "asc" });
  const [loading, setLoading] = useState(true);
  const [tooltipEnabled, setTooltipEnabled] = useState(true);
  const [showCopyButtons, setShowCopyButtons] = useState(false);

  const [yearOptions, setYearOptions] = useState([]);
  const [yearsLoading, setYearsLoading] = useState(true);

  // Reconciliation cells (each = one distributor + report type cell)
  const [cells, setCells] = useState([]);

  // ✅ Map reportTypeId -> reportTypeName (from master_reporttypes)
  const [rptNameById, setRptNameById] = useState(new Map());

  // ✅ Map distributorCode -> distributorName (from master_distributors)
  const [distNameByCode, setDistNameByCode] = useState(new Map());

  // ===== Load years from master_years =====
  useEffect(() => {
    let alive = true;

    async function loadYears() {
      try {
        setYearsLoading(true);

        const { data: snapDocs, error } = await supabase.from("master_years").select("*");
        if (error) throw error;
        const years = (snapDocs || [])
          .filter((r) => r.active !== false)
          .map((r) => String(r.year ?? "").trim())
          .filter(Boolean)
          .sort((a, b) => Number(b) - Number(a));

        if (!alive) return;

        setYearOptions(Array.from(new Set(years)));

        // If selectedYear not in master list, set to latest
        if (years.length && !years.includes(String(selectedYear))) {
          setSelectedYear(String(years[0]));
        }
      } catch (e) {
        console.error("loadYears:", e);
      } finally {
        if (alive) setYearsLoading(false);
      }
    }

    loadYears();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== Load report types (ID -> NAME) from master_reporttypes =====
  useEffect(() => {
    let alive = true;

    async function loadReportTypes() {
      try {
        const { data: snapDocs, error } = await supabase.from(REPORT_TYPES_TABLE).select("*");
        if (error) throw error;
        const m = new Map();

        (snapDocs || []).map(mapReportType).forEach((v) => {
          const id = v.id;
          const name = v.name;
          const active = v.active;
          const status = v.status;

          if (!id) return;
          if (!active) return;
          if (status && status !== "active") return;

          m.set(id, name);
        });

        if (!alive) return;
        setRptNameById(m);
      } catch (e) {
        console.error("loadReportTypes:", e);
        // fail open: keep empty map (we will fallback to reportTypeName/reportTypeId)
      }
    }

    loadReportTypes();
    return () => {
      alive = false;
    };
  }, []);

  // ===== Load distributors (CODE -> NAME) from master_distributors =====
  useEffect(() => {
    let alive = true;

    async function loadDistributors() {
      try {
        const { data: snapDocs, error } = await supabase.from(DISTRIBUTORS_TABLE).select("*");
        if (error) throw error;
        const m = new Map();

        (snapDocs || []).map(mapDistributor).forEach((v) => {
          const code = v.code;
          const name = v.name;

          if (!code) return;
          m.set(code, name);
        });

        if (!alive) return;
        setDistNameByCode(m);
      } catch (e) {
        console.error("loadDistributors:", e);
      }
    }

    loadDistributors();
    return () => {
      alive = false;
    };
  }, []);

  // ===== Load reconciliation cells from Supabase based on period + business =====
  useEffect(() => {
    let alive = true;

    async function loadCells() {
      setLoading(true);
      try {
        const pid = toPeriodId(selectedYear, selectedMonth);

        const { data, error } = await supabase.from(CELLS_TABLE)
          .select("*")
          .eq("period_id", pid)
          .eq("business_type", selectedBusinessType);
        if (error) throw error;

        if (!alive) return;

        // Normalize into the shape your matrix expects
        const normalized = (data || []).map((raw) => {
          const x = mapCell(raw);
          const distributorCode = x.distributorCode;
          // ✅ Use name from master data if available, otherwise fallback to existing
          const masterName = distNameByCode.get(distributorCode);
          const distributorName = masterName || x.distributorName;
          const reconsNo = Number(x.reconsNo || 0);
          const reportTypeId = x.reportTypeId;
          // ✅ Column header should be report TYPE NAME
          const reportTypeName =
            x.reportTypeName ||
            normalize(rptNameById.get(reportTypeId)) ||
            reportTypeId;

          const status = toSheetLikeStatus(x.status);
          const pic = x.updatedBy;

          const time =
            x.updatedAt
              ? (() => {
                const d = new Date(x.updatedAt);
                if (isNaN(d.getTime())) return String(x.updatedAt);
                const mm = String(d.getMonth() + 1).padStart(2, "0");
                const dd = String(d.getDate()).padStart(2, "0");
                const yyyy = d.getFullYear();
                const hh = String(d.getHours()).padStart(2, "0");
                const min = String(d.getMinutes()).padStart(2, "0");
                const ss = String(d.getSeconds()).padStart(2, "0");
                return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
              })()
              : "";

          return {
            distributorCode,
            distributorName,
            reportType: reportTypeName, // <-- IMPORTANT (use NAME for column)
            status,
            pic,
            time,
            reconsNo,
          };
        });

        setCells(normalized);
      } catch (e) {
        console.error("loadCells:", e);
        toast.error(`${e?.code || "error"}: ${e?.message || "Failed to load Supabase data"}`);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadCells();
    return () => {
      alive = false;
    };
  }, [selectedYear, selectedMonth, selectedBusinessType, rptNameById, distNameByCode]);

  // ===== Transform cells -> grouped matrix format =====
  const { sortedDistributors, sortedReportTypes } = useMemo(() => {
    const grouped = {};
    const reportTypes = new Set();

    cells.forEach((row) => {
      const code = row.distributorCode;
      const name = row.distributorName;
      const key = `${code}||${name}`;
      if (!grouped[key]) grouped[key] = { code, name, reports: {} };

      const report = row.reportType; // NAME (not ID)
      grouped[key].reports[report] = {
        status: row.status,
        pic: row.pic,
        time: row.time,
        reconsNo: row.reconsNo,  // ✅ ADD
      };

      reportTypes.add(report);
    });

    const sortedReportTypes = Array.from(reportTypes).sort();

    let sortedDistributors = Object.values(grouped);

    // sorting rules (same as your old code)
    sortedDistributors.sort((a, b) => {
      if (!sortConfig.key) return 0;

      if (sortConfig.key === "code") {
        return sortConfig.direction === "asc"
          ? a.code.localeCompare(b.code)
          : b.code.localeCompare(a.code);
      }
      if (sortConfig.key === "name") {
        return sortConfig.direction === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      if (sortConfig.key.startsWith("report:")) {
        const reportName = sortConfig.key.split(":")[1];
        const statusA = a.reports[reportName]?.status;
        const statusB = b.reports[reportName]?.status;
        const orderA = statusOrder(statusA);
        const orderB = statusOrder(statusB);
        if (orderA !== orderB)
          return sortConfig.direction === "asc" ? orderA - orderB : orderB - orderA;
        return a.code.localeCompare(b.code);
      }
      return 0;
    });

    return { sortedDistributors, sortedReportTypes };
  }, [cells, sortConfig]);

  const toggleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleCopyColumn = async (reportTypeName) => {
    try {
      // 1. Sort distributors by code ascending
      const sortedByCodeAsc = [...sortedDistributors].sort((a, b) => {
        return a.code.localeCompare(b.code);
      });

      // 2. Extract column data for the specific report type
      const columnData = sortedByCodeAsc.map((d) => {
        const status = d.reports[reportTypeName]?.status?.trim() || "No Data";
        return status;
      });

      // 3. Join with newline
      const textToCopy = columnData.join("\n");

      // 4. Copy to clipboard
      await navigator.clipboard.writeText(textToCopy);
      toast.success(`Copied data for ${reportTypeName} column!`);
    } catch (err) {
      console.error("Failed to copy text: ", err);
      toast.error("Failed to copy column data.");
    }
  };

  const sortIcon = (colKey) => {
    if (sortConfig.key !== colKey) return <span className="inline-block w-2" />;
    return sortConfig.direction === "asc" ? <span>▲</span> : <span>▼</span>;
  };

  return (
    <div className="px-4 py-0 font-sans text-[9px]">
      <div className="flex items-center mb-2">
        <h1 className="text-lg font-bold tracking-tight text-gray-800">
          Reconciliation Status Report
        </h1>
        <TooltipToggle enabled={tooltipEnabled} setEnabled={setTooltipEnabled} />
        <CopyToggle enabled={showCopyButtons} setEnabled={setShowCopyButtons} />
      </div>

      <div className="flex gap-4 items-start">
        {/* TABLE */}
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <svg
                className="animate-spin h-8 w-8 text-gray-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              <span className="ml-2 text-gray-500 text-sm">Loading Supabase data...</span>
            </div>
          ) : (
            <table className="w-full table-auto border text-center text-[9px]">
              <thead className="bg-gray-100">
                <tr>
                  <th
                    className="border font-semibold px-0 py-0.5 whitespace-nowrap cursor-pointer"
                    style={{ width: "60px" }}
                    onClick={() => toggleSort("code")}
                  >
                    DT Code {sortIcon("code")}
                  </th>

                  <th
                    className="border font-semibold px-1 py-0.5 text-left whitespace-nowrap truncate cursor-pointer"
                    style={{ width: "170px" }}
                    onClick={() => toggleSort("name")}
                  >
                    Distributors {sortIcon("name")}
                  </th>

                  {sortedReportTypes.map((r) => (
                    <th
                      key={r}
                      className="border font-semibold px-1 py-0.5 whitespace-normal cursor-pointer relative group break-words"
                      style={{
                        width: "100px",
                        minWidth: "100px",
                        maxWidth: "100px",
                      }}
                      onClick={() => toggleSort(`report:${r}`)}
                    >
                      <div className="inline-flex items-center gap-1">
                        {r} {sortIcon(`report:${r}`)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {sortedDistributors.length === 0 && (
                  <tr>
                    <td
                      colSpan={2 + sortedReportTypes.length}
                      className="py-6 text-center text-gray-400 italic border bg-gray-50"
                    >
                      No data found.
                    </td>
                  </tr>
                )}

                {sortedDistributors.map((d, i) => (
                  <tr key={i} className="border-t hover:bg-gray-200 cursor-pointer transition-colors">
                    <td className="border px-0 py-0.5 text-center whitespace-nowrap" style={{ width: "60px" }}>
                      {d.code}
                    </td>

                    <td className="border px-1 py-0.5 text-left truncate" style={{ width: "170px", maxWidth: "170px" }}>
                      {d.name}
                    </td>

                    {sortedReportTypes.map((r, j) => {
                      const entry = d.reports[r];
                      const status = entry?.status?.trim(); // Match/Mismatch/No Data

                      let colorClass = "bg-yellow-200 text-gray-700";
                      let statusColor = "text-gray-600";

                      if (status === "Match") {
                        colorClass = "bg-green-500 text-white";
                        statusColor = "text-green-500 font-bold";
                      }
                      if (status === "Mismatch") {
                        colorClass = "bg-red-500 text-white";
                        statusColor = "text-red-500 font-bold";
                      }

                      const hasTooltip = status === "Match" || status === "Mismatch";

                      return (
                        <td key={j} className={`border px-1 py-0.5 relative group ${colorClass} break-words`}>
                          {hasTooltip ? (
                            <TableTooltip
                              enabled={tooltipEnabled}
                              content={
                                <div>
                                  <div>
                                    <span className="font-semibold">Report Type:</span>{" "}
                                    <span>{r}</span>
                                  </div>
                                  <div>
                                    <span className="font-semibold">PIC:</span>{" "}
                                    <span>{entry?.pic || "-"}</span>
                                  </div>
                                  <div>
                                    <span className="font-semibold">Status:</span>
                                    <span className={statusColor + " ml-1"}>{status || "-"}</span>
                                  </div>
                                  <div>
                                    <span className="font-semibold">Recons No:</span>{" "}
                                    <span className="font-bold text-indigo-600">
                                      {entry?.reconsNo ?? "-"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="font-semibold">Last Time Update:</span>{" "}
                                    <span>{entry?.time || "-"}</span>
                                  </div>
                                </div>
                              }
                            >
                              <div className="text-center cursor-help break-words">{status}</div>
                            </TableTooltip>
                          ) : (
                            <div className="text-center break-words">{status || "No Data"}</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* CONTROLS */}
        <div className="flex flex-col gap-4 items-start min-w-[130px]">
          {/* Business Type Selector */}
          <div>
            <div className="text-[11px] font-bold mb-1">Business Type</div>
            <div className="flex flex-wrap gap-2">
              {["HPC", "IC"].map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedBusinessType(type)}
                  className={classNames(
                    "px-3 py-1 border rounded text-[10px] w-[90px]",
                    selectedBusinessType === type
                      ? "bg-black text-white"
                      : "bg-white hover:bg-gray-200"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Year Selector */}
          <div>
            <div className="text-[11px] font-bold mb-1">Year</div>
            <div className="grid grid-cols-2 gap-2">
              {(yearOptions.length ? yearOptions : [selectedYear]).map((y) => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={classNames(
                    "px-3 py-1 border rounded text-[10px] w-[90px]",
                    selectedYear === y
                      ? "bg-black text-white"
                      : "bg-white hover:bg-gray-200"
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
            {yearsLoading && (
              <div className="text-[10px] text-gray-400 mt-1">Loading years…</div>
            )}
          </div>

          {/* Month Selector */}
          <div>
            <div className="text-[11px] font-bold mb-1">Month</div>
            <div className="grid grid-cols-2 grid-rows-6 gap-2">
              {monthNames.map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMonth(m)}
                  className={classNames(
                    "px-3 py-1 border rounded text-[10px] w-[90px]",
                    selectedMonth === m
                      ? "bg-black text-white"
                      : "bg-white hover:bg-gray-200"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Copy Actions (conditional) */}
          {showCopyButtons && sortedReportTypes.length > 0 && (
            <div className="mt-4 border-t pt-4 w-full">
              <div className="text-[11px] font-bold mb-2 flex items-center gap-1 text-indigo-700">
                <Copy size={12} /> Copy Column Data
              </div>
              <div className="flex flex-col gap-1.5 w-full pr-1">
                {sortedReportTypes.map((r) => (
                  <button
                    key={`copy-${r}`}
                    onClick={() => handleCopyColumn(r)}
                    className="flex items-center justify-between px-2.5 py-1.5 border border-indigo-200 rounded text-[10px] w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors text-left"
                    title={`Copy all ${r} statuses`}
                  >
                    <span className="truncate mr-2 max-w-[120px]">{r}</span>
                    <Copy size={10} className="shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

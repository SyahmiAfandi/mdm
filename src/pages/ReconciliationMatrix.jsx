import React, { useEffect, useState, useRef } from "react";
import classNames from "classnames";
import DashboardLayout from "../components/DashboardLayout";
import { APP_FULL_NAME } from "../config";

const apiUrl = import.meta.env.VITE_GAS_MATRIX_URL;

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDefaultMonthYear() {
  const now = new Date();
  let year = now.getFullYear();
  let prevMonthIndex = now.getMonth() - 1; // move back 1 month

  if (prevMonthIndex < 0) {
    prevMonthIndex = 11;  // wrap to December
    year -= 1;            // adjust to previous year
  }

  return { month: monthNames[prevMonthIndex], year: String(year) };
}



// Helper for sorting status columns: Match > Mismatch > No Data
const statusOrder = (status) => {
  if (!status) return 2;
  if (status.trim() === "Match") return 0;
  if (status.trim() === "Mismatch") return 1;
  return 2;
};

// Smart Tooltip for table cells
function TableTooltip({ children, content, enabled }) {
  const [visible, setVisible] = useState(false);
  const [direction, setDirection] = useState("top");
  const ref = useRef();

  const handleMouseEnter = () => {
    if (!enabled || !ref.current) return;
    const cellRect = ref.current.getBoundingClientRect();
    const tableRect = ref.current.closest("table").getBoundingClientRect();
    const rowIndex = ref.current.parentElement.rowIndex;
    const totalRows = ref.current.closest("tbody").rows.length;
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

export default function ReconciliationMatrix() {
  const [data, setData] = useState([]);
  const { month: defaultMonth, year: defaultYear } = getDefaultMonthYear();
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedBusinessType, setSelectedBusinessType] = useState("HPC");
  const [sortConfig, setSortConfig] = useState({ key: "code", direction: "asc" });
  const [loading, setLoading] = useState(true);
  const [tooltipEnabled, setTooltipEnabled] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(apiUrl)
      .then((res) => res.json())
      .then((rows) => setData(rows))
      .catch((err) => console.error("Fetch error:", err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = data.filter(
    (row) =>
      row["Year"]?.toString().trim() === selectedYear &&
      row["Month"]?.trim() === selectedMonth &&
      row["Business Type"]?.trim().toUpperCase() === selectedBusinessType.toUpperCase()
  );

  const grouped = {};
  const reportTypes = new Set();
  filtered.forEach((row) => {
    const code = row["Distributor Code"];
    const name = row["Distributor Name"];
    const key = `${code}||${name}`;
    if (!grouped[key]) grouped[key] = { code, name, reports: {} };
    const report = row["Report Type"];
    const status = row["Report Status"];
    const pic = row["PIC"];
    const time = row["Timestamp"];
    grouped[key].reports[report] = { status, pic, time };
    reportTypes.add(report);
  });
  const sortedReportTypes = Array.from(reportTypes).sort();

  let sortedDistributors = Object.values(grouped);
  if (sortConfig.key) {
    sortedDistributors.sort((a, b) => {
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
  }

  const toggleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };
  const sortIcon = (colKey) => {
    if (sortConfig.key !== colKey) return <span className="inline-block w-2" />;
    return sortConfig.direction === "asc" ? <span>▲</span> : <span>▼</span>;
  };

  return (
    <DashboardLayout pageTitle={APP_FULL_NAME} breadcrumbs={["Reports", "Reconciliation Status Report"]}>
      <div className="px-4 py-0 font-sans text-[9px]">
        <div className="flex items-center mb-2">
          <h1 className="text-lg font-bold tracking-tight text-gray-800">
            Reconciliation Status Report
          </h1>
          <TooltipToggle enabled={tooltipEnabled} setEnabled={setTooltipEnabled} />
        </div>
        <div className="flex gap-4 items-start">
          <div className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <svg className="animate-spin h-8 w-8 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                <span className="ml-2 text-gray-500 text-sm">Loading data...</span>
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
                          width: "100px",     // <--- adjust this value!
                          minWidth: "100px",  // <--- adjust this value!
                          maxWidth: "100px"   // <--- adjust this value!
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
                    <tr
                      key={i}
                      className="border-t hover:bg-gray-200 cursor-pointer transition-colors"
                    >
                      <td
                        className="border px-0 py-0.5 text-center whitespace-nowrap"
                        style={{ width: "60px" }}
                      >
                        {d.code}
                      </td>
                      <td
                        className="border px-1 py-0.5 text-left truncate"
                        style={{ width: "170px", maxWidth: "170px" }}
                      >
                        {d.name}
                      </td>
                      {sortedReportTypes.map((r, j) => {
                        const entry = d.reports[r];
                        const status = entry?.status?.trim();
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
                                      <span className={statusColor + " ml-1"}>
                                        {status || "-"}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="font-semibold">
                                        Last Time Update:
                                      </span>{" "}
                                      <span>{entry?.time || "-"}</span>
                                    </div>
                                  </div>
                                }
                              >
                                <div className="text-center cursor-help break-words">
                                  {status}
                                </div>
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
          {/* Controls: Business Type, Year, Month */}
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
              <div className="grid grid-cols-2 grid-rows-2 gap-2">
                {["2024", "2025","2026"].map((y) => (
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
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}



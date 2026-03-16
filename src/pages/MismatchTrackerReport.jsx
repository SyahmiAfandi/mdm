import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../supabaseClient";
import { APP_FULL_NAME } from '../config';
import {
  Loader2,
  Search,
  Save,
  BarChart2,
  FileText,
  Activity,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { usePermissions } from "../hooks/usePermissions";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const CELLS_TABLE = "recon_cells";

function normalize(value = "") {
  return String(value ?? "").trim();
}

function mapCell(row = {}) {
  return {
    id: row.id ?? "",
    periodId: normalize(row.period_id ?? row.periodId ?? row.id),
    businessType: normalize(row.business_type ?? row.businessType ?? ""),
    distributorCode: normalize(row.distributor_code ?? row.distributorCode ?? ""),
    distributorName: normalize(row.distributor_name ?? row.distributorName ?? ""),
    reportTypeId: normalize(row.report_type_id ?? row.reportTypeId ?? row.report_type_code ?? row.reportTypeCode ?? ""),
    reportTypeName: normalize(row.report_type_name ?? row.reportTypeName ?? ""),
    status: normalize(row.status ?? row.Status ?? ""),
    remark: normalize(row.remark ?? ""),
  };
}

function MismatchTrackerReport() {
  const { can, role } = usePermissions();
  const canEdit = can("mismatch.edit") || role === "admin";

  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [editedRemarks, setEditedRemarks] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "asc" });
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [viewMode, setViewMode] = useState("table");

  const [filters, setFilters] = useState({
    Year: "All",
    Month: "All",
    "Business Type": "All",
    "Report Type": "All",
  });

  const tableContainerRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    supabase.from(CELLS_TABLE).select("*")
      .then(({ data: snap, error }) => {
        if (!alive) return;
        if (error) throw error;
        const mismatches = [];
        (snap || []).map(mapCell).forEach((docData) => {
          const status = docData.status || "";

          if (typeof status === "string" && status.trim().toLowerCase() === "mismatch") {
            const [year, monthNum] = (docData.periodId || "-").split("-");
            mismatches.push({
              id: docData.id,
              Year: year || "",
              Month: monthNum || "",
              "Business Type": docData.businessType || "",
              "Distributor Code": docData.distributorCode || "",
              "Distributor Name": docData.distributorName || "",
              "Report Type": docData.reportTypeName || docData.reportTypeId || "",
              "Report Status": "Mismatch",
              Remark: docData.remark || ""
            });
          }
        });

        setData(mismatches);
        setFilteredData(mismatches);
      })
      .catch((err) => {
        console.error("Error fetching data:", err);
        if (alive) {
          setData([]);
          setFilteredData([]);
          toast.error("Failed to load mismatches from database.");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
  }, [refreshKey]);

  useEffect(() => {
    let filtered = [...data];
    Object.keys(filters).forEach((key) => {
      if (filters[key] !== "All") {
        filtered = filtered.filter((row) => row[key] === filters[key]);
      }
    });

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter((row) =>
        Object.values(row).join(" ").toLowerCase().includes(lowerSearch)
      );
    }

    setFilteredData(filtered);
    setCurrentPage(1);
  }, [filters, searchTerm, data]);

  const columnOrder = [
    "Year",
    "Month",
    "Business Type",
    "Distributor Code",
    "Distributor Name",
    "Report Type",
    "Report Status",
    "Remark",
  ];

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      } else {
        return { key, direction: "asc" };
      }
    });
  };

  const handleScroll = () => {
    const scrollTop = tableContainerRef.current?.scrollTop || 0;
    setShowScrollTop(scrollTop > 150);
  };

  const scrollToTop = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const sortedData = [...filteredData].sort((a, b) => {
    const key = sortConfig.key;
    if (!key) return 0;
    const aVal = a[key] ?? "";
    const bVal = b[key] ?? "";
    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const indexOfLast = currentPage * rowsPerPage;
  const indexOfFirst = indexOfLast - rowsPerPage;
  const paginatedData = sortedData.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;

  const getUniqueOptions = (field) => {
    return ["All", ...Array.from(new Set(data.map((row) => row[field]))).filter(Boolean).sort()];
  };

  const chartData = Object.entries(
    filteredData.reduce((acc, row) => {
      const typeCode = row["Report Type"] || "Unknown";
      acc[typeCode] = (acc[typeCode] || 0) + 1;
      return acc;
    }, {})
  ).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);

  const handleSaveSingleRemark = async (record) => {
    const remark = editedRemarks[record.id];
    if (remark === undefined) return;

    try {
      const { error } = await supabase.from(CELLS_TABLE).update({ remark }).eq('id', record.id);
      if (error) throw error;

      toast.success(`Saved remark for ${record["Distributor Code"]}`);

      // Update local state
      setData(prev => prev.map(item => item.id === record.id ? { ...item, Remark: remark } : item));

      setEditedRemarks((prev) => {
        const updated = { ...prev };
        delete updated[record.id];
        return updated;
      });
    } catch (error) {
      console.error("Error saving remark:", error);
      toast.error("Failed to save remark");
    }
  };

  const prettifyBusinessType = (bt) => {
    if (!bt) return "";
    return bt.split(" ").map(w => w[0]?.toUpperCase() + w.substring(1).toLowerCase()).join(" ");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] overflow-hidden bg-gray-50">
      <Toaster position="top-right" />

      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between gap-4 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-100 text-violet-600">
            <Activity size={20} />
          </div>
          <div>
            <h1 className="text-[17px] font-black text-gray-900 tracking-tight leading-tight">
              Mismatch Tracker
            </h1>
            <p className="text-[11px] text-gray-400 font-medium">
              Monitor and resolve data mismatches across all reconciliation reports
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100/80 p-1 rounded-xl shadow-inner border border-gray-200/50">
            <button
              onClick={() => setViewMode("chart")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === "chart"
                ? "bg-white text-violet-700 shadow-sm ring-1 ring-black/5"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                }`}
            >
              <BarChart2 size={14} /> Chart
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === "table"
                ? "bg-white text-violet-700 shadow-sm ring-1 ring-black/5"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                }`}
            >
              <FileText size={14} /> Table
            </button>
          </div>

          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:border-gray-400 transition-all disabled:opacity-50 shadow-sm"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-center h-full">
          <Loader2 className="animate-spin text-violet-500 mb-3" size={36} />
          <p className="text-sm font-semibold text-gray-600">Loading mismatch data…</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-5 space-y-4" ref={tableContainerRef} onScroll={handleScroll}>
          {/* Chart Mode */}
          {viewMode === "chart" && (
            <div className="max-w-5xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-500 mb-1">Total Mismatches</div>
                    <div className="text-3xl font-black text-gray-800">{data.length}</div>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 border border-rose-100">
                    <AlertTriangle size={24} />
                  </div>
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-500 mb-1">Filtered Results</div>
                    <div className="text-3xl font-black text-gray-800">{filteredData.length}</div>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-violet-50 flex items-center justify-center text-violet-500 border border-violet-100">
                    <Search size={24} />
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <h2 className="font-bold text-gray-800 mb-4">Mismatches by Report Type</h2>
                <div className="w-full h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="type" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                      <Tooltip
                        cursor={{ fill: '#F3F4F6' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}
                      />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Mismatch Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Table Mode */}
          {viewMode === "table" && (
            <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 shadow-sm shrink-0">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1 w-full">
                    {["Year", "Month", "Business Type", "Report Type"].map((field) => (
                      <div key={field} className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-gray-500 tracking-wide uppercase">{field}</label>
                        <select
                          value={filters[field]}
                          onChange={(e) =>
                            setFilters((prev) => ({ ...prev, [field]: e.target.value }))
                          }
                          className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-violet-500 focus:border-violet-500 block w-full px-2.5 py-1.5 font-medium transition-colors cursor-pointer hover:bg-gray-100"
                        >
                          {getUniqueOptions(field).map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 md:max-w-xs w-full">
                    <label className="text-[11px] font-bold text-gray-500 tracking-wide uppercase mb-1.5 block">Search</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Search className="text-gray-400" size={14} />
                      </div>
                      <input
                        type="text"
                        className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-violet-500 focus:border-violet-500 block w-full pl-9 px-2.5 py-1.5 transition-colors placeholder-gray-400"
                        placeholder="Search across all columns..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="overflow-x-auto flex-1 custom-scrollbar">
                  <table className="min-w-full text-[11px] text-left">
                    <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                      <tr>
                        {columnOrder.map((key) => (
                          <th
                            key={key}
                            onClick={() => handleSort(key)}
                            className="px-3 py-3 font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-200 group select-none"
                          >
                            <div className="flex items-center gap-1">
                              {key}
                              {sortConfig.key === key && (
                                <span className="text-violet-500">
                                  {sortConfig.direction === "asc" ? "▲" : "▼"}
                                </span>
                              )}
                              {sortConfig.key !== key && (
                                <span className="text-gray-300 opacity-0 group-hover:opacity-100">
                                  ↕
                                </span>
                              )}
                            </div>
                          </th>
                        ))}
                        <th className="px-3 py-3 font-bold text-gray-500 uppercase tracking-wider text-center border-b border-gray-200 bg-gray-50 sticky right-0 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.05)]">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedData.length > 0 ? paginatedData.map((row, idx) => {
                        const isEdited = editedRemarks.hasOwnProperty(row.id);
                        const remarkVal = isEdited ? editedRemarks[row.id] : row.Remark;

                        return (
                          <tr key={row.id} className={`transition-colors hover:bg-violet-50/30 ${isEdited ? "bg-amber-50" : ""}`}>
                            {columnOrder.map((key, j) => (
                              <td key={j} className="px-3 py-2.5 whitespace-nowrap font-medium text-gray-700">
                                {key === "Remark" ? (
                                  <div className="relative min-w-[200px]">
                                    <input
                                      type="text"
                                      disabled={!canEdit}
                                      className={`w-full bg-transparent border-b border-dashed focus:outline-none focus:border-solid px-1 py-0.5 text-[11px] transition-colors ${!canEdit ? 'opacity-50 cursor-not-allowed border-gray-200' :
                                          isEdited ? "border-amber-400 focus:border-amber-600 text-amber-900" : "border-gray-300 focus:border-violet-500 text-gray-700"
                                        }`}
                                      value={remarkVal}
                                      placeholder="Add a remark..."
                                      onChange={(e) =>
                                        setEditedRemarks((prev) => ({
                                          ...prev,
                                          [row.id]: e.target.value,
                                        }))
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleSaveSingleRemark(row);
                                        }
                                      }}
                                    />
                                  </div>
                                ) : key === "Report Status" ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    <AlertTriangle size={10} /> Mismatch
                                  </span>
                                ) : key === "Business Type" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                                    {row[key]}
                                  </span>
                                ) : key === "Distributor Code" ? (
                                  <span className="font-mono text-gray-600 font-semibold">{row[key]}</span>
                                ) : (
                                  row[key]
                                )}
                              </td>
                            ))}
                            <td className="px-3 py-2.5 text-center bg-white sticky right-0 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.02)] group-hover:bg-gray-50 transition-colors">
                              <button
                                onClick={() => handleSaveSingleRemark(row)}
                                disabled={!isEdited || !canEdit}
                                className={`p-1.5 rounded-lg transition-all ${isEdited && canEdit
                                  ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200 hover:scale-105 shadow-sm"
                                  : "text-gray-300 opacity-50 cursor-not-allowed"
                                  }`}
                                title="Save Remark"
                              >
                                <Save size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td colSpan={columnOrder.length + 1} className="px-4 py-12 text-center text-gray-500 text-sm">
                            No mismatch records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="bg-white border-t border-gray-100 p-3 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-500">
                      Rows per page:
                    </span>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => {
                        setRowsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg focus:ring-violet-500 focus:border-violet-500 px-2 py-1 font-medium transition-colors cursor-pointer"
                    >
                      {[10, 20, 50, 100].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <span className="text-xs font-semibold text-gray-600 hidden md:inline">
                      Showing {Math.min(indexOfFirst + 1, filteredData.length)} to {Math.min(indexOfLast, filteredData.length)} of {filteredData.length} records
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Prev
                    </button>
                    <span className="text-xs font-bold text-gray-700 px-2">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MismatchTrackerReport;

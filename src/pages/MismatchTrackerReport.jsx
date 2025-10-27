import React, { useEffect, useState, useRef } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { APP_FULL_NAME } from '../config';
import {
  Loader2,
  Search,
  Save,
  BarChart2,
  FileText,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
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

function MismatchTrackerReport() {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [editedRemarks, setEditedRemarks] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
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
    fetch(import.meta.env.VITE_GAS_MISMATCH_URL)
      .then((res) => res.json())
      .then((json) => {
        const mismatches = json.filter((row) => {
          const status = row["Report Status"] || row["report status"];
          return typeof status === "string" && status.trim().toLowerCase() === "mismatch";
        });
        const cleaned = mismatches.map(({ PIC, Timestamp, ...rest }) => rest);
        setData(cleaned);
        setFilteredData(cleaned);
      })
      .catch((err) => {
        console.error("Error fetching data:", err);
        setData([]);
        setFilteredData([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let filtered = [...data];
    Object.keys(filters).forEach((key) => {
      if (filters[key] !== "All") {
        filtered = filtered.filter((row) => row[key] === filters[key]);
      }
    });

    if (searchTerm) {
      filtered = filtered.filter((row) =>
        Object.values(row).join(" ").toLowerCase().includes(searchTerm.toLowerCase())
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
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  const getUniqueOptions = (field) => {
    return ["All", ...Array.from(new Set(data.map((row) => row[field])))];
  };

  const chartData = Object.entries(
    filteredData.reduce((acc, row) => {
      const type = row["Report Type"] || "Unknown";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {})
  ).map(([type, count]) => ({ type, count }));

  const handleSaveSingleRemark = async (rowKey) => {
    const remark = editedRemarks[rowKey];
    if (!remark) return;

    try {
      await fetch(import.meta.env.VITE_GAS_MISMATCH_SAVE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowKey, remark }),
      })
      toast.success(`Saved remark for ${rowKey}`);
      setEditedRemarks((prev) => {
        const updated = { ...prev };
        delete updated[rowKey];
        return updated;
      });
    } catch (error) {
      toast.error("Failed to save remark");
    }
  };

  return (
    <DashboardLayout pageTitle={APP_FULL_NAME} breadcrumbs={["Reports", "Mismatch Tracker"]}>
      <Toaster position="top-right" />
      <div className="p-6 relative">
        {/* Header & Toggle always visible */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Mismatch Tracker</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 font-medium">View Mode:</span>
            <div className="flex items-center bg-gray-100 rounded-full p-1 space-x-2 shadow-sm">
              <button
                onClick={() => setViewMode("chart")}
                className={`
                  p-2 rounded-full transition
                  ${viewMode === "chart"
                    ? "bg-blue-600 text-white shadow"
                    : "text-gray-500 hover:bg-gray-200"}
                `}
                title="Chart Mode"
              >
                <BarChart2 size={20} />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`
                  p-2 rounded-full transition
                  ${viewMode === "table"
                    ? "bg-blue-600 text-white shadow"
                    : "text-gray-500 hover:bg-gray-200"}
                `}
                title="Table Mode"
              >
                <FileText size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Spinner below header, replacing content while loading */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="animate-spin text-blue-600" size={40} />
            <span className="mt-4 text-gray-500 font-medium">Loading data...</span>
          </div>
        ) : (
          <>
            {/* Chart Mode */}
            {viewMode === "chart" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="text-sm text-gray-500">Total Mismatches</div>
                    <div className="text-2xl font-bold">{data.length}</div>
                  </div>
                  <div className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="text-sm text-gray-500">Filtered Results</div>
                    <div className="text-2xl font-bold">{filteredData.length}</div>
                  </div>
                </div>

                <div className="w-full h-64 mb-6 bg-white p-4 rounded border shadow-sm">
                  <h2 className="font-semibold mb-2 text-gray-700">Mismatches by Report Type</h2>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#ef4444" name="Mismatch Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {/* Table Mode */}
            {viewMode === "table" && (
              <>
                {/* Filters */}
                <div className="bg-white border rounded-lg p-4 mb-4 shadow-sm">
                  <h2 className="font-semibold text-gray-700 mb-3">Filter Records</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {["Year", "Month", "Business Type", "Report Type"].map((field) => (
                      <div key={field} className="flex flex-col">
                        <label className="text-sm font-medium text-gray-600 mb-1">Filter by {field}</label>
                        <select
                          value={filters[field]}
                          onChange={(e) =>
                            setFilters((prev) => ({ ...prev, [field]: e.target.value }))
                          }
                          className="border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          {getUniqueOptions(field).map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Search */}
                <div className="mb-4 flex items-center gap-2">
                  <Search className="text-gray-500" />
                  <input
                    type="text"
                    className="border border-gray-300 rounded px-3 py-1 w-full max-w-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Search by any field..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Rows per page */}
                <div className="mb-4">
                  <label className="mr-2 font-medium text-sm">Rows per page:</label>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    {[10, 20, 50].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                {/* Table */}
                <div
                  ref={tableContainerRef}
                  onScroll={handleScroll}
                  className="overflow-auto rounded shadow max-h-[500px] relative"
                >
                  <table className="min-w-full border text-sm">
                    <thead className="sticky top-0 bg-gray-100 z-10">
                      <tr className="text-left">
                        {columnOrder.map((key) => (
                          <th
                            key={key}
                            onClick={() => handleSort(key)}
                            className="border px-3 py-2 cursor-pointer select-none bg-gray-100"
                          >
                            {key}
                            {sortConfig.key === key && (
                              <span className="ml-1">{sortConfig.direction === "asc" ? "▲" : "▼"}</span>
                            )}
                          </th>
                        ))}
                        <th className="border px-3 py-2 bg-gray-100">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedData.map((row, idx) => {
                        const rowKey = `${row["Distributor Code"]}_${row["Month"]}_${row["Report Type"]}`;
                        const remark = editedRemarks[rowKey] ?? row["Remark"] ?? "";
                        const isEdited = editedRemarks.hasOwnProperty(rowKey);
                        return (
                          <tr key={idx} className={`transition ${isEdited ? "bg-yellow-100" : "bg-red-50 hover:bg-red-100"}`}>
                            {columnOrder.map((key, j) => (
                              <td key={j} className={`border px-3 py-2 ${key === "Report Status" && row[key]?.toLowerCase() === "mismatch" ? "text-red-600 font-semibold" : ""}`}>
                                {key === "Remark" ? (
                                  <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                    value={remark}
                                    onChange={(e) =>
                                      setEditedRemarks((prev) => ({
                                        ...prev,
                                        [rowKey]: e.target.value,
                                      }))
                                    }
                                  />
                                ) : (
                                  row[key]
                                )}
                              </td>
                            ))}
                            <td className="border px-3 py-2 text-center">
                              {isEdited && (
                                <button
                                  onClick={() => handleSaveSingleRemark(rowKey)}
                                  className="text-green-600 hover:text-green-800"
                                  title="Save"
                                >
                                  <Save size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {filteredData.length > rowsPerPage && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-600">Page {currentPage} of {totalPages}</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-sm"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-sm"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default MismatchTrackerReport;

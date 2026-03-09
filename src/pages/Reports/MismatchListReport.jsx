import React, { useEffect, useState, useMemo, useCallback } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebaseClient";
import {
    Loader2,
    AlertTriangle,
    Copy,
    Check,
    Filter,
    X,
    RefreshCw,
    Building2,
    Calendar,
    FileText,
    LayoutGrid,
} from "lucide-react";

// ─── Copy Hook ────────────────────────────────────────────────────────────────
function useCopyToClipboard(timeout = 1800) {
    const [copiedKey, setCopiedKey] = useState(null);
    const copy = useCallback(
        (text, key) => {
            navigator.clipboard.writeText(text).then(() => {
                setCopiedKey(key);
                setTimeout(() => setCopiedKey(null), timeout);
            });
        },
        [timeout]
    );
    return { copiedKey, copy };
}

// ─── FilterButtonGroup ─────────────────────────────────────────────────────────
function FilterButtonGroup({ label, icon: Icon, options, value, onChange, color = "blue" }) {
    const colorMap = {
        blue: {
            active: "bg-blue-600 text-white border-blue-600 shadow-sm",
            inactive: "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600",
            label: "text-blue-700",
            icon: "text-blue-500",
        },
        violet: {
            active: "bg-violet-600 text-white border-violet-600 shadow-sm",
            inactive: "bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-600",
            label: "text-violet-700",
            icon: "text-violet-500",
        },
        amber: {
            active: "bg-amber-500 text-white border-amber-500 shadow-sm",
            inactive: "bg-white text-gray-600 border-gray-200 hover:border-amber-300 hover:text-amber-600",
            label: "text-amber-700",
            icon: "text-amber-500",
        },
    };
    const c = colorMap[color] || colorMap.blue;

    return (
        <div className="mb-5">
            <div className={`flex items-center gap-1.5 mb-2 text-xs font-bold uppercase tracking-wider ${c.label}`}>
                <Icon size={13} className={c.icon} />
                {label}
            </div>
            <div className="flex flex-col gap-1.5">
                {options.map((opt) => (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => onChange(opt)}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-medium transition-all duration-150 truncate
              ${value === opt ? c.active : c.inactive}`}
                    >
                        {opt === "All" ? `All ${label}s` : opt}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── CopyButton ────────────────────────────────────────────────────────────────
function CopyButton({ text, copyKey, copiedKey, onCopy, label }) {
    const isCopied = copiedKey === copyKey;
    return (
        <button
            type="button"
            onClick={() => onCopy(text, copyKey)}
            title={`Copy ${label}`}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200
        ${isCopied
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                    : "bg-white border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-800 active:scale-95"
                }`}
        >
            {isCopied ? <Check size={12} /> : <Copy size={12} />}
            {isCopied ? "Copied!" : `Copy ${label}`}
        </button>
    );
}

// ─── DistributorCard ───────────────────────────────────────────────────────────
function DistributorCard({ period, businessType, reportType, codes, names, copiedKey, onCopy }) {
    const codeText = codes.join(", ");
    const nameText = names.join(", ");
    const count = codes.length;

    return (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
            {/* Top accent stripe */}
            <div className="h-0.5 w-full bg-gradient-to-r from-rose-500 to-red-400" />

            {/* Card header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    <AlertTriangle size={10} />
                    {count} Mismatch{count > 1 ? "es" : ""}
                </span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                    {period}
                </span>
                {businessType && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-100">
                        {businessType}
                    </span>
                )}
                {reportType && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                        {reportType}
                    </span>
                )}
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
                {/* Distributor Codes */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            Distributor Code{count > 1 ? "s" : ""}
                        </span>
                        <CopyButton
                            text={codeText}
                            copyKey={`code-${period}-${businessType}-${reportType}`}
                            copiedKey={copiedKey}
                            onCopy={onCopy}
                            label="Codes"
                        />
                    </div>
                    <div className="max-h-28 overflow-y-auto flex flex-wrap gap-1.5">
                        {codes.map((code, i) => (
                            <span
                                key={i}
                                className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-xs font-bold text-gray-800 font-mono"
                            >
                                {code}
                            </span>
                        ))}
                    </div>

                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Distributor Names */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                            Distributor Name{count > 1 ? "s" : ""}
                        </span>
                        <CopyButton
                            text={nameText}
                            copyKey={`name-${period}-${businessType}-${reportType}`}
                            copiedKey={copiedKey}
                            onCopy={onCopy}
                            label="Names"
                        />
                    </div>
                    <div className="max-h-28 overflow-y-auto space-y-1">
                        {names.map((name, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                                <span className="text-sm text-gray-800 font-medium">{name}</span>
                            </div>
                        ))}
                    </div>
                    {count > 1 && (
                        <p className="mt-1.5 text-[10px] text-gray-400 font-medium select-all break-all">{nameText}</p>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MismatchListReport() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [yearOptions, setYearOptions] = useState([]);

    // Default: current year, previous month
    const _now = new Date();
    const _defaultYear = String(_now.getFullYear());
    const _prevMonthIdx = _now.getMonth() - 1;
    const _defaultMonth = _prevMonthIdx < 0
        ? { num: "12" }
        : { num: String(_prevMonthIdx + 1).padStart(2, "0") };

    const [filters, setFilters] = useState({
        businessType: "HPC",
        year: _defaultYear,
        month: _defaultMonth.num,
        reportType: "All",
    });

    const { copiedKey, copy } = useCopyToClipboard();

    // ── Load years from master_years ──────────────────────────────────────
    useEffect(() => {
        let alive = true;
        getDocs(collection(db, "master_years"))
            .then((snap) => {
                if (!alive) return;
                const years = snap.docs
                    .map((d) => d.data())
                    .filter((r) => r.active !== false)
                    .map((r) => String(r.year ?? "").trim())
                    .filter(Boolean)
                    .sort((a, b) => Number(b) - Number(a));
                setYearOptions(Array.from(new Set(years)));
            })
            .catch((e) => console.error("loadYears:", e));
        return () => { alive = false; };
    }, []);

    // ── Fetch from Firestore reconCells ──────────────────────────────────────────
    useEffect(() => {
        let alive = true;
        setLoading(true);
        setError(null);

        async function loadMismatches() {
            try {
                // Build periodId like "2026-02"
                const periodId = `${filters.year}-${filters.month}`;

                const q = query(
                    collection(db, "reconCells"),
                    where("periodId", "==", periodId),
                    where("businessType", "==", filters.businessType)
                );

                const snap = await getDocs(q);
                if (!alive) return;

                const mismatches = snap.docs
                    .map((d) => ({ id: d.id, ...d.data() }))
                    .filter((r) => {
                        const s = String(r.status || "").trim().toLowerCase();
                        return s === "mismatch";
                    })
                    .map((r) => ({
                        "Business Type": String(r.businessType || ""),
                        "Distributor Code": String(r.distributorCode || ""),
                        "Distributor Name": String(r.distributorName || ""),
                        "Report Type": String(r.reportTypeName || r.reportTypeId || ""),
                        "Report Status": "Mismatch",
                    }));

                setData(mismatches);
            } catch (err) {
                console.error("Firestore mismatch fetch error:", err);
                if (alive) setError("Failed to load data from Firestore. Please try again.");
                setData([]);
            } finally {
                if (alive) setLoading(false);
            }
        }

        loadMismatches();
        return () => { alive = false; };
    }, [filters.year, filters.month, filters.businessType, refreshKey]);

    // ── Unique filter options ─────────────────────────────────────────────────────
    const uniqueYears = useMemo(
        () => Array.from(new Set(data.map((r) => String(r["Year"] || "")).filter(Boolean))).sort().reverse(),
        [data]
    );

    const MONTH_LABELS = [
        { num: "01", label: "January" },
        { num: "02", label: "February" },
        { num: "03", label: "March" },
        { num: "04", label: "April" },
        { num: "05", label: "May" },
        { num: "06", label: "June" },
        { num: "07", label: "July" },
        { num: "08", label: "August" },
        { num: "09", label: "September" },
        { num: "10", label: "October" },
        { num: "11", label: "November" },
        { num: "12", label: "December" },
    ];


    const uniqueReportTypes = useMemo(
        () => ["All", ...Array.from(new Set(data.map((r) => r["Report Type"]).filter(Boolean))).sort()],
        [data]
    );

    // ── Filtered — year/month scoping is done at the Firestore query level ─────────
    const filteredData = useMemo(() => {
        return data.filter((row) => {
            if (filters.reportType !== "All" && row["Report Type"] !== filters.reportType) return false;
            return true;
        });
    }, [data, filters.reportType]);

    // ── Group by Business Type + Report Type (period already fixed by query) ────────
    const grouped = useMemo(() => {
        const period = `${filters.year}-${filters.month}`;
        const map = new Map();
        filteredData.forEach((row) => {
            const bt = row["Business Type"] || "";
            const rt = row["Report Type"] || "";
            const key = `${period}||${bt}||${rt}`;

            if (!map.has(key)) {
                map.set(key, { period, businessType: bt, reportType: rt, codes: [], names: [] });
            }
            const entry = map.get(key);
            const code = row["Distributor Code"] || "";
            const name = row["Distributor Name"] || "";
            if (code && !entry.codes.includes(code)) {
                entry.codes.push(code);
                entry.names.push(name);
            }
        });
        return Array.from(map.values()).sort((a, b) => a.businessType.localeCompare(b.businessType));
    }, [filteredData, filters.year, filters.month]);

    const totalMismatches = grouped.reduce((s, g) => s + g.codes.length, 0);
    const activeFilterCount = [filters.reportType !== "All"].filter(Boolean).length;
    const clearFilters = () => setFilters((p) => ({ ...p, reportType: "All" }));
    const selectedMonthLabel = MONTH_LABELS.find((m) => m.num === filters.month)?.label ?? filters.month;

    return (
        <div className="flex overflow-hidden" style={{ height: "calc(100vh - 120px)" }}>

            {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
            <aside
                className={`shrink-0 transition-all duration-300 ${sidebarOpen ? "w-60" : "w-0 overflow-hidden"} border-r border-gray-100 bg-gray-50`}
            >
                <div className="w-60 p-4 h-full overflow-y-auto">
                    {/* Sidebar Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Filter size={14} className="text-gray-500" />
                            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Filters</span>
                            {activeFilterCount > 0 && (
                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold">
                                    {activeFilterCount}
                                </span>
                            )}
                        </div>
                        {activeFilterCount > 0 && (
                            <button
                                onClick={clearFilters}
                                className="text-[10px] text-rose-500 font-semibold hover:text-rose-700 flex items-center gap-0.5"
                            >
                                <X size={10} /> Clear
                            </button>
                        )}
                    </div>
                    {/* ── Business Type ── */}
                    <div className="mb-3">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-violet-600 mb-1.5">Business Type</p>
                        <div className="grid grid-cols-3 gap-1">
                            {["HPC", "IC"].map((bt) => (
                                <button key={bt} type="button"
                                    onClick={() => setFilters((p) => ({ ...p, businessType: bt }))}
                                    className={`py-1.5 rounded-md border text-[11px] font-semibold text-center transition-all duration-150
                                        ${filters.businessType === bt
                                            ? "bg-violet-600 text-white border-violet-600"
                                            : "bg-white text-gray-600 border-gray-200 hover:border-violet-400 hover:text-violet-700"}`}>
                                    {bt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Year ── */}
                    <div className="mb-3">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-blue-600 mb-1.5">Year</p>
                        <div className="grid grid-cols-3 gap-1">
                            {(yearOptions.length ? yearOptions : [_defaultYear]).map((y) => (
                                <button key={y} type="button"
                                    onClick={() => setFilters((p) => ({ ...p, year: y }))}
                                    className={`py-1.5 rounded-md border text-[11px] font-semibold text-center transition-all duration-150
                                        ${filters.year === y
                                            ? "bg-blue-600 text-white border-blue-600"
                                            : "bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-700"}`}>
                                    {y}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Month ── */}
                    <div className="mb-3">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-600 mb-1.5">Month</p>
                        <div className="grid grid-cols-3 gap-1">
                            {MONTH_LABELS.map(({ num, label }) => (
                                <button key={num} type="button"
                                    onClick={() => setFilters((p) => ({ ...p, month: num }))}
                                    className={`py-1.5 rounded-md border text-[11px] font-medium text-center transition-all duration-150
                                        ${filters.month === num
                                            ? "bg-indigo-600 text-white border-indigo-600"
                                            : "bg-white text-gray-600 border-gray-200 hover:border-indigo-400 hover:text-indigo-700"}`}>
                                    {label.slice(0, 3)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Report Type ── */}
                    <div className="mb-3">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-amber-600 mb-1.5">Report Type</p>
                        <div className="grid grid-cols-3 gap-1">
                            {uniqueReportTypes.map((rt) => (
                                <button key={rt} type="button"
                                    onClick={() => setFilters((p) => ({ ...p, reportType: rt }))}
                                    className={`py-1.5 rounded-md border text-[11px] font-medium text-center transition-all duration-150 truncate
                                        ${filters.reportType === rt
                                            ? "bg-amber-500 text-white border-amber-500"
                                            : "bg-white text-gray-600 border-gray-200 hover:border-amber-400 hover:text-amber-700"}`}
                                    title={rt}>
                                    {rt === "All" ? "All" : rt.length > 6 ? rt.slice(0, 5) + "…" : rt}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </aside>

            {/* ── Main Content ────────────────────────────────────────────────────── */}
            <main className="flex-1 min-w-0 flex flex-col overflow-hidden">

                {/* Toolbar */}
                <div className="bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setSidebarOpen((p) => !p)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-all"
                        >
                            <Filter size={13} />
                            Filters
                            {activeFilterCount > 0 && (
                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        {/* Active filter chips */}
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-200 text-[10px] font-bold text-violet-700">
                            {filters.businessType}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-[10px] font-bold text-blue-700">
                            {filters.year}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-[10px] font-bold text-indigo-700">
                            {selectedMonthLabel}
                        </span>
                        {filters.reportType !== "All" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700">
                                {filters.reportType}
                                <button onClick={() => setFilters((p) => ({ ...p, reportType: "All" }))}><X size={9} /></button>
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                                <AlertTriangle size={12} />
                                {totalMismatches} mismatch{totalMismatches !== 1 ? "es" : ""}
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-600">
                                <LayoutGrid size={12} />
                                {grouped.length} group{grouped.length !== 1 ? "s" : ""}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setRefreshKey((k) => k + 1)}
                            disabled={loading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-all disabled:opacity-50"
                        >
                            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <Loader2 className="animate-spin text-rose-500 mb-3" size={36} />
                            <p className="text-sm font-semibold text-gray-600">Loading mismatch data…</p>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <AlertTriangle size={32} className="text-rose-400 mb-3" />
                            <p className="text-sm font-semibold text-gray-700">{error}</p>
                            <button
                                onClick={() => setRefreshKey((k) => k + 1)}
                                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
                            >
                                <RefreshCw size={12} /> Try Again
                            </button>
                        </div>
                    )}

                    {!loading && !error && grouped.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mb-3">
                                <Check size={22} className="text-emerald-500" />
                            </div>
                            <p className="text-sm font-semibold text-gray-700">No mismatches found</p>
                            <p className="text-xs text-gray-400 mt-1">
                                {activeFilterCount > 0 ? "Try adjusting your filters" : "All records are matching!"}
                            </p>
                            {activeFilterCount > 0 && (
                                <button onClick={clearFilters} className="mt-3 text-xs text-rose-500 font-semibold hover:text-rose-700 flex items-center gap-1">
                                    <X size={11} /> Clear filters
                                </button>
                            )}
                        </div>
                    )}

                    {!loading && !error && grouped.length > 0 && (
                        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                            {grouped.map((group, idx) => (
                                <DistributorCard
                                    key={`${group.period}-${group.businessType}-${group.reportType}-${idx}`}
                                    {...group}
                                    copiedKey={copiedKey}
                                    onCopy={copy}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

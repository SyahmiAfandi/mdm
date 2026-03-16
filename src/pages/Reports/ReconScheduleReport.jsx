import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import {
    Loader2,
    CalendarDays,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    Copy,
    Check,
} from "lucide-react";

const CELLS_TABLE = "recon_cells";
const REPORT_TYPES_TABLE = "master_reporttypes";
const DISTRIBUTORS_TABLE = "master_distributors";

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTH_LABELS = [
    { num: "01", label: "January", short: "Jan" },
    { num: "02", label: "February", short: "Feb" },
    { num: "03", label: "March", short: "Mar" },
    { num: "04", label: "April", short: "Apr" },
    { num: "05", label: "May", short: "May" },
    { num: "06", label: "June", short: "Jun" },
    { num: "07", label: "July", short: "Jul" },
    { num: "08", label: "August", short: "Aug" },
    { num: "09", label: "September", short: "Sep" },
    { num: "10", label: "October", short: "Oct" },
    { num: "11", label: "November", short: "Nov" },
    { num: "12", label: "December", short: "Dec" },
];

function getLastDay(year, monthNum) {
    return new Date(Number(year), Number(monthNum), 0).getDate();
}

function formatClosingDate(year, monthNum, monthShort) {
    return `${getLastDay(year, monthNum)}-${monthShort}`;
}

function ordinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function normalize(value = "") {
    return String(value ?? "").trim();
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
        ...row,
        periodId: normalize(row.period_id ?? row.periodId ?? row.id),
        businessType: normalize(row.business_type ?? row.businessType ?? ""),
        reportTypeId: normalize(row.report_type_id ?? row.reportTypeId ?? row.report_type_code ?? row.reportTypeCode ?? ""),
        reportTypeName: normalize(row.report_type_name ?? row.reportTypeName ?? ""),
        distributorCode: normalize(row.distributor_code ?? row.distributorCode ?? ""),
        distributorName: normalize(row.distributor_name ?? row.distributorName ?? ""),
        reconsNo: Number(row.recons_no ?? row.reconsNo ?? 1),
        updatedAt: row.updated_at ?? row.updatedAt ?? null,
    };
}

// ─── Copy Hook ─────────────────────────────────────────────────────────────
function useCopy(timeout = 1800) {
    const [copiedKey, setCopiedKey] = useState(null);
    const copy = useCallback((text, key) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), timeout);
        });
    }, [timeout]);
    return { copiedKey, copy };
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────
function StatusBadge({ text }) {
    if (!text) return <span className="text-gray-300 text-xs">—</span>;
    const lower = text.toLowerCase();
    if (lower.includes("all match") || lower === "match") {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 size={10} /> {text}
            </span>
        );
    }
    if (lower.includes("mismatch")) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <AlertTriangle size={10} /> {text}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
            {text}
        </span>
    );
}

// ─── CopyButton ──────────────────────────────────────────────────────────────
function CopyButton({ text, copyKey, copiedKey, onCopy }) {
    const done = copiedKey === copyKey;
    return (
        <button
            type="button"
            title="Copy row data"
            onClick={() => onCopy(text, copyKey)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-semibold transition-all duration-200 ${done
                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                : "bg-white border-gray-200 text-gray-500 hover:border-violet-400 hover:text-violet-700 active:scale-95"
                }`}
        >
            {done ? <Check size={11} /> : <Copy size={11} />}
            {done ? "Copied!" : "Copy"}
        </button>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReconScheduleReport() {
    const now = new Date();
    const defaultYear = String(now.getFullYear());

    const [yearOptions, setYearOptions] = useState([]);
    const [selectedYear, setSelectedYear] = useState(defaultYear);
    const [selectedBT, setSelectedBT] = useState("HPC");
    const [cells, setCells] = useState([]);
    const [rptNameById, setRptNameById] = useState(new Map());
    const [distNameByCode, setDistNameByCode] = useState(new Map());
    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const { copiedKey, copy } = useCopy();

    // ── Load years ──────────────────────────────────────────────────────────────
    useEffect(() => {
        let alive = true;
        supabase.from("master_years").select("*")
            .then(({ data, error }) => {
                if (!alive) return;
                if (error) throw error;
                const years = (data || [])
                    .filter((r) => r.active !== false)
                    .map((r) => String(r.year ?? "").trim())
                    .filter(Boolean)
                    .sort((a, b) => Number(b) - Number(a));
                const uniq = Array.from(new Set(years));
                setYearOptions(uniq);
                if (uniq.length && !uniq.includes(selectedYear)) setSelectedYear(uniq[0]);
            })
            .catch(console.error);
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Load report types ───────────────────────────────────────────────────────
    useEffect(() => {
        let alive = true;
        supabase.from(REPORT_TYPES_TABLE).select("*")
            .then(({ data, error }) => {
                if (!alive) return;
                if (error) throw error;
                const m = new Map();
                (data || []).map(mapReportType).forEach((v) => {
                    const id = v.id;
                    const name = v.name;
                    const active = v.active;
                    const status = v.status;
                    if (!id || !active || (status && status !== "active")) return;
                    m.set(id, name);
                });
                setRptNameById(m);
            })
            .catch(console.error);
        return () => { alive = false; };
    }, []);

    // ── Load distributors ────────────────────────────────────────────────────────
    useEffect(() => {
        let alive = true;
        supabase.from(DISTRIBUTORS_TABLE).select("*")
            .then(({ data, error }) => {
                if (!alive) return;
                if (error) throw error;
                const m = new Map();
                (data || []).map(mapDistributor).forEach((v) => {
                    const code = v.code;
                    const name = v.name;
                    if (code) m.set(code, name);
                });
                setDistNameByCode(m);
            })
            .catch(console.error);
        return () => { alive = false; };
    }, []);

    // ── Load reconCells for all 12 months of the selected year ─────────────────
    useEffect(() => {
        let alive = true;
        setLoading(true);

        async function load() {
            try {
                const results = await Promise.all(
                    MONTH_LABELS.map(({ num }) =>
                        supabase.from(CELLS_TABLE)
                            .select("*")
                            .eq("period_id", `${selectedYear}-${num}`)
                            .eq("business_type", selectedBT)
                            .then(({ data, error }) => {
                                if (error) throw error;
                                return (data || []).map((d) => ({
                                    ...mapCell(d),
                                    _periodId: `${selectedYear}-${num}`,
                                }));
                            })
                    )
                );
                if (alive) setCells(results.flat());
            } catch (e) {
                console.error("ReconScheduleReport load error:", e);
                if (alive) setCells([]);
            } finally {
                if (alive) setLoading(false);
            }
        }

        load();
        return () => { alive = false; };
    }, [selectedYear, selectedBT, rptNameById, refreshKey]);

    // ── Build one row per (periodId, reportType, reconNo) ──────────────────────
    // DT code / name collapsed to comma-separated in a single row.
    const scheduleByMonth = useMemo(() => {
        // byPeriod[periodId][reportTypeName][reconNo] = { reconDate, codes[], names[], status }
        const byPeriod = {};

        cells.forEach((cell) => {
            const periodId = cell._periodId || "";
            const reportTypeId = String(cell.reportTypeId || "").trim();
            const reportTypeName =
                String(cell.reportTypeName || "").trim() ||
                rptNameById.get(reportTypeId) ||
                reportTypeId;

            const distributorCode = String(cell.distributorCode || "").trim();
            const masterName = distNameByCode.get(distributorCode);
            const distributorName = masterName || String(cell.distributorName || "").trim();

            // Use reconsNo to differentiate attempt (1 = 1st Recon, 2 = 2nd Recon, …)
            const reconsNo = Number(cell.reconsNo || 1);
            const statusRaw = String(cell.status || "").trim().toLowerCase();
            const isMismatch = statusRaw === "mismatch";

            // Resolve recon date from updatedAt
            const updatedAt = cell.updatedAt ? new Date(cell.updatedAt) : null;
            const reconDate = updatedAt && !isNaN(updatedAt.getTime())
                ? (() => {
                    const dd = String(updatedAt.getDate()).padStart(2, "0");
                    const mm = String(updatedAt.getMonth() + 1).padStart(2, "0");
                    const yyyy = updatedAt.getFullYear();
                    return `${dd}/${mm}/${yyyy}`;
                })()
                : "";

            if (!byPeriod[periodId]) byPeriod[periodId] = {};
            if (!byPeriod[periodId][reportTypeName]) byPeriod[periodId][reportTypeName] = {};

            const byRT = byPeriod[periodId][reportTypeName];
            if (!byRT[reconsNo]) {
                byRT[reconsNo] = { reconsNo, reconDate, codes: [], names: [], hasMismatch: false };
            }

            const entry = byRT[reconsNo];
            // Capture date from whichever cell has it (first wins)
            if (!entry.reconDate && reconDate) entry.reconDate = reconDate;

            if (isMismatch && distributorCode && !entry.codes.includes(distributorCode)) {
                entry.codes.push(distributorCode);
                entry.names.push(distributorName);
                entry.hasMismatch = true;
            }
        });

        // Assemble month objects
        return MONTH_LABELS.map(({ num, short, label }) => {
            const periodId = `${selectedYear}-${num}`;
            const closingDate = formatClosingDate(selectedYear, num, short);
            const reportTypes = byPeriod[periodId] || {};

            // One flat row per (reportTypeName, reconNo)
            const rows = [];
            Object.entries(reportTypes)
                .sort(([a], [b]) => a.localeCompare(b))
                .forEach(([reportTypeName, reconAttempts]) => {
                    // Only get the maximum reconNo attempt for this report type
                    const attemptsEntries = Object.entries(reconAttempts).sort(([a], [b]) => Number(b) - Number(a));
                    if (attemptsEntries.length === 0) return;

                    // The most recent attempt is the first one after sorting descending
                    const [reconNoStr, { reconDate, codes, names, hasMismatch }] = attemptsEntries[0];
                    const reconNo = Number(reconNoStr);
                    const reconLabel = `${ordinal(reconNo)} Recon`;
                    const dtCodes = codes.join(", ");
                    const dtNames = names.join(", ");
                    const remarkText = hasMismatch
                        ? `${codes.length} DT Mismatch`
                        : "All Match";

                    rows.push({
                        key: `${periodId}-${reportTypeName}-${reconNo}`,
                        reportTypeName,
                        closingDate: rows.length === 0 ? closingDate : "",
                        reconLabel,
                        reconDate,
                        remarks: remarkText,
                        dtCodes,
                        dtNames,
                        isMismatch: hasMismatch,
                        isFirstRow: rows.length === 0,
                        // Copy text spans: Report → DT Name
                        copyText: [reportTypeName, selectedBT, reconLabel, reconDate, remarkText, dtCodes, dtNames]
                            .join("\t"),
                    });
                });

            return {
                periodId,
                monthNum: num,
                monthShort: short,
                monthLabel: label,
                closingDate,
                rows,
                hasData: rows.length > 0,
                totalMismatches: rows.filter((r) => r.isMismatch).length,
            };
        });
    }, [cells, selectedYear, selectedBT, rptNameById, distNameByCode]);

    const totalMismatches = scheduleByMonth.reduce(
        (s, m) => s + m.rows.filter((r) => r.isMismatch).length,
        0
    );

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] overflow-hidden bg-gray-50">

            {/* ── Header ── */}
            <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between gap-4 shrink-0 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-violet-100 text-violet-600">
                        <CalendarDays size={20} />
                    </div>
                    <div>
                        <h1 className="text-[17px] font-black text-gray-900 tracking-tight leading-tight">
                            Recons Tracker Report
                        </h1>
                        <p className="text-[11px] text-gray-400 font-medium">
                            Monitor and track the status of each distributor's reconciliation report by period
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Business Type */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                        {["HPC", "IC"].map((bt) => (
                            <button
                                key={bt}
                                onClick={() => setSelectedBT(bt)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${selectedBT === bt
                                    ? "bg-violet-600 text-white shadow-sm"
                                    : "text-gray-600 hover:text-violet-700"
                                    }`}
                            >
                                {bt}
                            </button>
                        ))}
                    </div>

                    {/* Year */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                        {(yearOptions.length ? yearOptions : [defaultYear]).map((y) => (
                            <button
                                key={y}
                                onClick={() => setSelectedYear(y)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 ${selectedYear === y
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "text-gray-600 hover:text-blue-700"
                                    }`}
                            >
                                {y}
                            </button>
                        ))}
                    </div>

                    {!loading && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                            <AlertTriangle size={12} />
                            {totalMismatches} mismatch{totalMismatches !== 1 ? "es" : ""}
                        </span>
                    )}

                    <button
                        onClick={() => setRefreshKey((k) => k + 1)}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:border-gray-400 transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* ── Main Table ── */}
            <div className="flex-1 overflow-auto p-5">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <Loader2 className="animate-spin text-violet-500 mb-3" size={36} />
                        <p className="text-sm font-semibold text-gray-600">Loading schedule data…</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-[11px]">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        {[
                                            { label: "Year", w: "w-14" },
                                            { label: "Month", w: "w-20" },
                                            { label: "DT Closing", w: "w-24" },
                                            { label: "Report", w: "min-w-[160px]" },
                                            { label: "Dist. Type", w: "w-20" },
                                            { label: "Recon", w: "w-24" },
                                            { label: "Recon Date", w: "w-28" },
                                            { label: "Remarks", w: "min-w-[130px]" },
                                            { label: "DT Code", w: "min-w-[120px]" },
                                            { label: "DT Name", w: "min-w-[200px]" },
                                            { label: "Copy", w: "w-20" },
                                        ].map(({ label, w }) => (
                                            <th
                                                key={label}
                                                className={`border-r last:border-r-0 border-gray-200 px-3 py-2.5 text-left font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap ${w}`}
                                            >
                                                {label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100">
                                    {scheduleByMonth.map((monthData) => {
                                        if (!monthData.hasData) {
                                            // Empty month — single placeholder row
                                            return (
                                                <tr key={monthData.periodId} className="bg-white hover:bg-gray-50">
                                                    <td className="border-r border-gray-100 px-3 py-2 font-black text-slate-700 whitespace-nowrap">
                                                        {selectedYear}
                                                    </td>
                                                    <td className="border-r border-gray-100 px-3 py-2 font-semibold text-gray-700 whitespace-nowrap">
                                                        {monthData.monthShort}-{String(selectedYear).slice(-2)}
                                                    </td>
                                                    <td className="border-r border-gray-100 px-3 py-2 text-gray-400 whitespace-nowrap">
                                                        {monthData.closingDate}
                                                    </td>
                                                    <td colSpan={8} className="px-3 py-2 text-gray-300 italic text-[10px]">
                                                        No data
                                                    </td>
                                                </tr>
                                            );
                                        }

                                        return monthData.rows.map((row, rowIdx) => {
                                            const isFirst = rowIdx === 0;
                                            const bgClass = row.isMismatch
                                                ? "bg-yellow-50 hover:bg-yellow-100"
                                                : "bg-emerald-50/50 hover:bg-emerald-50";

                                            return (
                                                <tr key={row.key} className={`transition-colors ${bgClass}`}>
                                                    {/* Year — merged across all rows of this month */}
                                                    {isFirst && (
                                                        <td
                                                            rowSpan={monthData.rows.length}
                                                            className="border-r border-gray-200 px-3 py-2 font-black text-slate-700 whitespace-nowrap align-middle text-center bg-white"
                                                        >
                                                            {selectedYear}
                                                        </td>
                                                    )}

                                                    {/* Month — merged */}
                                                    {isFirst && (
                                                        <td
                                                            rowSpan={monthData.rows.length}
                                                            className="border-r border-gray-200 px-3 py-2 font-semibold text-gray-800 whitespace-nowrap align-middle bg-white"
                                                        >
                                                            {monthData.monthShort}-{String(selectedYear).slice(-2)}
                                                        </td>
                                                    )}

                                                    {/* DT Closing — only on first row of each report type (tracked by closingDate) */}
                                                    <td className="border-r border-gray-100 px-3 py-2 text-gray-600 whitespace-nowrap font-medium">
                                                        {row.closingDate}
                                                    </td>

                                                    {/* Report */}
                                                    <td className="border-r border-gray-100 px-3 py-2 text-gray-800 font-semibold">
                                                        {row.reportTypeName}
                                                    </td>

                                                    {/* Dist. Type */}
                                                    <td className="border-r border-gray-100 px-3 py-2 text-center">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                                                            {selectedBT}
                                                        </span>
                                                    </td>

                                                    {/* Recon */}
                                                    <td className="border-r border-gray-100 px-3 py-2 text-gray-700 font-medium whitespace-nowrap">
                                                        {row.reconLabel}
                                                    </td>

                                                    {/* Recon Date */}
                                                    <td className="border-r border-gray-100 px-3 py-2 text-gray-600 whitespace-nowrap font-mono text-[10px]">
                                                        {row.reconDate}
                                                    </td>

                                                    {/* Remarks */}
                                                    <td className="border-r border-gray-100 px-3 py-2">
                                                        <StatusBadge text={row.remarks} />
                                                    </td>

                                                    {/* DT Code — comma-separated */}
                                                    <td className="border-r border-gray-100 px-3 py-2 font-mono text-[10px] text-gray-700 leading-relaxed">
                                                        {row.dtCodes || <span className="text-gray-300">—</span>}
                                                    </td>

                                                    {/* DT Name — comma-separated */}
                                                    <td className="border-r border-gray-100 px-3 py-2 text-gray-700 leading-relaxed">
                                                        {row.dtNames || <span className="text-gray-300">—</span>}
                                                    </td>

                                                    {/* Copy button — always present on every row */}
                                                    <td className="px-3 py-2 text-center">
                                                        <CopyButton
                                                            text={row.copyText}
                                                            copyKey={row.key}
                                                            copiedKey={copiedKey}
                                                            onCopy={copy}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

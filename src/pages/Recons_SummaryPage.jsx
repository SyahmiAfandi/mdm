import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { saveAs } from 'file-saver';
import { DownloadIcon, Loader2, ChevronDownIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBackendUrl } from "../config/backend";
import { useUser } from "../context/UserContext";
import { assertSupabaseBrowserConfig, supabase } from "../supabaseClient";

const monthNames = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const RECON_CELLS_TABLE = 'recon_cells';
const DSS_REPORT_TABLE = 'daily_sales_summary_reports';
const SUPABASE_CHUNK_SIZE = 200;

// Get last month (if Jan, should go to Dec last year)
function getDefaultMonthYear() {
  const now = new Date();
  let month = now.getMonth(); // JS: 0=Jan, ..., 11=Dec
  let year = now.getFullYear();
  if (month === 0) {
    month = 11;
    year = year - 1;
  } else {
    month = month - 1;
  }
  return {
    defaultMonth: monthNames[month],
    defaultYear: String(year)
  };
}

function pickFirstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return '';
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function numberOrZero(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function monthNameToNumber(value) {
  const monthIndex = monthNames.findIndex(
    (month) => month.toLowerCase() === String(value ?? '').trim().toLowerCase()
  );
  if (monthIndex < 0) {
    throw new Error(`Invalid month '${value}'`);
  }
  return monthIndex + 1;
}

function makePeriodId(year, monthName) {
  return `${String(year).trim()}-${String(monthNameToNumber(monthName)).padStart(2, '0')}`;
}

function makeCellId(periodId, businessType, distributorCode, reportTypeId) {
  return `${periodId}__${businessType}__${distributorCode}__${reportTypeId}`;
}

function normalizeReconStatus(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'match') return 'match';
  if (normalized === 'mismatch') return 'mismatch';
  if (['no data', 'no_data', 'nodata'].includes(normalized)) return 'no_data';
  return normalized || 'mismatch';
}

function chunkArray(items, chunkSize = SUPABASE_CHUNK_SIZE) {
  const chunks = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

function normalizeDssRow(row = {}) {
  return {
    distributor_code: normalizeText(
      pickFirstValue(
        row.distributor_code,
        row.distributorCode,
        row.Distributor,
        row['Distributor Code'],
        row.distributor
      )
    ),
    distributor_name: normalizeText(
      pickFirstValue(
        row.distributor_name,
        row.distributorName,
        row['Distributor Name'],
        row.Name,
        row.name
      )
    ),
    csdp_sales_qty_cs: numberOrZero(
      pickFirstValue(
        row.csdp_sales_qty_cs,
        row.csdpSalesQtyCs,
        row['CSDP Sales Qty CS'],
        row['CSDP_Sales Qty CS']
      )
    ),
    osdp_sales_qty_cs: numberOrZero(
      pickFirstValue(
        row.osdp_sales_qty_cs,
        row.osdpSalesQtyCs,
        row['OSDP Sales Qty CS'],
        row['OSDP_Sales Qty CS']
      )
    ),
    csdp_sale_qty_pc: numberOrZero(
      pickFirstValue(
        row.csdp_sale_qty_pc,
        row.csdpSaleQtyPc,
        row['CSDP Sale Qty PC'],
        row['CSDP_Sale Qty PC']
      )
    ),
    osdp_sale_qty_pc: numberOrZero(
      pickFirstValue(
        row.osdp_sale_qty_pc,
        row.osdpSaleQtyPc,
        row.osdpSalesQtyPc,
        row['OSDP Sale Qty PC'],
        row['OSDP_Sale Qty PC']
      )
    ),
    csdp_free_total_qty: numberOrZero(
      pickFirstValue(
        row.csdp_free_total_qty,
        row.csdpFreeTotalQty,
        row['CSDP Free Total Qty'],
        row['CSDP_Free Total Qty']
      )
    ),
    osdp_free_total_qty: numberOrZero(
      pickFirstValue(
        row.osdp_free_total_qty,
        row.osdpFreeTotalQty,
        row['OSDP Free Total Qty'],
        row['OSDP_Free Total Qty']
      )
    ),
    csdp_gsv_amount: numberOrZero(
      pickFirstValue(
        row.csdp_gsv_amount,
        row.csdpGsvAmount,
        row['CSDP GSV'],
        row['CSDP GSV Amount'],
        row['CSDP_GSV'],
        row['CSDP_GSV Amount']
      )
    ),
    osdp_gsv_amount: numberOrZero(
      pickFirstValue(
        row.osdp_gsv_amount,
        row.osdpGsvAmount,
        row['OSDP GSV'],
        row['OSDP GSV Amount'],
        row['OSDP_GSV'],
        row['OSDP_GSV Amount']
      )
    ),
    csdp_niv_total: numberOrZero(
      pickFirstValue(
        row.csdp_niv_total,
        row.csdpNivTotal,
        row['CSDP NIV'],
        row['CSDP NIV Total'],
        row['CSDP_NIV'],
        row['CSDP_NIV Total']
      )
    ),
    osdp_niv_total: numberOrZero(
      pickFirstValue(
        row.osdp_niv_total,
        row.osdpNivTotal,
        row['OSDP NIV'],
        row['OSDP NIV Total'],
        row['OSDP_NIV'],
        row['OSDP_NIV Total']
      )
    ),
    csdp_sales_turn_over: numberOrZero(
      pickFirstValue(
        row.csdp_sales_turn_over,
        row.csdpSalesTurnOver,
        row['CSDP Sales Turn Over'],
        row['CSDP_Sales Turn Over']
      )
    ),
    osdp_sales_turn_over: numberOrZero(
      pickFirstValue(
        row.osdp_sales_turn_over,
        row.osdpSalesTurnOver,
        row['OSDP Sales Turn Over'],
        row['OSDP_Sales Turn Over']
      )
    ),
  };
}

function isDssMatch(row = {}) {
  const varGsv = Math.abs(numberOrZero(row.csdp_gsv_amount) - numberOrZero(row.osdp_gsv_amount));
  const varNiv = Math.abs(numberOrZero(row.csdp_niv_total) - numberOrZero(row.osdp_niv_total));
  return varGsv < 0.01 && varNiv < 0.01;
}

function ReconciliationSummary() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();

  // --- Place this at the top ---
  const resultId = location.state?.result_id || sessionStorage.getItem('reconcileResultId');

  // --- All hooks ---
  const [osdpData, setOsdpData] = useState([]);
  const [pbiData, setPbiData] = useState([]);
  const [dssRows, setDssRows] = useState([]);
  const [fullResult, setFullResult] = useState(null);
  const [source, setSource] = useState('OSDP');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const fromButton = location.state?.fromButton || sessionStorage.getItem('fromButton') || 'N/A';
  const businessType = location.state?.businessType || sessionStorage.getItem('businessType') || 'N/A';
  const reportTypeId =location.state?.reportTypeId || sessionStorage.getItem("reportTypeId") || "";
  const reportTypeName =location.state?.reportTypeName || sessionStorage.getItem("reportTypeName") || fromButton;
  const normalizedReportType = String(reportTypeName || fromButton || "").trim().toLowerCase();
  const isHpcDssReport = businessType === 'HPC' && normalizedReportType === 'daily sales summary';
  const [exporting, setExporting] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const { defaultMonth, defaultYear } = getDefaultMonthYear();
  const [exportYear, setExportYear] = useState(defaultYear);
  const [exportMonth, setExportMonth] = useState(defaultMonth);
  const creator =
    user?.display_name?.trim() ||
    localStorage.getItem('display_name') ||
    localStorage.getItem('username') ||
    'Auto Generated';
  const [loading, setLoading] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const backendUrl = getBackendUrl();
  const requireBackend = () => {
    if (!backendUrl) {
      toast.error("Backend URL not set. Please set Tunnel URL in Header.");
      throw new Error("Backend URL not set");
    }
    return backendUrl;
  };

  // --- Early navigation effect, NO return! ---
  useEffect(() => {
    if (!resultId) {
      toast.error("No reconciliation result found. Please upload and process files first.");
      navigate('/recons/hpc_fcs');
    }
  }, [resultId, navigate]);

  // optional: persist if coming from state
  useEffect(() => {
    if (location.state?.reportTypeId) sessionStorage.setItem("reportTypeId", location.state.reportTypeId);
    if (location.state?.reportTypeName) sessionStorage.setItem("reportTypeName", location.state.reportTypeName);
  }, [location.state?.reportTypeId, location.state?.reportTypeName]);

  // --- Data fetching effect ---
  useEffect(() => {
    if (!resultId) return; // Only fetch if resultId exists
    setLoading(true);
    fetch(`${requireBackend()}/get_reconcile_summary?result_id=${resultId}`)
      .then(res => res.json())
      .then(data => {
        setOsdpData(data.summary_osdp || []);
        setPbiData(data.summary_pbi || []);
        setDssRows(data.dss_report_rows || []);
        setFullResult(data);
        sessionStorage.setItem('keyColumns', JSON.stringify(data.key_columns || []));
      })
      .catch(err => {
        console.error('Error fetching summary:', err);
        toast.error('Failed to load reconciliation summary.');
      })
      .finally(() => setLoading(false));
  }, [resultId]);

  // --- Hover logic for dropdown ---
  useEffect(() => {
    if (!showExportOptions) return;
    if (!isHovering) {
      const timeout = setTimeout(() => setShowExportOptions(false), 100);
      return () => clearTimeout(timeout);
    }
  }, [isHovering, showExportOptions]);

  // --- Export handlers ---
  const exportReconCellsDirect = async (records) => {
    const year = Number(exportYear);
    const month = monthNameToNumber(exportMonth);
    const periodId = makePeriodId(exportYear, exportMonth);
    const effectiveReportTypeId =
      normalizeText(reportTypeId) ||
      normalizeText(reportTypeName) ||
      normalizeText(fromButton);
    const effectiveReportTypeName =
      normalizeText(reportTypeName) ||
      normalizeText(fromButton) ||
      effectiveReportTypeId;

    const normalizedRecords = (Array.isArray(records) ? records : [])
      .map((row) => ({
        distributor_code: normalizeText(
          pickFirstValue(
            row?.Distributor,
            row?.['Distributor Code'],
            row?.distributor_code,
            row?.distributorCode,
            row?.distributor
          )
        ),
        distributor_name: normalizeText(
          pickFirstValue(
            row?.['Distributor Name'],
            row?.distributor_name,
            row?.distributorName,
            row?.Name,
            row?.name
          )
        ),
        status: normalizeReconStatus(
          pickFirstValue(row?.Status, row?.status)
        ),
        remark: normalizeText(pickFirstValue(row?.Remark, row?.remark)),
      }))
      .filter((row) => row.distributor_code);

    if (!normalizedRecords.length) {
      throw new Error('No valid records to export to recon_cells.');
    }

    const cellIds = normalizedRecords.map((row) =>
      makeCellId(periodId, businessType, row.distributor_code, effectiveReportTypeId)
    );

    const existingRowsById = new Map();
    for (const chunk of chunkArray(cellIds)) {
      const { data, error } = await supabase
        .from(RECON_CELLS_TABLE)
        .select('id,status,recons_no,created_at,created_by')
        .in('id', chunk);
      if (error) throw error;
      for (const row of data || []) {
        existingRowsById.set(row.id, row);
      }
    }

    const nowIso = new Date().toISOString();
    const upsertPayloads = [];
    let locked = 0;

    for (const row of normalizedRecords) {
      const cellId = makeCellId(periodId, businessType, row.distributor_code, effectiveReportTypeId);
      const previous = existingRowsById.get(cellId);
      const previousStatus = normalizeText(previous?.status).toLowerCase();

      if (previousStatus === 'match') {
        locked += 1;
        continue;
      }

      upsertPayloads.push({
        id: cellId,
        period_id: periodId,
        year,
        month,
        business_type: businessType,
        distributor_code: row.distributor_code,
        distributor_name: row.distributor_name,
        report_type_id: effectiveReportTypeId,
        report_type_name: effectiveReportTypeName,
        status: row.status,
        remark: row.remark,
        recons_no: Number(previous?.recons_no || 0) + 1,
        updated_by: creator,
        updated_at: nowIso,
        created_at: previous?.created_at || nowIso,
        created_by: previous?.created_by || creator,
      });
    }

    for (const chunk of chunkArray(upsertPayloads)) {
      const { error } = await supabase
        .from(RECON_CELLS_TABLE)
        .upsert(chunk, { onConflict: 'id' });
      if (error) throw error;
    }

    return {
      updated: upsertPayloads.length,
      locked,
      errors: normalizedRecords.length - upsertPayloads.length - locked,
    };
  };

  const exportDssRowsDirect = async (rows) => {
    const year = Number(exportYear);
    const month = monthNameToNumber(exportMonth);
    const nowIso = new Date().toISOString();

    const payloads = (Array.isArray(rows) ? rows : [])
      .filter((row) => normalizeText(row?.distributor_code))
      .map((row) => ({
        year,
        month,
        business_type: businessType,
        distributor_code: normalizeText(row.distributor_code),
        distributor_name: normalizeText(row.distributor_name),
        csdp_sales_qty_cs: numberOrZero(row.csdp_sales_qty_cs),
        osdp_sales_qty_cs: numberOrZero(row.osdp_sales_qty_cs),
        csdp_sale_qty_pc: numberOrZero(row.csdp_sale_qty_pc),
        osdp_sale_qty_pc: numberOrZero(row.osdp_sale_qty_pc),
        csdp_free_total_qty: numberOrZero(row.csdp_free_total_qty),
        osdp_free_total_qty: numberOrZero(row.osdp_free_total_qty),
        csdp_gsv_amount: numberOrZero(row.csdp_gsv_amount),
        osdp_gsv_amount: numberOrZero(row.osdp_gsv_amount),
        csdp_niv_total: numberOrZero(row.csdp_niv_total),
        osdp_niv_total: numberOrZero(row.osdp_niv_total),
        csdp_sales_turn_over: numberOrZero(row.csdp_sales_turn_over),
        osdp_sales_turn_over: numberOrZero(row.osdp_sales_turn_over),
        updated_at: nowIso,
      }));

    if (!payloads.length) {
      throw new Error('No Daily Sales Summary rows to export.');
    }

    const { error: deleteError } = await supabase
      .from(DSS_REPORT_TABLE)
      .delete()
      .eq('year', year)
      .eq('month', month)
      .eq('business_type', businessType);

    if (deleteError) throw deleteError;

    for (const chunk of chunkArray(payloads)) {
      const { error } = await supabase
        .from(DSS_REPORT_TABLE)
        .insert(chunk);
      if (error) throw error;
    }

    return { exported: payloads.length };
  };

  const handleExportExcel = async () => {
    setExporting(true);
    const dataToExport = source === 'OSDP' ? osdpData : pbiData;
    const toastId = toast.loading('Exporting report...');
    try {
      const response = await fetch(`${requireBackend()}/export_summary_excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: dataToExport,
          report_type: source
        })
      });
      if (!response.ok) throw new Error('Failed to export');
      const blob = await response.blob();
      saveAs(blob, `Reconciliation_Summary_${source}.xlsx`);
      toast.success('Report exported successfully!', { id: toastId });
    } catch (error) {
      toast.error('Failed to export report.', { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  const handleExportToDatabase = async () => {
    const dataToExport = source === 'OSDP' ? osdpData : pbiData;
    const toastId = toast.loading('Exporting to database...');
    setExporting(true);
    try {
      assertSupabaseBrowserConfig();
      let summary = [];
      let updated = 0;
      let locked = 0;
      let errorCount = 0;
      const recordsForReconExport = isHpcDssReport ? dssStatusRows : dataToExport;
      if (!recordsForReconExport?.length) {
        throw new Error(
          isHpcDssReport
            ? 'No Daily Sales Summary rows to export.'
            : 'No records to export to reconCells.'
        );
      }

      toast.loading(
        isHpcDssReport
          ? 'Pushing reconciliation status to database (1/2)...'
          : 'Pushing reconciliation status to database...',
        { id: toastId }
      );

      const result = await exportReconCellsDirect(recordsForReconExport);

      updated = Number(result?.updated || result?.updated_rows || 0);
      locked = Number(result?.locked || 0);
      errorCount = Number(result?.errors || 0);

      if (updated > 0) summary.push(`reconCells ${updated} updated`);
      if (locked > 0) summary.push(`${locked} locked`);
      if (errorCount > 0) summary.push(`${errorCount} errors`);

      if (isHpcDssReport) {
        toast.loading('Pushing Daily Sales Summary rows to database (2/2)...', { id: toastId });
        const dssResult = await exportDssRowsDirect(normalizedDssRows);

        const exportedCount = Number(dssResult?.exported || 0);
        if (exportedCount > 0) summary.push(`DSS ${exportedCount} rows updated`);
      }

      toast.loading('Finalizing export...', { id: toastId });
      const summaryText = summary.length > 0 ? summary.join(', ') : 'No data exported';
      toast.success(`Exported to Report Database: ${summaryText}`, { id: toastId });
    } catch (err) {
      toast.error(err?.message || 'Failed to export to Report Database.', { id: toastId });
    } finally {
      setExporting(false);
      setShowExportModal(false);
    }
  };

  // NEW: CSV DSS (calls /export_combined_csv and downloads the CSV)
  const handleExportCsvDss = async () => {
    setExporting(true);
    const toastId = toast.loading('Generating CSV DSS...');
    try {
      const url = `${requireBackend()}/export_combined_csv`;
      const fd = new FormData();
      // Provide result_id so backend can rebuild the CSV for this reconciliation
      fd.append('result_id', resultId);

      const resp = await fetch(url, {
        method: 'POST',
        body: fd,
      });

      if (!resp.ok) {
        const msg = `Failed to generate CSV (HTTP ${resp.status})`;
        throw new Error(msg);
      }

      const blob = await resp.blob();
      const fname = `combined_export_${businessType}_${fromButton}.csv`.replace(/\s+/g, '_');
      saveAs(blob, fname);

      toast.success('CSV DSS generated!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate CSV DSS.', { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  // --- Early return after all hooks, for safety ---
  if (!resultId) {
    return (
      <>
        <div className="w-full h-[60vh] flex items-center justify-center">
          <div className="text-red-600 font-semibold text-lg">
            No reconciliation result found. Please upload and process files first.
          </div>
        </div>
      </>
    );
  }

  // --- Displayed data ---
  const displayedData = source === 'OSDP' ? osdpData : pbiData;
  const normalizedDssRows = useMemo(
    () => (
      Array.isArray(dssRows)
        ? dssRows
            .map(normalizeDssRow)
            .filter((row) => row.distributor_code || row.distributor_name)
        : []
    ),
    [dssRows]
  );
  const dssStatusRows = useMemo(
    () => normalizedDssRows
      .filter((row) => row.distributor_code)
      .map((row) => ({
        Distributor: row.distributor_code,
        'Distributor Name': row.distributor_name,
        Status: isDssMatch(row) ? 'Match' : 'Mismatch',
      })),
    [normalizedDssRows]
  );

  // For HPC DSS, compute match/mismatch from dssRows (osdpData/pbiData are empty for DSS)
  const totalMatch = isHpcDssReport
    ? normalizedDssRows.filter((row) => isDssMatch(row)).length
    : displayedData.filter(row => row.Status === 'Match').length;

  const totalMismatch = isHpcDssReport
    ? normalizedDssRows.filter((row) => !isDssMatch(row)).length
    : displayedData.filter(row => row.Status === 'Mismatch').length;

  // For DSS, there's no detailed mismatch result page — disable Go to Result always
  // For standard reports, disable if all match or no data
  const noMismatchInBoth = isHpcDssReport
    ? true  // DSS doesn't have a detail result page
    : (osdpData.every(row => row.Status === 'Match') && pbiData.every(row => row.Status === 'Match'));

  if (loading) {
    return (
      <>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="animate-spin h-10 w-10 text-blue-600 mb-4" />
          <div className="text-blue-800 font-medium text-lg">Processing reconciliation summary, please wait...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 items-center mb-6">
        <div className="flex gap-2 justify-start relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowConfirmModal(true)}
            className="px-4 py-2 bg-gray-700 text-white text-sm rounded hover:bg-gray-800 transition"
          >
            Back to Main
          </motion.button>
          <div className="relative">
            <button
              onClick={() => {
                setShowExportOptions((prev) => !prev);
                setIsHovering(true); // keep open briefly
              }}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
            >
              <DownloadIcon size={16} /> Export <ChevronDownIcon size={14} />
            </button>
            {showExportOptions && (
              <div
                className="absolute z-20 mt-1 w-56 bg-white rounded shadow border"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
              >
                <button
                  onClick={() => {
                    setShowExportOptions(false);
                    handleExportExcel();
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                  disabled={exporting}
                >
                  To Excel File
                </button>
                <button
                  onClick={() => {
                    setShowExportOptions(false);
                    setShowExportModal(true);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                  disabled={exporting}
                >
                  To Report Database
                </button>
                {/* NEW: CSV DSS */}
                <button
                  onClick={() => {
                    setShowExportOptions(false);
                    handleExportCsvDss();
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                  disabled={exporting}
                >
                  CSV DSS
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center">
          <motion.div className="border border-gray-300 bg-gray-50 rounded-md px-4 py-2 flex gap-6 items-center text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-600">Business Type:</span>
              <span className="inline-block px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 font-semibold">
                {businessType}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-600">Report Type:</span>
              <span className="inline-block px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 font-semibold">
                {fromButton}
              </span>
            </div>
          </motion.div>
        </div>

        <div className="flex justify-end">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const keyColumns = fullResult?.key_columns || JSON.parse(sessionStorage.getItem('keyColumns') || '[]');
              navigate('/recons/result', {
                state: {
                  result_id: resultId,
                  key_columns: keyColumns,
                  fromButton,
                  businessType
                }
              });
            }}
            disabled={noMismatchInBoth || !osdpData.length || !pbiData.length}
            className={`px-4 py-2 text-white text-sm rounded ${noMismatchInBoth ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}
          >
            Go to Result
          </motion.button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 relative">
        <h2 className="text-2xl font-bold text-center mb-6">
          {isHpcDssReport ? "Daily Sales Summary (Aggregated)" : "Reconciliation Summary"}
        </h2>

        <div className="flex justify-center gap-6 mb-6">
          <div className="bg-green-100 text-green-800 w-48 h-24 px-6 py-4 rounded shadow flex flex-col justify-center">
            <p className="text-sm font-semibold text-center">Total Match</p>
            <p className="text-xl font-bold text-center">{totalMatch}</p>
          </div>
          <div className="bg-red-100 text-red-800 w-48 h-24 px-6 py-4 rounded shadow flex flex-col justify-center">
            <p className="text-sm font-semibold text-center">Total Mismatch</p>
            <p className="text-xl font-bold text-center">{totalMismatch}</p>
          </div>
        </div>

        {isHpcDssReport ? (
          <div className="overflow-x-auto mt-6">
            <table className="w-full table-auto border-collapse text-sm border border-gray-400 whitespace-nowrap">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-4 py-2 text-left">Distributor</th>
                  <th className="border px-4 py-2 text-left">Name</th>
                  <th className="border px-4 py-2 text-right">CSDP GSV</th>
                  <th className="border px-4 py-2 text-right">OSDP GSV</th>
                  <th className="border px-4 py-2 text-right">Var GSV</th>
                  <th className="border px-4 py-2 text-right">CSDP NIV</th>
                  <th className="border px-4 py-2 text-right">OSDP NIV</th>
                  <th className="border px-4 py-2 text-right">Var NIV</th>
                </tr>
              </thead>
              <tbody>
                {normalizedDssRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="border px-4 py-6 text-center text-gray-500">
                      No aggregated Daily Sales Summary rows were found for this reconciliation result.
                    </td>
                  </tr>
                ) : normalizedDssRows.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border px-4 py-2">{row.distributor_code}</td>
                    <td className="border px-4 py-2 truncate max-w-[200px]" title={row.distributor_name}>{row.distributor_name}</td>
                    <td className="border px-4 py-2 text-right font-mono text-xs">{row.csdp_gsv_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="border px-4 py-2 text-right font-mono text-xs">{row.osdp_gsv_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className={`border px-4 py-2 text-right font-mono text-xs font-semibold ${Math.abs(row.csdp_gsv_amount - row.osdp_gsv_amount) < 0.01 ? 'text-green-600' : 'text-red-500'}`}>{(row.csdp_gsv_amount - row.osdp_gsv_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="border px-4 py-2 text-right font-mono text-xs">{row.csdp_niv_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="border px-4 py-2 text-right font-mono text-xs">{row.osdp_niv_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className={`border px-4 py-2 text-right font-mono text-xs font-semibold ${Math.abs(row.csdp_niv_total - row.osdp_niv_total) < 0.01 ? 'text-green-600' : 'text-red-500'}`}>{(row.csdp_niv_total - row.osdp_niv_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6">
        <div className="flex justify-center mb-6">
          <div className="relative bg-gray-100 rounded-full flex p-1 gap-1 w-fit shadow-inner">
            {['OSDP', 'PBI'].map(tab => (
              <button
                key={tab}
                onClick={() => setSource(tab)}
                className={`relative z-10 w-24 h-8 text-sm font-semibold rounded-full transition-colors duration-200 ${source === tab ? 'text-white' : 'text-gray-700'}`}
              >
                {source === tab && (
                  <motion.div
                    layoutId="pill-indicator"
                    className="absolute inset-0 bg-blue-600 rounded-full z-0"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-auto border-collapse text-sm border border-gray-400">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-4 py-2 text-left">Distributor</th>
                <th className="border px-4 py-2 text-left">Distributor Name</th>
                <th className="border px-4 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayedData.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50 cursor-pointer">
                  <td className="border px-4 py-2">{row.Distributor}</td>
                  <td className="border px-4 py-2">{row['Distributor Name']}</td>
                  <td className={`border px-4 py-2 text-center font-semibold ${row.Status === 'Match' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{row.Status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}
      </div>

      <AnimatePresence>
        {showConfirmModal && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-md flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowConfirmModal(false)}
          >
            <motion.div
              className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md mx-4 text-center relative"
              initial={{ y: 30, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 30, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-gray-800">Leave this page?</h3>
              <p className="text-sm text-gray-600 mt-2 px-2">
                Are you sure you want to go back to the Reconciliation Main page? Any unsaved progress will be lost.
              </p>
              <div className="flex justify-center gap-4 mt-6">
                <button
                  onClick={() => navigate('/recons')}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                >
                  ✅ Yes, leave
                </button>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
                >
                  ❌ Stay here
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showExportModal && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full"
              initial={{ scale: 0.95, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-3 text-gray-800">Export to Report Database</h3>
              {isHpcDssReport && (
                <p className="mb-4 text-sm text-gray-600">
                  This export will update both the reconciliation status table and the HPC Daily Sales Summary report table.
                </p>
              )}
              <div className="flex flex-col gap-3 mb-5">
                <div>
                  <label className="block text-sm mb-1">Year:</label>
                  <select value={exportYear} onChange={e => setExportYear(e.target.value)} className="border rounded px-2 py-1 w-full">
                    {['2026','2025', '2024', '2023'].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Month:</label>
                  <select value={exportMonth} onChange={e => setExportMonth(e.target.value)} className="border rounded px-2 py-1 w-full">
                    {monthNames.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >Cancel</button>
                <button
                  onClick={handleExportToDatabase}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >Export</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default ReconciliationSummary;

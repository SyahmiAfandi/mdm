// BulkReconCellsImportPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../../../firebaseClient";
import { useUser } from "../../../../context/UserContext";
import {
  UploadCloud,
  RefreshCcw,
  Play,
  Trash2,
  Info,
  X,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

// =====================
// Firestore Collections
// =====================
const COL_CELLS = "reconCells";
const COL_PERIODS = "reconPeriods";
const COL_DIST = "master_distributors";
const COL_RPT = "master_reporttypes";
const COL_BUS = "master_businesses";
const COL_MAP = "map_business_reporttypes";
const COL_RECON_CFG = "reconConfig"; // reconConfig/default.allowedCountries

// =====================
// Helpers
// =====================
function normalize(str = "") {
  return String(str ?? "").trim();
}
function upper(str = "") {
  return normalize(str).toUpperCase();
}
function makeCellId(periodId, businessType, distributorCode, reportTypeId) {
  return `${periodId}__${businessType}__${distributorCode}__${reportTypeId}`;
}
function parseAllowedCountries(raw) {
  let arr = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === "string") arr = raw.split(",");
  else if (raw != null) arr = [String(raw)];
  const set = new Set(arr.map((x) => upper(x)).filter(Boolean));
  return set.size ? set : null;
}
function pick(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] != null && String(obj[k]).trim() !== "") return obj[k];
  }
  return "";
}
function toStatus(s) {
  const v = upper(s).replace(/\s+/g, "_");
  if (v === "MATCH") return "match";
  if (v === "MISMATCH") return "mismatch";
  if (v === "NO_DATA" || v === "NODATA") return "no_data";
  return "";
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Parse date/time from sheet into Firestore Timestamp
function parseToTimestamp(val) {
  const raw = normalize(val);
  if (!raw) return null;

  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return Timestamp.fromDate(val);
  }

  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) {
    if (n > 10_000_000_000) {
      const d = new Date(n);
      return Number.isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
    }
    if (n > 20_000 && n < 100_000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(excelEpoch.getTime() + n * 24 * 60 * 60 * 1000);
      return Number.isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
    }
  }

  const ms = Date.parse(raw);
  if (Number.isFinite(ms)) {
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
  }

  return null;
}

// Minimal CSV parser (no extra deps)
function parseCsvText(text) {
  const rows = [];
  let cur = [];
  let val = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"' && inQuotes && next === '"') {
      val += '"';
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && c === ",") {
      cur.push(val);
      val = "";
      continue;
    }
    if (!inQuotes && (c === "\n" || c === "\r")) {
      if (c === "\r" && next === "\n") i++;
      cur.push(val);
      val = "";
      if (cur.some((x) => String(x).trim() !== "")) rows.push(cur);
      cur = [];
      continue;
    }
    val += c;
  }
  cur.push(val);
  if (cur.some((x) => String(x).trim() !== "")) rows.push(cur);

  if (!rows.length) return [];
  const header = rows[0].map((h) => normalize(h));
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const obj = {};
    for (let c = 0; c < header.length; c++) obj[header[c]] = row[c] ?? "";
    out.push(obj);
  }
  return out;
}

// Load XLSX only when needed (npm i xlsx)
async function parseXlsxFile(file) {
  const XLSX = await import("xlsx");
  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
  return json.map((r) => {
    const o = {};
    for (const k of Object.keys(r || {})) o[String(k)] = r[k];
    return o;
  });
}

// Concurrency limiter
async function runWithLimit(items, limit, fn) {
  const results = [];
  let idx = 0;
  let active = 0;

  return new Promise((resolve, reject) => {
    const next = () => {
      if (idx >= items.length && active === 0) return resolve(results);
      while (active < limit && idx < items.length) {
        const curIdx = idx++;
        active++;
        Promise.resolve(fn(items[curIdx], curIdx))
          .then((res) => (results[curIdx] = res))
          .catch(reject)
          .finally(() => {
            active--;
            next();
          });
      }
    };
    next();
  });
}

// =====================
// Small UI pieces
// =====================
function Pill({ tone = "slate", children }) {
  const map = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-rose-100 text-rose-800",
    amber: "bg-amber-100 text-amber-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[tone] || map.slate}`}>
      {children}
    </span>
  );
}

function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl border">
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b">
            <div>
              <div className="text-sm font-semibold text-slate-900">{title}</div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 hover:bg-slate-100 text-slate-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 py-4">{children}</div>

          {footer && <div className="px-5 py-4 border-t bg-slate-50 rounded-b-2xl">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

// =====================
// Page
// =====================
export default function BulkReconCellsImportPage() {
  const { user } = useUser();
  const canManage = !!user;

  // "Importer" (who clicked import)
  const importerName =
    user?.name?.trim() || user?.displayName?.trim() || user?.email || "unknown";
  const importerUid = user?.uid || "";
  const importerEmail = user?.email || "";

  const fileRef = useRef(null);
  const [loading, setLoading] = useState(false);

  // master caches
  const [periodSet, setPeriodSet] = useState(new Set());
  const [businessSet, setBusinessSet] = useState(new Set());
  const [distByCode, setDistByCode] = useState(new Map());
  const [rptById, setRptById] = useState(new Map());
  const [mapBizToRpt, setMapBizToRpt] = useState(new Map());
  const [allowedCountries, setAllowedCountries] = useState(null);

  // file + rows
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState([]);
  const [rows, setRows] = useState([]);

  // import options
  const [importAttempts, setImportAttempts] = useState(true);
  const [autoReconsNo, setAutoReconsNo] = useState(true);
  const [concurrency, setConcurrency] = useState(5);

  // UI
  const [helpOpen, setHelpOpen] = useState(false);

  const requiredColumns = useMemo(
    () => ["periodId", "businessType", "distributorCode", "reportTypeId", "status"],
    []
  );

  const optionalColumns = useMemo(
    () => ["remark", "reconsNo (only if Auto ReconsNo OFF)", "updatedBy", "updatedAt", "distributorName", "reportTypeName"],
    []
  );

  // ==============
  // Fetch masters
  // ==============
  async function fetchReconConfig() {
    const snap = await getDoc(doc(db, COL_RECON_CFG, "default"));
    if (!snap.exists()) {
      setAllowedCountries(null);
      return;
    }
    const cfg = snap.data() || {};
    setAllowedCountries(parseAllowedCountries(cfg.allowedCountries));
  }

  async function fetchPeriods() {
    const snap = await getDocs(collection(db, COL_PERIODS));
    const s = new Set();
    snap.docs.forEach((d) => {
      const v = d.data() || {};
      const pid = normalize(v.periodId ?? d.id);
      if (pid) s.add(pid);
    });
    setPeriodSet(s);
  }

  async function fetchBusinesses() {
    const snap = await getDocs(collection(db, COL_BUS));
    const s = new Set();
    snap.docs.forEach((d) => {
      const v = d.data() || {};
      const code = normalize(v.code ?? v.businessType ?? v.businessCode ?? d.id);
      const st = normalize(v.status ?? (v.active === false ? "Inactive" : "Active"));
      if (code && (!st || st.toLowerCase() === "active")) s.add(code);
    });
    setBusinessSet(s);
  }

  async function fetchDistributors() {
    const snap = await getDocs(collection(db, COL_DIST));
    const m = new Map();

    snap.docs.forEach((d) => {
      const x = d.data() || {};
      const code = normalize(x.code ?? x.distributorCode ?? d.id);
      if (!code) return;

      const name = normalize(x.name ?? x.distributorName ?? "");
      const btRaw = normalize(x.businessType ?? x.bizType ?? "");
      const businessTypes = btRaw
        ? btRaw.split(",").map((s) => normalize(s)).filter(Boolean)
        : [];

      const country = upper(x.country ?? x.countryCode ?? "");
      const countries = Array.isArray(x.countries)
        ? x.countries.map((c) => upper(c)).filter(Boolean)
        : [];

      m.set(code, { code, name, businessTypes, country, countries });
    });

    setDistByCode(m);
  }

  async function fetchReportTypes() {
    const snap = await getDocs(collection(db, COL_RPT));
    const m = new Map();

    snap.docs.forEach((d) => {
      const v = d.data() || {};
      const id = normalize(v.code ?? v.reportTypeId ?? d.id);
      if (!id) return;

      const name = normalize(v.name ?? v.reportTypeName ?? id);
      const st = normalize(v.status ?? (v.active === false ? "Inactive" : "Active"));
      if (st && st.toLowerCase() !== "active") return;

      m.set(id, { id, name });
    });

    setRptById(m);
  }

  async function fetchBizReportTypeMapping() {
    const snap = await getDocs(collection(db, COL_MAP));
    const m = new Map();

    for (const d of snap.docs) {
      const v = d.data() || {};
      const b = normalize(v.businessType ?? v.businessCode ?? v.code);
      if (!b) continue;

      const arr = Array.isArray(v.reportTypeIds) ? v.reportTypeIds : null;
      if (arr) {
        const set = m.get(b) || new Set();
        for (const x of arr) {
          const id = normalize(x);
          if (id) set.add(id);
        }
        m.set(b, set);
        continue;
      }

      const rt = normalize(v.reportTypeId ?? v.reportTypeCode ?? v.reportType);
      const active = v.active === undefined ? true : Boolean(v.active);
      if (rt && active) {
        const set = m.get(b) || new Set();
        set.add(rt);
        m.set(b, set);
      }
    }

    setMapBizToRpt(m);
  }

  async function refreshMasters() {
    setLoading(true);
    try {
      await Promise.all([
        fetchReconConfig(),
        fetchPeriods(),
        fetchBusinesses(),
        fetchDistributors(),
        fetchReportTypes(),
        fetchBizReportTypeMapping(),
      ]);
      toast.success("Masters loaded");
    } catch (e) {
      console.error(e);
      toast.error("Failed to load masters");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshMasters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ======================
  // Normalize + validate
  // ======================
  function normalizeAndValidate(raw) {
    const periodId = normalize(pick(raw, ["periodId", "Period", "period", "PeriodId"]));
    const businessType = normalize(pick(raw, ["businessType", "BusinessType", "business", "Business"]));
    const distributorCode = normalize(pick(raw, ["distributorCode", "DistributorCode", "distributor", "Distributor"]));
    const reportTypeId = normalize(
      pick(raw, ["reportTypeId", "ReportTypeId", "reportType", "ReportType", "rpt", "RPT"])
    );
    const status = toStatus(pick(raw, ["status", "Status"]));
    const remark = normalize(pick(raw, ["remark", "Remark", "remarks", "Remarks"]));

    const reconsNoRaw = normalize(pick(raw, ["reconsNo", "ReconsNo", "Recons#", "recons#", "Recons"]));
    const reconsNo = reconsNoRaw ? Number(reconsNoRaw) : null;

    const distributorNameInFile = normalize(pick(raw, ["distributorName", "DistributorName"]));
    const reportTypeNameInFile = normalize(pick(raw, ["reportTypeName", "ReportTypeName"]));

    const updatedByFromFile = normalize(
      pick(raw, [
        "updatedBy",
        "Updated By",
        "updated_by",
        "lastUpdatedBy",
        "Last Updated By",
        "PIC Updated By",
        "picUpdatedBy",
      ])
    );

    const updatedAtRaw = pick(raw, [
      "updatedAt",
      "Updated At",
      "updated_at",
      "lastUpdatedAt",
      "Last Updated At",
      "lastTimeUpdate",
      "Last Time Update",
      "lastTimeUpdated",
      "Last Time Updated",
      "lastUpdate",
      "Last Update",
    ]);
    const updatedAtFromFile = parseToTimestamp(updatedAtRaw);

    const errors = [];

    if (!periodId) errors.push("Missing periodId");
    if (!businessType) errors.push("Missing businessType");
    if (!distributorCode) errors.push("Missing distributorCode");
    if (!reportTypeId) errors.push("Missing reportTypeId");
    if (!status) errors.push("Invalid status (use match/mismatch/no_data)");

    if (periodId && periodSet.size && !periodSet.has(periodId)) {
      errors.push(`periodId not found in ${COL_PERIODS}`);
    }
    if (businessType && businessSet.size && !businessSet.has(businessType)) {
      errors.push(`businessType not found in ${COL_BUS}`);
    }

    const dist = distributorCode ? distByCode.get(distributorCode) : null;
    if (distributorCode && distByCode.size && !dist) {
      errors.push(`distributorCode not found in ${COL_DIST}`);
    }

    const rpt = reportTypeId ? rptById.get(reportTypeId) : null;
    if (reportTypeId && rptById.size && !rpt) {
      errors.push(`reportTypeId not found in ${COL_RPT}`);
    }

    if (dist && businessType) {
      const okBt = Array.isArray(dist.businessTypes) && dist.businessTypes.includes(businessType);
      if (!okBt) errors.push("Distributor not allowed for businessType");
    }

    if (dist && allowedCountries && allowedCountries.size > 0) {
      const distCountries = (dist.countries && dist.countries.length ? dist.countries : [dist.country])
        .map((c) => upper(c))
        .filter(Boolean);

      const okCountry = distCountries.some((c) => allowedCountries.has(c));
      if (!okCountry) errors.push("Distributor not allowed by reconConfig.allowedCountries");
    }

    if (businessType) {
      const allowedRt = mapBizToRpt.get(businessType);
      if (allowedRt && allowedRt.size > 0 && reportTypeId && !allowedRt.has(reportTypeId)) {
        errors.push("ReportType not allowed for businessType (map_business_reporttypes)");
      }
    }

    if (!autoReconsNo) {
      if (!reconsNoRaw) errors.push("Missing reconsNo (Auto ReconsNo is OFF)");
      else if (!Number.isFinite(reconsNo) || reconsNo <= 0) errors.push("Invalid reconsNo");
    }

    const distributorName = distributorNameInFile || dist?.name || "";
    const reportTypeName = reportTypeNameInFile || rpt?.name || "";

    return {
      raw,
      periodId,
      businessType,
      distributorCode,
      distributorName,
      reportTypeId,
      reportTypeName,
      status,
      remark,
      reconsNo: Number.isFinite(reconsNo) ? reconsNo : null,
      updatedByFromFile,
      updatedAtFromFile,
      errors,
      ok: errors.length === 0,
      cellId:
        periodId && businessType && distributorCode && reportTypeId
          ? makeCellId(periodId, businessType, distributorCode, reportTypeId)
          : "",
    };
  }

  useEffect(() => {
    if (!rawRows.length) return;
    const next = rawRows.map(normalizeAndValidate);
    setRows(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawRows, periodSet, businessSet, distByCode, rptById, mapBizToRpt, allowedCountries, autoReconsNo]);

  const stats = useMemo(() => {
    const total = rows.length;
    const ok = rows.filter((r) => r.ok).length;
    const bad = total - ok;
    return { total, ok, bad };
  }, [rows]);

  // ======================
  // File handling
  // ======================
  async function handleFile(file) {
    if (!file) return;

    const name = file.name || "";
    setFileName(name);
    setLoading(true);

    try {
      let parsed = [];
      if (name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        parsed = parseCsvText(text);
      } else if (name.toLowerCase().endsWith(".xlsx") || name.toLowerCase().endsWith(".xls")) {
        parsed = await parseXlsxFile(file);
      } else {
        toast.error("Unsupported file. Use CSV or XLSX.");
        return;
      }

      if (!parsed.length) {
        toast.error("No rows found in file");
        return;
      }

      setRawRows(parsed);
      toast.success(`Loaded ${parsed.length} rows`);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || "Failed to parse file");
    } finally {
      setLoading(false);
    }
  }

  function clearAll() {
    setFileName("");
    setRawRows([]);
    setRows([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ======================
  // Import logic
  // ======================
  async function importRows() {
    if (!canManage) return toast.error("No permission");
    if (!rows.length) return toast.error("No data to import");

    const valid = rows.filter((r) => r.ok);
    if (!valid.length) return toast.error("No valid rows to import");

    const proceedCount = valid.length;

    setLoading(true);
    toast(`Importing ${proceedCount} rows...`, { icon: "🚀" });

    try {
      await runWithLimit(
        valid,
        Math.max(1, Math.min(15, Number(concurrency) || 5)),
        async (r, idx) => {
          const cellRef = doc(db, COL_CELLS, r.cellId);

          await runTransaction(db, async (tx) => {
            const snap = await tx.get(cellRef);
            const prev = snap.exists() ? snap.data() : null;

            if (prev?.status === "match") {
              const err = new Error("LOCKED_MATCH");
              err.code = "LOCKED_MATCH";
              throw err;
            }

            const prevReconsNo = Number(prev?.reconsNo || 0) || 0;
            const nextReconsNo = autoReconsNo ? prevReconsNo + 1 : (Number(r.reconsNo) || 1);

            const createdAt = prev?.createdAt || serverTimestamp();
            const createdBy = prev?.createdBy || importerName;

            const finalUpdatedBy = r.updatedByFromFile || importerName;
            const finalUpdatedAt = r.updatedAtFromFile || serverTimestamp();

            const payload = {
              periodId: r.periodId,
              year: Number(String(r.periodId).split("-")[0] || 0),
              month: Number(String(r.periodId).split("-")[1] || 0),

              businessType: r.businessType,
              distributorCode: r.distributorCode,
              distributorName: r.distributorName || "",
              reportTypeId: r.reportTypeId,
              reportTypeName: r.reportTypeName || "",

              status: r.status,
              remark: r.remark || "",

              updatedBy: finalUpdatedBy,
              updatedAt: finalUpdatedAt,

              importedBy: importerName,
              importedByUid: importerUid,
              importedByEmail: importerEmail,
              importedAt: serverTimestamp(),
            };

            tx.set(
              cellRef,
              {
                ...payload,
                reconsNo: nextReconsNo,
                createdAt,
                createdBy,
              },
              { merge: true }
            );

            if (importAttempts) {
              const attemptSnapshot = {
                cellId: r.cellId,
                reconsNo: nextReconsNo,

                periodId: payload.periodId,
                year: payload.year,
                month: payload.month,

                businessType: payload.businessType,
                distributorCode: payload.distributorCode,
                distributorName: payload.distributorName,
                reportTypeId: payload.reportTypeId,
                reportTypeName: payload.reportTypeName,

                status: payload.status,
                remark: payload.remark,

                updatedBy: payload.updatedBy,
                updatedAt: payload.updatedAt,

                importedBy: payload.importedBy,
                importedByUid: payload.importedByUid,
                importedByEmail: payload.importedByEmail,
                importedAt: payload.importedAt,

                clientImportedAt: new Date().toISOString(),
                previousStatus: prev?.status || (snap.exists() ? "no_data" : "new"),
                previousReconsNo: prevReconsNo,
                source: "bulk_import",
              };

              const attemptRef = doc(db, COL_CELLS, r.cellId, "attempts", String(nextReconsNo));
              tx.set(attemptRef, attemptSnapshot);
            }
          });

          if (idx % 25 === 0) await sleep(50);
          return true;
        }
      );

      toast.success(`Imported ${proceedCount} rows ✅`);
    } catch (e) {
      console.error(e);
      if (e?.code === "LOCKED_MATCH" || e?.message === "LOCKED_MATCH") {
        toast.error("Import stopped: found LOCKED Match record(s).");
      } else {
        toast.error(`${e?.code || "error"}: ${e?.message || "Import failed"}`);
      }
    } finally {
      setLoading(false);
    }
  }

  const preview = useMemo(() => rows.slice(0, 50), [rows]);

  // ==============
  // Render
  // ==============
  return (
    <div className="p-5 bg-slate-50 min-h-[calc(100vh-75px)]">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">Bulk ReconCells Import</h1>
            <button
              onClick={() => setHelpOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Info className="h-4 w-4" />
              Required Columns
            </button>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span>
              Importer: <span className="font-semibold text-slate-900">{importerName}</span>
            </span>
            {allowedCountries ? (
              <Pill tone="blue">Allowed: {[...allowedCountries].join(", ")}</Pill>
            ) : (
              <Pill tone="slate">Allowed: All countries</Pill>
            )}
            {distByCode.size ? <Pill tone="green">Masters loaded</Pill> : <Pill tone="amber">Masters not loaded</Pill>}
          </div>

          <p className="mt-2 text-sm text-slate-600">
            Upload CSV/XLSX → preview & validate → import to <span className="font-semibold">{COL_CELLS}</span>
            {importAttempts ? " + attempts history" : ""}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refreshMasters}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Upload */}
        <div className="rounded-2xl border bg-white p-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-800">Upload</div>
            <div className="text-xs text-slate-500">
              Total <span className="font-semibold">{stats.total}</span> ·{" "}
              <span className="text-emerald-700 font-semibold">{stats.ok} valid</span> ·{" "}
              <span className="text-rose-700 font-semibold">{stats.bad} invalid</span>
            </div>
          </div>

          <div className="mt-3 flex flex-col md:flex-row md:items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => handleFile(e.target.files?.[0])}
              disabled={loading}
              className="block w-full text-sm"
            />

            <button
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <UploadCloud className="h-4 w-4" />
              Choose
            </button>

            <button
              onClick={clearAll}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </button>
          </div>

          {fileName && (
            <div className="mt-2 text-xs text-slate-500">
              File: <span className="font-semibold text-slate-900">{fileName}</span>
            </div>
          )}

          {/* Options */}
          <div className="mt-4 rounded-xl border bg-slate-50 p-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={importAttempts}
                  onChange={(e) => setImportAttempts(e.target.checked)}
                  disabled={loading}
                />
                Write attempts
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoReconsNo}
                  onChange={(e) => setAutoReconsNo(e.target.checked)}
                  disabled={loading}
                />
                Auto ReconsNo
              </label>

              <label className="text-sm flex items-center gap-2">
                Concurrency
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={concurrency}
                  onChange={(e) => setConcurrency(e.target.value)}
                  disabled={loading}
                  className="w-20 rounded-lg border px-2 py-1 text-sm bg-white"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <Pill tone="slate">status: match / mismatch / no_data</Pill>
              {!autoReconsNo && <Pill tone="amber">reconsNo required</Pill>}
              <Pill tone="red">Stops on LOCKED match</Pill>
              <Pill tone="blue">updatedBy/updatedAt allowed</Pill>
            </div>
          </div>

          {/* Action */}
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={importRows}
              disabled={loading || !canManage || !rows.length || stats.ok === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              title={!canManage ? "No permission" : stats.ok === 0 ? "No valid rows" : ""}
            >
              <Play className="h-4 w-4" />
              Import Valid Rows
            </button>

            <div className="text-xs text-slate-500">
              {stats.ok > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Ready to import <span className="font-semibold">{stats.ok}</span> rows
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Fix validation errors to import
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm font-semibold text-slate-800 mb-3">Summary</div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Masters</span>
              <span className="font-semibold">{distByCode.size ? "Loaded" : "Not loaded"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Allowed Countries</span>
              <span className="font-semibold">{allowedCountries ? [...allowedCountries].join(", ") : "All"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Attempts</span>
              <span className="font-semibold">{importAttempts ? "On" : "Off"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Auto ReconsNo</span>
              <span className="font-semibold">{autoReconsNo ? "On" : "Off"}</span>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            If XLSX parsing fails:
            <div className="mt-2 font-mono text-[11px] bg-white border rounded p-2">npm i xlsx</div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="mt-4 rounded-2xl border bg-white overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="text-sm font-semibold text-slate-800">Preview (first 50 rows)</div>
          <div className="text-xs text-slate-500">
            Valid rows import. Invalid rows show reasons.
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">periodId</th>
                <th className="px-4 py-3">businessType</th>
                <th className="px-4 py-3">distributor</th>
                <th className="px-4 py-3">reportType</th>
                <th className="px-4 py-3">status</th>
                <th className="px-4 py-3">reconsNo</th>
                <th className="px-4 py-3">updatedBy</th>
                <th className="px-4 py-3">updatedAt</th>
                <th className="px-4 py-3">remark</th>
                <th className="px-4 py-3">OK</th>
                <th className="px-4 py-3">Errors</th>
              </tr>
            </thead>

            <tbody>
              {preview.map((r, i) => (
                <tr key={i} className={`border-t ${r.ok ? "hover:bg-slate-50" : "bg-rose-50/40"}`}>
                  <td className="px-4 py-3 text-xs text-slate-500">{i + 1}</td>
                  <td className="px-4 py-3">{r.periodId}</td>
                  <td className="px-4 py-3">{r.businessType}</td>

                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{r.distributorCode}</div>
                    <div className="text-xs text-slate-500">{r.distributorName}</div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{r.reportTypeId}</div>
                    <div className="text-xs text-slate-500">{r.reportTypeName}</div>
                  </td>

                  <td className="px-4 py-3">{r.status}</td>
                  <td className="px-4 py-3">{autoReconsNo ? "(auto)" : r.reconsNo ?? ""}</td>

                  <td className="px-4 py-3">{r.updatedByFromFile || ""}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {r.updatedAtFromFile?.toDate ? r.updatedAtFromFile.toDate().toLocaleString() : ""}
                  </td>

                  <td className="px-4 py-3">{r.remark}</td>

                  <td className="px-4 py-3">
                    {r.ok ? <Pill tone="green">OK</Pill> : <Pill tone="red">Invalid</Pill>}
                  </td>

                  <td className="px-4 py-3 text-xs text-rose-700">
                    {r.errors?.length ? r.errors.join(" | ") : ""}
                  </td>
                </tr>
              ))}

              {!preview.length && (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-500" colSpan={12}>
                    Upload a CSV/XLSX to see preview here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 text-xs text-slate-500 border-t">
          Tip: Recommended headers:
          <span className="font-semibold">
            {" "}
            periodId, businessType, distributorCode, reportTypeId, status, remark, reconsNo, updatedBy, updatedAt
          </span>
        </div>
      </div>

      {/* Required Columns Modal */}
      <Modal
        open={helpOpen}
        title="Required Columns & File Template"
        onClose={() => setHelpOpen(false)}
        footer={
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-600">
              If <span className="font-semibold">Auto ReconsNo</span> is OFF, you must include{" "}
              <span className="font-semibold">reconsNo</span>.
            </div>
            <button
              onClick={() => setHelpOpen(false)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Got it
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border bg-slate-50 p-3">
            <div className="text-xs font-semibold text-slate-800 mb-2">Required</div>
            <div className="flex flex-wrap gap-2">
              {requiredColumns.map((c) => (
                <Pill key={c} tone="green">{c}</Pill>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-3">
            <div className="text-xs font-semibold text-slate-800 mb-2">Optional</div>
            <div className="flex flex-wrap gap-2">
              {optionalColumns.map((c) => (
                <Pill key={c} tone="slate">{c}</Pill>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-3">
            <div className="text-xs font-semibold text-slate-800 mb-2">Example header row</div>
            <div className="font-mono text-xs bg-slate-50 border rounded-lg p-3 overflow-x-auto">
              periodId,businessType,distributorCode,reportTypeId,status,remark,reconsNo,updatedBy,updatedAt
            </div>
          </div>

          <div className="rounded-xl border bg-amber-50 p-3 text-xs text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <div>
                <div className="font-semibold">Validation rules</div>
                <ul className="list-disc ml-5 mt-1 space-y-1">
                  <li>Status accepted: match / mismatch / no_data</li>
                  <li>Stops import if existing record status is already match (LOCKED)</li>
                  <li>Distributor country must be allowed if reconConfig.allowedCountries is set</li>
                  <li>ReportType must be mapped to the businessType if mapping exists</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
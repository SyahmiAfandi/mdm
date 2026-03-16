import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useUser } from "../../context/UserContext";
import { Save, RefreshCcw } from "lucide-react";

import { supabase } from "../../supabaseClient";

// Write to Google Sheet via GAS (POST)
const GAS_URL = import.meta.env.VITE_RECONS_GAS_URL;

// ====== FIXED LISTS ======
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const STATUSES = ["Match", "Mismatch", "No data"];

// ====== HELPERS ======
function nowIsoLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function normalize(s) {
  return String(s ?? "").trim();
}

function truthyFlag(v) {
  if (v === true) return true;
  const s = String(v ?? "").toLowerCase().trim();
  return s === "true" || s === "1" || s === "yes";
}

export default function ManualReconsEntry() {
  const { user } = useUser();

  const picName = useMemo(() => {
    return user?.name || user?.displayName || user?.email || "Unknown";
  }, [user]);

  // ====== MASTER DATA (Firestore) ======
  const [loadingMaster, setLoadingMaster] = useState(false);

  // Business dropdown options (codes)
  const [businessTypes, setBusinessTypes] = useState([]); // ["HPC","IC","UFS"]

  //Year Master Data
  const [yearOptions, setYearOptions] = useState([]); // ["2024","2025","2026"]

  /**
   * Report types:
   * - master_reporttypes gives: code -> name
   * - map_business_report... gives: businessCode -> [reportTypeCode]
   * We convert to: businessCode -> [reportTypeName]
   */
  const [reportNameByCode, setReportNameByCode] = useState({}); // { R001: "Daily Sales Summary" }
  const [reportNamesByBusiness, setReportNamesByBusiness] = useState({}); // { HPC: ["Daily Sales Summary", ...] }

  // Distributors
  const [distList, setDistList] = useState([]); // [{code,name}]

  // ====== FORM ======
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);

  const [businessType, setBusinessType] = useState(""); // must pick first
  const [reportType, setReportType] = useState(""); // report NAME (not code)
  const [reportStatus, setReportStatus] = useState("Match");

  const [distributorCode, setDistributorCode] = useState("");
  const [distributorName, setDistributorName] = useState("");

  const [remark, setRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ====== LOAD MASTER FROM FIRESTORE ======
  async function loadMaster() {
    try {
      setLoadingMaster(true);

      // 1) Businesses
      const { data: bizData, error: bizErr } = await supabase.from("master_businesses").select('*');
      if (bizErr) throw bizErr;
      const businesses = (bizData || [])
        .map((d) => {
          const code = normalize(d.businessCode) || normalize(d.id);
          const activeOk = d.active === undefined ? true : truthyFlag(d.active);
          const statusOk = d.status === undefined ? true : truthyFlag(d.status);
          return activeOk && statusOk ? code : "";
        })
        .filter(Boolean);

      // 2) Distributors
      const { data: distData, error: distErr } = await supabase.from("master_distributors").select('*');
      if (distErr) throw distErr;
      const distributors = (distData || [])
        .map((d) => {
          const code = normalize(d.code) || normalize(d.distributorCode) || normalize(d.id);
          const name = normalize(d.name) || normalize(d.distributorName);
          const activeOk = d.active === undefined ? true : truthyFlag(d.active);
          const statusOk = d.status === undefined ? true : truthyFlag(d.status);
          if (!activeOk || !statusOk) return null;
          if (!code && !name) return null;
          return { code, name };
        })
        .filter(Boolean);

      // 3) Report type master: code -> name
      const { data: rtData, error: rtErr } = await supabase.from("master_reporttypes").select('*');
      if (rtErr) throw rtErr;
      const rtMap = {};
      (rtData || []).forEach((d) => {
        const activeOk = d.active === undefined ? true : truthyFlag(d.active);
        const statusOk = d.status === undefined ? true : truthyFlag(d.status);
        if (!activeOk || !statusOk) return;

        const code = normalize(d.code) || normalize(d.id);
        const name = normalize(d.name);
        if (code && name) rtMap[code] = name;
      });

      // 0) Years (master_years)
      const { data: yearData, error: yearErr } = await supabase.from("master_years").select('*');
      if (yearErr) throw yearErr;
      const years = (yearData || [])
        .filter((d) => d.active !== false) // treat missing active as Active
        .map((d) => String(d.year ?? "").trim())
        .filter(Boolean)
        .sort((a, b) => Number(b) - Number(a));

      setYearOptions(Array.from(new Set(years)));
      const latest = years[0];
      if (latest) setYear((y) => (years.includes(String(y)) ? String(y) : String(latest)));

      // 4) Mapping business -> reportTypeCode
      const { data: mapData, error: mapErr } = await supabase.from("map_business_reporttypes").select('*');
      if (mapErr) throw mapErr;

      const mapBusinessToCodes = {};
      (mapData || []).forEach((d) => {
        const activeOk = d.active === undefined ? true : truthyFlag(d.active);
        const statusOk = d.status === undefined ? true : truthyFlag(d.status);
        if (!activeOk || !statusOk) return;

        const bCode = normalize(d.businessCode);
        const rtCode = normalize(d.reportTypeCode);
        if (!bCode || !rtCode) return;

        if (!mapBusinessToCodes[bCode]) mapBusinessToCodes[bCode] = [];
        mapBusinessToCodes[bCode].push(rtCode);
      });

      // 5) Convert codes to NAMES per business (because sheets need name)
      const namesByBiz = {};
      for (const bCode of Object.keys(mapBusinessToCodes)) {
        const codes = Array.from(new Set(mapBusinessToCodes[bCode]));
        const names = codes
          .map((c) => rtMap[c])
          .filter(Boolean); // drops missing code lookups
        namesByBiz[bCode] = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
      }

      setBusinessTypes(Array.from(new Set(businesses)).sort((a, b) => a.localeCompare(b)));
      setDistList(distributors);
      setReportNameByCode(rtMap);
      setReportNamesByBusiness(namesByBiz);
    } catch (e) {
      console.error(e);
      toast.error(String(e?.message || e || "Failed to load master data"));
    } finally {
      setLoadingMaster(false);
    }
  }

  useEffect(() => {
    loadMaster();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ====== REPORT OPTIONS (NAMES) ======
  const reportTypeOptions = useMemo(() => {
    if (!businessType) return [];
    return Array.isArray(reportNamesByBusiness?.[businessType])
      ? reportNamesByBusiness[businessType]
      : [];
  }, [businessType, reportNamesByBusiness]);

  // reset report type when business changes
  useEffect(() => {
    setReportType("");
  }, [businessType]);

  // ====== DISTRIBUTOR LOOKUPS ======
  const codeToName = useMemo(() => {
    const m = new Map();
    for (const d of distList) {
      if (d?.code) m.set(String(d.code).toUpperCase(), d.name || "");
    }
    return m;
  }, [distList]);

  const nameToCode = useMemo(() => {
    const m = new Map();
    for (const d of distList) {
      if (d?.name) m.set(String(d.name).toUpperCase(), d.code || "");
    }
    return m;
  }, [distList]);

  const codeSuggestions = useMemo(() => {
    const q = normalize(distributorCode).toUpperCase();
    if (!q) return distList.slice(0, 10);
    return distList
      .filter((d) => String(d?.code || "").toUpperCase().includes(q))
      .slice(0, 10);
  }, [distList, distributorCode]);

  const nameSuggestions = useMemo(() => {
    const q = normalize(distributorName).toUpperCase();
    if (!q) return distList.slice(0, 10);
    return distList
      .filter((d) => String(d?.name || "").toUpperCase().includes(q))
      .slice(0, 10);
  }, [distList, distributorName]);

  function autoFillFromCode(codeRaw) {
    const code = normalize(codeRaw);
    if (!code) return;
    const name = codeToName.get(code.toUpperCase());
    if (name) setDistributorName(name);
  }

  function autoFillFromName(nameRaw) {
    const name = normalize(nameRaw);
    if (!name) return;
    const code = nameToCode.get(name.toUpperCase());
    if (code) setDistributorCode(code);
  }

  // ====== VALIDATION ======
  function validate() {
    if (!year) return "Year is required";
    if (!month) return "Month is required";
    if (!businessType) return "Business Type is required";

    if (!reportType) return "Report Type is required (select Business Type first)";
    if (!reportTypeOptions.includes(reportType)) return "Invalid Report Type for selected Business Type";

    if (!distributorCode) return "Distributor Code is required";
    if (!distributorName) return "Distributor Name is required";
    if (!STATUSES.includes(reportStatus)) return "Invalid status";
    return null;
  }

  // ====== SUBMIT (WRITE VIA GAS) ======
  async function onSubmit(e) {
    e.preventDefault();

    const err = validate();
    if (err) return toast.error(err);

    if (!GAS_URL) return toast.error("Missing VITE_RECONS_GAS_URL in .env");

    // IMPORTANT: reportType is NAME here (for Google Sheet)
    const payload = {
      year: String(year),
      month: String(month),
      businessType: String(businessType),
      reportType: String(reportType), // <-- NAME, not code
      distributorCode: String(distributorCode),
      distributorName: String(distributorName),
      reportStatus: String(reportStatus),
      pic: String(picName),
      timestamp: nowIsoLocal(),
      remark: String(remark || ""),
    };

    try {
      setSubmitting(true);
      const res = await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Write failed");

      toast.success("Saved into Google Sheet ✅");
      setDistributorCode("");
      setDistributorName("");
      setRemark("");
    } catch (e2) {
      toast.error(String(e2?.message || e2));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold">Manual Recons Entry</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Report Type dropdown is filtered by Business (mapping), but saved as Report Name (Google Sheet requirement).
          </p>
        </div>

        <button
          type="button"
          onClick={loadMaster}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <RefreshCcw className={`w-4 h-4 ${loadingMaster ? "animate-spin" : ""}`} />
          Refresh Master
        </button>
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4"
      >
        {/* Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Year (master)">
            <select
              className="w-full input"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              disabled={loadingMaster}
            >
              {yearOptions.length ? (
                yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))
              ) : (
                <option value={year}>{year}</option> // fallback (keeps current value)
              )}
            </select>

            {!yearOptions.length && !loadingMaster && (
              <div className="text-xs text-amber-600 mt-1">
                No years found (collection: <b>master_years</b>, field: <b>year</b>).
              </div>
            )}
          </Field>

          <Field label="Month">
            <select className="w-full input" value={month} onChange={(e) => setMonth(e.target.value)}>
              {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>

          <Field label="Business Type (master)">
            <select
              className="w-full input"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              disabled={loadingMaster}
            >
              <option value="">-- Select Business Type --</option>
              {businessTypes.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>

            {!businessTypes.length && !loadingMaster && (
              <div className="text-xs text-amber-600 mt-1">
                No business types found (collection: <b>master_businesses</b>, field: <b>businessCode</b>).
              </div>
            )}
          </Field>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <Field label="Report Type (filtered, saved as name)">
            <select
              className="w-full input"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              disabled={!businessType || loadingMaster}
            >
              <option value="">
                {!businessType ? "-- Select Business Type first --" : "-- Select Report Type --"}
              </option>
              {reportTypeOptions.map((rtName) => (
                <option key={rtName} value={rtName}>
                  {rtName}
                </option>
              ))}
            </select>

            {businessType && !reportTypeOptions.length && !loadingMaster && (
              <div className="text-xs text-amber-600 mt-1">
                No report types mapped for <b>{businessType}</b> (collection: <b>map_business_reporttypes</b>).
              </div>
            )}
          </Field>

          <Field label="Report Status">
            <select className="w-full input" value={reportStatus} onChange={(e) => setReportStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <Field label="Distributor Code (master)">
            <input
              className="w-full input"
              value={distributorCode}
              onChange={(e) => {
                setDistributorCode(e.target.value);
                autoFillFromCode(e.target.value);
              }}
              onBlur={() => autoFillFromCode(distributorCode)}
              placeholder="7160xxxx"
              list="dt-code-list"
            />
            <datalist id="dt-code-list">
              {codeSuggestions.map((d) => (
                <option key={d.code} value={d.code}>{d.name}</option>
              ))}
            </datalist>
          </Field>

          <Field label="Distributor Name (master)">
            <input
              className="w-full input"
              value={distributorName}
              onChange={(e) => {
                setDistributorName(e.target.value);
                autoFillFromName(e.target.value);
              }}
              onBlur={() => autoFillFromName(distributorName)}
              placeholder="e.g. MS MAKMUR"
              list="dt-name-list"
            />
            <datalist id="dt-name-list">
              {nameSuggestions.map((d) => (
                <option key={`${d.code}-${d.name}`} value={d.name}>{d.code}</option>
              ))}
            </datalist>
          </Field>
        </div>

        {/* Row 4 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <Field label="PIC (auto)">
            <input className="w-full input bg-gray-50 dark:bg-gray-800" value={picName} readOnly />
          </Field>
          <Field label="Timestamp (auto)">
            <input className="w-full input bg-gray-50 dark:bg-gray-800" value={nowIsoLocal()} readOnly />
          </Field>
        </div>

        <div className="mt-3">
          <Field label="Remark (optional)">
            <textarea
              className="w-full input min-h-[90px]"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Optional notes..."
            />
          </Field>
        </div>

        <div className="flex items-center justify-end mt-4">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white dark:bg-white dark:text-black disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {submitting ? "Saving..." : "Save to Sheet"}
          </button>
        </div>

        <style>{`
          .input{
            border:1px solid rgba(0,0,0,.12);
            border-radius: .6rem;
            padding: .55rem .75rem;
            outline:none;
          }
          .dark .input{
            border-color: rgba(255,255,255,.14);
          }
          .input:focus{
            box-shadow: 0 0 0 3px rgba(59,130,246,.25);
            border-color: rgba(59,130,246,.6);
          }
        `}</style>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">
        {label}
      </div>
      {children}
    </label>
  );
}
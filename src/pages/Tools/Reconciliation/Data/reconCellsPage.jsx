// ReconCellsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../../../firebaseClient";
import { useUser } from "../../../../context/UserContext";
import { RefreshCcw, Save, Pencil, Search, Trash2 } from "lucide-react";

const COL_CELLS = "reconCells";
const COL_PERIODS = "reconPeriods";
const COL_DIST = "master_distributors";
const COL_RPT = "master_reporttypes";
const COL_BUS = "master_businesses";
const COL_MAP = "map_business_reporttypes";
const COL_RECON_CFG = "reconConfig";

// Optional: global attempts collection (easy reporting). Set "" to disable.
const COL_GLOBAL_ATTEMPTS = "";

const STATUSES = [
  { value: "match", label: "Match (LOCK)" },
  { value: "mismatch", label: "Mismatch" },
  { value: "no_data", label: "No Data" },
];

function normalize(str = "") {
  return String(str ?? "").trim();
}

function makeCellId(periodId, businessType, distributorCode, reportTypeId) {
  return `${periodId}__${businessType}__${distributorCode}__${reportTypeId}`;
}

function numOr(val, fallback = 999) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export default function ReconCellsPage() {
  const { user } = useUser();
  const canManage = !!user;

  const actorName =
    user?.name?.trim() || user?.displayName?.trim() || user?.email || "unknown";
  const actorUid = user?.uid || "";
  const actorEmail = user?.email || "";

  const [periods, setPeriods] = useState([]);
  const [businesses, setBusinesses] = useState([]);

  const [allDistributors, setAllDistributors] = useState([]); // includes businessTypes[]
  const [reportTypes, setReportTypes] = useState([]); // full master list

  // reconConfig-derived: Set(countryCode) or null (no restriction)
  const [allowedCountries, setAllowedCountries] = useState(null);

  // mapping: businessType -> Set(reportTypeId)
  const [mapBizToRpt, setMapBizToRpt] = useState(new Map());

  // selection
  const [periodId, setPeriodId] = useState("");
  const [businessType, setBusinessType] = useState("");

  const [distributorCode, setDistributorCode] = useState("");
  const [reportTypeId, setReportTypeId] = useState("");
  const [status, setStatus] = useState("no_data");
  const [remark, setRemark] = useState("");
  const [locked, setLocked] = useState(false);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [qText, setQText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // ✅ NEW: selected row ids
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  // ✅ Filter distributors by businessType AND reconConfig.countries
  const distributorsForSelectedBusiness = useMemo(() => {
    let list = allDistributors;

    // 1) businessType filter
    if (businessType) {
      const bt = normalize(businessType);
      list = list.filter((d) => {
        if (!d.businessTypes || d.businessTypes.length === 0) return false;
        return d.businessTypes.includes(bt);
      });
    }

    // 2) allowedCountries filter (from reconConfig)
    if (allowedCountries && allowedCountries.size > 0) {
      list = list.filter((d) => {
        const distCountries = (
          d.countries && d.countries.length ? d.countries : [d.country]
        )
          .map((c) => normalize(c).toUpperCase())
          .filter(Boolean);

        return distCountries.some((c) => allowedCountries.has(c));
      });
    }

    return list;
  }, [allDistributors, businessType, allowedCountries]);

  // --------- Derived: allowed report types for selected business ----------
  const allowedReportTypeIds = useMemo(() => {
    if (!businessType) return null;
    return mapBizToRpt.get(businessType) || null; // null => show all
  }, [businessType, mapBizToRpt]);

  const reportTypesForSelectedBusiness = useMemo(() => {
    if (allowedReportTypeIds && allowedReportTypeIds.size > 0) {
      return reportTypes.filter((r) => allowedReportTypeIds.has(r.id));
    }
    return reportTypes;
  }, [reportTypes, allowedReportTypeIds]);

  const selectedDistributor = useMemo(
    () => allDistributors.find((d) => d.code === distributorCode),
    [allDistributors, distributorCode]
  );

  const selectedReportType = useMemo(
    () => reportTypes.find((r) => r.id === reportTypeId),
    [reportTypes, reportTypeId]
  );

  // ----------------- Fetchers -----------------
  async function fetchPeriods() {
    const snap = await getDocs(collection(db, COL_PERIODS));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    data.sort((a, b) =>
      String(b.periodId || b.id).localeCompare(String(a.periodId || a.id))
    );
    setPeriods(data);
    if (!periodId && data.length) setPeriodId(data[0].periodId || data[0].id);
  }

  async function fetchBusinesses() {
    const snap = await getDocs(collection(db, COL_BUS));
    const data = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .map((v) => {
        const code = normalize(v.code ?? v.businessType ?? v.businessCode ?? v.id);
        const name = normalize(v.name ?? v.businessName ?? code);
        const order = numOr(v.order ?? v.sortOrder ?? v.orderNo, 999);
        const st = normalize(v.status ?? (v.active === false ? "Inactive" : "Active"));
        return { code, name, order, status: st };
      })
      .filter((x) => x.code)
      .filter((x) => !x.status || x.status.toLowerCase() === "active");

    data.sort((a, b) => {
      const ao = a.order - b.order;
      if (ao !== 0) return ao;
      return a.name.localeCompare(b.name);
    });

    setBusinesses(data);
    if (!businessType && data.length) setBusinessType(data[0].code);
  }

  async function fetchDistributors() {
    const distSnap = await getDocs(collection(db, COL_DIST));

    const dist = distSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .map((x) => {
        const code = normalize(x.code ?? x.distributorCode ?? x.id);
        const name = normalize(x.name ?? x.distributorName ?? "");

        // business type list
        const btRaw = normalize(x.businessType ?? x.bizType ?? "");
        const btList = btRaw
          ? btRaw.split(",").map((s) => normalize(s)).filter(Boolean)
          : [];

        // ✅ country support (string or array)
        const country = normalize(x.country ?? x.countryCode ?? "");
        const countries = Array.isArray(x.countries)
          ? x.countries.map((c) => normalize(c)).filter(Boolean)
          : [];

        return { code, name, businessTypes: btList, country, countries };
      })
      .filter((x) => x.code);

    dist.sort((a, b) => a.code.localeCompare(b.code));
    setAllDistributors(dist);
  }

  async function fetchReportTypes() {
    const rptSnap = await getDocs(collection(db, COL_RPT));
    const rpt = rptSnap.docs
      .map((d) => {
        const v = d.data() || {};
        const id = normalize(v.code ?? v.reportTypeId ?? d.id);
        const name = normalize(v.name ?? v.reportTypeName ?? id);
        const order = numOr(v.order ?? v.sortOrder ?? v.orderNo, 999);
        const st = normalize(v.status ?? (v.active === false ? "Inactive" : "Active"));
        return { id, name, order, status: st };
      })
      .filter((r) => r.id)
      .filter((r) => !r.status || r.status.toLowerCase() === "active");

    rpt.sort((a, b) => {
      const ao = a.order - b.order;
      if (ao !== 0) return ao;
      return a.name.localeCompare(b.name);
    });

    setReportTypes(rpt);
  }

  async function fetchBizReportTypeMapping() {
    const snap = await getDocs(collection(db, COL_MAP));
    const m = new Map();

    for (const d of snap.docs) {
      const v = d.data() || {};
      const b = normalize(v.businessType ?? v.businessCode ?? v.code);
      if (!b) continue;

      // Shape B: { businessType, reportTypeIds: [] }
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

      // Shape A: { businessType, reportTypeId, active }
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

  async function fetchReconConfigCountries() {
    try {
      const cfgSnap = await getDoc(doc(db, COL_RECON_CFG, "default"));

      if (!cfgSnap.exists()) {
        setAllowedCountries(null);
        return;
      }

      const cfg = cfgSnap.data() || {};
      const raw = cfg.allowedCountries;

      let arr = [];
      if (Array.isArray(raw)) arr = raw;
      else if (typeof raw === "string") arr = raw.split(",");
      else if (raw) arr = [String(raw)];

      const set = new Set(arr.map((x) => normalize(x).toUpperCase()).filter(Boolean));
      setAllowedCountries(set.size ? set : null);
    } catch (e) {
      console.error(e);
      setAllowedCountries(null);
    }
  }

  async function fetchCells() {
    if (!periodId || !businessType) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, COL_CELLS),
        where("periodId", "==", periodId),
        where("businessType", "==", businessType)
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      data.sort((a, b) => {
        const an = (a.distributorName || "").localeCompare(b.distributorName || "");
        if (an !== 0) return an;
        return (a.reportTypeName || "").localeCompare(b.reportTypeName || "");
      });

      setRows(data);
    } catch (e) {
      console.error(e);
      toast.error(`${e?.code || "error"}: ${e?.message || "Failed to load reconCells"}`);
    } finally {
      setLoading(false);
    }
  }

  // ----------------- Init -----------------
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchPeriods(),
          fetchBusinesses(),
          fetchDistributors(),
          fetchReportTypes(),
          fetchBizReportTypeMapping(),
        ]);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load setup data");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchCells();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId, businessType]);

  useEffect(() => {
    fetchReconConfigCountries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ When period/business changes, clear selection to prevent wrong deletes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [periodId, businessType]);

  // ✅ When filters change (search/status), optionally clear selection (safer)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [qText, statusFilter]);

  // ✅ Auto-pick first distributor + first report type
  useEffect(() => {
    if (!businessType) return;

    const dList = distributorsForSelectedBusiness;
    if (!dList.length) {
      setDistributorCode("");
    } else {
      const ok = dList.some((d) => d.code === distributorCode);
      if (!distributorCode || !ok) setDistributorCode(dList[0].code);
    }

    const rList = reportTypesForSelectedBusiness;
    if (!rList.length) {
      setReportTypeId("");
    } else {
      const ok = rList.some((r) => r.id === reportTypeId);
      if (!reportTypeId || !ok) setReportTypeId(rList[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    businessType,
    distributorsForSelectedBusiness.length,
    reportTypesForSelectedBusiness.length,
  ]);

  useEffect(() => {
    setLocked(false);
  }, [periodId, businessType, distributorCode, reportTypeId]);

  async function loadExistingIntoForm() {
    if (!periodId || !businessType || !distributorCode || !reportTypeId) return;
    const cellId = makeCellId(periodId, businessType, distributorCode, reportTypeId);
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, COL_CELLS, cellId));
      if (!snap.exists()) {
        toast("No existing cell. You will create a new one.", { icon: "ℹ️" });
        setStatus("no_data");
        setRemark("");
        setLocked(false);
        return;
      }
      const d = snap.data();
      setStatus(d.status || "no_data");
      setRemark(d.remark || "");
      const isLocked = (d.status || "") === "match";
      setLocked(isLocked);
      toast.success(isLocked ? "Loaded (LOCKED: Match)" : "Loaded existing cell");
    } catch (e) {
      console.error(e);
      toast.error(`${e?.code || "error"}: ${e?.message || "Failed to load cell"}`);
    } finally {
      setLoading(false);
    }
  }

  async function recordUpdate() {
    if (!canManage) return toast.error("No permission");
    if (!periodId) return toast.error("Please select a period");
    if (!businessType) return toast.error("Please select business type");
    if (!distributorCode) return toast.error("Please select distributor");
    if (!reportTypeId) return toast.error("Please select report type");

    if (
      allowedReportTypeIds &&
      allowedReportTypeIds.size > 0 &&
      !allowedReportTypeIds.has(reportTypeId)
    ) {
      return toast.error("This Report Type is not allowed for the selected Business Type.");
    }

    const isAllowedDist = distributorsForSelectedBusiness.some(
      (d) => d.code === distributorCode
    );
    if (!isAllowedDist) {
      return toast.error(
        "This Distributor is not allowed for the selected Business Type / Country config."
      );
    }

    const cellId = makeCellId(periodId, businessType, distributorCode, reportTypeId);
    const cellRef = doc(db, COL_CELLS, cellId);

    const distName = selectedDistributor?.name || "";
    const rptName = selectedReportType?.name || "";

    const payload = {
      periodId,
      year: Number(String(periodId).split("-")[0] || 0),
      month: Number(String(periodId).split("-")[1] || 0),

      businessType,
      distributorCode,
      distributorName: distName,
      reportTypeId,
      reportTypeName: rptName,

      status,
      remark: remark || "",

      pic: actorName,
      picUid: actorUid,
      picEmail: actorEmail,
    };

    setLoading(true);
    try {
      const res = await runTransaction(db, async (tx) => {
        const snap = await tx.get(cellRef);
        const prev = snap.exists() ? snap.data() : null;

        if (prev?.status === "match") {
          const err = new Error("LOCKED_MATCH");
          err.code = "LOCKED_MATCH";
          throw err;
        }

        const prevReconsNo = Number(prev?.reconsNo || 0) || 0;
        const nextReconsNo = prevReconsNo + 1;

        const createdAt = prev?.createdAt || serverTimestamp();
        const createdBy = prev?.createdBy || actorName;

        tx.set(
          cellRef,
          {
            ...payload,
            reconsNo: nextReconsNo,
            updatedAt: serverTimestamp(),
            createdAt,
            createdBy,
          },
          { merge: true }
        );

        const attemptSnapshot = {
          cellId,
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

          pic: actorName,
          picUid: actorUid,
          picEmail: actorEmail,
          updatedAt: serverTimestamp(),
          clientUpdatedAt: new Date().toISOString(),

          previousStatus: prev?.status || (snap.exists() ? "no_data" : "new"),
          previousReconsNo: prevReconsNo,
          source: "ui",
        };

        const attemptRef = doc(db, COL_CELLS, cellId, "attempts", String(nextReconsNo));
        tx.set(attemptRef, attemptSnapshot);

        if (COL_GLOBAL_ATTEMPTS) {
          const globalRef = doc(collection(db, COL_GLOBAL_ATTEMPTS));
          tx.set(globalRef, attemptSnapshot);
        }

        return { nextReconsNo, willLock: payload.status === "match" };
      });

      setLocked(res.willLock);
      toast.success(
        `Saved ${cellId} (Recons #${res.nextReconsNo})${res.willLock ? " — LOCKED" : ""}`
      );
      await fetchCells();
    } catch (e) {
      console.error(e);
      if (e?.code === "LOCKED_MATCH" || e?.message === "LOCKED_MATCH") {
        setLocked(true);
        toast.error("This record is LOCKED because it is already Match.");
      } else {
        toast.error(`${e?.code || "error"}: ${e?.message || "Failed to save reconCell"}`);
      }
    } finally {
      setLoading(false);
    }
  }

  // ✅ NEW: bulk delete
  async function deleteSelected() {
    if (!canManage) return toast.error("No permission");
    if (!selectedIds.size) return toast.error("Please select at least 1 row.");

    const selectedRows = filteredRows.filter((r) => selectedIds.has(r.id));

    // Safety: block locked matches
    const lockedOnes = selectedRows.filter((r) => (r.status || "") === "match");
    const msg =
      lockedOnes.length
        ? `You are deleting ${selectedRows.length} record(s), including ${lockedOnes.length} MATCH record(s). Continue?`
        : `Delete ${selectedRows.length} selected reconCell(s)? Continue?`;

    const ok = window.confirm(msg);
    if (!ok) return;
    
    setLoading(true);
    const toastId = toast.loading("Deleting selected...");
    try {
      // 1) Delete main docs (batch)
      const batch = writeBatch(db);
      selectedRows.forEach((r) => {
        batch.delete(doc(db, COL_CELLS, r.id));
      });
      await batch.commit();

      // 2) Delete attempts subcollection docs (best effort)
      for (const r of selectedRows) {
        try {
          const attemptsRef = collection(db, COL_CELLS, r.id, "attempts");
          const attemptsSnap = await getDocs(attemptsRef);
          if (!attemptsSnap.empty) {
            const b2 = writeBatch(db);
            attemptsSnap.docs.forEach((ad) => b2.delete(ad.ref));
            await b2.commit();
          }
        } catch (e) {
          console.warn("Attempts delete skipped/failed for", r.id, e);
        }
      }

      setSelectedIds(new Set());
      toast.success("Deleted selected rows.", { id: toastId });
      await fetchCells();
    } catch (e) {
      console.error(e);
      toast.error(`${e?.code || "error"}: ${e?.message || "Failed to delete selected"}`, {
        id: toastId,
      });
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = useMemo(() => {
    const t = qText.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && (r.status || "") !== statusFilter) return false;
      if (!t) return true;
      const hay = `${r.distributorCode} ${r.distributorName} ${r.reportTypeId} ${r.reportTypeName}`.toLowerCase();
      return hay.includes(t);
    });
  }, [rows, qText, statusFilter]);

  // ✅ select all / partial
  const allVisibleSelected = useMemo(() => {
    if (!filteredRows.length) return false;
    return filteredRows.every((r) => selectedIds.has(r.id));
  }, [filteredRows, selectedIds]);

  const someVisibleSelected = useMemo(() => {
    if (!filteredRows.length) return false;
    return filteredRows.some((r) => selectedIds.has(r.id));
  }, [filteredRows, selectedIds]);

  function toggleSelectAllVisible(checked) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        filteredRows.forEach((r) => next.add(r.id));
      } else {
        filteredRows.forEach((r) => next.delete(r.id));
      }
      return next;
    });
  }

  function toggleSelectOne(id, checked) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <div className="p-5 bg-slate-50 min-h-[calc(100vh-75px)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">ReconCells Manager</h1>
          <p className="text-sm text-slate-600">
            Distributor list is filtered by master_distributors.businessType and reconConfig.countries.
            Report types filtered by map_business_reporttypes.
          </p>
          <div className="mt-1 text-xs text-slate-500">
            Signed in as: <span className="font-semibold">{actorName}</span>
            {locked && (
              <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                LOCKED (Match)
              </span>
            )}
          </div>

          {allowedCountries && (
            <div className="mt-2 text-xs text-slate-500">
              Allowed countries:{" "}
              <span className="font-semibold">{[...allowedCountries].join(", ")}</span>
            </div>
          )}
        </div>

        <button
          onClick={fetchCells}
          className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
          disabled={loading}
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm font-semibold text-slate-800 mb-3">Context</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">Period</label>
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={periodId}
                onChange={(e) => setPeriodId(e.target.value)}
                disabled={loading}
              >
                {periods.map((p) => {
                  const pid = p.periodId || p.id;
                  return (
                    <option key={pid} value={pid}>
                      {pid} — {p.monthName || ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">Business Type</label>
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                disabled={loading}
              >
                {businesses.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-500">
            Loaded cells: <span className="font-semibold">{rows.length}</span>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm font-semibold text-slate-800 mb-3">Record Update</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">
                Distributor{" "}
                <span className="text-slate-400">
                  ({distributorsForSelectedBusiness.length})
                </span>
              </label>
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={distributorCode}
                onChange={(e) => setDistributorCode(e.target.value)}
                disabled={loading || locked}
              >
                {distributorsForSelectedBusiness.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">
                Report Type{" "}
                <span className="text-slate-400">
                  ({reportTypesForSelectedBusiness.length})
                </span>
              </label>
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={reportTypeId}
                onChange={(e) => setReportTypeId(e.target.value)}
                disabled={loading || locked}
              >
                {reportTypesForSelectedBusiness.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} — {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">Status</label>
              <select
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={loading || locked}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600">Remark</label>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Optional remark"
                disabled={loading || locked}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={loadExistingIntoForm}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
            >
              <Pencil className="h-4 w-4" />
              Load Existing
            </button>

            <button
              onClick={recordUpdate}
              disabled={loading || locked || !canManage}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              title={locked ? "Locked: already Match" : !canManage ? "No permission" : ""}
            >
              <Save className="h-4 w-4" />
              Record Update
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="mt-4 rounded-xl border bg-white">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="text-sm font-semibold text-slate-800">
            ReconCells ({periodId} / {businessType || "-"})
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                className="pl-8 pr-3 py-2 rounded-lg border text-sm"
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                placeholder="Search distributor/report..."
              />
            </div>

            <select
              className="rounded-lg border px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="match">Match</option>
              <option value="mismatch">Mismatch</option>
              <option value="no_data">No Data</option>
            </select>

            <button
              onClick={deleteSelected}
              disabled={loading || !canManage || selectedIds.size === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
              title={
                !canManage
                  ? "No permission"
                  : selectedIds.size === 0
                    ? "Select row(s) first"
                    : "Delete selected"
              }
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-600">
              <tr>
                <th className="px-4 py-3 w-[52px]">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                    }}
                    onChange={(e) => toggleSelectAllVisible(e.target.checked)}
                    disabled={!filteredRows.length}
                    title="Select all visible"
                  />
                </th>
                <th className="px-4 py-3">Distributor</th>
                <th className="px-4 py-3">Report Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Recons#</th>
                <th className="px-4 py-3">PIC</th>
                <th className="px-4 py-3">Remark</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t hover:bg-slate-50 cursor-pointer"
                  onClick={() => {
                    setDistributorCode(r.distributorCode || "");
                    setReportTypeId(r.reportTypeId || "");
                    setStatus(r.status || "no_data");
                    setRemark(r.remark || "");
                    setLocked((r.status || "") === "match");
                  }}
                  title="Click to load into form"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => toggleSelectOne(r.id, e.target.checked)}
                    />
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{r.distributorCode}</div>
                    <div className="text-xs text-slate-500">{r.distributorName}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{r.reportTypeId}</div>
                    <div className="text-xs text-slate-500">{r.reportTypeName}</div>
                  </td>
                  <td className="px-4 py-3">
                    {(r.status || "") === "match" ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                        match
                      </span>
                    ) : (
                      r.status
                    )}
                  </td>
                  <td className="px-4 py-3">{r.reconsNo || 0}</td>
                  <td className="px-4 py-3">{r.pic || "-"}</td>
                  <td className="px-4 py-3">{r.remark || ""}</td>
                </tr>
              ))}

              {!filteredRows.length && (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                    No data found for this selection.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 text-xs text-slate-500 border-t">
          Select row(s) using checkbox, then click <span className="font-semibold">Delete Selected</span>.
        </div>
      </div>
    </div>
  );
}
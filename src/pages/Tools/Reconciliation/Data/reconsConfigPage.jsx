import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../../../../firebaseClient";
import { useUser } from "../../../../context/UserContext";
import { Save, Plus, Trash2, RefreshCcw } from "lucide-react";

const COL_CFG = "reconConfig";
const DOC_ID = "default";

const COL_COUNTRIES = "master_countries";

// Seed default: allow MY + BR, SG excluded
const DEFAULT_ALLOWED = ["MY", "BR"];

function norm(s = "") {
  return String(s ?? "").trim().toUpperCase();
}

function pickCountryCode(v, docId) {
  // support many schemas
  return norm(v.code ?? v.countryCode ?? v.iso2 ?? v.iso ?? docId);
}

function pickCountryName(v, code) {
  return String(v.name ?? v.countryName ?? v.title ?? code).trim();
}

export default function ReconsConfigPage() {
  const { user } = useUser();

  const canManage = !!user; // tighten later with role/permission
  const actor = user?.email || user?.name || "unknown";
  const actorUid = user?.uid || "";

  const [loading, setLoading] = useState(false);

  // config
  const [allowedCountries, setAllowedCountries] = useState(DEFAULT_ALLOWED);

  // master countries
  const [countries, setCountries] = useState([]); // [{code,name,active}]
  const [search, setSearch] = useState("");
  const [pickCode, setPickCode] = useState(""); // dropdown selection

  const allowedSet = useMemo(
    () => new Set((allowedCountries || []).map(norm).filter(Boolean)),
    [allowedCountries]
  );

  const sortedAllowed = useMemo(() => {
    const arr = Array.from(allowedSet);
    arr.sort((a, b) => a.localeCompare(b));
    return arr;
  }, [allowedSet]);

  const filteredMaster = useMemo(() => {
    const t = search.trim().toLowerCase();
    const base = countries.filter((c) => c.active !== false);
    if (!t) return base;
    return base.filter((c) => `${c.code} ${c.name}`.toLowerCase().includes(t));
  }, [countries, search]);

  async function loadConfig() {
    const ref = doc(db, COL_CFG, DOC_ID);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      // create initial config
      await setDoc(
        ref,
        {
          allowedCountries: DEFAULT_ALLOWED,
          createdAt: serverTimestamp(),
          createdBy: actor,
          createdByUid: actorUid,
          updatedAt: serverTimestamp(),
          updatedBy: actor,
          updatedByUid: actorUid,
        },
        { merge: true }
      );
      return DEFAULT_ALLOWED;
    }

    const d = snap.data() || {};
    const arr = Array.isArray(d.allowedCountries) ? d.allowedCountries : DEFAULT_ALLOWED;
    return arr.map(norm).filter(Boolean);
  }

  async function loadMasterCountries() {
    const snap = await getDocs(query(collection(db, COL_COUNTRIES)));
    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .map((v) => {
        const code = pickCountryCode(v, v.id);
        const name = pickCountryName(v, code);

        // treat missing status as Active
        const active =
          v.active === undefined
            ? !(String(v.status || "Active").toLowerCase() === "inactive")
            : Boolean(v.active);

        // optional: sorting field
        const order = Number.isFinite(Number(v.order ?? v.sortOrder ?? v.orderNo))
          ? Number(v.order ?? v.sortOrder ?? v.orderNo)
          : 999;

        return { code, name, active, order };
      })
      .filter((x) => x.code);

    list.sort((a, b) => {
      const ao = a.order - b.order;
      if (ao !== 0) return ao;
      return a.name.localeCompare(b.name);
    });

    return list;
  }

  async function refreshAll() {
    setLoading(true);
    try {
      const [cfgAllowed, master] = await Promise.all([loadConfig(), loadMasterCountries()]);

      // keep only allowed countries that exist in master (avoid typos)
      const masterSet = new Set(master.map((c) => c.code));
      const cleaned = Array.from(new Set(cfgAllowed)).filter((c) => masterSet.has(c));

      setCountries(master);
      setAllowedCountries(cleaned.length ? cleaned : cfgAllowed);
      setPickCode(master.find((c) => c.code === "MY") ? "MY" : master[0]?.code || "");
      toast.success("Loaded config & master countries");
    } catch (e) {
      console.error(e);
      toast.error(`${e?.code || "error"}: ${e?.message || "Failed to load data"}`);
    } finally {
      setLoading(false);
    }
  }

  async function saveAllowed(nextAllowed) {
    if (!canManage) return toast.error("No permission");

    // only allow codes that exist in master
    const masterSet = new Set(countries.map((c) => c.code));
    const cleaned = Array.from(new Set((nextAllowed || []).map(norm)))
      .filter(Boolean)
      .filter((c) => masterSet.has(c));

    setLoading(true);
    try {
      await setDoc(
        doc(db, COL_CFG, DOC_ID),
        {
          allowedCountries: cleaned,
          updatedAt: serverTimestamp(),
          updatedBy: actor,
          updatedByUid: actorUid,
        },
        { merge: true }
      );
      setAllowedCountries(cleaned);
      toast.success("Saved config");
    } catch (e) {
      console.error(e);
      toast.error(`${e?.code || "error"}: ${e?.message || "Failed to save config"}`);
    } finally {
      setLoading(false);
    }
  }

  function addPickedCountry() {
    const c = norm(pickCode);
    if (!c) return;
    if (allowedSet.has(c)) return toast("Already allowed", { icon: "ℹ️" });
    saveAllowed([...sortedAllowed, c]);
  }

  function removeCountry(code) {
    saveAllowed(sortedAllowed.filter((x) => x !== code));
  }

  // init
  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-5 bg-slate-50 min-h-[calc(100vh-75px)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Recons Config</h1>
          <p className="text-sm text-slate-600">
            Whitelist which countries are allowed to reconcile (uses master_countries).
          </p>
          <div className="mt-1 text-xs text-slate-500">
            Default: <span className="font-semibold">MY</span>,{" "}
            <span className="font-semibold">BR</span>. SG excluded unless you add it.
          </div>
        </div>

        <button
          onClick={refreshAll}
          className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
          disabled={loading}
        >
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Allowed list */}
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-800">Allowed Countries</div>
              <div className="text-xs text-slate-500">Only these codes can be reconciled.</div>
            </div>

            <button
              onClick={() => saveAllowed(sortedAllowed)}
              disabled={loading || !canManage}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              title={!canManage ? "No permission" : ""}
            >
              <Save className="h-4 w-4" />
              Save
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {sortedAllowed.map((c) => {
              const name = countries.find((x) => x.code === c)?.name || "";
              return (
                <span
                  key={c}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-800"
                >
                  <span className="font-semibold">{c}</span>
                  {name ? <span className="text-slate-500">— {name}</span> : null}
                  <button
                    onClick={() => removeCountry(c)}
                    className="rounded-full p-1 hover:bg-slate-200"
                    disabled={loading || !canManage}
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </span>
              );
            })}

            {!sortedAllowed.length && (
              <div className="text-sm text-amber-700">
                No allowed countries set. This will block reconciliation for all countries.
              </div>
            )}
          </div>

          <div className="mt-4 border-t pt-4">
            <div className="text-sm font-semibold text-slate-800 mb-2">Add from master_countries</div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Country</label>
                <select
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  value={pickCode}
                  onChange={(e) => setPickCode(e.target.value)}
                  disabled={loading || !canManage}
                >
                  {filteredMaster.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>

                <div className="mt-2">
                  <input
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search country..."
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                onClick={addPickedCountry}
                disabled={loading || !canManage || !pickCode}
                className="inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Add
              </button>
            </div>

            <div className="mt-2 text-xs text-slate-500">
              Master source: <span className="font-semibold">{COL_COUNTRIES}</span> (only Active countries are shown).
            </div>
          </div>
        </div>

        {/* Master preview */}
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm font-semibold text-slate-800">Master Countries Preview</div>
          <div className="text-xs text-slate-500 mt-1">
            Showing {filteredMaster.length} active countries (filtered by search).
          </div>

          <div className="mt-3 max-h-[520px] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-600">
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Allowed?</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaster.map((c) => (
                  <tr key={c.code} className="border-t">
                    <td className="px-3 py-2 font-semibold text-slate-800">{c.code}</td>
                    <td className="px-3 py-2 text-slate-700">{c.name}</td>
                    <td className="px-3 py-2">
                      {allowedSet.has(c.code) ? (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 text-xs">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 text-xs">
                          No
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {!filteredMaster.length && (
                  <tr>
                    <td className="px-3 py-6 text-center text-slate-500" colSpan={3}>
                      No countries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-slate-500">
            The whitelist is stored at{" "}
            <span className="font-semibold">/reconsConfig/default.allowedCountries</span>.
          </div>
        </div>
      </div>
    </div>
  );
}
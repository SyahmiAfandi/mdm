import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Plus, RefreshCcw, Save, Settings2, Shield, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getBackendUrl } from "../../config/backend";
import { usePermissions } from "../../hooks/usePermissions";
import { useUser } from "../../context/UserContext";

const BUSINESS_TYPE = "HPC";

const norm = (value = "") => String(value ?? "").trim().toUpperCase();

export default function DssTemplateCountryConfigPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { can, role } = usePermissions();

  const canView = can("reports.dss.view") || can("reports.view") || can("reports.*") || role === "admin";
  const canEdit = can("reports.dss.edit") || can("reports.*") || can("settings.*") || role === "admin";

  const backendUrl = useMemo(() => {
    const url = getBackendUrl();
    return url ? url.replace(/\/+$/, "") : "";
  }, []);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allowedCountries, setAllowedCountries] = useState([]);
  const [availableCountries, setAvailableCountries] = useState([]);
  const [pickCode, setPickCode] = useState("");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("default");
  const [updatedAt, setUpdatedAt] = useState("");
  const [updatedBy, setUpdatedBy] = useState("");

  const allowedSet = useMemo(
    () => new Set((allowedCountries || []).map(norm).filter(Boolean)),
    [allowedCountries]
  );

  const filteredAvailable = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableCountries;
    return availableCountries.filter((item) => `${item.code} ${item.distributorCount}`.toLowerCase().includes(q));
  }, [availableCountries, search]);

  async function loadConfig(showToast = false) {
    if (!backendUrl) {
      toast.error("Backend URL is not configured.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${backendUrl}/dss_template_country_config?businessType=${BUSINESS_TYPE}`);
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Failed to load DSS template config.");

      const nextAllowed = Array.isArray(result?.allowedCountries)
        ? result.allowedCountries.map(norm).filter(Boolean)
        : [];
      const nextAvailable = Array.isArray(result?.availableCountries)
        ? result.availableCountries
            .map((item) => ({
              code: norm(item?.code),
              distributorCount: Number(item?.distributorCount || 0),
            }))
            .filter((item) => item.code)
        : [];

      setAllowedCountries(nextAllowed);
      setAvailableCountries(nextAvailable);
      setPickCode(nextAvailable.find((item) => nextAllowed.includes(item.code))?.code || nextAvailable[0]?.code || "");
      setSource(String(result?.source || "default"));
      setUpdatedAt(String(result?.updatedAt || ""));
      setUpdatedBy(String(result?.updatedBy || ""));
      if (showToast) toast.success("Template config refreshed");
    } catch (error) {
      console.error(error);
      toast.error(error?.message || "Failed to load DSS template config.");
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig(nextAllowed) {
    if (!canEdit) {
      toast.error("No permission to update DSS template config.");
      return;
    }
    if (!backendUrl) {
      toast.error("Backend URL is not configured.");
      return;
    }

    const availableSet = new Set(availableCountries.map((item) => item.code));
    const cleaned = Array.from(new Set((nextAllowed || []).map(norm))).filter((code) => availableSet.has(code));

    try {
      setSaving(true);
      const response = await fetch(`${backendUrl}/dss_template_country_config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessType: BUSINESS_TYPE,
          allowedCountries: cleaned,
          updatedBy: user?.email || user?.name || user?.uid || "unknown",
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Failed to save DSS template config.");

      setAllowedCountries(Array.isArray(result?.allowedCountries) ? result.allowedCountries.map(norm).filter(Boolean) : []);
      setSource(String(result?.source || "saved"));
      setUpdatedAt(String(result?.updatedAt || ""));
      setUpdatedBy(String(result?.updatedBy || ""));
      toast.success("DSS template config saved");
    } catch (error) {
      console.error(error);
      toast.error(error?.message || "Failed to save DSS template config.");
    } finally {
      setSaving(false);
    }
  }

  function addCountry() {
    const code = norm(pickCode);
    if (!code) return;
    if (allowedSet.has(code)) {
      toast("Country already allowed", { icon: "i" });
      return;
    }
    saveConfig([...allowedCountries, code]);
  }

  function removeCountry(code) {
    saveConfig(allowedCountries.filter((item) => norm(item) !== norm(code)));
  }

  useEffect(() => {
    if (!canView) return;
    loadConfig();
  }, [canView]);

  if (!canView) {
    return (
      <div className="p-6">
        <div className="rounded-xl border p-6 flex gap-3 bg-white">
          <Shield className="w-5 h-5" />
          <div>You do not have permission to view DSS template configuration.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 min-h-[calc(100vh-75px)] bg-slate-50">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 px-5 py-4 text-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
                <Settings2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold tracking-tight">DSS Template Country Config</h1>
                <p className="text-xs text-slate-300 mt-1">
                  Control which active {BUSINESS_TYPE} distributor countries are included in the DSS template export.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Default behavior excludes <span className="font-semibold text-white">USG</span> and keeps
                  <span className="font-semibold text-white"> UMY</span> / <span className="font-semibold text-white">UBR</span>
                  when those country codes exist in active distributor data.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/reports/DSS")}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to DSS
              </button>
              <button
                onClick={() => loadConfig(true)}
                disabled={loading || saving}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15 disabled:opacity-60"
              >
                <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
          <div className="rounded-2xl border bg-white shadow-sm p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Allowed Countries</div>
                <div className="text-xs text-slate-500">Only distributors in these country buckets will appear in the exported template.</div>
              </div>
              <button
                onClick={() => saveConfig(allowedCountries)}
                disabled={saving || loading || !canEdit}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 min-h-10">
              {allowedCountries.map((code) => {
                const distributorCount = availableCountries.find((item) => item.code === code)?.distributorCount || 0;
                return (
                  <span
                    key={code}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-800"
                  >
                    <span className="font-semibold">{code}</span>
                    <span className="text-slate-500">{distributorCount} distributors</span>
                    <button
                      onClick={() => removeCountry(code)}
                      disabled={saving || loading || !canEdit}
                      className="rounded-full p-1 hover:bg-slate-200 disabled:opacity-50"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </span>
                );
              })}
              {!allowedCountries.length && (
                <div className="text-sm text-amber-700">
                  No countries are currently allowed. Template export will return no distributors until you add one.
                </div>
              )}
            </div>

            <div className="mt-5 border-t pt-4">
              <div className="text-sm font-semibold text-slate-900 mb-2">Add Country</div>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Country Code</label>
                  <select
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={pickCode}
                    onChange={(event) => setPickCode(event.target.value)}
                    disabled={loading || saving || !canEdit}
                  >
                    {filteredAvailable.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.code} ({item.distributorCount} distributors)
                      </option>
                    ))}
                  </select>
                  <input
                    className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search country code..."
                    disabled={loading || saving}
                  />
                </div>

                <button
                  onClick={addCountry}
                  disabled={loading || saving || !canEdit || !pickCode}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>

            <div className="mt-4 text-xs text-slate-500 space-y-1">
              <div>Config source: <span className="font-semibold uppercase">{source}</span></div>
              {updatedAt && <div>Last updated: <span className="font-semibold">{updatedAt}</span></div>}
              {updatedBy && <div>Updated by: <span className="font-semibold">{updatedBy}</span></div>}
            </div>
          </div>

          <div className="rounded-2xl border bg-white shadow-sm p-4">
            <div className="text-sm font-semibold text-slate-900">Active {BUSINESS_TYPE} Country Preview</div>
            <div className="text-xs text-slate-500 mt-1">
              Available country codes are read from active {BUSINESS_TYPE} rows in <span className="font-semibold">master_distributors</span>.
            </div>

            <div className="mt-3 overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Country</th>
                    <th className="px-3 py-2">Distributor Count</th>
                    <th className="px-3 py-2">Allowed</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAvailable.map((item) => (
                    <tr key={item.code} className="border-t">
                      <td className="px-3 py-2 font-semibold text-slate-800">{item.code}</td>
                      <td className="px-3 py-2 text-slate-600">{item.distributorCount}</td>
                      <td className="px-3 py-2">
                        {allowedSet.has(item.code) ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 text-xs font-semibold">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-rose-700 text-xs font-semibold">
                            No
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!filteredAvailable.length && (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-slate-500">
                        {loading ? "Loading countries..." : "No active country codes found for HPC distributors."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

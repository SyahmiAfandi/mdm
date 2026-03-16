import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "../../supabaseClient";
import { useUser } from "../../context/UserContext";

import { RefreshCcw, Save, GitMerge, Shield, Search, Package } from "lucide-react";
import { usePermissions } from "../../hooks/usePermissions";

export default function MasterMapPromoItemSkuPage() {
  const { user } = useUser();
  const CURRENT_USER = user?.email || user?.name || user?.uid || "";

  const { can, role } = usePermissions();

  const canView = can("masterData.mapPromoSku.view") || can("masterData.*") || role === "admin";
  const canEdit =
    can("masterData.mapPromoSku.edit") || can("masterData.*") || role === "admin";

  const [loading, setLoading] = useState(false);
  const [promoItems, setPromoItems] = useState([]);
  const [skus, setSkus] = useState([]);

  // Selections
  const [selectedPromoItem, setSelectedPromoItem] = useState(null);
  const [mappedSkus, setMappedSkus] = useState([]); // Array of sku codes
  const [qText, setQText] = useState("");
  const [skuQText, setSkuQText] = useState("");

  async function fetchData() {
    try {
      setLoading(true);

      const [promoSnap, skuSnap, mapSnap] = await Promise.all([
        getDocs(query(collection(db, "master_promo_items"), orderBy("itemCode", "asc"))),
        getDocs(query(collection(db, "master_sku"), orderBy("code", "asc"))),
        getDocs(query(collection(db, "map_promoItem_sku")))
      ]);

      const promoData = promoSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const skuData = skuSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Mappings (doc id = promo item code)
      const mappingDict = {};
      mapSnap.docs.forEach(d => {
        mappingDict[d.id] = d.data().mappedSkus || [];
      });

      // Embed mappings into promo items for display
      const finalPromo = promoData.map(p => ({
        ...p,
        mappedSkus: mappingDict[p.itemCode] || []
      }));

      setPromoItems(finalPromo);
      setSkus(skuData);

      // If we had a selection, refresh its mapping
      if (selectedPromoItem) {
        setMappedSkus(mappingDict[selectedPromoItem.itemCode] || []);
      }

    } catch (e) {
      console.error(e);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const filteredItems = useMemo(() => {
    const t = qText.toLowerCase().trim();
    if (!t) return promoItems;
    return promoItems.filter(p =>
      p.itemCode.toLowerCase().includes(t) ||
      p.itemName.toLowerCase().includes(t)
    );
  }, [promoItems, qText]);

  const filteredSkus = useMemo(() => {
    const t = skuQText.toLowerCase().trim();
    if (!t) return skus;
    return skus.filter(s =>
      s.code.toLowerCase().includes(t) ||
      (s.description || "").toLowerCase().includes(t)
    );
  }, [skus, skuQText]);

  function handleSelectPromo(item) {
    setSelectedPromoItem(item);
    setMappedSkus(item.mappedSkus || []);
  }

  function toggleSku(skuCode) {
    if (!canEdit) return;
    setMappedSkus(prev => {
      if (prev.includes(skuCode)) {
        return prev.filter(s => s !== skuCode);
      } else {
        return [...prev, skuCode];
      }
    });
  }

  async function handleSave() {
    if (!canEdit) return toast.error("No permission to map SKUs");
    if (!selectedPromoItem) return toast.error("Select a Promotion Item first");

    try {
      setLoading(true);
      const code = selectedPromoItem.itemCode;

      await setDoc(doc(db, "map_promoItem_sku", code), {
        promoItemCode: code,
        mappedSkus,
        updatedAt: serverTimestamp(),
        updatedBy: CURRENT_USER
      }, { merge: true });

      toast.success("Mapping updated successfully ✅");
      await fetchData(); // Refresh data to show updated counts on LHS
    } catch (e) {
      console.error(e);
      toast.error("Failed to save mapping");
    } finally {
      setLoading(false);
    }
  }


  if (!canView) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-gray-700" />
            </div>
            <div>
              <div className="text-base font-semibold text-gray-900">Access restricted</div>
              <div className="mt-1 text-sm text-gray-600">
                You don’t have permission to view Promo Item to SKU Mapping.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 flex flex-col h-[calc(100vh-80px)]">

      {/* Header */}
      <div className="shrink-0 flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center">
            <GitMerge className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Map Promo Item to SKU
            </h1>
            <p className="text-sm text-gray-500">
              Select a Promotion Item to link it with one or multiple SKUs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            disabled={loading}
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Layout: Split Screen */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">

        {/* Left Column: Promotion Items List */}
        <div className="w-full md:w-1/3 flex flex-col bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-100 bg-gray-50">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                placeholder="Search Promotion Items…"
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-gray-300"
              />
            </div>
            <div className="mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">
              {filteredItems.length} PROMO ITEMS
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-gray-50/30">
            {filteredItems.map(item => {
              const isSelected = selectedPromoItem?.itemCode === item.itemCode;
              const mappedCount = item.mappedSkus?.length || 0;

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectPromo(item)}
                  className={`
                    w-full text-left p-3 rounded-lg border transition-all duration-150
                    ${isSelected
                      ? 'bg-amber-50 border-amber-200 shadow-sm'
                      : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-sm'
                    }
                  `}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`font-mono text-xs font-bold ${isSelected ? 'text-amber-900' : 'text-gray-900'}`}>
                      {item.itemCode}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${mappedCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
                      {mappedCount} SKU{mappedCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className={`text-sm truncate ${isSelected ? 'text-amber-800' : 'text-gray-600'}`}>
                    {item.itemName}
                  </div>
                </button>
              );
            })}

            {filteredItems.length === 0 && (
              <div className="text-center p-6 text-sm text-gray-500">
                {loading ? "Loading items..." : "No Promotion Items found."}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: SKU Mapping Area */}
        <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">

          {selectedPromoItem ? (
            <>
              {/* Mapping Header */}
              <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    Mapping SKUs for:
                    <span className="font-mono bg-white border border-gray-200 px-2 py-0.5 rounded text-amber-700">
                      {selectedPromoItem.itemCode}
                    </span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">{selectedPromoItem.itemName}</p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative w-48 hidden sm:block">
                    <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                    <input
                      value={skuQText}
                      onChange={(e) => setSkuQText(e.target.value)}
                      placeholder="Find SKU..."
                      className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-2 text-xs outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="text-xs font-medium text-gray-500">
                    <strong className="text-gray-900">{mappedSkus.length}</strong> selected
                  </div>
                  <button
                    onClick={handleSave}
                    disabled={!canEdit || loading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-bold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    Save Mapping
                  </button>
                </div>
              </div>

              {/* Grid of SKUs */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
                <div className="mb-3 sm:hidden">
                    <div className="relative w-full text-xs">
                      <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
                      <input
                        value={skuQText}
                        onChange={(e) => setSkuQText(e.target.value)}
                        placeholder="Find SKU..."
                        className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-2 outline-none focus:border-amber-400"
                      />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredSkus.map(sku => {
                    const isSelected = mappedSkus.includes(sku.code);
                    return (
                      <button
                        key={sku.id}
                        onClick={() => toggleSku(sku.code)}
                        type="button"
                        disabled={!canEdit}
                        className={`
                          flex flex-col text-left p-3 rounded-xl border-2 transition-all
                          ${isSelected
                            ? 'bg-white border-amber-400 shadow-sm ring-2 ring-amber-100'
                            : 'bg-white border-gray-100 hover:border-gray-200'
                          }
                          ${!canEdit ? 'cursor-not-allowed opacity-70' : ''}
                        `}
                      >
                        <div className="flex justify-between items-start w-full mb-1">
                          <span className={`font-mono text-xs font-bold ${isSelected ? 'text-amber-800' : 'text-gray-700'}`}>
                            {sku.code}
                          </span>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 line-clamp-2 w-full pr-2">
                          {sku.description}
                        </div>
                      </button>
                    );
                  })}
                  {filteredSkus.length === 0 && (
                    <div className="col-span-full py-10 text-center text-sm text-gray-500">
                      {skuQText ? "No matching SKUs found." : "No SKUs available. Create SKUs first."}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                <Package className="w-8 h-8 text-gray-300" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">No Item Selected</h2>
              <p className="text-sm text-gray-500 max-w-sm">
                Select a Promotion Item from the left sidebar to start linking it with SKUs.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

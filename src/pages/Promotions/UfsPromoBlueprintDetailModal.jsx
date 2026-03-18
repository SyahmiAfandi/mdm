import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Database, Filter, Layout, X } from 'lucide-react';
import { formatDisplayDate, formatNumericDisplay } from './ufsPromoUtils';

export default function UfsPromoBlueprintDetailModal({ isOpen, selectedDetail, onClose }) {
  const MotionDiv = motion.div;

  const currentSchemeInfo = selectedDetail ? [
    { label: 'Project Code - Name', value: selectedDetail.description || '-' },
    { label: 'Date From', value: formatDisplayDate(selectedDetail.periodFrom) },
    { label: 'Date To', value: formatDisplayDate(selectedDetail.periodTo) },
    { label: 'Scheme Promotion Number', value: selectedDetail.promoNumber || '-' },
    { label: 'Scheme ID', value: selectedDetail.schemeId || '-' },
    { label: 'Scheme On Unit', value: selectedDetail.uom || '-' },
    { label: 'Promo Type', value: selectedDetail.promoType || '-' },
    { label: 'Target Region', value: selectedDetail.regionName ? `${selectedDetail.regionCode} - ${selectedDetail.regionName}` : '-' },
    { label: 'Asset / Item', value: selectedDetail.itemName ? `${selectedDetail.itemCode} - ${selectedDetail.itemName}` : '-' },
  ] : [];

  const showFreeSkuColumn = selectedDetail?.promoType !== 'DISC';

  return (
    <AnimatePresence>
      {isOpen && selectedDetail ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          />

          <MotionDiv
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-7xl h-[85vh] bg-white dark:bg-slate-950 rounded-[40px] shadow-2xl border border-white/10 flex flex-col overflow-hidden"
          >
            <div className="shrink-0 px-10 py-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500">
                  <Database size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Scheme Blueprint Protocol</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">{selectedDetail.schemeId}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-3 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-10 custom-scrollbar space-y-12 bg-white dark:bg-slate-950">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-900/10 flex items-center justify-center">
                      <Database size={16} className="text-slate-700" />
                    </div>
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-[0.1em]">Current Scheme Information</h4>
                  </div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.16em]">
                    {selectedDetail.regionName || 'UFS Blueprint'}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-950">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                    {currentSchemeInfo.map((item, index) => (
                      <div
                        key={item.label}
                        className={`${index % 2 === 0 ? 'bg-white dark:bg-slate-950' : 'bg-slate-50 dark:bg-slate-900/40'} px-5 py-5 border-b border-r border-slate-100 dark:border-slate-800`}
                      >
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.16em] mb-1.5">
                          {item.label}
                        </div>
                        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 break-words leading-relaxed">
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Layout size={16} className="text-blue-500" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-[0.1em]">Scheme Multi-Slab Logic</h4>
                </div>

                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="text-white">
                      <tr className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                        <th className="px-5 py-3 border-r border-white/10 text-center bg-[#2E5FA8] text-white">Slab No</th>
                        <th className="px-5 py-3 border-r border-white/10 text-center bg-[#2E5FA8] text-white">Quantity From</th>
                        <th className="px-5 py-3 border-r border-white/10 text-center bg-[#2E5FA8] text-white">Quantity To</th>
                        <th className="px-5 py-3 border-r border-white/10 text-center bg-[#2E5FA8] text-white">Discount Qty</th>
                        <th className="px-5 py-3 border-r border-white/10 text-center bg-[#2E5FA8] text-white">For Every</th>
                        <th className={`px-6 py-3 text-center bg-[#2E5FA8] text-white ${showFreeSkuColumn ? 'border-r border-white/10' : ''}`}>Purchase Limit</th>
                        {showFreeSkuColumn ? (
                          <th className="px-8 py-3 text-center bg-[#2E5FA8] text-white">Free SKU</th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      {selectedDetail.slabs?.length > 0 ? selectedDetail.slabs.map((slab, index) => (
                        <tr key={`${slab.serialNo}-${slab.raw}`} className={index % 2 === 0 ? 'bg-white dark:bg-slate-950' : 'bg-slate-50 dark:bg-slate-900/40'}>
                          <td className="px-5 py-5 border-r border-slate-100 dark:border-slate-800 text-center italic">{slab.serialNo}</td>
                          <td className="px-5 py-5 border-r border-slate-100 dark:border-slate-800 text-center font-black">{formatNumericDisplay(slab.quantityFrom)}</td>
                          <td className="px-5 py-5 border-r border-slate-100 dark:border-slate-800 text-center font-black">{formatNumericDisplay(slab.quantityTo)}</td>
                          <td className="px-5 py-5 border-r border-slate-100 dark:border-slate-800 text-center font-black text-blue-600">{slab.discountDisplay || formatNumericDisplay(slab.discountQty)}</td>
                          <td className="px-5 py-5 border-r border-slate-100 dark:border-slate-800 text-center">{formatNumericDisplay(slab.forEvery, 2)}</td>
                          <td className={`px-6 py-5 text-center font-mono tracking-tighter ${showFreeSkuColumn ? 'border-r border-slate-100 dark:border-slate-800' : ''}`}>{formatNumericDisplay(slab.purchaseLimit, 2)}</td>
                          {showFreeSkuColumn ? (
                            <td className="px-4 py-3 min-w-[280px]">
                              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-sm">
                                <table className="w-full">
                                  <thead className="text-white">
                                    <tr className="text-[9px] font-black uppercase tracking-tighter">
                                      <th className="px-3 py-2 border-r border-white/10 bg-[#2E5FA8] text-white">SKU</th>
                                      <th className="px-3 py-2 bg-[#2E5FA8] text-white">Description</th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white dark:bg-slate-800/50 text-[10px]">
                                    {selectedDetail.freeSkus?.length > 0 ? (
                                      selectedDetail.freeSkus.map((sku, skuIndex) => (
                                        <tr
                                          key={`${slab.serialNo}-${sku.code}`}
                                          className={skuIndex !== selectedDetail.freeSkus.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''}
                                        >
                                          <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 font-mono text-blue-600">{sku.code}</td>
                                          <td className="px-3 py-2 font-black">{sku.description}</td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td colSpan={2} className="px-3 py-3 text-center text-slate-400 italic">No SKU mapped</td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={showFreeSkuColumn ? 7 : 6} className="px-6 py-10 text-center text-slate-400 italic">
                            No slab logic parsed from mechanics.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center">
                    <Filter size={16} className="text-rose-500" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-[0.1em]">Additional Target Attributes</h4>
                </div>

                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="text-white">
                      <tr className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                        <th className="px-5 py-3 border-r border-slate-500/60 bg-[#2E5FA8] text-white">Attributes</th>
                        <th className="px-5 py-3 border-r border-slate-500/60 text-center bg-[#2E5FA8] text-white">Condition</th>
                        <th className="px-5 py-3 bg-[#2E5FA8] text-white">Criteria</th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      {selectedDetail.criteriaMappings?.length > 0 ? (
                        selectedDetail.criteriaMappings.map((criteriaMapping, index) => (
                          <tr key={`${criteriaMapping.attribute}-${index}`} className={index % 2 === 0 ? 'bg-white dark:bg-slate-950' : 'bg-slate-50 dark:bg-slate-900/40'}>
                            <td className="px-5 py-5 border-r border-slate-100 dark:border-slate-800">{criteriaMapping.attribute}</td>
                            <td className="text-center px-5 py-5 border-r border-slate-100 dark:border-slate-800 text-blue-600">Include</td>
                            <td className="px-5 py-5 leading-relaxed text-slate-700 dark:text-slate-200">
                              {criteriaMapping.values.map((value, valueIndex) => (
                                <React.Fragment key={valueIndex}>
                                  {value} <br />
                                </React.Fragment>
                              ))}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-6 py-10 text-center text-slate-400 italic">No additional attributes mapped for this region.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="shrink-0 px-10 py-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center z-10">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 font-black text-[9px] uppercase tracking-tighter">
                  Reference: UFS-SYS-PK-01
                </div>
              </div>
              <button
                onClick={onClose}
                className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
              >
                Close Blueprint
              </button>
            </div>
          </MotionDiv>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

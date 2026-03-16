import React from "react";
import { Mail, Headset, Info, History, ShieldCheck, Zap } from "lucide-react";
import { motion } from "framer-motion";

function ContactPage() {
  const versionHistory = [
    {
      group: "Web Apps Application",
      versions: [
        {
          version: "Version 3.0",
          date: "now",
          features: [
            "Complete migration to a modern Web Application format",
            "Advanced Reconciliation tools for EFOS, FCS HPC, FCS IC, and Custom rules",
            "New Utilities: Email Tracker, Daily Sales Summary, Mismatch Tracker",
            "Master Data Management for Distributors, Brands, and Retailers",
            "Role-based Access Control (RBAC) and Admin Settings",
            "Interactive Dashboards and Analytics Reporting"
          ]
        }
      ]
    },
    {
      group: "New UI & VBA Excel",
      versions: [
        { version: "Version 2.3", date: "22/7/2024", features: ["Fix some bugs in the application", "Fix recons logic on EFOS Outlet reports", "Added: Internal info & version info"] },
        { version: "Version 2.2", date: "17/7/2024", features: ["Fix minor issue in Update recons report logic", "Improve tool performance upon closure"] },
        { version: "Version 2.1", date: "2/7/2024", features: ["Fix major issue in Daily Sales Summary Recon", "Enhance feature Promotion Creation Tools", "Improve Excel Tool Space Utilization", "Added Feature: Upload recons data in PBI"] },
        { version: "Version 2.0", date: "", features: ["fix major issue on EFOS Outlet View and EFOS Salesman view", "fix minor bug", "new UI interface", "added Daily Sales Summary recon", "added Tools: Promotion Interface"] }
      ]
    },
    {
      group: "Excel VBA BASIC",
      versions: [
        { version: "Version 1.16", date: "", features: ["fix minor issue", "fix IC IQ Performance issue logic"] },
        { version: "Version 1.15", date: "", features: ["fix PBI data based on CTG logic", "cleanup the script", "fix minor logic on result button"] },
        { version: "Version 1.14", date: "", features: ["Added feature: Merge PBI (now can recon UBR and UMY at one time)", "fix EFOS outlet logic", "Adhance function added", "UI interface"] },
        { version: "Version 1.13", date: "", features: ["Added feature: Login screen", "Enhance User UI interface", "Fix OSDP load - EFOS Salesman"] },
        { version: "Version 1.12", date: "", features: ["Added feature: freeze panes for all sheets except Dashboard"] },
        { version: "Version 1.11", date: "", features: ["Feature added: IQ Performance Salesman recon", "Fix result output (result should be only displayed based on total OSDP input)", "Fix other recon logic"] },
        { version: "Version 1.10", date: "", features: ["Feature added: IQ Performance Outlet recon", "Fix bugs and load OSDP/PBI logic", "Enhance result script: reduce time execute the result", "Enhance the reconcile script"] },
        { version: "Version 1.9", date: "", features: ["Enhance FCS HPC logic", "Add on merge button for PBI report UMY & UBR", "Merge script code for FCS IC and FCS HPC"] },
        { version: "Version 1.8", date: "", features: ["Enhance EFOS outlet view recon logic", "Enhance FCS IC recon logic"] },
        { version: "Version 1.7", date: "", features: ["Add feature: mismatch result (Only available for EFOS Outlet)"] },
        { version: "Version 1.6", date: "", features: ["Fix OSDP Load rows number"] },
        { version: "Version 1.5", date: "", features: ["Fix login UI Button"] },
        { version: "Version 1.4", date: "", features: ["Added Recon: IC IQ Performance", "Change login on UI button"] },
        { version: "Version 1.3", date: "", features: ["Added Recon: EFOS Salesman View", "Change logic recon on EFOS Outlet View"] },
        { version: "Version 1.2", date: "", features: ["Added Recon: FCS IC"] },
        { version: "Version 1.1", date: "", features: ["Added Recon: FCS HPC"] },
        { version: "Version 1.0", date: "", features: ["EFOS Outlet View can be recon"] },
      ]
    }
  ];

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full min-w-0 px-3 sm:px-5 pb-3 flex flex-col"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* --- LEFT COLUMN: Contact & App Info --- */}
        <div className="lg:col-span-1 flex flex-col gap-6">

          {/* Contact Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[220px]">
            <div className="p-6 pb-4 bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex-1 relative overflow-hidden">
              {/* Decorative circle */}
              <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-2xl"></div>

              <div className="relative z-10 w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                <Headset className="w-5 h-5 text-white" />
              </div>
              <h2 className="relative z-10 text-lg font-bold mb-1">Contact Support</h2>
              <p className="relative z-10 text-blue-100 text-xs">Need help or have questions about the MDM Application? We're here for you.</p>
            </div>

            <div className="p-5 bg-white shrink-0">
              <div className="flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Email Support</p>
                  <a href="mailto:syahmi.afandi@unilever.com" className="text-xs font-semibold text-slate-800 hover:text-blue-600 transition-colors">
                    syahmi.afandi@unilever.com
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Current Version Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4 flex-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">App Version & Info</h3>
                <p className="text-[11px] text-slate-500">System details</p>
              </div>
            </div>

            <div className="space-y-3 flex-1">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Current Version</p>
                <div className="flex items-end gap-2">
                  <span className="text-xl font-black text-slate-800 leading-none">3.0</span>
                  <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mb-0.5">Stable</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 leading-tight">Web Apps Application Format</p>
              </div>

              <div className="flex flex-col gap-2 mt-auto pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Environment</span>
                  <span className="text-xs font-bold text-slate-700">Production</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- RIGHT COLUMN: Version History --- */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800">Version History</h2>
                <p className="text-[11px] text-slate-500">Changelog and updates over time</p>
              </div>
            </div>
          </div>

          <div className="p-6 relative">
            <div className="absolute left-8 top-6 bottom-6 w-px bg-slate-200"></div>

            <div className="space-y-10 relative">
              {versionHistory.map((group, groupIdx) => (
                <div key={groupIdx} className="relative">
                  <div className="sticky top-0 bg-white/90 backdrop-blur-sm z-10 py-2 -mt-2 mb-4 pr-4 pl-12">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">{group.group}</h3>
                  </div>

                  <div className="space-y-8 pl-14">
                    {group.versions.map((ver, verIdx) => (
                      <div key={verIdx} className="relative">
                        {/* Timeline dot */}
                        <div className="absolute -left-[30px] top-1.5 w-3 h-3 rounded-full border-2 border-white bg-indigo-500 shadow-sm z-10"></div>

                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
                          <h4 className="text-base font-bold text-indigo-600">{ver.version}</h4>
                          {ver.date && <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{ver.date}</span>}
                        </div>

                        {ver.features.length > 0 ? (
                          <ul className="space-y-1.5">
                            {ver.features.map((feat, fIdx) => (
                              <li key={fIdx} className="text-sm text-slate-600 flex items-start gap-2">
                                <span className="text-slate-300 mt-1.5 shrink-0">•</span>
                                <span>{feat}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-slate-500 italic">Initial web application release</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
}

export default ContactPage;

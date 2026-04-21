import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  DatabaseZap,
  Headset,
  History,
  Info,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  Megaphone,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wrench,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";

function ContactPage() {
  const MotionDiv = motion.div;

  const currentRelease = {
    version: "3.0",
    date: "15/04/2026",
    status: "Stable",
    label: "Supabase-Powered Operations Hub",
    summary:
      "Version 3.0 turns MDM Tools into a connected web operations platform with live data, permission-aware navigation, broader business workflows, and a cleaner command-center experience for daily teams.",
    highlights: [
      {
        title: "Platform Core",
        desc: "Supabase-backed authentication, cleaner route structure, improved page transitions, persistent breadcrumbs, and a stronger foundation for multi-module operations.",
      },
      {
        title: "Operations Workflow",
        desc: "Reconciliation, report extraction, email tracking, and promotion workflows now cover more of the real day-to-day execution cycle instead of isolated utilities.",
      },
      {
        title: "Admin & Governance",
        desc: "Role permissions, license handling, user setup, and PIC registration now sit inside the product instead of depending on scattered manual processes.",
      },
    ],
    quickNotes: [
      "Live header alerts, backend status awareness, and system health visibility",
      "Task-driven report extraction workspace with PIC ownership and due-date tracking",
      "Broader promotion, utilities, reporting, and master data coverage across the app",
    ],
    stats: [
      {
        value: "6",
        label: "Core Workspaces",
        detail: "Promotions, Reconciliation, Reports, Utilities, Master Data, and Settings",
      },
      {
        value: "60",
        label: "App Routes",
        detail: "Permission-aware pages and workflows spanning operations, analytics, and admin",
      },
      {
        value: "Live",
        label: "Signals",
        detail: "Realtime notifications, health checks, and backend-aware header status",
      },
      {
        value: "RBAC",
        label: "Governance",
        detail: "Supabase auth, role permissions, licenses, and PIC registration controls",
      },
    ],
  };

  const moduleSpotlights = [
    {
      title: "Operational Dashboard",
      tag: "Platform",
      route: "/",
      icon: LayoutDashboard,
      desc: "The app now behaves like a command center with cleaner entry points, clearer context, and better system visibility from the top-level experience.",
      bullets: [
        "Persistent breadcrumbs and page metadata across the product",
        "Live backend awareness and notification entry points in the header",
      ],
    },
    {
      title: "Reconciliation Hub",
      tag: "Core Ops",
      route: "/recons",
      icon: DatabaseZap,
      desc: "Reconciliation expanded from a focused tool into a fuller operational suite for setup, maintenance, upload, summary, and output tracking.",
      bullets: [
        "Periods, cells, config, bulk import, upload, summary, result, and custom flows",
        "Dedicated button mapping and schedule visibility connected to reporting",
      ],
    },
    {
      title: "Promotions Workspace",
      tag: "Commercial",
      route: "/promotions",
      icon: Megaphone,
      desc: "Version 3.0 adds a much stronger promotions workspace for both setup-heavy administration and guided generation workflows.",
      bullets: [
        "Manual entry, Auto-IC, Auto-UFS, controls, criteria, period, item, and region mapping",
        "Promotion blueprint generation and saved registry management",
      ],
    },
    {
      title: "Utilities & Extraction",
      tag: "Execution",
      route: "/utilities",
      icon: Wrench,
      desc: "Utility tooling now supports operational follow-through instead of acting like a miscellaneous drawer.",
      bullets: [
        "Report extraction task lists, assignment, remarks, due dates, and tracker detail",
        "Email tracker, bulk import, manual reconciliation entry, and date conversion tools",
      ],
    },
    {
      title: "Reporting Layer",
      tag: "Insights",
      route: "/reports",
      icon: BarChart3,
      desc: "Reporting grew into a more useful layer for monitoring mismatches, schedules, matrices, and summary outcomes tied to core workflows.",
      bullets: [
        "Mismatch tracker, mismatch list, reconciliation matrix, DSS, and schedule reporting",
        "Closer alignment between reports, uploads, and ongoing operational monitoring",
      ],
    },
    {
      title: "Admin & Access",
      tag: "Governance",
      route: "/settings",
      icon: UsersRound,
      desc: "Administrative capability is now much more productized, with security and ownership controls built into the application surface.",
      bullets: [
        "User management, role permissions, license maintenance, and PIC registration",
        "Permission-gated navigation backed by Supabase authentication",
      ],
    },
  ];

  const versionHistory = [
    {
      group: "Web Apps Application",
      versions: [
        {
          version: "Version 3.0",
          date: currentRelease.date,
          features: [
            "Complete migration into a modern web application experience powered by Supabase-backed data access, authentication, and role permissions",
            "New dashboard-style workspace with live system health, operational summary widgets, and cleaner navigation across modules",
            "Expanded reconciliation suite covering period management, data cell maintenance, bulk import, button mapping, configuration, summary, result, and schedule flows",
            "Advanced report extraction process with task lists, assignment distribution, due dates, remarks, upload handling, and archival workflow",
            "Stronger promotions workspace with Auto UFS, controls, manual entry, promo period setup, criteria, item config, region distributor, and mapping pages",
            "Dedicated master data maintenance for distributors, countries, business, report types, years, SKU, and report-business mapping",
            "New utility coverage including Email Tracker, bulk email import, Manual Recons Entry, and Date Converter tools",
            "Improved reporting layer with mismatch tracker, mismatch list, reconciliation matrix, DSS support, and extraction-related monitoring",
            "Header experience upgrade with backend status indicator, environment badge, notification bell, account tools, and persistent breadcrumbs",
            "More resilient app behavior through realtime refresh patterns, better upload flow handling, clearer error feedback, and cleaner state management",
            "Refreshed responsive UI with better visual hierarchy, smoother transitions, reusable cards, and dark mode beta support",
            "Broader admin governance with user setup, license management, role permission control, and PIC registration",
          ],
        },
      ],
    },
    {
      group: "New UI & VBA Excel",
      versions: [
        {
          version: "Version 2.3",
          date: "22/7/2024",
          features: [
            "Fix some bugs in the application",
            "Fix recons logic on EFOS Outlet reports",
            "Added: Internal info & version info",
          ],
        },
        {
          version: "Version 2.2",
          date: "17/7/2024",
          features: [
            "Fix minor issue in Update recons report logic",
            "Improve tool performance upon closure",
          ],
        },
        {
          version: "Version 2.1",
          date: "2/7/2024",
          features: [
            "Fix major issue in Daily Sales Summary Recon",
            "Enhance feature Promotion Creation Tools",
            "Improve Excel Tool Space Utilization",
            "Added Feature: Upload recons data in PBI",
          ],
        },
        {
          version: "Version 2.0",
          date: "",
          features: [
            "fix major issue on EFOS Outlet View and EFOS Salesman view",
            "fix minor bug",
            "new UI interface",
            "added Daily Sales Summary recon",
            "added Tools: Promotion Interface",
          ],
        },
      ],
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
      ],
    },
  ];

  return (
    <MotionDiv
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full min-w-0 px-3 sm:px-5 pb-3 flex flex-col"
    >
      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-5">
        <div className="flex flex-col gap-5">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[190px]">
            <div className="p-5 pb-4 bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 text-white flex-1 relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute right-6 bottom-4 w-20 h-20 rounded-full border border-white/10" />

              <div className="relative z-10 w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center mb-3 backdrop-blur-sm">
                <Headset className="w-5 h-5 text-white" />
              </div>
              <p className="relative z-10 text-[10px] font-black uppercase tracking-[0.2em] text-blue-100 mb-1.5">Support Desk</p>
              <h2 className="relative z-10 text-lg font-black mb-1.5">Contact Support</h2>
              <p className="relative z-10 text-[13px] leading-relaxed text-blue-100 max-w-xs">
                Reach out if you need help with access, workflows, report issues, or questions about how the new Version 3.0 tools fit together.
              </p>
            </div>

            <div className="p-4 bg-white shrink-0">
              <div className="flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Email Support</p>
                  <a href="mailto:syahmi.afandi@unilever.com" className="text-[13px] font-semibold text-slate-800 hover:text-blue-600 transition-colors">
                    syahmi.afandi@unilever.com
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col gap-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                <Zap className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="font-black text-slate-800 text-sm">Current Release</h3>
                <p className="text-[11px] text-slate-500">Version snapshot and rollout notes</p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3.5">
              <div className="flex flex-wrap items-end gap-2">
                <span className="text-xl font-black text-slate-900 leading-none">{currentRelease.version}</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                  {currentRelease.status}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-slate-600 mt-2.5">{currentRelease.label}</p>
              <p className="text-[11px] leading-relaxed text-slate-500 mt-1.5">{currentRelease.summary}</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {currentRelease.stats.map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-100 bg-white p-2.5">
                  <p className="text-base font-black text-slate-900">{item.value}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">{item.label}</p>
                  <p className="text-[10px] leading-relaxed text-slate-500 mt-1.5">{item.detail}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 via-white to-sky-50 p-3.5">
              <div className="flex items-center gap-2 mb-2.5">
                <BellRing className="w-4 h-4 text-sky-600" />
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-700">Version 3.0 Quick Wins</p>
              </div>
              <div className="space-y-1.5">
                {currentRelease.quickNotes.map((note) => (
                  <div key={note} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" />
                    <p className="text-[11px] text-slate-600 leading-relaxed">{note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 pt-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" /> Release Date
                </span>
                <span className="text-[11px] font-bold text-slate-700">{currentRelease.date}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Environment
                </span>
                <span className="text-[11px] font-bold text-slate-700">Production</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                  <LockKeyhole className="w-3.5 h-3.5" /> Access Model
                </span>
                <span className="text-[11px] font-bold text-slate-700">Role-Based</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                <History className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-800">Version History</h2>
                <p className="text-[11px] text-slate-500">Release overview, module expansion, and changelog timeline</p>
              </div>
            </div>
          </div>

          <div className="p-5 flex flex-col gap-6">
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500 mb-1">Featured Release</p>
                  <h3 className="text-lg font-black text-slate-900">{currentRelease.version} Improvements</h3>
                  <p className="text-[13px] text-slate-600 mt-1 max-w-3xl leading-relaxed">{currentRelease.summary}</p>
                </div>
                <div className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-3 py-1 rounded-full">
                  {currentRelease.date}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
                {currentRelease.highlights.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-white/80 bg-white/85 p-3 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      <h4 className="text-sm font-bold text-slate-800">{item.title}</h4>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-600">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-600 mb-1">What Changed In 3.0</p>
                  <h3 className="text-base font-black text-slate-900">Expanded Product Surface</h3>
                  <p className="text-[13px] text-slate-500 leading-relaxed">The biggest change in 3.0 is not one page. It is the breadth of connected workflows now available across the platform.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
                {moduleSpotlights.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-white text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
                            <Icon className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <span className="inline-flex text-[9px] font-black uppercase tracking-[0.16em] text-sky-700 bg-sky-100 px-2 py-1 rounded-full mb-1.5">
                              {item.tag}
                            </span>
                            <h4 className="text-sm font-black text-slate-900">{item.title}</h4>
                          </div>
                        </div>
                        <Link
                          to={item.route}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:text-sky-900 transition-colors shrink-0"
                        >
                          Open
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>

                      <p className="text-[13px] leading-relaxed text-slate-600 mb-3">{item.desc}</p>

                      <div className="space-y-1.5">
                        {item.bullets.map((bullet) => (
                          <div key={bullet} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                            <p className="text-[11px] leading-relaxed text-slate-600">{bullet}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-8">
                {versionHistory.map((group) => (
                  <div key={group.group} className="relative">
                    <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 py-1.5 mb-3">
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">{group.group}</h3>
                    </div>

                    <div className="space-y-6">
                      {group.versions.map((ver) => (
                        <div key={`${group.group}-${ver.version}`} className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                            <h4 className="text-sm font-bold text-indigo-600 leading-none">{ver.version}</h4>
                            {ver.date ? (
                              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                {ver.date}
                              </span>
                            ) : null}
                          </div>

                          {ver.features.length > 0 ? (
                            <div className={ver.version === "Version 3.0" ? "grid gap-2 lg:grid-cols-2" : "space-y-1.5"}>
                              {ver.features.map((feature) => (
                                <div
                                  key={`${ver.version}-${feature}`}
                                  className={
                                    ver.version === "Version 3.0"
                                      ? "flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2.5"
                                      : "flex items-start gap-2"
                                  }
                                >
                                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0" />
                                  <p className={ver.version === "Version 3.0" ? "text-[11px] text-slate-600 leading-relaxed" : "text-sm text-slate-600 leading-relaxed"}>
                                    {feature}
                                  </p>
                                </div>
                              ))}
                            </div>
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
    </MotionDiv>
  );
}

export default ContactPage;

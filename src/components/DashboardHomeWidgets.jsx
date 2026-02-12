// src/components/DashboardHomeWidgets.jsx
import React from "react";
import { Mail, CheckCircle2, AlertCircle, Clock3, FileSpreadsheet } from "lucide-react";
import useEmailTrackerSummary from "../hooks/useEmailTrackerSummary";
import useReconsProgress from "../hooks/useReconsProgress";

function StatPill({ icon: Icon, label, value, sub, tone = "blue" }) {
  const toneMap = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${toneMap[tone]}`}>
      <Icon size={16} />
      <div className="leading-tight">
        <div className="text-[11px] font-medium">{label}</div>
        <div className="text-sm font-semibold">
          {value}
          {sub ? <span className="ml-2 text-[11px] font-medium opacity-80">{sub}</span> : null}
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ value }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
      <div className="h-full bg-blue-600" style={{ width: `${v}%` }} />
    </div>
  );
}

export default function DashboardHomeWidgets({
  emailSheetId,
  emailSheetName = "",
}) {
  const email = useEmailTrackerSummary({ sheetId: emailSheetId, sheetName: emailSheetName });
  const recons = useReconsProgress();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* EMAIL TRACKER */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
              <Mail size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">Email Tracker Summary</div>
              <div className="text-xs text-gray-500">
                {email.loading ? "Loading from Google Sheet..." : email.error ? "Failed to load" : "Live overview"}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-gray-500">Completion</div>
            <div className="text-sm font-bold text-gray-900">{email.percentComplete}%</div>
          </div>
        </div>

        <div className="mt-3">
          <ProgressBar value={email.percentComplete} />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <StatPill icon={AlertCircle} label="New" value={email.counts.new} tone="red" />
          <StatPill icon={Clock3} label="In Progress" value={email.counts.inProgress} tone="amber" />
          <StatPill icon={CheckCircle2} label="Complete" value={email.counts.complete} tone="green" />
          <StatPill icon={Mail} label="Total" value={email.counts.total} tone="gray" />
        </div>

        {email.error ? (
          <div className="mt-3 text-xs text-red-600">{email.error}</div>
        ) : null}
      </div>

      {/* RECONS */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">Recons Progress</div>
              <div className="text-xs text-gray-500">
                {recons.hasData ? "From latest saved run" : "No run data yet"}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-gray-500">Progress</div>
            <div className="text-sm font-bold text-gray-900">{recons.percentDone}%</div>
          </div>
        </div>

        <div className="mt-3">
          <ProgressBar value={recons.percentDone} />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <StatPill
            icon={FileSpreadsheet}
            label="Processed Files"
            value={recons.processed}
            sub={`/ ${recons.total}`}
            tone="blue"
          />
          <StatPill icon={AlertCircle} label="Mismatches" value={recons.mismatches} tone="red" />
          <StatPill icon={CheckCircle2} label="Matched" value={recons.matched} tone="green" />
          <StatPill icon={Clock3} label="Last Run" value={recons.lastRunLabel} tone="gray" />
        </div>
      </div>
    </div>
  );
}

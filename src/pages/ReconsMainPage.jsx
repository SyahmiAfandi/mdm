import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Database,
  BarChart3,
  Layers,
  FileSearch,
  FileBarChart2,
  Settings,
  Activity,
} from "lucide-react";

function ReconsMainPage() {
  const navigate = useNavigate();

  const Section = ({ title, icon: Icon, children }) => (
    <div className="flex flex-col bg-white border rounded-2xl shadow-sm p-6 h-full">
      <div className="flex items-center gap-3 mb-6 pb-3 border-b">
        <div className="p-2 bg-slate-100 rounded-lg">
          <Icon className="w-5 h-5 text-slate-700" />
        </div>
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      </div>

      <div className="flex flex-col gap-4 flex-1">
        {children}
      </div>
    </div>
  );

  const StandardButton = ({ 
    title, 
    desc, 
    path, 
    icon: Icon, 
    img, 
    disabled, 
    placeholder, 
    state }) => {
    const navigate = useNavigate();

    if (placeholder) {
      return (
        <div
          className="
            flex-1 w-full
            border border-dashed
            rounded-xl
            bg-slate-50
            flex items-center justify-center
            text-slate-300
            text-sm
            font-medium
          "
        >
          {title}
        </div>
      );
    }

    return (
      <button
        onClick={() => !disabled && path && navigate(path, { state })}
        disabled={disabled}
        className={`
          flex-1 w-full
          border rounded-xl
          flex items-stretch overflow-hidden
          transition-all duration-200 ease-out
          ${
            disabled
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-slate-50 hover:bg-white hover:shadow-lg hover:-translate-y-1 hover:border-slate-400"
          }
        `}
      >
        {img && (
          <div
            className="w-1/3 bg-cover bg-center opacity-90"
            style={{ backgroundImage: `url(${img})` }}
          />
        )}

        <div className="flex-1 px-4 py-4 flex flex-col justify-start text-left">
          <div className="flex items-center gap-2 mb-2">
            {Icon && <Icon className="w-4 h-4" />}
            <span className="font-semibold">{title}</span>
          </div>

          {desc && (
            <p className="text-xs leading-snug text-slate-500">
              {desc}
            </p>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-[calc(100vh-75px)] bg-slate-50 p-8 flex flex-col">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Reconciliation Management
        </h1>
        <p className="text-slate-600 text-sm">
          Manage reconciliation operations, tools, and reporting.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">

        {/* ================= DATA ================= */}
        <Section title="Data" icon={Database}>
          <StandardButton
            title="Recons Period Setup"
            desc="Create and manage reconciliation periods."
            path="/recons/period"
            icon={Database}
          />
          <StandardButton
            title="Recons Data Management"
            desc="Manage recons data for each distributor and report type."
            path="/recons/cells"
            icon={Database}
          />
          <StandardButton
            title="Recons Config"
            desc="Configure recons across all data in tools and reports."
            path="/recons/config"
            icon={Database}
          />
          <StandardButton
            title="Recons Bulk Import Data"
            desc="Bulk import data into Databases."
            path="/recons/bulk_import"
            icon={Database}
          />
        </Section>

        {/* ================= TOOLS ================= */}
        <Section title="Tools & Functions" icon={Activity}>
          <StandardButton
            title="HPC Reconciliation"
            desc="Execute reconciliation process for HPC."
            path="/recons/hpc"
            img="/images/hpc_bw.jpg"
            state={{ businessType: "HPC" }}
          />
          <StandardButton
            title="IC Reconciliation"
            desc="Execute reconciliation process for IC."
            path="/recons/ic"
            img="/images/ic_bw.jpg"
            state={{ businessType: "IC" }}
          />
          <StandardButton
            title="Custom Reconciliation"
            desc="Run reconciliation for custom reports."
            path="/recons/custom"
            img="/images/custom_report.jpg"
          />
          <StandardButton
            title="Coming Soon"
            placeholder
          />
        </Section>

        {/* ================= REPORTS ================= */}
        <Section title="Reports" icon={BarChart3}>
          <StandardButton
            title="Mismatch Tracker"
            desc="Monitor and analyze mismatch cases."
            path="/recons/mismatch"
            icon={BarChart3}
          />
          <StandardButton
            title="Summary Dashboard"
            desc="View reconciliation performance metrics."
            path="/recons/summary"
            icon={FileBarChart2}
          />
          <StandardButton
            title="Export Reports"
            desc="Download reports in Excel or PDF."
            path="/recons/export"
            icon={FileSearch}
          />
          <StandardButton
            title="Audit History"
            desc="Review reconciliation audit logs."
            path="/recons/audit"
            icon={Layers}
          />
        </Section>

      </div>
    </div>
  );
}

export default ReconsMainPage;
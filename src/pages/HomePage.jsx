import React from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { UploadCloud, BarChart2, FileText, RefreshCw } from 'lucide-react';

function HomePage() {
  const notifications = [
    'New upload from Distributor A',
    'Reconciliation completed successfully',
    'Mismatch detected in recent PBI file'
  ];
  const stats = { uploads: 42, matches: 87, mismatches: 5 };

  return (
    <DashboardLayout mobileSlide>
      <style>{`
        @keyframes fadeInUp {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }
      `}</style>

      <header className="mb-8 sm:mb-10 animate-fadeInUp px-4 sm:px-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
          Welcome to MDM Tools <span className="text-blue-600">v3.0</span>
        </h1>
        <p className="text-gray-600 mt-2">Master your distributor data with speed and accuracy.</p>
      </header>

      {/* Stats Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-10 animate-fadeInUp px-4 sm:px-0">
        <StatCard title="Uploads" value={stats.uploads} icon={<UploadCloud />} />
        <StatCard title="Matches" value={stats.matches} icon={<RefreshCw />} />
        <StatCard title="Mismatches" value={stats.mismatches} icon={<BarChart2 />} />
      </div>

      {/* Notifications */}
      <div className="bg-white shadow rounded-lg p-4 sm:p-6 mb-8 sm:mb-10 animate-fadeInUp mx-4 sm:mx-0">
        <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3">Recent Activity</h2>
        <ul className="text-gray-600 list-disc list-inside space-y-2 text-sm sm:text-base">
          {notifications.map((note, index) => (
            <li key={index}>{note}</li>
          ))}
        </ul>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 animate-fadeInUp px-4 sm:px-0">
        <DashboardCard
          icon={<UploadCloud className="text-blue-600" size={36} />}
          title="Upload Files"
          desc="Drag & drop OSDP and PBI files for reconciliation."
          link="/upload"
        />
        <DashboardCard
          icon={<BarChart2 className="text-blue-600" size={36} />}
          title="View Summary"
          desc="See distributor matches, mismatches, and details."
          link="/result_summary"
        />
        <DashboardCard
          icon={<FileText className="text-blue-600" size={36} />}
          title="Documentation"
          desc="Understand how MDM Tools works from end to end."
          link="/about"
        />
      </div>
    </DashboardLayout>
  );
}

function DashboardCard({ icon, title, desc, link }) {
  return (
    <div className="bg-white shadow-md rounded-lg p-4 sm:p-6 hover:shadow-lg transition duration-300">
      <div className="mb-3 sm:mb-4">{icon}</div>
      <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-1 sm:mb-2">{title}</h3>
      <p className="text-gray-600 text-sm sm:text-base mb-3 sm:mb-4">{desc}</p>
      <a href={link} className="text-blue-600 text-sm sm:text-base font-medium hover:underline">Explore →</a>
    </div>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
      <div className="bg-blue-100 text-blue-600 p-2 rounded-full">
        {icon}
      </div>
      <div>
        <h4 className="text-sm text-gray-500 font-semibold">{title}</h4>
        <p className="text-lg sm:text-xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );
}

export default HomePage;

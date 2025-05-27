// LicenseExpiryPage.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';

function LicenseExpiryPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;
  const navigate = useNavigate();

  useEffect(() => {
    fetch('https://script.google.com/macros/s/AKfycbx_pPfpu51AK6u_eOZo998IR8WE_A7MZiDD0BBINijtASqeAGfgoyQrvmJFAUbhMEZBUw/exec?mode=users')
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      });
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(today.getDate() + 7);

  const getStatus = (dateStr) => {
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    if (date > soon) {
      return 'Active';
    } else if (date >= today && date <= soon) {
      return 'Expiring Soon';
    } else {
      return 'Expired';
    }
  };

  const statusClass = (status) => {
    switch (status) {
      case 'Expired': return 'bg-red-100 text-red-700';
      case 'Expiring Soon': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-green-100 text-green-700';
    }
  };

  const summary = users.reduce((acc, user) => {
    const status = getStatus(user.licenseDate);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const filteredUsers = users.filter((user) => {
    const lower = search.toLowerCase();
    const matchesSearch =
      user.name.toLowerCase().includes(lower) ||
      user.username.toLowerCase().includes(lower) ||
      user.email.toLowerCase().includes(lower);
    const matchesStatus = statusFilter ? getStatus(user.licenseDate) === statusFilter : true;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    const aVal = a[sortField]?.toLowerCase?.() || '';
    const bVal = b[sortField]?.toLowerCase?.() || '';
    return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const pageStart = (currentPage - 1) * usersPerPage;
  const pageUsers = filteredUsers.slice(pageStart, pageStart + usersPerPage);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">License Expiry Overview</h1>
          <button onClick={() => navigate(-1)} className="text-sm px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Back</button>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <input
            type="text"
            placeholder="Search name, username, or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-1/2 border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-60 border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Expiring Soon">Expiring Soon</option>
            <option value="Expired">Expired</option>
          </select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {['Active', 'Expiring Soon', 'Expired'].map((type) => (
            <div key={type} className={`rounded shadow p-4 text-center ${statusClass(type)}`}>
              <div className="text-sm font-semibold">{type}</div>
              <div className="text-2xl font-bold">{summary[type] || 0}</div>
            </div>
          ))}
        </div>

        {/* User Table */}
        <div className="overflow-x-auto">
          <table className="min-w-[800px] w-full bg-white shadow rounded mt-4">
            <thead className="bg-gray-100 text-gray-600 text-sm">
              <tr>
                {['name', 'username', 'email', 'role', 'licenseDate'].map((field) => (
                  <th
                    key={field}
                    className="px-6 py-3 text-left cursor-pointer select-none"
                    onClick={() => {
                      if (sortField === field) {
                        setSortAsc(!sortAsc);
                      } else {
                        setSortField(field);
                        setSortAsc(true);
                      }
                    }}
                  >
                    {field.charAt(0).toUpperCase() + field.slice(1)}{sortField === field && (sortAsc ? ' ↑' : ' ↓')}
                  </th>
                ))}
                <th className="px-6 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center p-4">Loading...</td></tr>
              ) : (
                pageUsers.map((user, i) => {
                  const status = getStatus(user.licenseDate);
                  return (
                    <tr key={i} className="border-t text-sm">
                      <td className="px-6 py-3">{user.name}</td>
                      <td className="px-6 py-3">{user.username}</td>
                      <td className="px-6 py-3">{user.email}</td>
                      <td className="px-6 py-3 capitalize">{user.role}</td>
                      <td className="px-6 py-3">{user.licenseDate}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass(status)}`}>{status}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex justify-between items-center mt-4">
          <span className="text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >Previous</button>
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50"
            >Next</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default LicenseExpiryPage;

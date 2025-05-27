// AdminUsersPage.js with toast, responsive design, role badges, and pagination
import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import toast, { Toaster } from 'react-hot-toast';

function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [roleFilter, setRoleFilter] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;

  useEffect(() => {
    fetch('https://script.google.com/macros/s/AKfycbx_pPfpu51AK6u_eOZo998IR8WE_A7MZiDD0BBINijtASqeAGfgoyQrvmJFAUbhMEZBUw/exec?mode=users')
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setFilteredUsers(data);
      })
      .catch(err => toast.error('Failed to fetch users'));
  }, []);

  useEffect(() => {
    let filtered = [...users];
    if (roleFilter.length > 0) {
      filtered = filtered.filter(user => roleFilter.includes(user.role));
    }
    if (search) {
      const lower = search.toLowerCase();
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(lower) ||
        user.email.toLowerCase().includes(lower) ||
        user.username.toLowerCase().includes(lower)
      );
    }
    filtered.sort((a, b) => {
      const aVal = a[sortField]?.toLowerCase?.() || '';
      const bVal = b[sortField]?.toLowerCase?.() || '';
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    setFilteredUsers(filtered);
    setCurrentPage(1); // Reset to page 1 on filter/search
  }, [search, sortField, sortAsc, users, roleFilter]);

  const toggleRole = (role) => {
    setRoleFilter(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleEdit = (user) => setEditingUser({ ...user });

  const handleSaveEdit = () => {
    fetch('https://script.google.com/macros/s/AKfycbx_pPfpu51AK6u_eOZo998IR8WE_A7MZiDD0BBINijtASqeAGfgoyQrvmJFAUbhMEZBUw/exec', {
      method: 'POST',
      body: JSON.stringify({ mode: 'updateUser', ...editingUser }),
    })
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setUsers(prev =>
            prev.map(u => u.username === editingUser.username ? editingUser : u)
          );
          setEditingUser(null);
          toast.success('User updated');
        } else {
          toast.error('Update failed');
        }
      });
  };

  const handleRemove = (user) => {
    if (window.confirm(`Remove ${user.username}?`)) {
      fetch('https://script.google.com/macros/s/AKfycbx_pPfpu51AK6u_eOZo998IR8WE_A7MZiDD0BBINijtASqeAGfgoyQrvmJFAUbhMEZBUw/exec', {
        method: 'POST',
        body: JSON.stringify({ mode: 'removeUser', username: user.username }),
      })
        .then(res => res.json())
        .then(res => {
          if (res.success) {
            setUsers(prev => prev.filter(u => u.username !== user.username));
            toast.success('User removed');
          } else {
            toast.error('Failed to remove');
          }
        });
    }
  };

  const pageStart = (currentPage - 1) * usersPerPage;
  const pageUsers = filteredUsers.slice(pageStart, pageStart + usersPerPage);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  return (
    <DashboardLayout>
      <Toaster position="top-right" />
      <div className="max-w-5xl mx-auto p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Manage Users</h2>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <input
            type="text"
            placeholder="Search by name, email, or username"
            className="w-full sm:max-w-sm border border-gray-300 rounded px-3 py-2 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex gap-2 flex-wrap">
            {['admin', 'user', 'viewer'].map((role) => (
              <label key={role} className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={roleFilter.includes(role)}
                  onChange={() => toggleRole(role)}
                />
                <span className="capitalize">{role}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[700px] w-full bg-white shadow rounded">
            <thead className="bg-gray-100 text-gray-600 text-sm">
              <tr>
                {['name', 'email', 'username', 'role', 'licenseDate'].map((field) => (
                  <th
                    key={field}
                    className="px-6 py-3 text-left cursor-pointer select-none"
                    onClick={() => {
                      if (sortField === field) setSortAsc(!sortAsc);
                      else { setSortField(field); setSortAsc(true); }
                    }}
                  >
                    {field.charAt(0).toUpperCase() + field.slice(1)}
                    {sortField === field && (sortAsc ? ' ↑' : ' ↓')}
                  </th>
                ))}
                <th className="px-6 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageUsers.map((user, i) => (
                <tr key={user.username || i} className="border-t text-sm">
                  <td className="px-6 py-3">
                    {editingUser?.username === user.username ? (
                      <input
                        type="text"
                        className="border px-2 py-1 rounded w-full"
                        value={editingUser.name}
                        onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                      />
                    ) : user.name}
                  </td>
                  <td className="px-6 py-3">{user.email}</td>
                  <td className="px-6 py-3">{user.username}</td>
                  <td className="px-6 py-3">
                    {editingUser?.username === user.username ? (
                      <select
                        className="border px-2 py-1 rounded w-full"
                        value={editingUser.role}
                        onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                      >
                        <option value="admin">Admin</option>
                        <option value="user">User</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-1 rounded text-xs font-medium 
                        ${user.role === 'admin' ? 'bg-red-100 text-red-700' :
                          user.role === 'user' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'}`}>{user.role}</span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    {editingUser?.username === user.username ? (
                      <input
                        type="date"
                        className="border px-2 py-1 rounded w-full"
                        value={editingUser.licenseDate}
                        onChange={(e) => setEditingUser({ ...editingUser, licenseDate: e.target.value })}
                      />
                    ) : user.licenseDate}
                  </td>
                  <td className="px-6 py-3 space-x-2">
                    {editingUser?.username === user.username ? (
                      <>
                        <button onClick={handleSaveEdit} className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600">Save</button>
                        <button onClick={() => setEditingUser(null)} className="bg-gray-300 text-gray-700 px-3 py-1 rounded hover:bg-gray-400">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleEdit(user)} className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">Edit</button>
                        <button onClick={() => handleRemove(user)} className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">Remove</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
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

export default AdminUsersPage;

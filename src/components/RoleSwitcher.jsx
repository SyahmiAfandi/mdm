import React from 'react';
import { useUser } from '../context/UserContext';

const roles = ['admin', 'user', 'viewer'];

const RoleSwitcher = () => {
  const { role, setRole } = useUser();

  return (
    <div className="fixed top-4 right-4 bg-white border shadow p-4 rounded z-50">
      <h4 className="text-sm font-semibold text-gray-600 mb-2">Current Role: <span className="text-blue-600">{role}</span></h4>
      <div className="flex gap-2">
        {roles.map(r => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`px-3 py-1 text-sm rounded border transition ${
              role === r ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
};

export default RoleSwitcher;

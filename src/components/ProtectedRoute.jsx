// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

function ProtectedRoute({ children }) {
  const { role } = useUser();
  return role ? children : <Navigate to="/login" />;
}

export default ProtectedRoute;

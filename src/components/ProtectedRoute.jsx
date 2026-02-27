import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "../context/UserContext";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const { loading, isAuthed } = useUser();

  if (loading) return null; // or a spinner

  return isAuthed ? children : (
    <Navigate to="/login" replace state={{ from: location }} />
  );
}
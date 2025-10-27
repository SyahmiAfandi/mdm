import React from "react";
import { Navigate } from "react-router-dom";
import { usePermissions } from "../hooks/usePermissions";


export default function RequirePermission({ perm, children, fallback = null }) {
const { loading, can } = usePermissions();
if (loading) return null; // or a spinner
if (!can(perm)) return fallback ?? <Navigate to="/" replace />;
return children;
}
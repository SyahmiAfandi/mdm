import React from "react";
import { Navigate } from "react-router-dom";
import { usePermissions } from "../hooks/usePermissions";

/**
 * <RequirePermission>
 *
 * Usage:
 *   <RequirePermission perm="reports.view">...</RequirePermission>
 *   <RequirePermission perms={["reports.view","reports.export"]} requireAll>...</RequirePermission>
 *   <RequirePermission perm="admin.*" fallback={<NoAccess/>}>...</RequirePermission>
 */
export default function RequirePermission({
  perm,
  perms,
  requireAll = false,
  redirectTo = "/",
  fallback = null,
  children,
}) {
  const { loading, canAny, canAll } = usePermissions();

  if (loading) return null; // replace with your spinner if you want

  const list = perms ?? (perm ? [perm] : []);
  const ok = requireAll ? canAll(list) : canAny(list);

  if (!ok) return fallback ?? <Navigate to={redirectTo} replace />;
  return children;
}

import React from "react";
import { useAuth } from "../hooks/useAuth";

export interface PermissionGateProps {
  children: React.ReactNode;
  permissions: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  children,
  permissions,
  requireAll = false,
  fallback = null,
}) => {
  const { hasPermission, hasAnyPermission } = useAuth();

  const isAllowed = requireAll
    ? permissions.every((p) => hasPermission(p))
    : hasAnyPermission(permissions);

  if (!isAllowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default PermissionGate;

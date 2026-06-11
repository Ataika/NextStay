import React from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore, isAdminRole } from "../store/authStore";
import type { UserRole } from "../store/authStore";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const token = useAuthStore((s) => s.token);
  const role  = useAuthStore((s) => s.role);

  if (!token || !role) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to={isAdminRole(role) ? "/admin" : "/staff"} replace />;
  }

  return <>{children}</>;
}

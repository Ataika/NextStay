import React from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import type { UserRole } from "../store/authStore";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);

  // if there is no full auth session
  if (!token || !role) {
    return <Navigate to="/login" replace />;
  }

  // if a specific role is needed and the role doesn't match
  if (requiredRole && role !== requiredRole) {
    return <Navigate to={role === "OWNER" ? "/admin" : "/staff"} replace />;
  }

  return <>{children}</>;
}

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

  // если нет полной auth-сессии
  if (!token || !role) {
    return <Navigate to="/login" replace />;
  }

  // если нужна конкретная роль, а роль не совпала
  if (requiredRole && role !== requiredRole) {
    return <Navigate to={role === "OWNER" ? "/admin" : "/staff"} replace />;
  }

  return <>{children}</>;
}

import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import type { UserRole } from "../store/authStore";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
}

export default function ProtectedRoute({
  children,
  requiredRole,
}: ProtectedRouteProps) {
  const { token, role, isAuthenticated } = useAuthStore();

  // Если нет токена, редирект на /login
  if (!isAuthenticated() || !token) {
    return <Navigate to="/login" replace />;
  }

  // Если требуется определенная роль и роль не совпадает
  if (requiredRole && role !== requiredRole) {
    // Редирект в зависимости от роли пользователя
    if (role === "OWNER") {
      return <Navigate to="/admin" replace />;
    } else if (role === "STAFF") {
      return <Navigate to="/staff" replace />;
    }
    // Если роль неизвестна, редирект на login
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

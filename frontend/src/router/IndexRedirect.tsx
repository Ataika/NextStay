import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

export default function IndexRedirect() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);

  if (!token || !role) return <Navigate to="/login" replace />;

  return <Navigate to={role === "OWNER" ? "/admin" : "/staff"} replace />;
}

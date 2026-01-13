import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { authApi } from "../api/api";
import Button from "../ui/Button";

export default function Header() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Ignore errors when logging out
    } finally {
      clearAuth();
      navigate("/login");
    }
  };

  if (!role) {
    return null;
  }

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 z-30">
      <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
        <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-800 dark:text-white truncate">
          {role === "OWNER" ? "Admin Dashboard" : "Staff Dashboard"}
        </h1>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="hidden sm:inline text-sm text-gray-600 dark:text-gray-300">
            {role === "OWNER" ? "Administrator" : "Staff"}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleLogout}
          >
            Logout
          </Button>
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-sm">
            {role === "OWNER" ? "A" : "S"}
          </div>
        </div>
      </div>
    </header>
  );
}

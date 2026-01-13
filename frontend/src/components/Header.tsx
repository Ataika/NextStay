import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { authApi } from "../api/api";

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
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
      <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-800 dark:text-white truncate">
          {role === "OWNER" ? "Admin Dashboard" : "Staff Dashboard"}
        </h1>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="hidden sm:inline text-sm text-gray-600 dark:text-gray-300">
            {role === "OWNER" ? "Administrator" : "Staff"}
          </span>
          <button
            onClick={handleLogout}
            className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <span className="hidden sm:inline">Logout</span>
            <span className="sm:hidden">Logout</span>
          </button>
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-sm">
            {role === "OWNER" ? "A" : "S"}
          </div>
        </div>
      </div>
    </header>
  );
}

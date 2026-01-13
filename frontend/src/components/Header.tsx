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
      // Игнорируем ошибки при выходе
    } finally {
      clearAuth();
      navigate("/login");
    }
  };

  if (!role) {
    return null;
  }

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">
          {role === "OWNER" ? "Admin Dashboard" : "Staff Dashboard"}
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {role === "OWNER" ? "Администратор" : "Персонал"}
          </span>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            Выйти
          </button>
          <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
            {role === "OWNER" ? "A" : "S"}
          </div>
        </div>
      </div>
    </header>
  );
}

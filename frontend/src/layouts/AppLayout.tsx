import { Outlet, Link, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { useI18n } from "../i18n";
import { useAuthStore } from "../store/authStore";

export default function AppLayout() {
  const location = useLocation();
  const role = useAuthStore((s) => s.role);
  const { t } = useI18n();

  const mobileNavItems = [
    { path: "/admin",    label: "Rooms",   roles: ["OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER"] },
    { path: "/bookings", label: "Bookings", roles: ["OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER"] },
    { path: "/staff",    label: "Tasks",   roles: ["STAFF"] },
    { path: "/chat",     label: "Chat",    roles: ["OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER", "STAFF"] },
    { path: "/settings", label: "Settings", roles: ["OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER", "STAFF"] },
  ].filter((item) => !role || item.roles.includes(role as string));
  const labels: Record<string, string> = {
    Rooms: t("sidebar.rooms"),
    Bookings: t("sidebar.bookings"),
    Tasks: t("sidebar.tasks"),
    Chat: t("sidebar.chat"),
    Settings: t("sidebar.settings"),
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 flex">
      {/* Sidebar — sticky, scrolls independently if content overflows */}
      <div className="hidden md:flex shrink-0">
        <Sidebar />
      </div>

      {/* Right side */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <Header />

        {/* Main content area — only this scrolls */}
        <main className="flex-1 p-3 sm:p-4 lg:p-5 pb-20 md:pb-3 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      {mobileNavItems.length > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 z-40">
          <div className="flex items-center justify-around text-sm">
            {mobileNavItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 rounded-md transition-colors ${
                    isActive
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {labels[item.label] ?? item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

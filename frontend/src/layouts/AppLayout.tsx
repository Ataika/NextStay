import { Outlet, Link, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { useAuthStore } from "../store/authStore";

export default function AppLayout() {
  const location = useLocation();
  const role = useAuthStore((s) => s.role);

  const mobileNavItems = [
    { path: "/admin", label: "Rooms", roles: ["OWNER"] },
    { path: "/staff", label: "Tasks", roles: ["STAFF"] },
    { path: "/reports", label: "Reports", roles: ["OWNER"] },
  ].filter((item) => !role || item.roles.includes(role));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex min-h-screen">
        {/* Sidebar только на md+ */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0 flex flex-col">
          <Header />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full pb-16 md:pb-0">
            <Outlet />
          </main>
          
          {/* Mobile bottom nav */}
          {mobileNavItems.length > 0 && (
            <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 z-20">
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
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import type { UserRole } from "../store/authStore";

interface SidebarItem {
  path: string;
  label: string;
  roles: UserRole[];
}

const items: SidebarItem[] = [
  { path: "/admin", label: "Rooms", roles: ["OWNER"] },
  { path: "/bookings", label: "Bookings", roles: ["OWNER"] },
  { path: "/staff", label: "Tasks", roles: ["STAFF"] },
  { path: "/reports", label: "Reports", roles: ["OWNER"] },
];

export default function Sidebar() {
  const location = useLocation();
  const role = useAuthStore((s) => s.role);

  const visibleItems = role ? items.filter((i) => i.roles.includes(role)) : [];

  return (
    <aside className="w-64 bg-gray-800 dark:bg-gray-900 text-gray-300 dark:text-gray-400 flex-shrink-0 min-h-screen border-r border-gray-700 dark:border-gray-800">
      <div className="p-4 min-h-screen flex flex-col">
        <h2 className="text-lg font-semibold mb-6 text-gray-200 dark:text-gray-300">NextStay</h2>

        <nav className="flex-1">
          <ul className="space-y-1">
            {visibleItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`relative block px-3 py-2 text-sm transition-colors rounded-md ${
                      isActive
                        ? "text-gray-100 dark:text-gray-100 bg-gray-700/30 dark:bg-gray-700/30"
                        : "text-gray-400 dark:text-gray-500 hover:text-gray-200 dark:hover:text-gray-300 hover:bg-gray-700/20 dark:hover:bg-gray-700/20"
                    }`}
                  >
                    {/* Тонкий индикатор для активного пункта */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-500 rounded-r" />
                    )}
                    <span className="pl-1">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}

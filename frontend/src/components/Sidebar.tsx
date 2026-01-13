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
  { path: "/staff", label: "Tasks", roles: ["STAFF"] },
  { path: "/reports", label: "Reports", roles: ["OWNER"] },
];

export default function Sidebar() {
  const location = useLocation();
  const role = useAuthStore((s) => s.role);

  const visibleItems = role ? items.filter((i) => i.roles.includes(role)) : [];

  return (
    <aside className="w-64 bg-gray-800 dark:bg-gray-900 text-white min-h-screen">
      <div className="p-6">
        <h2 className="text-xl font-bold mb-6">NextStay</h2>

        <nav>
          <ul className="space-y-2">
            {visibleItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`block px-4 py-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* если хочешь, можно добавить внизу маленькую подпись роли */}
        {role && (
          <div className="mt-8 text-xs text-gray-400">
            Role: {role === "OWNER" ? "Owner/Admin" : "Staff"}
          </div>
        )}
      </div>
    </aside>
  );
}

import { Link, useLocation } from "react-router-dom";

interface SidebarItem {
  path: string;
  label: string;
  icon?: string;
}

const sidebarItems: SidebarItem[] = [
  { path: "/admin", label: "Admin" },
  { path: "/staff", label: "Staff" },
  { path: "/reports", label: "Reports" },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 bg-gray-800 text-white min-h-screen">
      <div className="p-6">
        <h2 className="text-xl font-bold mb-6">NextStay</h2>
        <nav>
          <ul className="space-y-2">
            {sidebarItems.map((item) => {
              const isActive = location.pathname === item.path;
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
      </div>
    </aside>
  );
}

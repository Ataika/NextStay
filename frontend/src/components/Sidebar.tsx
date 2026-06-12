import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore, canAccessEngine } from "../store/authStore";
import { useI18n } from "../i18n";
import type { UserRole } from "../store/authStore";

interface SidebarItem {
  path: string;
  label: string;
  roles: UserRole[];
}

const items: SidebarItem[] = [
  { path: "/admin",         label: "Rooms",    roles: ["OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER"] },
  { path: "/bookings",      label: "Bookings", roles: ["OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER"] },
  { path: "/team",          label: "Team",     roles: ["OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER"] },
  { path: "/reports",       label: "Reports",  roles: ["OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER"] },
  { path: "/staff",         label: "Tasks",    roles: ["STAFF"] },
  { path: "/chat",          label: "Chat",     roles: ["OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER", "STAFF"] },
];

const ENGINE_PATHS = ["/engine", "/inventory-setup", "/pricing-lab", "/model-training", "/engine-tuning"];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const name = useAuthStore((s) => s.name);
  const { t } = useI18n();

  const visibleItems = role ? items.filter((i) => i.roles.includes(role)) : [];
  const engineActive = ENGINE_PATHS.some((p) => location.pathname.startsWith(p));
  const showEngine = canAccessEngine(role);
  const labels: Record<string, string> = {
    Rooms: t("sidebar.rooms"),
    Bookings: t("sidebar.bookings"),
    Team: t("sidebar.team"),
    Reports: t("sidebar.reports"),
    Tasks: t("sidebar.tasks"),
    Chat: t("sidebar.chat"),
  };

  return (
    <aside className="w-56 bg-gray-800 dark:bg-gray-900 text-gray-300 dark:text-gray-400 flex-shrink-0 h-full overflow-y-auto border-r border-gray-700 dark:border-gray-800">
      <div className="p-3 min-h-full flex flex-col">
        <h2 className="text-base font-semibold mb-1 text-gray-200 dark:text-gray-300">NextStay</h2>
        {name && (
          <p className="text-xs text-gray-500 dark:text-gray-600 mb-4 truncate">{name}</p>
        )}

        <nav className="flex-1">
          <ul className="space-y-0.5">
            {visibleItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`relative block px-2.5 py-1.5 text-xs transition-colors rounded-md ${
                      isActive
                        ? "text-white font-medium bg-white/10"
                        : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-500 rounded-r" />
                    )}
                    <span className="pl-1">{labels[item.label] ?? item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {showEngine && (
          <div className="pt-3 border-t border-gray-700 dark:border-gray-800">
            <button
              onClick={() => navigate("/engine")}
              className={`relative w-full text-left px-2.5 py-2 text-xs rounded-md transition-colors ${
                engineActive
                  ? "bg-blue-500/20 text-blue-300 font-medium"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
              }`}
            >
              {engineActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-500 rounded-r" />
              )}
              <span className="pl-1 flex items-center gap-1.5">
                <span>⚙</span>
                <span>{t("sidebar.pricingEngine")}</span>
              </span>
            </button>
          </div>
        )}

        {/* Settings link */}
        <div className="pt-3 border-t border-gray-700 dark:border-gray-800">
          <button
            onClick={() => navigate("/settings")}
            className={`relative w-full text-left px-2.5 py-1.5 text-xs rounded-md transition-colors ${
              location.pathname === "/settings"
                ? "text-white font-medium bg-white/10"
                : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
            }`}
          >
            {location.pathname === "/settings" && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-500 rounded-r" />
            )}
            <span className="pl-1 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{t("sidebar.settings")}</span>
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}

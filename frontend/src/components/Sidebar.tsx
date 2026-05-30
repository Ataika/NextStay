import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { authApi } from "../api/api";
import { useEffect, useState } from "react";
import type { UserRole } from "../store/authStore";
import type { MeResponse } from "../api/api";

const icons = {
  rooms: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  bookings: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  analytics: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  settings: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  staff: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
};

interface SidebarItem {
  path: string;
  label: string;
  roles: UserRole[];
  icon: React.ReactNode;
}

const dashboardItems: SidebarItem[] = [
  { path: "/admin", label: "Rooms", roles: ["OWNER"], icon: icons.rooms },
  { path: "/bookings", label: "Bookings", roles: ["OWNER"], icon: icons.bookings },
  { path: "/reports", label: "Analytics", roles: ["OWNER"], icon: icons.analytics },
];

const adminItems: SidebarItem[] = [
  { path: "/profile", label: "Settings", roles: ["OWNER", "STAFF"], icon: icons.settings },
  { path: "/staff", label: "Staff Panel", roles: ["OWNER", "STAFF"], icon: icons.staff },
];

function formatCompanyName(code: string | null): string {
  if (!code) return "Property";
  return code
    .split(/[\s-_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export default function Sidebar() {
  const location = useLocation();
  const role = useAuthStore((s) => s.role);
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await authApi.me();
        if (!cancelled) setMe(data);
      } catch {
        // ignore
      }
    };
    if (role) load();
    return () => {
      cancelled = true;
    };
  }, [role]);

  const companyName = formatCompanyName(me?.companyCode ?? null) || "Hayat Residence";
  const companyInitial = companyName.charAt(0).toUpperCase();

  const visibleDashboard = role ? dashboardItems.filter((i) => i.roles.includes(role)) : [];
  const visibleAdmin = role ? adminItems.filter((i) => i.roles.includes(role)) : [];

  const NavLink = ({ item }: { item: SidebarItem }) => {
    const isActive = location.pathname.startsWith(item.path);
    return (
      <Link
        to={item.path}
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? "bg-blue-50 text-blue-600 dark:bg-blue-600 dark:text-white"
            : "text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700/50"
        }`}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-500 dark:bg-blue-400 rounded-r" />
        )}
        {item.icon}
        {item.label}
      </Link>
    );
  };

  return (
    <aside className="w-52 shrink-0 min-h-screen bg-white dark:bg-[#111827] lg:dark:bg-[#1F2937] border-r border-gray-200 dark:border-gray-700/60 flex flex-col">
      {/* Company header */}
      <div className="p-3 flex items-center gap-2.5 shrink-0">
        <div className="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white font-semibold text-base shrink-0">
          {companyInitial}
        </div>
        <span className="text-gray-900 dark:text-white font-semibold text-sm truncate">
          {companyName}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        <div className="mb-3">
          <h3 className="px-3 mb-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Dashboard
          </h3>
          <div className="space-y-0.5">
            {visibleDashboard.map((item) => (
              <NavLink key={item.path} item={item} />
            ))}
          </div>
        </div>

        <div className="border-t border-gray-700/60 pt-3">
          <div className="space-y-0.5">
            {visibleAdmin.map((item) => (
              <NavLink key={item.path} item={item} />
            ))}
          </div>
        </div>
      </nav>
    </aside>
  );
}

import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { authApi, type MeResponse } from "../api/api";
import Popover from "../ui/Popover";

export default function Header() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [me, setMe] = useState<MeResponse | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const avatarRef = useRef<HTMLButtonElement>(null);

  type ThemeMode = "system" | "dark" | "light";
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadMe = async () => {
      try {
        const data = await authApi.me();
        if (!cancelled) setMe(data);
      } catch {
        // ignore
      }
    };
    if (role) loadMe();
    return () => {
      cancelled = true;
    };
  }, [role]);

  // Init theme from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = (localStorage.getItem("theme") as ThemeMode | null) || "system";
    setThemeMode(stored);
  }, []);

  const applyTheme = (mode: ThemeMode) => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const shouldDark = mode === "dark" || (mode === "system" && mediaQuery.matches);
    if (shouldDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", mode);
  };

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
    applyTheme(mode);
    setThemeMenuOpen(false);
  };

  const handleLogout = async () => {
    setProfileOpen(false);
    try {
      await authApi.logout();
    } catch {
      // Ignore
    } finally {
      clearAuth();
      navigate("/login");
    }
  };

  if (!role) return null;

  const displayName = me?.name || "Name Surname";
  const displayEmail = me?.email || "example@email.com";
  const initials = me?.name
    ? me.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : me?.email
    ? me.email.charAt(0).toUpperCase()
    : role === "OWNER"
    ? "A"
    : "S";

  return (
    <header className="h-14 shrink-0 border-b border-gray-200 dark:border-gray-700/50 bg-white dark:bg-[#1F2937] flex items-center justify-end px-4">
      <div className="flex items-center gap-2">
        {/* Avatar with dropdown - first per Figma */}
        <button
          ref={avatarRef}
          type="button"
          onClick={() => setProfileOpen(!profileOpen)}
          className="flex items-center gap-2 p-1 pr-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          <div className="w-9 h-9 rounded-full bg-purple-500/80 flex items-center justify-center text-white font-semibold text-sm shrink-0">
            {initials}
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${profileOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <Popover
          isOpen={profileOpen}
          onClose={() => setProfileOpen(false)}
          anchorRef={avatarRef}
          placement="bottom-end"
          className="w-64 p-0 overflow-hidden"
        >
          <div className="p-4 pb-3">
            <div className="font-semibold text-gray-900 dark:text-white">{displayName}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{displayEmail}</div>
          </div>
          <div className="border-t border-gray-600 px-4 pb-1 pt-3">
            <button
              type="button"
              onClick={() => setThemeMenuOpen((open) => !open)}
              className="w-full flex items-center justify-between text-sm text-gray-700 dark:text-gray-300 py-1 hover:text-gray-900 dark:hover:text-white"
            >
              <span>Theme</span>
              <span className="text-gray-500 dark:text-gray-400">
                {themeMode === "dark"
                  ? "Dark"
                  : themeMode === "light"
                  ? "Bright"
                  : "System"}{" "}
                &gt;
              </span>
            </button>
            {themeMenuOpen && (
              <div className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                <button
                  type="button"
                  onClick={() => handleThemeChange("dark")}
                  className={`w-full text-left px-1 py-1 rounded ${
                    themeMode === "dark"
                      ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700/60"
                  }`}
                >
                  Dark
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange("light")}
                  className={`w-full text-left px-1 py-1 rounded ${
                    themeMode === "light"
                      ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700/60"
                  }`}
                >
                  Bright
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange("system")}
                  className={`w-full text-left px-1 py-1 rounded ${
                    themeMode === "system"
                      ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700/60"
                  }`}
                >
                  System
                </button>
              </div>
            )}
          </div>
          <div className="px-4 py-2">
            <button
              type="button"
              onClick={() => {
                setProfileOpen(false);
                navigate("/profile");
              }}
              className="w-full text-left py-1 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              View profile
            </button>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-600 px-4 py-2">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-between gap-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <span>Log out</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              
            </button>
          </div>
        </Popover>

        {/* Notification bell - placeholder for future */}
        <button
          type="button"
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600/50 transition-colors"
          aria-label="Notifications"
          title="Notifications (coming soon)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}

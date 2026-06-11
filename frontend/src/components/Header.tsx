import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useSettingsStore } from "../store/settingsStore";
import { authApi } from "../api/api";
import LanguageSelector from "../components/LanguageSelector";
import { useTaskNotifications } from "../hooks/useTaskNotifications";
import { useI18n } from "../i18n";
import type { UserRole } from "../store/authStore";

const PRIORITY_COLOR: Record<string, string> = {
  High:   "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  Medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  Low:    "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

function getInitials(name: string | null, role: UserRole | null): string {
  if (name) return name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2);
  return role?.[0] ?? "U";
}

export default function Header() {
  const navigate   = useNavigate();
  const role       = useAuthStore((s) => s.role);
  const name       = useAuthStore((s) => s.name);
  const email      = useAuthStore((s) => s.email);
  const clearAuth  = useAuthStore((s) => s.clearAuth);
  const avatar     = useSettingsStore((s) => s.avatar);

  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen]     = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef   = useRef<HTMLDivElement>(null);

  const { unseenTasks, pendingTasks, markAllSeen } = useTaskNotifications();
  const { language, t, roleLabel, priorityLabel } = useI18n();

  // Close dropdowns on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (notifRef.current   && !notifRef.current.contains(e.target as Node))   setNotifOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const handleLogout = async () => {
    setProfileOpen(false);
    try { await authApi.logout(); } catch { /* ignore */ }
    clearAuth();
    navigate("/login");
  };

  const openNotif = () => {
    setNotifOpen((o) => !o);
    setProfileOpen(false);
  };

  const openProfile = () => {
    setProfileOpen((o) => !o);
    setNotifOpen(false);
  };

  if (!role) return null;

  const userInitials = getInitials(name, role);
  const currentRoleLabel = roleLabel(role);
  const badgeCount   = unseenTasks.length;
  const pendingTotalLabel = language === "it"
    ? `${pendingTasks.length} ${pendingTasks.length === 1 ? "compito" : "compiti"} totali in attesa`
    : `${pendingTasks.length} pending task${pendingTasks.length !== 1 ? "s" : ""} in total`;

  return (
    <header className="h-12 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 z-30">
      <div className="px-3 sm:px-4 h-12 flex items-center justify-end gap-2">

        {/* ---- Notification Bell ---- */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={openNotif}
            className="relative p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            title={t("header.notifications")}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {badgeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                {badgeCount > 9 ? "9+" : badgeCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-10 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t("header.notifications")}
                  {pendingTasks.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      {t("header.pendingCount", { count: pendingTasks.length })}
                    </span>
                  )}
                </p>
                {unseenTasks.length > 0 && (
                  <button
                    onClick={markAllSeen}
                    className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  >
                    {t("header.markAllRead")}
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {unseenTasks.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <svg className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-gray-400 dark:text-gray-500">{t("header.caughtUp")}</p>
                  </div>
                ) : (
                  unseenTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => {
                        markAllSeen();
                        setNotifOpen(false);
                        navigate(role === "STAFF" ? "/staff" : "/admin");
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-50 dark:border-gray-700/50 last:border-0 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 dark:text-white">
                            {t("header.newTask", { room: task.roomNumber })}
                          </p>
                          {task.notes && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{task.notes}</p>
                          )}
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {task.assignedToName
                              ? t("header.assignedTo", { name: task.assignedToName })
                              : t("header.unassigned")}
                          </p>
                        </div>
                        <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${PRIORITY_COLOR[task.priority] ?? PRIORITY_COLOR.Low}`}>
                          {priorityLabel(task.priority)}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {pendingTasks.length > 0 && unseenTasks.length === 0 && (
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-400 text-center">
                    {pendingTotalLabel}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <LanguageSelector compact />

        {/* ---- Avatar / Profile ---- */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={openProfile}
            className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-800"
          >
            {avatar ? (
              <img src={avatar} alt="avatar" className="w-7 h-7 rounded-full object-cover ring-2 ring-gray-200 dark:ring-gray-600" />
            ) : (
              <div className="w-7 h-7 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-xs select-none">
                {userInitials}
              </div>
            )}
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-10 w-60 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
                {avatar ? (
                  <img src={avatar} alt="avatar" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 select-none">
                    {userInitials}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{name ?? "—"}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{email ?? "—"}</p>
                  <span className="mt-0.5 inline-block text-xs bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                    {currentRoleLabel}
                  </span>
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={() => { setProfileOpen(false); navigate("/settings"); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-3 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {t("header.settings")}
                </button>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-700 py-1">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  {t("header.signOut")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

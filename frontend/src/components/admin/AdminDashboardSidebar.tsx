import type { Booking } from "../../mocks/bookings";
import type { CleaningTask } from "../../mocks/tasks";
import type { Room } from "../../mocks/rooms";
import Card from "../../ui/Card";
import { useI18n } from "../../i18n";
import { buildRecentActivity, buildTodaySummary } from "../../utils/adminDashboard";

interface AdminDashboardSidebarProps {
  rooms: Room[];
  bookings: Booking[];
  tasks: CleaningTask[];
}

function MiniMonthCalendar() {
  const { locale } = useI18n();
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthLabel = monthStart.toLocaleString(locale, { month: "long", year: "numeric" });
  const startWeekday = (monthStart.getDay() + 6) % 7;
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const dayLabels = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: "narrow" })
  );

  return (
    <Card padding="sm">
      <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{monthLabel}</p>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-gray-400 mb-1">
        {dayLabels.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {cells.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} />;
          const isToday = day === today.getDate();
          return (
            <span
              key={day}
              className={`py-1 rounded-full ${
                isToday
                  ? "bg-blue-600 text-white font-semibold"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              {day}
            </span>
          );
        })}
      </div>
    </Card>
  );
}

export default function AdminDashboardSidebar({
  rooms,
  bookings,
  tasks,
}: AdminDashboardSidebarProps) {
  const { locale, t } = useI18n();
  const summary = buildTodaySummary(rooms, bookings, tasks);
  const activity = buildRecentActivity(rooms, bookings, tasks, locale, {
    roomCheckedIn: (room) => t("admin.activityCheckedIn", { room }),
    roomCleaning: (room) => t("admin.activityCleaning", { room }),
    roomMaintenance: (room) => t("admin.activityMaintenance", { room }),
    taskCompleted: (room) => t("admin.activityTaskDone", { room }),
    bookingCreated: (room, guest) => t("admin.activityBooking", { room, guest }),
  });

  const summaryRows = [
    { label: t("admin.todayCheckIns"), value: summary.checkIns, color: "bg-emerald-500" },
    { label: t("admin.todayCheckOuts"), value: summary.checkOuts, color: "bg-blue-500" },
    { label: t("admin.todayCleanings"), value: summary.cleanings, color: "bg-amber-500" },
    { label: t("admin.todayMaintenance"), value: summary.maintenance, color: "bg-red-500" },
  ];

  return (
    <div className="space-y-4">
      <MiniMonthCalendar />

      <Card padding="sm">
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          {t("admin.todaySummary")}
        </p>
        <div className="space-y-2.5">
          {summaryRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <span className={`w-2 h-2 rounded-full ${row.color}`} />
                {row.label}
              </span>
              <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card padding="sm">
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          {t("admin.recentActivity")}
        </p>
        {activity.length === 0 ? (
          <p className="text-xs text-gray-500">{t("admin.noRecentActivity")}</p>
        ) : (
          <div className="space-y-3">
            {activity.map((item) => (
              <div key={item.id} className="flex gap-2">
                <span className="text-sm shrink-0 mt-0.5">{item.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-800 dark:text-gray-200 leading-snug">
                    {item.text}
                  </p>
                  {item.timeLabel && (
                    <p className="text-[10px] text-gray-400 mt-0.5 tabular-nums">{item.timeLabel}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

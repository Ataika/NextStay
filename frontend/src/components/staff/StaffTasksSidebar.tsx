import type { ShiftResponse } from "../../api/api";
import type { CleaningTask } from "../../mocks/tasks";
import Card from "../../ui/Card";
import { useI18n } from "../../i18n";
import { formatTaskTime, taskPrimaryLabel, taskTypeAccent, taskTypeIcon } from "../../utils/taskDisplay";

interface StaffTasksSidebarProps {
  tasks: CleaningTask[];
  shifts: ShiftResponse[];
  hoursThisMonth: number;
  monthHoursTarget?: number;
  onOpenSchedule: () => void;
  onOpenHours: () => void;
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

  return (
    <Card padding="sm">
      <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{monthLabel}</p>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-gray-400 mb-1">
        {["M", "T", "W", "T", "F", "S", "S"].map((day) => (
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

export default function StaffTasksSidebar({
  tasks,
  shifts,
  hoursThisMonth,
  monthHoursTarget = 160,
  onOpenSchedule,
  onOpenHours,
}: StaffTasksSidebarProps) {
  const { locale, t } = useI18n();
  const upcoming = tasks
    .filter((task) => task.status === "Pending" || task.status === "In Progress")
    .slice(0, 4);
  const weekHours = shifts.filter((s) => s.shift_type !== "off").reduce((sum, s) => sum + s.hours, 0);
  const completedCount = tasks.filter((t) => t.status === "Completed").length;

  return (
    <div className="space-y-4">
      <MiniMonthCalendar />

      <Card padding="sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{t("staff.upcomingSchedule")}</p>
          <button type="button" onClick={onOpenSchedule} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
            {t("staff.viewFullSchedule")}
          </button>
        </div>
        <div className="space-y-2">
          {upcoming.length === 0 ? (
            <p className="text-xs text-gray-500">{t("staff.noUpcomingTasks")}</p>
          ) : (
            upcoming.map((task) => (
              <div key={task.id} className="flex items-start gap-2">
                <span className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center text-sm ${taskTypeAccent(task.taskType)}`}>
                  {taskTypeIcon(task.taskType)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                    {formatTaskTime(task.dueAt ?? task.createdAt, locale)} · {t("taskCard.room", { room: task.roomNumber })}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">{taskPrimaryLabel(task)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card padding="sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{t("staff.hoursThisWeek")}</p>
          <button type="button" onClick={onOpenHours} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
            {t("staff.viewHours")}
          </button>
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
          {weekHours}h <span className="text-sm font-normal text-gray-400">/ 40h</span>
        </p>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
          <div
            className="h-2 rounded-full bg-blue-500 transition-all"
            style={{ width: `${Math.min(100, Math.round((weekHours / 40) * 100))}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-3">
          {t("staff.monthHoursProgress", {
            current: String(hoursThisMonth),
            target: String(monthHoursTarget),
          })}
        </p>
      </Card>

      <Card padding="sm">
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t("staff.todayProgress")}</p>
        <p className="text-xs text-gray-500 mb-2">
          {t("staff.completedSummary", {
            done: String(completedCount),
            total: String(tasks.length),
          })}
        </p>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="h-2 rounded-full bg-emerald-500 transition-all"
            style={{
              width: `${tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0}%`,
            }}
          />
        </div>
      </Card>
    </div>
  );
}

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { tasksApi, staffApi } from "../../api/api";
import { useI18n } from "../../i18n";
import type { CleaningTask } from "../../mocks/tasks";
import type { StaffMember, ShiftResponse } from "../../api/api";
import { useAuthStore } from "../../store/authStore";
import StaffCompactTaskItem from "../../components/staff/StaffCompactTaskItem";
import StaffTasksSidebar from "../../components/staff/StaffTasksSidebar";
import { STAFF_PATHS, staffTabFromPath, type StaffTab } from "../../utils/staffNav";
import LoadingSpinner from "../../ui/LoadingSpinner";
import Card from "../../ui/Card";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import toast from "react-hot-toast";
import { resolveTaskChecklist } from "../../utils/taskDisplay";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function getMondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const result = new Date(d);
  result.setDate(d.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(d.getDate() + n);
  return result;
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function getCalWeeks(month: Date): Date[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last  = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const weeks: Date[][] = [];
  let weekStart = getMondayOf(first);
  while (weekStart <= last) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)));
    weekStart = addDays(weekStart, 7);
  }
  return weeks;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHIFT_CONFIG = {
  morning:       { hours: "07:00–15:00", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  afternoon:     { hours: "15:00–23:00", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  night:         { hours: "23:00–07:00", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  off:           { hours: "—",           color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
  day_extended:  { hours: "08:00–20:00", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" },
  night_extended:{ hours: "20:00–08:00", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
} as const;

type ShiftType = keyof typeof SHIFT_CONFIG;

const MONTH_HOURS = 160;

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function ProgressBar({ value, max, color = "bg-blue-500" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type StatusFilter   = CleaningTask["status"] | "All";
type PriorityFilter = CleaningTask["priority"] | "All";

export default function StaffPage() {
  const { locale, priorityLabel, roleLabel: translateRoleLabel, shiftLabel, t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const authName    = useAuthStore((s) => s.name);
  const authEmail   = useAuthStore((s) => s.email);
  const setStaffId  = useAuthStore((s) => s.setStaffId);

  const tab = staffTabFromPath(location.pathname);

  // --- Profile ---
  const [profile, setProfile] = useState<StaffMember | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // --- Tasks ---
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>("All");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("All");
  const [taskListTab, setTaskListTab] = useState<"active" | "completed">("active");
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<CleaningTask | null>(null);
  const [deleting, setDeleting]           = useState(false);
  const initialTasksLoadRef = useRef(true);

  // --- Schedule (weekly) ---
  const [weekStart, setWeekStart]       = useState(() => getMondayOf(new Date()));
  const [shifts, setShifts]             = useState<ShiftResponse[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // --- Calendar (monthly) ---
  const [calMonth, setCalMonth]         = useState(() => startOfMonth(new Date()));
  const [calShifts, setCalShifts]       = useState<ShiftResponse[]>([]);
  const [calLoading, setCalLoading]     = useState(false);

  // ---------------------------------------------------------------------------
  // Loaders
  // ---------------------------------------------------------------------------

  useEffect(() => {
    void (async () => {
      setProfileLoading(true);
      const me = await staffApi.getMe();
      setProfile(me);
      if (me) setStaffId(me.id);
      setProfileLoading(false);
    })();
  }, [setStaffId]);

  const loadTasks = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setTasksLoading(initialTasksLoadRef.current);
      }
      setTasks(await tasksApi.getAll());
    } catch {
      toast.error(t("staff.failedLoadTasks"));
    } finally {
      if (!options?.silent) {
        setTasksLoading(false);
        initialTasksLoadRef.current = false;
      }
    }
  }, [t]);

  const loadSchedule = useCallback(async () => {
    try {
      setScheduleLoading(true);
      setShifts(await staffApi.getMySchedule(toDateStr(weekStart)));
    } catch {
      toast.error(t("staff.failedLoadSchedule"));
    } finally {
      setScheduleLoading(false);
    }
  }, [t, weekStart]);

  const loadCalendar = useCallback(async () => {
    try {
      setCalLoading(true);
      const weeks = getCalWeeks(calMonth);
      const results = await Promise.all(
        weeks.map((week) => staffApi.getMySchedule(toDateStr(week[0])))
      );
      // Flatten and deduplicate by id
      const seen = new Set<number>();
      const all: ShiftResponse[] = [];
      for (const batch of results) {
        for (const s of batch) {
          if (!seen.has(s.id)) { seen.add(s.id); all.push(s); }
        }
      }
      setCalShifts(all);
    } catch {
      toast.error(t("staff.failedLoadCalendar"));
    } finally {
      setCalLoading(false);
    }
  }, [calMonth, t]);

  useEffect(() => { void loadTasks(); }, [loadTasks]);
  useEffect(() => {
    if (tab === "overview" || tab === "tasks" || tab === "schedule") void loadSchedule();
  }, [tab, loadSchedule]);
  useEffect(() => { if (tab === "calendar") void loadCalendar(); }, [tab, loadCalendar]);

  // ---------------------------------------------------------------------------
  // Task actions
  // ---------------------------------------------------------------------------

  const handleStart = async (taskId: number) => {
    if (!profile) return;
    try {
      await tasksApi.assign(taskId, profile.id, profile.name);
      toast.success(t("staff.taskStarted"));
      void loadTasks({ silent: true });
    } catch {
      toast.error(t("staff.failedStartTask"));
    }
  };

  const handleChecklistToggle = async (taskId: number, itemId: string, checked: boolean) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        const checklist = resolveTaskChecklist(task).map((item) =>
          item.id === itemId ? { ...item, checked } : item
        );
        return {
          ...task,
          checklist,
          status: task.status === "Pending" ? "In Progress" : task.status,
        };
      })
    );

    try {
      const updated = await tasksApi.updateChecklistItem(taskId, itemId, checked);
      setTasks((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
    } catch {
      void loadTasks({ silent: true });
      toast.error(t("staff.failedUpdateChecklist"));
    }
  };

  const handleComplete = async (taskId: number) => {
    try {
      const updated = await tasksApi.complete(taskId);
      setTasks((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
      toast.success(t("staff.taskCompleted"));
    } catch {
      toast.error(t("staff.failedCompleteTask"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await tasksApi.delete(deleteTarget.id);
      toast.success(t("staff.taskDeleted"));
      setDeleteTarget(null);
      void loadTasks();
    } catch {
      toast.error(t("staff.failedDeleteTask"));
    } finally {
      setDeleting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const myTasks = useMemo(() => {
    if (!profile) return tasks;
    return tasks.filter((task) => task.assignedTo === profile.id);
  }, [tasks, profile]);

  const overviewTasks = useMemo(() => {
    return myTasks.filter((task) =>
      taskListTab === "completed"
        ? task.status === "Completed"
        : task.status !== "Completed"
    );
  }, [myTasks, taskListTab]);

  const filteredTasks = useMemo(() => {
    return myTasks.filter((task) => {
      const matchesTab =
        taskListTab === "completed"
          ? task.status === "Completed"
          : task.status !== "Completed";
      if (!matchesTab) return false;
      if (statusFilter !== "All" && task.status !== statusFilter) return false;
      if (priorityFilter !== "All" && task.priority !== priorityFilter) return false;
      return true;
    });
  }, [myTasks, taskListTab, statusFilter, priorityFilter]);

  const taskStats = useMemo(() => ({
    pending:    tasks.filter((t) => t.status === "Pending").length,
    inProgress: tasks.filter((t) => t.status === "In Progress").length,
    completed:  tasks.filter((t) => t.status === "Completed").length,
  }), [tasks]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const getShift = (dateStr: string) => shifts.find((s) => s.shift_date === dateStr);

  const calWeeks  = getCalWeeks(calMonth);
  const getCalShift = (dateStr: string) => calShifts.find((s) => s.shift_date === dateStr);

  // Pending task dates (from tasks with createdAt)
  const pendingDateSet = useMemo(() => {
    const set = new Set<string>();
    tasks
      .filter((t) => t.status === "Pending" || t.status === "In Progress")
      .forEach((t) => {
        const d = t.createdAt?.split("T")[0];
        if (d) set.add(d);
      });
    return set;
  }, [tasks]);

  // Cal stats — only count days in the displayed month
  const calMonthShifts = calShifts.filter((s) => {
    const d = new Date(s.shift_date);
    return d.getFullYear() === calMonth.getFullYear() && d.getMonth() === calMonth.getMonth();
  });

  const displayName = profile?.name ?? authName ?? t("staff.staffMember");
  const roleLabel   = profile?.role
    ? translateRoleLabel(profile.role)
    : null;
  const calendarDayLabels = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(getMondayOf(new Date()), index).toLocaleDateString(locale, { weekday: "short" })),
    [locale]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const taskListToggle = (
    <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 rounded-lg p-1">
      <button
        type="button"
        onClick={() => {
          setTaskListTab("active");
          if (statusFilter === "Completed") setStatusFilter("All");
        }}
        className={`px-3 py-1.5 text-xs rounded-md font-medium ${
          taskListTab === "active"
            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
            : "text-gray-500"
        }`}
      >
        {t("staff.myTasks")}
      </button>
      <button
        type="button"
        onClick={() => setTaskListTab("completed")}
        className={`px-3 py-1.5 text-xs rounded-md font-medium ${
          taskListTab === "completed"
            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
            : "text-gray-500"
        }`}
      >
        {t("taskStatus.Completed")}
      </button>
    </div>
  );

  const renderTaskList = (list: CleaningTask[]) => {
    if (tasksLoading) {
      return <LoadingSpinner message={t("staff.loadingTasks")} fullScreen={false} />;
    }
    if (list.length === 0) {
      return (
        <Card padding="lg">
          <p className="text-center text-sm text-gray-400">{t("staff.noTasks")}</p>
        </Card>
      );
    }
    return (
      <div className="space-y-2">
        {list.map((task) => (
          <StaffCompactTaskItem
            key={task.id}
            task={task}
            expanded={expandedTaskId === task.id}
            onToggleExpand={() =>
              setExpandedTaskId((current) => (current === task.id ? null : task.id))
            }
            currentStaffId={profile?.id ?? -1}
            onStart={handleStart}
            onComplete={handleComplete}
            onChecklistToggle={handleChecklistToggle}
          />
        ))}
      </div>
    );
  };

  const mobileTabs: StaffTab[] = ["overview", "tasks", "schedule", "calendar", "hours"];

  return (
    <div className={`w-full mx-auto space-y-5 ${tab === "tasks" ? "max-w-5xl" : "max-w-3xl"}`}>
        <div className="md:hidden flex gap-1 overflow-x-auto bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {mobileTabs.map((tabName) => (
            <Link
              key={tabName}
              to={STAFF_PATHS[tabName]}
              className={`shrink-0 px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                tab === tabName
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-500"
              }`}
            >
              {tabName === "overview"
                ? t("staff.tabOverview")
                : tabName === "tasks"
                  ? t("staff.tabTasks")
                  : tabName === "schedule"
                    ? t("staff.tabSchedule")
                    : tabName === "calendar"
                      ? t("staff.tabCalendar")
                      : t("staff.tabHours")}
            </Link>
          ))}
        </div>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {profileLoading ? t("staff.loading") : t("staff.hello", { name: displayName.split(" ")[0] })}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {tab === "overview"
                ? t("staff.dashboardSubtitle")
                : tab === "tasks"
                  ? t("staff.tabTasks")
                  : `${roleLabel ? `${roleLabel} · ` : ""}${authEmail ?? ""}`}
            </p>
          </div>
          {profile && (tab === "overview" || tab === "hours") && (
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400">{t("staff.thisMonth")}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                {profile.hours_this_month}h
              </p>
            </div>
          )}
        </div>

        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: t("staff.statPending"), value: taskStats.pending, color: "text-gray-900 dark:text-white", icon: "🕒" },
                { label: t("staff.statInProgress"), value: taskStats.inProgress, color: "text-blue-700 dark:text-blue-300", icon: "🔄" },
                { label: t("staff.statCompleted"), value: taskStats.completed, color: "text-emerald-700 dark:text-emerald-300", icon: "✅" },
              ].map((s) => (
                <Card key={s.label} padding="sm" className="flex items-center gap-3">
                  <span className="text-xl">{s.icon}</span>
                  <div>
                    <p className={`text-2xl font-bold leading-none ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
                  </div>
                </Card>
              ))}
            </div>

            <Card padding="sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{t("staff.myTasks")}</p>
                {taskListToggle}
              </div>
              {renderTaskList(overviewTasks)}
            </Card>

            <Card padding="sm">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{t("staff.todayProgress")}</p>
              <p className="text-xs text-gray-500 mb-2">
                {t("staff.completedSummary", {
                  done: String(taskStats.completed),
                  total: String(tasks.length),
                })}
              </p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${tasks.length ? Math.round((taskStats.completed / tasks.length) * 100) : 0}%`,
                  }}
                />
              </div>
            </Card>
          </div>
        )}

        {tab === "tasks" && (
          <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-4">
            <div className="space-y-4 order-1 xl:order-none">
              <StaffTasksSidebar
                tasks={tasks}
                shifts={shifts}
                hoursThisMonth={profile?.hours_this_month ?? 0}
                onOpenSchedule={() => navigate(STAFF_PATHS.schedule)}
                onOpenHours={() => navigate(STAFF_PATHS.hours)}
              />
            </div>

            <div className="space-y-3 order-2 xl:order-none">
              <Card padding="sm">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {taskListToggle}
                  <div className="flex gap-2 sm:ml-auto w-full sm:w-auto">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                      className="flex-1 sm:flex-none px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      <option value="All">{t("staff.allStatuses")}</option>
                      <option value="Pending">{t("taskStatus.Pending")}</option>
                      <option value="In Progress">{t("taskStatus.InProgress")}</option>
                      {taskListTab === "completed" && (
                        <option value="Completed">{t("taskStatus.Completed")}</option>
                      )}
                    </select>
                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
                      className="flex-1 sm:flex-none px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      <option value="All">{t("staff.allPriorities")}</option>
                      <option value="High">{priorityLabel("High")}</option>
                      <option value="Medium">{priorityLabel("Medium")}</option>
                      <option value="Low">{priorityLabel("Low")}</option>
                    </select>
                  </div>
                </div>
              </Card>
              {renderTaskList(filteredTasks)}
            </div>
          </div>
        )}

      {/* ------------------------------------------------------------------ */}
      {/* SCHEDULE TAB (weekly)                                               */}
      {/* ------------------------------------------------------------------ */}
      {tab === "schedule" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setWeekStart((d) => addDays(d, -7))}>{`<- ${t("common.prev")}`}</Button>
            <span className="flex-1 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
              {weekDays[0].toLocaleDateString(locale, { day: "numeric", month: "short" })}
              {" – "}
              {weekDays[6].toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <Button size="sm" variant="secondary" onClick={() => setWeekStart((d) => addDays(d, 7))}>{`${t("common.next")} ->`}</Button>
            <Button size="sm" variant="secondary" onClick={() => setWeekStart(getMondayOf(new Date()))}>{t("common.today")}</Button>
          </div>

          {!profile && !profileLoading ? (
            <Card padding="lg">
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                {t("staff.noStaffProfileLong")}
              </p>
            </Card>
          ) : scheduleLoading ? (
            <LoadingSpinner message={t("staff.loadingSchedule")} fullScreen={false} />
          ) : (
            <Card padding="none">
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {weekDays.map((day, i) => {
                  const dateStr = toDateStr(day);
                  const shift   = getShift(dateStr);
                  const isToday = dateStr === toDateStr(new Date());
                  const cfg     = shift ? SHIFT_CONFIG[shift.shift_type as ShiftType] : null;

                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between px-4 py-3 ${
                        isToday ? "bg-blue-50/60 dark:bg-blue-900/10" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 text-center">
                          <p className={`text-xs font-medium ${isToday ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`}>
                            {day.toLocaleDateString(locale, { weekday: "short" }).replace(".", "").toUpperCase()}
                          </p>
                          <p className={`text-lg font-bold leading-none ${isToday ? "text-blue-600 dark:text-blue-400" : "text-gray-800 dark:text-gray-200"}`}>
                            {day.getDate()}
                          </p>
                        </div>
                        <div>
                          {cfg ? (
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-sm font-medium ${cfg.color}`}>
                              {shiftLabel(shift?.shift_type ?? "off")}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-300 dark:text-gray-600">{t("shifts.unscheduled")}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        {cfg ? (
                          <>
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-300 tabular-nums">{cfg.hours}</p>
                            {shift && shift.shift_type !== "off" && (
                              <p className="text-xs text-gray-400">{shift.hours}h</p>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {profile && !scheduleLoading && (
            <Card padding="md">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">{t("staff.hoursThisWeek")}</span>
                <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                  {shifts.filter((s) => s.shift_type !== "off").reduce((sum, s) => sum + s.hours, 0)}h
                </span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-600 dark:text-gray-400">{t("staff.daysOffThisWeek")}</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {shifts.filter((s) => s.shift_type === "off").length}
                </span>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* CALENDAR TAB (monthly grid)                                         */}
      {/* ------------------------------------------------------------------ */}
      {tab === "calendar" && (
        <div className="space-y-4">
          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setCalMonth((m) => addMonths(m, -1))}>{`<- ${t("common.prev")}`}</Button>
            <span className="flex-1 text-center text-sm font-semibold text-gray-800 dark:text-gray-200">
              {calMonth.toLocaleString(locale, { month: "long", year: "numeric" })}
            </span>
            <Button size="sm" variant="secondary" onClick={() => setCalMonth((m) => addMonths(m, 1))}>{`${t("common.next")} ->`}</Button>
            <Button size="sm" variant="secondary" onClick={() => setCalMonth(startOfMonth(new Date()))}>{t("common.today")}</Button>
          </div>

          {!profile && !profileLoading ? (
            <Card padding="lg">
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                {t("staff.noStaffProfileShort")}
              </p>
            </Card>
          ) : calLoading ? (
            <LoadingSpinner message={t("staff.loadingCalendar")} fullScreen={false} />
          ) : (
            <Card padding="none" className="overflow-hidden">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                {calendarDayLabels.map((d) => (
                  <div key={d} className="text-center py-2 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                    {d}
                  </div>
                ))}
              </div>

              {/* Weeks */}
              {calWeeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  {week.map((day, di) => {
                    const dateStr  = toDateStr(day);
                    const inMonth  = day.getMonth() === calMonth.getMonth();
                    const isToday  = dateStr === toDateStr(new Date());
                    const shift    = getCalShift(dateStr);
                    const cfg      = shift ? SHIFT_CONFIG[shift.shift_type as ShiftType] : null;
                    const hasTask  = pendingDateSet.has(dateStr) && inMonth;

                    return (
                      <div
                        key={di}
                        className={`relative min-h-[60px] p-1.5 ${
                          di < 6 ? "border-r border-gray-100 dark:border-gray-800" : ""
                        } ${!inMonth ? "bg-gray-50/60 dark:bg-gray-800/20" : ""} ${
                          isToday ? "bg-blue-50/40 dark:bg-blue-900/10" : ""
                        }`}
                      >
                        {/* Date number */}
                        <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1 ${
                          isToday
                            ? "bg-blue-600 text-white"
                            : inMonth
                            ? "text-gray-700 dark:text-gray-300"
                            : "text-gray-300 dark:text-gray-600"
                        }`}>
                          {day.getDate()}
                        </div>

                        {/* Shift badge */}
                        {cfg && inMonth && (
                          <span className={`text-[9px] px-1 py-0.5 rounded font-semibold leading-tight block truncate ${cfg.color}`}>
                            {shiftLabel(shift.shift_type).length > 8 ? shiftLabel(shift.shift_type).slice(0, 8) : shiftLabel(shift.shift_type)}
                          </span>
                        )}

                        {/* Pending task dot */}
                        {hasTask && (
                          <span
                            className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full"
                            title={t("staff.pendingDotTitle")}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </Card>
          )}

          {/* Legend */}
          <Card padding="sm">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-2 font-semibold">{t("staff.legend")}</p>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(SHIFT_CONFIG) as [ShiftType, typeof SHIFT_CONFIG[ShiftType]][]).map(([type, cfg]) => (
                <span key={type} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                  {shiftLabel(type)}
                </span>
              ))}
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                {t("shifts.unscheduled")}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block" />
                {t("staff.pendingTasks")}
              </span>
            </div>
          </Card>

          {/* Monthly stats */}
          {!calLoading && (
            <Card padding="md">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                {t("staff.atAGlance", { month: calMonth.toLocaleString(locale, { month: "long" }) })}
              </p>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: t("staff.scheduledHours"), value: calMonthShifts.filter((s) => s.shift_type !== "off").reduce((sum, s) => sum + s.hours, 0) },
                  { label: t("staff.workDays"), value: calMonthShifts.filter((s) => s.shift_type !== "off").length },
                  { label: t("staff.daysOff"), value: calMonthShifts.filter((s) => s.shift_type === "off").length },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* HOURS TAB                                                           */}
      {/* ------------------------------------------------------------------ */}
      {tab === "hours" && (
        <div className="space-y-4">
          {profileLoading ? (
            <LoadingSpinner message={t("staff.loadingHours")} fullScreen={false} />
          ) : !profile ? (
            <Card padding="lg">
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                {t("staff.noStaffProfileLong")}
              </p>
            </Card>
          ) : (
            <>
              <Card padding="md">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  {t("staff.hoursWorked", { month: new Date().toLocaleString(locale, { month: "long", year: "numeric" }) })}
                </p>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white tabular-nums">{profile.hours_this_month}</span>
                  <span className="text-sm text-gray-400 mb-1">/ {MONTH_HOURS}h</span>
                </div>
                <ProgressBar
                  value={profile.hours_this_month}
                  max={MONTH_HOURS}
                  color={profile.hours_this_month >= MONTH_HOURS ? "bg-emerald-500" : "bg-blue-500"}
                />
                <p className="text-xs text-gray-400 mt-2">
                  {t("staff.remainingToFullMonth", { count: Math.max(0, MONTH_HOURS - profile.hours_this_month) })}
                </p>
              </Card>

              <Card padding="md">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  {t("staff.daysOffYear", { year: new Date().getFullYear() })}
                </p>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white tabular-nums">{profile.days_off_this_year}</span>
                  <span className="text-sm text-gray-400 mb-1">/ {profile.annual_days_off} {locale === "it-IT" ? "giorni" : "days"}</span>
                </div>
                <ProgressBar
                  value={profile.days_off_this_year}
                  max={profile.annual_days_off}
                  color={profile.days_off_this_year >= profile.annual_days_off ? "bg-rose-500" : "bg-emerald-500"}
                />
                <p className="text-xs text-gray-400 mt-2">
                  {t("staff.daysRemaining", { count: Math.max(0, profile.annual_days_off - profile.days_off_this_year) })}
                </p>
              </Card>

              <Card padding="md">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">{t("staff.myProfile")}</p>
                <div className="space-y-2 text-sm">
                  {[
                    { label: t("staff.profileName"), value: profile.name },
                    { label: t("staff.profileRole"), value: translateRoleLabel(profile.role) },
                    { label: t("staff.profileEmail"), value: profile.email ?? "—" },
                    { label: t("staff.profilePhone"), value: profile.phone ?? "—" },
                    { label: t("staff.profileSince"), value: profile.hire_date ? new Date(profile.hire_date).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }) : "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">{label}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{value}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Delete task modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title={t("staff.deleteTask")}
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="secondary" fullWidth onClick={() => setDeleteTarget(null)} disabled={deleting}>{t("common.cancel")}</Button>
            <Button variant="danger" fullWidth onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? t("staff.deleting") : t("taskCard.delete")}
            </Button>
          </div>
        }
      >
        {deleteTarget && (
          <p className="text-gray-700 dark:text-gray-300">
            {t("staff.deleteTaskPrompt", { room: deleteTarget.roomNumber })}
          </p>
        )}
      </Modal>
    </div>
  );
}

import { useState, useEffect, useMemo, useCallback } from "react";
import { tasksApi, staffApi } from "../../api/api";
import { useI18n } from "../../i18n";
import type { CleaningTask } from "../../mocks/tasks";
import type { StaffMember, ShiftResponse } from "../../api/api";
import { useAuthStore } from "../../store/authStore";
import TaskCard from "../../components/TaskCard";
import LoadingSpinner from "../../ui/LoadingSpinner";
import Card from "../../ui/Card";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import toast from "react-hot-toast";

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

type Tab = "tasks" | "schedule" | "calendar" | "hours";
type StatusFilter   = CleaningTask["status"] | "All";
type PriorityFilter = CleaningTask["priority"] | "All";

export default function StaffPage() {
  const { locale, priorityLabel, roleLabel: translateRoleLabel, shiftLabel, t } = useI18n();
  const authName    = useAuthStore((s) => s.name);
  const authEmail   = useAuthStore((s) => s.email);
  const setStaffId  = useAuthStore((s) => s.setStaffId);

  const [tab, setTab] = useState<Tab>("tasks");

  // --- Profile ---
  const [profile, setProfile] = useState<StaffMember | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // --- Tasks ---
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>("All");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("All");
  const [onlyMyTasks, setOnlyMyTasks]     = useState(false);
  const [deleteTarget, setDeleteTarget]   = useState<CleaningTask | null>(null);
  const [deleting, setDeleting]           = useState(false);

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

  const loadTasks = useCallback(async () => {
    try {
      setTasksLoading(true);
      setTasks(await tasksApi.getAll());
    } catch {
      toast.error(t("staff.failedLoadTasks"));
    } finally {
      setTasksLoading(false);
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
  useEffect(() => { if (tab === "schedule") void loadSchedule(); }, [tab, loadSchedule]);
  useEffect(() => { if (tab === "calendar") void loadCalendar(); }, [tab, loadCalendar]);

  // ---------------------------------------------------------------------------
  // Task actions
  // ---------------------------------------------------------------------------

  const handleStart = async (taskId: number) => {
    if (!profile) return;
    try {
      await tasksApi.assign(taskId, profile.id, profile.name);
      toast.success(t("staff.taskStarted"));
      void loadTasks();
    } catch {
      toast.error(t("staff.failedStartTask"));
    }
  };

  const handleComplete = async (taskId: number) => {
    try {
      await tasksApi.complete(taskId);
      toast.success(t("staff.taskCompleted"));
      void loadTasks();
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

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== "All" && t.status !== statusFilter) return false;
      if (priorityFilter !== "All" && t.priority !== priorityFilter) return false;
      if (onlyMyTasks && profile && t.assignedTo !== profile.id) return false;
      return true;
    });
  }, [tasks, statusFilter, priorityFilter, onlyMyTasks, profile]);

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

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5 px-4 py-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {profileLoading ? t("staff.loading") : t("staff.hello", { name: displayName.split(" ")[0] })}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {roleLabel ? `${roleLabel} · ` : ""}{authEmail ?? ""}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {profile && (
            <div className="text-right">
              <p className="text-xs text-gray-400">{t("staff.thisMonth")}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                {profile.hours_this_month}h
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {(["tasks", "schedule", "calendar", "hours"] as const).map((tabName) => (
          <button
            key={tabName}
            onClick={() => setTab(tabName)}
            className={`flex-1 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-colors capitalize ${
              tab === tabName
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tabName === "tasks"
              ? t("staff.tabTasks")
              : tabName === "schedule"
                ? t("staff.tabSchedule")
                : tabName === "calendar"
                  ? t("staff.tabCalendar")
                  : t("staff.tabHours")}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TASKS TAB                                                           */}
      {/* ------------------------------------------------------------------ */}
      {tab === "tasks" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t("staff.statPending"), value: taskStats.pending, color: "text-gray-900 dark:text-white" },
              { label: t("staff.statInProgress"), value: taskStats.inProgress, color: "text-blue-700 dark:text-blue-300" },
              { label: t("staff.statCompleted"), value: taskStats.completed, color: "text-emerald-700 dark:text-emerald-300" },
            ].map((s) => (
              <Card key={s.label} padding="sm" className="text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
              </Card>
            ))}
          </div>

          <Card padding="md">
            <div className="space-y-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="All">{t("staff.allStatuses")}</option>
                <option value="Pending">{t("taskStatus.Pending")}</option>
                <option value="In Progress">{t("taskStatus.InProgress")}</option>
                <option value="Completed">{t("taskStatus.Completed")}</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="All">{t("staff.allPriorities")}</option>
                <option value="High">{priorityLabel("High")}</option>
                <option value="Medium">{priorityLabel("Medium")}</option>
                <option value="Low">{priorityLabel("Low")}</option>
              </select>
              {profile && (
                <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyMyTasks}
                    onChange={(e) => setOnlyMyTasks(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">{t("staff.onlyMyTasks")}</span>
                </label>
              )}
            </div>
          </Card>

          {tasksLoading ? (
            <LoadingSpinner message={t("staff.loadingTasks")} fullScreen={false} />
          ) : filteredTasks.length === 0 ? (
            <Card padding="lg">
              <p className="text-center text-sm text-gray-400">{t("staff.noTasks")}</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStart={handleStart}
                  onComplete={handleComplete}
                  onDelete={(id) => setDeleteTarget(filteredTasks.find((t) => t.id === id) ?? null)}
                  currentStaffId={profile?.id ?? -1}
                />
              ))}
            </div>
          )}
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

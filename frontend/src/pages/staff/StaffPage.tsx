import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { tasksApi, staffApi } from "../../api/api";
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
  morning:       { label: "Morning",     hours: "07:00–15:00", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  afternoon:     { label: "Afternoon",   hours: "15:00–23:00", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  night:         { label: "Night",       hours: "23:00–07:00", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  off:           { label: "Day Off",     hours: "—",           color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
  day_extended:  { label: "Day (12h)",   hours: "08:00–20:00", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" },
  night_extended:{ label: "Night (12h)", hours: "20:00–08:00", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
} as const;

type ShiftType = keyof typeof SHIFT_CONFIG;

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const CAL_DAYS  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_HOURS = 160;

// ---------------------------------------------------------------------------
// ShiftTimer — running clock since login, heartbeat every 2 min
// ---------------------------------------------------------------------------

function ShiftTimer({ loginTime }: { loginTime: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(loginTime).getTime();
    const tick  = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [loginTime]);

  // Heartbeat every 2 minutes keeps the session verified
  useEffect(() => {
    const id = setInterval(() => { void staffApi.heartbeat().catch(() => {}); }, 120_000);
    return () => clearInterval(id);
  }, []);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;

  return (
    <div className="flex items-center gap-2.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />
      <div>
        <p className="text-[10px] uppercase tracking-wide text-green-600 dark:text-green-500 font-semibold">Shift active</p>
        <p className="text-sm font-bold text-green-800 dark:text-green-300 tabular-nums leading-none mt-0.5">
          {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
        </p>
      </div>
    </div>
  );
}

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
  const navigate    = useNavigate();
  const authName    = useAuthStore((s) => s.name);
  const authEmail   = useAuthStore((s) => s.email);
  const loginTime   = useAuthStore((s) => s.loginTime);
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
      toast.error("Failed to load tasks");
    } finally {
      setTasksLoading(false);
    }
  }, []);

  const loadSchedule = useCallback(async () => {
    try {
      setScheduleLoading(true);
      setShifts(await staffApi.getMySchedule(toDateStr(weekStart)));
    } catch {
      toast.error("Failed to load schedule");
    } finally {
      setScheduleLoading(false);
    }
  }, [weekStart]);

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
      toast.error("Failed to load calendar");
    } finally {
      setCalLoading(false);
    }
  }, [calMonth]);

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
      toast.success("Task started");
      void loadTasks();
    } catch {
      toast.error("Failed to start task");
    }
  };

  const handleComplete = async (taskId: number) => {
    try {
      await tasksApi.complete(taskId);
      toast.success("Task completed");
      void loadTasks();
    } catch {
      toast.error("Failed to complete task");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await tasksApi.delete(deleteTarget.id);
      toast.success("Task deleted");
      setDeleteTarget(null);
      void loadTasks();
    } catch {
      toast.error("Failed to delete task");
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

  const displayName = profile?.name ?? authName ?? "Staff Member";
  const roleLabel   = profile?.role
    ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
    : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5 px-4 py-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {profileLoading ? "Loading…" : `Hello, ${displayName.split(" ")[0]}`}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {roleLabel ? `${roleLabel} · ` : ""}{authEmail ?? ""}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {loginTime && <ShiftTimer loginTime={loginTime} />}
          {profile && (
            <div className="text-right">
              <p className="text-xs text-gray-400">This month</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                {profile.hours_this_month}h
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Shift start prompt */}
      {!loginTime && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Shift not started</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Enter the shift code to start your shift timer.</p>
          </div>
          <button
            onClick={() => navigate("/shift-start")}
            className="shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Start Shift →
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
        {(["tasks", "schedule", "calendar", "hours"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-colors capitalize ${
              tab === t
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t === "tasks" ? "Tasks" : t === "schedule" ? "Schedule" : t === "calendar" ? "Calendar" : "Hours"}
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
              { label: "Pending",     value: taskStats.pending,    color: "text-gray-900 dark:text-white" },
              { label: "In progress", value: taskStats.inProgress, color: "text-blue-700 dark:text-blue-300" },
              { label: "Completed",   value: taskStats.completed,  color: "text-emerald-700 dark:text-emerald-300" },
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
                <option value="All">All statuses</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In progress</option>
                <option value="Completed">Completed</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="All">All priorities</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              {profile && (
                <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyMyTasks}
                    onChange={(e) => setOnlyMyTasks(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">Only my tasks</span>
                </label>
              )}
            </div>
          </Card>

          {tasksLoading ? (
            <LoadingSpinner message="Loading tasks…" fullScreen={false} />
          ) : filteredTasks.length === 0 ? (
            <Card padding="lg">
              <p className="text-center text-sm text-gray-400">No tasks match the current filters.</p>
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
            <Button size="sm" variant="secondary" onClick={() => setWeekStart((d) => addDays(d, -7))}>← Prev</Button>
            <span className="flex-1 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
              {weekDays[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              {" – "}
              {weekDays[6].toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <Button size="sm" variant="secondary" onClick={() => setWeekStart((d) => addDays(d, 7))}>Next →</Button>
            <Button size="sm" variant="secondary" onClick={() => setWeekStart(getMondayOf(new Date()))}>Today</Button>
          </div>

          {!profile && !profileLoading ? (
            <Card padding="lg">
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Your account isn't linked to a staff profile yet. Ask your manager to add your email.
              </p>
            </Card>
          ) : scheduleLoading ? (
            <LoadingSpinner message="Loading schedule…" fullScreen={false} />
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
                            {DAY_NAMES[i].slice(0, 3).toUpperCase()}
                          </p>
                          <p className={`text-lg font-bold leading-none ${isToday ? "text-blue-600 dark:text-blue-400" : "text-gray-800 dark:text-gray-200"}`}>
                            {day.getDate()}
                          </p>
                        </div>
                        <div>
                          {cfg ? (
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-sm font-medium ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-300 dark:text-gray-600">Unscheduled</span>
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
                <span className="text-gray-600 dark:text-gray-400">Hours this week</span>
                <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                  {shifts.filter((s) => s.shift_type !== "off").reduce((sum, s) => sum + s.hours, 0)}h
                </span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-600 dark:text-gray-400">Days off this week</span>
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
            <Button size="sm" variant="secondary" onClick={() => setCalMonth((m) => addMonths(m, -1))}>← Prev</Button>
            <span className="flex-1 text-center text-sm font-semibold text-gray-800 dark:text-gray-200">
              {calMonth.toLocaleString("en-US", { month: "long", year: "numeric" })}
            </span>
            <Button size="sm" variant="secondary" onClick={() => setCalMonth((m) => addMonths(m, 1))}>Next →</Button>
            <Button size="sm" variant="secondary" onClick={() => setCalMonth(startOfMonth(new Date()))}>Today</Button>
          </div>

          {!profile && !profileLoading ? (
            <Card padding="lg">
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Your account isn't linked to a staff profile yet.
              </p>
            </Card>
          ) : calLoading ? (
            <LoadingSpinner message="Loading calendar…" fullScreen={false} />
          ) : (
            <Card padding="none" className="overflow-hidden">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                {CAL_DAYS.map((d) => (
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
                            {cfg.label === "Afternoon" ? "Aft." : cfg.label}
                          </span>
                        )}

                        {/* Pending task dot */}
                        {hasTask && (
                          <span
                            className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full"
                            title="Pending tasks"
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
            <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-2 font-semibold">Legend</p>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(SHIFT_CONFIG) as [ShiftType, typeof SHIFT_CONFIG[ShiftType]][]).map(([, cfg]) => (
                <span key={cfg.label} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                  {cfg.label}
                </span>
              ))}
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                Unscheduled
              </span>
              <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block" />
                Pending tasks
              </span>
            </div>
          </Card>

          {/* Monthly stats */}
          {!calLoading && (
            <Card padding="md">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                {calMonth.toLocaleString("en-US", { month: "long" })} at a glance
              </p>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "Scheduled h",  value: calMonthShifts.filter((s) => s.shift_type !== "off").reduce((sum, s) => sum + s.hours, 0) },
                  { label: "Work days",    value: calMonthShifts.filter((s) => s.shift_type !== "off").length },
                  { label: "Days off",     value: calMonthShifts.filter((s) => s.shift_type === "off").length },
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
            <LoadingSpinner message="Loading…" fullScreen={false} />
          ) : !profile ? (
            <Card padding="lg">
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Your account isn't linked to a staff profile yet. Ask your manager to add your email.
              </p>
            </Card>
          ) : (
            <>
              <Card padding="md">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Hours worked — {new Date().toLocaleString("en-US", { month: "long", year: "numeric" })}
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
                  {Math.max(0, MONTH_HOURS - profile.hours_this_month)}h remaining to full month
                </p>
              </Card>

              <Card padding="md">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                  Days off — {new Date().getFullYear()}
                </p>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white tabular-nums">{profile.days_off_this_year}</span>
                  <span className="text-sm text-gray-400 mb-1">/ {profile.annual_days_off} days</span>
                </div>
                <ProgressBar
                  value={profile.days_off_this_year}
                  max={profile.annual_days_off}
                  color={profile.days_off_this_year >= profile.annual_days_off ? "bg-rose-500" : "bg-emerald-500"}
                />
                <p className="text-xs text-gray-400 mt-2">
                  {Math.max(0, profile.annual_days_off - profile.days_off_this_year)} days remaining
                </p>
              </Card>

              <Card padding="md">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">My Profile</p>
                <div className="space-y-2 text-sm">
                  {[
                    { label: "Name",  value: profile.name },
                    { label: "Role",  value: profile.role.charAt(0).toUpperCase() + profile.role.slice(1) },
                    { label: "Email", value: profile.email ?? "—" },
                    { label: "Phone", value: profile.phone ?? "—" },
                    { label: "Since", value: profile.hire_date ? new Date(profile.hire_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—" },
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
        title="Delete task"
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="secondary" fullWidth onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="danger" fullWidth onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        }
      >
        {deleteTarget && (
          <p className="text-gray-700 dark:text-gray-300">
            Delete task for Room #{deleteTarget.roomNumber}? This cannot be undone.
          </p>
        )}
      </Modal>
    </div>
  );
}

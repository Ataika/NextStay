import { Fragment, useState, useEffect, useCallback } from "react";
import { staffApi } from "../../api/api";
import type { StaffMember, ShiftResponse } from "../../api/api";
import Button from "../../ui/Button";
import Card from "../../ui/Card";
import PageHeader from "../../ui/PageHeader";
import Modal from "../../ui/Modal";
import toast from "react-hot-toast";
import { useAuthStore, canManageEngine, isAdminRole } from "../../store/authStore";
import { useI18n } from "../../i18n";

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHIFT_CONFIG = {
  morning: {
    label: "M",
    full: "Morning",
    hours: "07:00–15:00",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    ring: "ring-blue-400",
    adminOnly: false,
  },
  afternoon: {
    label: "A",
    full: "Afternoon",
    hours: "15:00–23:00",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    ring: "ring-amber-400",
    adminOnly: false,
  },
  night: {
    label: "N",
    full: "Night",
    hours: "23:00–07:00",
    color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    ring: "ring-violet-400",
    adminOnly: false,
  },
  day_extended: {
    label: "D12",
    full: "Day (08-20)",
    hours: "08:00–20:00",
    color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    ring: "ring-cyan-400",
    adminOnly: false,
  },
  night_extended: {
    label: "N12",
    full: "Night (20-08)",
    hours: "20:00–08:00",
    color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    ring: "ring-indigo-400",
    adminOnly: false,
  },
  off: {
    label: "OFF",
    full: "Day Off",
    hours: "—",
    color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    ring: "ring-rose-400",
    adminOnly: false,
  },
} as const;

type ShiftType = keyof typeof SHIFT_CONFIG;

const ROLES = ["hostess", "cleaner", "manager", "director"] as const;
type Role = (typeof ROLES)[number];

const ROLE_LABELS: Record<Role, string> = {
  hostess: "Hostess",
  cleaner: "Cleaner",
  manager: "Manager",
  director: "Director",
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DEFAULT_FORM = {
  name: "",
  role: "hostess" as Role,
  email: "",
  phone: "",
  hire_date: "",
  annual_days_off: 20,
  is_active: true,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StaffPlannerPage() {
  const { t } = useI18n();
  const role           = useAuthStore((s) => s.role);
  const canAssignShifts = canManageEngine(role);
  const canAssignOff    = isAdminRole(role);
  const canAssign       = canAssignOff;
  const [tab, setTab] = useState<"team" | "schedule">("team");

  // --- Team state ---
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [saving, setSaving] = useState(false);

  // --- Schedule state ---
  const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date()));
  const [shifts, setShifts] = useState<ShiftResponse[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [openCell, setOpenCell] = useState<string | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data loaders
  // ---------------------------------------------------------------------------

  const loadStaff = useCallback(async () => {
    try {
      setStaffLoading(true);
      setStaff(await staffApi.list());
    } catch {
      toast.error(t("staffPlanner.loadFailed"));
    } finally {
      setStaffLoading(false);
    }
  }, []);

  const loadSchedule = useCallback(async () => {
    try {
      setScheduleLoading(true);
      setShifts(await staffApi.getSchedule(toDateStr(weekStart)));
    } catch {
      toast.error(t("staffPlanner.scheduleFailed"));
    } finally {
      setScheduleLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  useEffect(() => {
    if (tab === "schedule") void loadSchedule();
  }, [tab, loadSchedule]);

  // ---------------------------------------------------------------------------
  // Team actions
  // ---------------------------------------------------------------------------

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...DEFAULT_FORM });
    setShowModal(true);
  };

  const openEdit = (m: StaffMember) => {
    setEditingId(m.id);
    setForm({
      name: m.name,
      role: m.role as Role,
      email: m.email ?? "",
      phone: m.phone ?? "",
      hire_date: m.hire_date ?? "",
      annual_days_off: m.annual_days_off,
      is_active: m.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t("staffPlanner.nameRequired"));
      return;
    }
    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        role: form.role,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        hire_date: form.hire_date || undefined,
        annual_days_off: form.annual_days_off,
      };
      if (editingId !== null) {
        await staffApi.update(editingId, { ...payload, is_active: form.is_active });
        toast.success(t("staffPlanner.updated"));
      } else {
        await staffApi.create(payload);
        toast.success(t("staffPlanner.added"));
      }
      setShowModal(false);
      void loadStaff();
    } catch {
      toast.error(t("staffPlanner.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(t("staffPlanner.deleteConfirm", { name }))) return;
    try {
      await staffApi.delete(id);
      toast.success(t("staffPlanner.removed"));
      void loadStaff();
    } catch {
      toast.error(t("staffPlanner.deleteFailed"));
    }
  };

  // ---------------------------------------------------------------------------
  // Schedule actions
  // ---------------------------------------------------------------------------

  const getShift = (staffId: number, dateStr: string) =>
    shifts.find((s) => s.staff_id === staffId && s.shift_date === dateStr);

  const handleAssign = async (staffId: number, dateStr: string, type: ShiftType) => {
    const cellKey = `${staffId}-${dateStr}`;
    setOpenCell(null);
    setSavingCell(cellKey);
    try {
      const result = await staffApi.upsertShift(staffId, dateStr, type);
      setShifts((prev) => [
        ...prev.filter((s) => !(s.staff_id === staffId && s.shift_date === dateStr)),
        result,
      ]);
      void loadStaff();
    } catch {
      toast.error(t("staffPlanner.shiftSaveFailed"));
    } finally {
      setSavingCell(null);
    }
  };

  const handleClear = async (staffId: number, dateStr: string) => {
    const existing = getShift(staffId, dateStr);
    if (!existing) return;
    const cellKey = `${staffId}-${dateStr}`;
    setOpenCell(null);
    setSavingCell(cellKey);
    try {
      await staffApi.deleteShift(existing.id);
      setShifts((prev) => prev.filter((s) => s.id !== existing.id));
      void loadStaff();
    } catch {
      toast.error(t("staffPlanner.shiftClearFailed"));
    } finally {
      setSavingCell(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const activeStaff = staff.filter((s) => s.is_active);
  const staffByRole = (ROLES as readonly Role[])
    .map((role) => ({ role, members: activeStaff.filter((s) => s.role === role) }))
    .filter((g) => g.members.length > 0);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="w-full space-y-5">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title={t("staffPlanner.title")}
          subtitle={t("staffPlanner.subtitle")}
        />
        {tab === "team" && (
          <div className="shrink-0 pt-1">
            <Button onClick={openAdd}>{t("staffPlanner.addStaff")}</Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {(["team", "schedule"] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors capitalize ${
              tab === tabKey
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tabKey === "team" ? t("staffPlanner.tabTeam") : t("staffPlanner.tabSchedule")}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TEAM TAB                                                           */}
      {/* ------------------------------------------------------------------ */}
      {tab === "team" && (
        <Card padding="none">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/60">
              <tr>
                {[
                  t("staffPlanner.colName"),
                  t("staffPlanner.colRole"),
                  t("staffPlanner.colHours"),
                  t("staffPlanner.colDaysOff"),
                  t("staffPlanner.colStatus"),
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {staffLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                    {t("staffPlanner.loading")}
                  </td>
                </tr>
              ) : staff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                    {t("staffPlanner.noStaff")}{" "}
                    <button
                      className="text-blue-500 hover:underline"
                      onClick={openAdd}
                    >
                      {t("staffPlanner.noStaffLink")}
                    </button>{" "}
                    {t("staffPlanner.noStaffEnd")}
                  </td>
                </tr>
              ) : (
                staff.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {m.name}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">
                        {m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 tabular-nums">
                      {m.hours_this_month}h
                      <span className="text-gray-400 text-xs ml-1">/ 160h</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 tabular-nums">
                      {m.days_off_this_year}
                      <span className="text-gray-400 text-xs ml-1">/ {m.annual_days_off}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          m.is_active
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                        }`}
                      >
                        {m.is_active ? t("staffPlanner.active") : t("staffPlanner.inactive")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openEdit(m)}
                          className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300"
                        >
                          {t("staffPlanner.edit")}
                        </button>
                        <button
                          onClick={() => void handleDelete(m.id, m.name)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          {t("staffPlanner.delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* SCHEDULE TAB                                                        */}
      {/* ------------------------------------------------------------------ */}
      {tab === "schedule" && (
        <div className="space-y-4">
          {/* Week navigation */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setWeekStart((d) => addDays(d, -7))}
            >
              {t("staffPlanner.prevWeek")}
            </Button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[200px] text-center">
              {weekDays[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              {" – "}
              {weekDays[6].toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setWeekStart((d) => addDays(d, 7))}
            >
              {t("staffPlanner.nextWeek")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setWeekStart(getMondayOf(new Date()))}
            >
              {t("staffPlanner.today")}
            </Button>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {(Object.entries(SHIFT_CONFIG) as [ShiftType, (typeof SHIFT_CONFIG)[ShiftType]][]).map(
              ([type, cfg]) => (
                <span key={type} className={`px-2 py-0.5 rounded font-medium ${cfg.color}`}>
                  {cfg.label} = {cfg.full} ({cfg.hours})
                </span>
              ),
            )}
            <span className="text-gray-400 dark:text-gray-500">{t("staffPlanner.unscheduled")}</span>
          </div>

          {/* Click-outside overlay to close cell dropdown */}
          {openCell && (
            <div className="fixed inset-0 z-0" onClick={() => setOpenCell(null)} />
          )}

          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/60">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 w-36 sticky left-0 bg-gray-50 dark:bg-gray-900/60">
                      {t("staffPlanner.staffCol")}
                    </th>
                    {weekDays.map((day, i) => {
                      const isToday = toDateStr(day) === toDateStr(new Date());
                      return (
                        <th
                          key={i}
                          className={`px-2 py-2.5 text-center text-xs font-medium min-w-[82px] ${
                            isToday
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          <div>{DAY_LABELS[i]}</div>
                          <div
                            className={`font-normal ${isToday ? "text-blue-500 font-semibold" : "text-gray-400"}`}
                          >
                            {day.getDate()}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {scheduleLoading ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-sm text-gray-400">
                        {t("staffPlanner.loadingSchedule")}
                      </td>
                    </tr>
                  ) : activeStaff.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-sm text-gray-400">
                        {t("staffPlanner.noActiveStaff")}
                      </td>
                    </tr>
                  ) : (
                    staffByRole.map((group) => (
                      <Fragment key={group.role}>
                        {/* Role group header */}
                        <tr className="bg-gray-50/80 dark:bg-gray-900/40">
                          <td
                            colSpan={8}
                            className="px-4 py-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider"
                          >
                            {ROLE_LABELS[group.role]}
                          </td>
                        </tr>
                        {group.members.map((member) => (
                          <tr
                            key={member.id}
                            className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20"
                          >
                            <td className="px-4 py-2 text-xs font-medium text-gray-800 dark:text-gray-200 sticky left-0 bg-white dark:bg-gray-900">
                              {member.name}
                            </td>
                            {weekDays.map((day, di) => {
                              const dateStr = toDateStr(day);
                              const cellKey = `${member.id}-${dateStr}`;
                              const shift = getShift(member.id, dateStr);
                              const isOpen = openCell === cellKey;
                              const isSaving = savingCell === cellKey;
                              const cfg = shift
                                ? SHIFT_CONFIG[shift.shift_type as ShiftType]
                                : null;

                              return (
                                <td key={di} className="px-1.5 py-1.5 text-center relative">
                                  <button
                                    onClick={() =>
                                      canAssign ? setOpenCell(isOpen ? null : cellKey) : undefined
                                    }
                                    disabled={isSaving || !canAssign}
                                    title={
                                      !canAssign
                                        ? cfg ? cfg.full : "No shift"
                                        : cfg ? `${cfg.full} — click to change` : "Click to assign shift"
                                    }
                                    className={`w-full rounded-md px-1 py-1.5 text-xs font-semibold transition-all ${
                                      isSaving
                                        ? "opacity-40 cursor-wait"
                                        : !canAssign
                                        ? cfg
                                          ? `${cfg.color} cursor-default`
                                          : "text-gray-300 dark:text-gray-600 cursor-default"
                                        : isOpen
                                        ? `${cfg?.color ?? "bg-gray-100 dark:bg-gray-700 text-gray-400"} ring-2 ${cfg?.ring ?? "ring-gray-300"}`
                                        : cfg
                                        ? `${cfg.color} hover:opacity-80`
                                        : "text-gray-300 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                                    }`}
                                  >
                                    {isSaving ? "…" : cfg ? cfg.label : "—"}
                                  </button>

                                  {isOpen && canAssign && (
                                    <div className="absolute z-10 top-full left-1/2 -translate-x-1/2 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-1.5 flex flex-col gap-0.5 min-w-[140px]">
                                      {!canAssignShifts && (
                                        <p className="px-2.5 py-1 text-[10px] text-gray-400 border-b border-gray-100 dark:border-gray-700 mb-0.5">
                                          {t("staffPlanner.daysOffOnly")}
                                        </p>
                                      )}
                                      {(
                                        Object.entries(SHIFT_CONFIG) as [
                                          ShiftType,
                                          (typeof SHIFT_CONFIG)[ShiftType],
                                        ][]
                                      )
                                        .filter(([type]) =>
                                          canAssignShifts || type === "off"
                                        )
                                        .map(([type, c]) => (
                                          <button
                                            key={type}
                                            onClick={() =>
                                              void handleAssign(member.id, dateStr, type)
                                            }
                                            className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 ${c.color}`}
                                          >
                                            {c.full}
                                            <span className="ml-1 font-normal opacity-60 text-[10px]">
                                              {c.hours}
                                            </span>
                                          </button>
                                        ))}
                                      {shift && (canAssignShifts || shift.shift_type === "off") && (
                                        <button
                                          onClick={() =>
                                            void handleClear(member.id, dateStr)
                                          }
                                          className="text-left px-2.5 py-1.5 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 mt-0.5 border-t border-gray-100 dark:border-gray-700"
                                        >
                                          {t("staffPlanner.clear")}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* ADD / EDIT MODAL                                                    */}
      {/* ------------------------------------------------------------------ */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId !== null ? t("staffPlanner.editStaffTitle") : t("staffPlanner.addStaffTitle")}
        size="md"
      >
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("staffPlanner.fullName")} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Maria Rossi"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("staffPlanner.role")} <span className="text-red-500">*</span>
            </label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("staffPlanner.email")}
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("staffPlanner.phone")}
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+39 333 123 4567"
              />
            </div>
          </div>

          {/* Hire date + Days off */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("staffPlanner.hireDate")}
              </label>
              <input
                type="date"
                value={form.hire_date}
                onChange={(e) => setForm({ ...form, hire_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("staffPlanner.annualDaysOff")}
              </label>
              <input
                type="number"
                min={0}
                max={365}
                value={form.annual_days_off}
                onChange={(e) =>
                  setForm({ ...form, annual_days_off: Number(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Active toggle (edit only) */}
          {editingId !== null && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t("staffPlanner.activeLabel")}</span>
            </label>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowModal(false)}
              disabled={saving}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              fullWidth
              disabled={saving || !form.name.trim()}
              onClick={() => void handleSave()}
            >
              {saving
                ? t("staffPlanner.saving")
                : editingId !== null
                ? t("staffPlanner.saveChanges")
                : t("staffPlanner.addStaff")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

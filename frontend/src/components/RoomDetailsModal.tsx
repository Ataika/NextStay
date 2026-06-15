import { useCallback, useEffect, useMemo, useState } from "react";
import type { Room } from "../mocks/rooms";
import type { Booking } from "../mocks/bookings";
import type { CleaningTask, CreateTaskPayload, TaskPriority, TaskType } from "../mocks/tasks";
import { roomsApi, staffApi, tasksApi } from "../api/api";
import type { StaffMember } from "../api/api";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { useI18n } from "../i18n";
import {
  getAmenityIcon,
  getRoomDisplayDetails,
  getRoomPhotoUrl,
  ROOM_STATUS_COLORS,
} from "../utils/roomDisplay";
import toast from "react-hot-toast";

type TaskTab = "active" | "planned" | "completed";
type RoomDetailsView = "details" | "edit";

interface RoomDetailsModalProps {
  isOpen: boolean;
  room: Room | null;
  bookings: Booking[];
  view: RoomDetailsView;
  onViewChange: (view: RoomDetailsView) => void;
  onClose: () => void;
  onRoomUpdated: (room: Room) => void;
  onTasksChanged: () => void;
  onMaintenance: (room: Room) => void;
}

interface HistoryEvent {
  date: string;
  label: string;
  actor?: string;
}

const inputClass =
  "w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40";

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  Low: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  Medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  High: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  Urgent: "bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-200",
};

function isPlannedTask(task: CleaningTask): boolean {
  if (task.status !== "Pending" || !task.dueAt) return false;
  return new Date(task.dueAt) > new Date();
}

function isActiveTask(task: CleaningTask): boolean {
  if (task.status === "In Progress") return true;
  if (task.status === "Pending" && !isPlannedTask(task)) return true;
  return false;
}

function buildRoomHistory(
  roomId: number,
  bookings: Booking[],
  tasks: CleaningTask[],
  labels: { checkIn: string; checkOut: string; cleaning: string; maintenance: string }
): HistoryEvent[] {
  const events: HistoryEvent[] = [];

  for (const booking of bookings.filter((b) => b.roomId === roomId)) {
    events.push({
      date: booking.checkIn,
      label: labels.checkIn,
      actor: booking.guestName,
    });
    if (booking.status === "Checked-out" || booking.status === "Checked-in") {
      events.push({
        date: booking.checkOut,
        label: labels.checkOut,
        actor: booking.guestName,
      });
    }
  }

  for (const task of tasks.filter((t) => t.roomId === roomId && t.status === "Completed")) {
    const type = task.taskType ?? "cleaning";
    events.push({
      date: task.completedAt ?? task.createdAt,
      label: type === "maintenance" ? labels.maintenance : labels.cleaning,
      actor: task.assignedToName,
    });
  }

  return events
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
}

export default function RoomDetailsModal({
  isOpen,
  room,
  bookings,
  view,
  onViewChange,
  onClose,
  onRoomUpdated,
  onTasksChanged,
  onMaintenance,
}: RoomDetailsModalProps) {
  const { t, locale } = useI18n();
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskTab, setTaskTab] = useState<TaskTab>("active");
  const [showHistory, setShowHistory] = useState(false);

  const [taskType, setTaskType] = useState<TaskType>("cleaning");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("Medium");
  const [taskNotes, setTaskNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [checklistInput, setChecklistInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [roomForm, setRoomForm] = useState<Omit<Room, "id"> | null>(null);
  const [amenitiesInput, setAmenitiesInput] = useState("");

  const loadRoomTasks = useCallback(async (roomId: number) => {
    setLoadingTasks(true);
    try {
      const data = await tasksApi.getByRoomId(roomId);
      setTasks(data);
    } catch (error) {
      toast.error(t("roomModal.errorLoadTasks"));
      console.error(error);
    } finally {
      setLoadingTasks(false);
    }
  }, [t]);

  useEffect(() => {
    if (!isOpen || !room) return;
    void loadRoomTasks(room.id);
    void staffApi.list().then(setStaff).catch(() => setStaff([]));
    setTaskTab("active");
    setShowHistory(false);
  }, [isOpen, room, loadRoomTasks]);

  useEffect(() => {
    if (!room || view !== "edit") return;
    setRoomForm({
      number: room.number,
      category: room.category,
      status: room.status,
      price: room.price,
      capacity: room.capacity,
      description: room.description || "",
      amenities: room.amenities || [],
      photoUrl: room.photoUrl,
      areaSqm: room.areaSqm,
      bedType: room.bedType,
      viewType: room.viewType,
      floor: room.floor,
    });
    setAmenitiesInput(room.amenities?.join(", ") || "");
  }, [room, view]);

  const display = room ? getRoomDisplayDetails(room) : null;
  const photoUrl = room ? getRoomPhotoUrl(room) : "";

  const filteredTasks = useMemo(() => {
    if (taskTab === "active") return tasks.filter(isActiveTask);
    if (taskTab === "planned") return tasks.filter(isPlannedTask);
    return tasks.filter((task) => task.status === "Completed");
  }, [tasks, taskTab]);

  const history = useMemo(() => {
    if (!room) return [];
    return buildRoomHistory(room.id, bookings, tasks, {
      checkIn: t("roomModal.historyCheckIn"),
      checkOut: t("roomModal.historyCheckOut"),
      cleaning: t("roomModal.historyCleaning"),
      maintenance: t("roomModal.historyMaintenance"),
    });
  }, [room, bookings, tasks, t]);

  const currentBooking = useMemo(() => {
    if (!room) return null;
    return (
      bookings.find(
        (b) => b.roomId === room.id && (b.status === "Checked-in" || b.status === "Upcoming")
      ) ?? null
    );
  }, [bookings, room]);

  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const resetTaskForm = () => {
    setTaskType("cleaning");
    setTaskPriority("Medium");
    setTaskNotes("");
    setDueDate("");
    setDueTime("");
    setAssigneeId("");
    setChecklistInput("");
  };

  const handleCreateTask = async () => {
    if (!room) return;
    let dueAt: string | undefined;
    if (dueDate) {
      const time = dueTime || "10:00";
      dueAt = new Date(`${dueDate}T${time}`).toISOString();
    }

    const selectedStaff = staff.find((member) => String(member.id) === assigneeId);
    const checklistItems = checklistInput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const payload: CreateTaskPayload = {
      roomId: room.id,
      roomNumber: room.number,
      priority: taskPriority,
      taskType,
      notes: taskNotes.trim() || undefined,
      dueAt,
      staffId: selectedStaff?.id,
      staffName: selectedStaff?.name,
      checklistItems: checklistItems.length > 0 ? checklistItems : undefined,
    };

    setSubmitting(true);
    try {
      await tasksApi.create(payload);
      toast.success(t("roomModal.taskCreated"));
      resetTaskForm();
      await loadRoomTasks(room.id);
      onTasksChanged();
    } catch (error) {
      toast.error(t("roomModal.errorCreateTask"));
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteTask = async (taskId: number) => {
    try {
      await tasksApi.complete(taskId);
      toast.success(t("admin.taskCompleted"));
      if (room) await loadRoomTasks(room.id);
      onTasksChanged();
    } catch (error) {
      toast.error(t("admin.errorCompleteTask"));
      console.error(error);
    }
  };

  const handleSaveRoom = async () => {
    if (!room || !roomForm) return;
    if (!roomForm.number.trim() || !roomForm.category.trim()) {
      toast.error(t("admin.roomNumberRequired"));
      return;
    }

    const amenitiesArray = amenitiesInput
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      const updated = await roomsApi.update(room.id, {
        ...roomForm,
        amenities: amenitiesArray,
      });
      toast.success(t("admin.roomUpdated", { number: roomForm.number }));
      onRoomUpdated(updated);
      onViewChange("details");
    } catch (error) {
      toast.error(t("admin.errorUpdateRoom"));
      console.error(error);
    }
  };

  const taskTypeLabel = (type: TaskType | undefined) => {
    switch (type ?? "cleaning") {
      case "maintenance":
        return t("roomModal.taskTypeMaintenance");
      case "inventory":
        return t("roomModal.taskTypeInventory");
      case "guest_request":
        return t("roomModal.taskTypeGuestRequest");
      default:
        return t("roomModal.taskTypeCleaning");
    }
  };

  const activeCount = tasks.filter(isActiveTask).length;
  const plannedCount = tasks.filter(isPlannedTask).length;
  const completedCount = tasks.filter((task) => task.status === "Completed").length;

  const modalTitle =
    view === "edit"
      ? t("admin.editRoom", { number: room?.number ?? "" })
      : room
        ? `${room.number}`
        : t("admin.roomDetails");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      size="2xl"
      footer={
        view === "edit" ? (
          <div className="flex gap-2 w-full">
            <Button variant="secondary" size="sm" fullWidth onClick={() => onViewChange("details")}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" size="sm" fullWidth onClick={handleSaveRoom}>
              {t("admin.saveChanges")}
            </Button>
          </div>
        ) : undefined
      }
    >
      {!room ? null : view === "edit" && roomForm ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("admin.roomNumber")} *
              </label>
              <input
                type="text"
                value={roomForm.number}
                onChange={(e) => setRoomForm({ ...roomForm, number: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("admin.category")} *
              </label>
              <input
                type="text"
                value={roomForm.category}
                onChange={(e) => setRoomForm({ ...roomForm, category: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("admin.status")} *
              </label>
              <select
                value={roomForm.status}
                onChange={(e) => setRoomForm({ ...roomForm, status: e.target.value as Room["status"] })}
                className={inputClass}
              >
                <option value="Available">{t("admin.available")}</option>
                <option value="Occupied">{t("admin.occupied")}</option>
                <option value="Cleaning">{t("admin.cleaning")}</option>
                <option value="Maintenance">{t("admin.maintenance")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("admin.capacity")} *
              </label>
              <input
                type="number"
                min={1}
                value={roomForm.capacity}
                onChange={(e) => setRoomForm({ ...roomForm, capacity: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("admin.pricePerNight")} *
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={roomForm.price}
                onChange={(e) => setRoomForm({ ...roomForm, price: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("roomModal.area")}
              </label>
              <input
                type="number"
                min={1}
                value={roomForm.areaSqm ?? ""}
                onChange={(e) =>
                  setRoomForm({ ...roomForm, areaSqm: e.target.value ? Number(e.target.value) : null })
                }
                className={inputClass}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("roomModal.bedType")}
              </label>
              <input
                type="text"
                value={roomForm.bedType ?? ""}
                onChange={(e) => setRoomForm({ ...roomForm, bedType: e.target.value || null })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("roomModal.view")}
              </label>
              <input
                type="text"
                value={roomForm.viewType ?? ""}
                onChange={(e) => setRoomForm({ ...roomForm, viewType: e.target.value || null })}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t("admin.description")}
            </label>
            <textarea
              value={roomForm.description}
              onChange={(e) => setRoomForm({ ...roomForm, description: e.target.value })}
              rows={3}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t("admin.amenities")}
            </label>
            <input
              type="text"
              value={amenitiesInput}
              onChange={(e) => setAmenitiesInput(e.target.value)}
              className={inputClass}
              placeholder={t("admin.amenitiesPlaceholder")}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">{room.category}</span>
            <span
              className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${ROOM_STATUS_COLORS[room.status]}`}
            >
              {room.status}
            </span>
            {currentBooking && (
              <span className="text-xs text-blue-600 dark:text-blue-300">
                {t("roomModal.currentGuest", { name: currentBooking.guestName })}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 min-h-[220px]">
              <img
                src={photoUrl}
                alt={t("roomModal.roomPhotoAlt", { number: room.number })}
                className="w-full h-full object-cover min-h-[220px]"
              />
            </div>
            <div className="space-y-2 text-sm">
              {[
                [t("roomModal.category"), room.category],
                [t("roomModal.area"), `${display?.areaSqm} m²`],
                [t("roomModal.capacity"), t("admin.people", { count: String(room.capacity) })],
                [t("roomModal.bedType"), display?.bedType],
                [t("roomModal.view"), display?.viewType],
                [t("roomModal.floor"), t("roomModal.floorValue", { floor: String(display?.floor ?? 1) })],
                [t("admin.roomNumber"), room.number],
                [t("admin.price"), `${room.price.toLocaleString(locale)} ${t("admin.perNight")}`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                  <span className="text-gray-500 dark:text-gray-400">{label}</span>
                  <span className="font-medium text-gray-900 dark:text-white text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {room.description && (
            <p className="text-sm text-gray-600 dark:text-gray-300">{room.description}</p>
          )}

          {room.amenities && room.amenities.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
                {t("roomModal.amenities")}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {room.amenities.map((amenity) => (
                  <div
                    key={amenity}
                    className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-2 py-3 text-center"
                  >
                    <span className="text-xl">{getAmenityIcon(amenity)}</span>
                    <span className="text-xs text-gray-700 dark:text-gray-300">{amenity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {t("roomModal.roomTasks")}
                </h3>
                <div className="flex gap-1">
                  {(
                    [
                      { tab: "active" as const, label: t("roomModal.tabActive"), count: activeCount },
                      { tab: "planned" as const, label: t("roomModal.tabPlanned"), count: plannedCount },
                      { tab: "completed" as const, label: t("roomModal.tabCompleted"), count: completedCount },
                    ]
                  ).map(({ tab, label, count }) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setTaskTab(tab)}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${
                        taskTab === tab
                          ? "bg-amber-700 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {label} ({count})
                    </button>
                  ))}
                </div>
              </div>

              {loadingTasks ? (
                <p className="text-sm text-gray-500">{t("common.loading")}</p>
              ) : filteredTasks.length === 0 ? (
                <Card padding="sm">
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    {t("roomModal.noTasks")}
                  </p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {filteredTasks.map((task) => (
                    <Card key={task.id} padding="sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {taskTypeLabel(task.taskType)}
                            </span>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${PRIORITY_BADGE[task.priority]}`}>
                              {task.priority}
                            </span>
                          </div>
                          {task.notes && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">{task.notes}</p>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {task.assignedToName || t("admin.notAssigned")}
                            {task.dueAt ? ` · ${formatDateTime(task.dueAt)}` : ""}
                          </p>
                        </div>
                        {task.status !== "Completed" && (
                          <Button variant="secondary" size="sm" onClick={() => void handleCompleteTask(task.id)}>
                            {t("admin.markComplete")}
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <Card padding="sm" className="h-fit">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
                {t("roomModal.createTask")}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t("roomModal.taskType")}
                  </label>
                  <select value={taskType} onChange={(e) => setTaskType(e.target.value as TaskType)} className={inputClass}>
                    <option value="cleaning">{t("roomModal.taskTypeCleaning")}</option>
                    <option value="maintenance">{t("roomModal.taskTypeMaintenance")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t("roomModal.description")}
                  </label>
                  <textarea
                    value={taskNotes}
                    onChange={(e) => setTaskNotes(e.target.value)}
                    rows={2}
                    className={inputClass}
                    placeholder={t("roomModal.descriptionPlaceholder")}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t("roomModal.checklist")}
                  </label>
                  <textarea
                    value={checklistInput}
                    onChange={(e) => setChecklistInput(e.target.value)}
                    rows={4}
                    className={inputClass}
                    placeholder={t("roomModal.checklistPlaceholder")}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("roomModal.checklistHint")}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t("admin.priority")}
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    className={inputClass}
                  >
                    <option value="Low">{t("priorities.Low")}</option>
                    <option value="Medium">{t("priorities.Medium")}</option>
                    <option value="High">{t("priorities.High")}</option>
                    <option value="Urgent">{t("priorities.Urgent")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {t("roomModal.assignee")}
                  </label>
                  <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={inputClass}>
                    <option value="">{t("roomModal.autoAssign")}</option>
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      {t("roomModal.deadlineDate")}
                    </label>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      {t("roomModal.deadlineTime")}
                    </label>
                    <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <Button variant="primary" size="sm" fullWidth onClick={() => void handleCreateTask()} disabled={submitting}>
                  {t("roomModal.createTask")}
                </Button>
              </div>
            </Card>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {t("roomModal.history")}
              </h3>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHistory((value) => !value)}
                  className="text-xs text-amber-700 dark:text-amber-400 hover:underline"
                >
                  {showHistory ? t("roomModal.hideHistory") : t("roomModal.viewAllHistory")}
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t("roomModal.noHistory")}</p>
            ) : (
              <div className="space-y-2">
                {(showHistory ? history : history.slice(0, 3)).map((event, index) => (
                  <div
                    key={`${event.date}-${index}`}
                    className="flex items-center justify-between gap-3 text-sm border-b border-gray-100 dark:border-gray-700 pb-2"
                  >
                    <span className="text-gray-500 dark:text-gray-400">{formatDateTime(event.date)}</span>
                    <span className="text-gray-800 dark:text-gray-200">{event.label}</span>
                    <span className="text-gray-600 dark:text-gray-300">{event.actor ?? "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" size="sm" fullWidth onClick={() => onViewChange("edit")}>
              {t("admin.edit")}
            </Button>
            <Button variant="danger" size="sm" fullWidth onClick={() => onMaintenance(room)}>
              {t("admin.dangerZone")}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

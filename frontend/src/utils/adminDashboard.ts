import type { Booking } from "../mocks/bookings";
import type { CleaningTask } from "../mocks/tasks";
import type { Room } from "../mocks/rooms";

export function todayDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isoDatePart(value: string): string {
  return value.split("T")[0] ?? value;
}

export function getActiveGuestName(roomId: number, bookings: Booking[]): string | null {
  const active = bookings.find(
    (booking) =>
      booking.roomId === roomId &&
      (booking.status === "Checked-in" || booking.status === "Confirmed" || booking.status === "Upcoming")
  );
  return active?.guestName ?? null;
}

export interface TodaySummary {
  checkIns: number;
  checkOuts: number;
  cleanings: number;
  maintenance: number;
}

export function buildTodaySummary(
  rooms: Room[],
  bookings: Booking[],
  tasks: CleaningTask[]
): TodaySummary {
  const today = todayDateStr();
  const checkIns = bookings.filter(
    (b) => isoDatePart(b.checkIn) === today && b.status !== "Cancelled" && b.status !== "Expired"
  ).length;
  const checkOuts = bookings.filter(
    (b) => isoDatePart(b.checkOut) === today && b.status !== "Cancelled" && b.status !== "Expired"
  ).length;
  const cleanings = Math.max(
    rooms.filter((r) => r.status === "Cleaning").length,
    tasks.filter(
      (t) =>
        (t.status === "Pending" || t.status === "In Progress") &&
        (t.taskType === "cleaning" || !t.taskType)
    ).length
  );
  const maintenance = rooms.filter((r) => r.status === "Maintenance").length;

  return { checkIns, checkOuts, cleanings, maintenance };
}

export interface ActivityItem {
  id: string;
  icon: string;
  text: string;
  timeLabel: string;
  sortKey: number;
}

export function buildRecentActivity(
  rooms: Room[],
  bookings: Booking[],
  tasks: CleaningTask[],
  locale: string,
  labels: {
    roomCheckedIn: (room: string) => string;
    roomCleaning: (room: string) => string;
    roomMaintenance: (room: string) => string;
    taskCompleted: (room: string) => string;
    bookingCreated: (room: string, guest: string) => string;
  }
): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const booking of bookings) {
    const sortKey = new Date(booking.createdAt).getTime();
    if (booking.status === "Checked-in") {
      items.push({
        id: `booking-in-${booking.id}`,
        icon: "🟢",
        text: labels.roomCheckedIn(booking.roomNumber),
        timeLabel: formatTimeLabel(booking.checkIn, locale),
        sortKey,
      });
    } else if (booking.status === "Confirmed" || booking.status === "Upcoming") {
      items.push({
        id: `booking-new-${booking.id}`,
        icon: "📅",
        text: labels.bookingCreated(booking.roomNumber, booking.guestName),
        timeLabel: formatTimeLabel(booking.createdAt, locale),
        sortKey,
      });
    }
  }

  for (const task of tasks) {
    const sortKey = new Date(task.completedAt ?? task.createdAt).getTime();
    if (task.status === "Completed") {
      items.push({
        id: `task-done-${task.id}`,
        icon: "✅",
        text: labels.taskCompleted(task.roomNumber),
        timeLabel: formatTimeLabel(task.completedAt ?? task.createdAt, locale),
        sortKey,
      });
    } else if (task.status === "In Progress") {
      items.push({
        id: `task-active-${task.id}`,
        icon: "🧹",
        text: labels.roomCleaning(task.roomNumber),
        timeLabel: formatTimeLabel(task.createdAt, locale),
        sortKey,
      });
    }
  }

  for (const room of rooms) {
    if (room.status === "Maintenance") {
      items.push({
        id: `room-maint-${room.id}`,
        icon: "🔧",
        text: labels.roomMaintenance(room.number),
        timeLabel: "",
        sortKey: 0,
      });
    }
  }

  return items
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 6);
}

function formatTimeLabel(iso: string, locale: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function totalPages(count: number, pageSize: number): number {
  return Math.max(1, Math.ceil(count / pageSize));
}

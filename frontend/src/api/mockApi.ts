// Mock API for working without backend
import { mockRooms, type Room } from "../mocks/rooms";
import {
  DEFAULT_TASK_CHECKLIST_LABELS,
  mockTasks,
  type CleaningTask,
  type CreateTaskPayload,
} from "../mocks/tasks";
import { getGuestByToken, type GuestToken } from "../mocks/guest";
import { mockBookings, type Booking } from "../mocks/bookings";

// Flag for switching between mock and real API
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === "true" || import.meta.env.VITE_USE_MOCK_API !== "false"; // Default true if not explicitly set to false

// Network delay simulation
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const mockApi = {
  // Rooms API
  rooms: {
    getAll: async (): Promise<Room[]> => {
      await delay(500);
      return [...mockRooms];
    },

    getById: async (id: number): Promise<Room | null> => {
      await delay(300);
      return mockRooms.find((room) => room.id === id) || null;
    },

    update: async (id: number, data: Partial<Room>): Promise<Room> => {
      await delay(400);
      const index = mockRooms.findIndex((r) => r.id === id);
      if (index === -1) throw new Error("Room not found");
      mockRooms[index] = { ...mockRooms[index], ...data };
      return mockRooms[index];
    },

    create: async (data: Omit<Room, "id">): Promise<Room> => {
      await delay(400);
      const newRoom: Room = {
        ...data,
        id: Math.max(...mockRooms.map((r) => r.id)) + 1,
      };
      mockRooms.push(newRoom);
      return newRoom;
    },

    delete: async (id: number): Promise<void> => {
      await delay(300);
      const index = mockRooms.findIndex((r) => r.id === id);
      if (index === -1) throw new Error("Room not found");
      mockRooms.splice(index, 1);
    },
  },

  // Tasks API
  tasks: {
    getAll: async (): Promise<CleaningTask[]> => {
      await delay(500);
      return [...mockTasks];
    },

    getById: async (id: number): Promise<CleaningTask | null> => {
      await delay(300);
      return mockTasks.find((task) => task.id === id) || null;
    },

    getByRoomId: async (roomId: number): Promise<CleaningTask[]> => {
      await delay(300);
      return mockTasks.filter((task) => task.roomId === roomId);
    },

    create: async (payload: CreateTaskPayload): Promise<CleaningTask> => {
      await delay(400);
      const isPlanned = payload.dueAt ? new Date(payload.dueAt) > new Date() : false;
      const labels = payload.checklistItems?.filter(Boolean) ?? [...DEFAULT_TASK_CHECKLIST_LABELS];
      const newTask: CleaningTask = {
        id: Math.max(...mockTasks.map((t) => t.id), 0) + 1,
        roomId: payload.roomId,
        roomNumber: payload.roomNumber,
        status: isPlanned ? "Pending" : payload.staffId ? "In Progress" : "Pending",
        priority: payload.priority ?? "Medium",
        taskType: payload.taskType ?? "cleaning",
        assignedTo: payload.staffId,
        assignedToName: payload.staffName,
        createdAt: new Date().toISOString(),
        dueAt: payload.dueAt ?? null,
        notes: payload.notes,
        checklist: labels.map((label, index) => ({
          id: String(index),
          label,
          checked: false,
        })),
      };
      mockTasks.push(newTask);
      return newTask;
    },

    updateChecklistItem: async (taskId: number, itemId: string, checked: boolean): Promise<CleaningTask> => {
      await delay(200);
      const task = mockTasks.find((t) => t.id === taskId);
      if (!task) throw new Error("Task not found");
      if (!task.checklist?.length) {
        task.checklist = DEFAULT_TASK_CHECKLIST_LABELS.map((label, index) => ({
          id: String(index),
          label,
          checked: false,
        }));
      }
      task.checklist = task.checklist.map((item) =>
        item.id === itemId ? { ...item, checked } : item
      );
      if (task.status === "Pending") task.status = "In Progress";
      return task;
    },

    update: async (id: number, data: Partial<CleaningTask>): Promise<CleaningTask> => {
      await delay(400);
      const task = mockTasks.find((t) => t.id === id);
      if (!task) throw new Error("Task not found");
      return { ...task, ...data };
    },

    assign: async (taskId: number, staffId: number, staffName: string): Promise<CleaningTask> => {
      await delay(400);
      const task = mockTasks.find((t) => t.id === taskId);
      if (!task) throw new Error("Task not found");
      task.assignedTo = staffId;
      task.assignedToName = staffName;
      task.status = "In Progress";
      return task;
    },

    complete: async (taskId: number): Promise<CleaningTask> => {
      await delay(400);
      const task = mockTasks.find((t) => t.id === taskId);
      if (!task) throw new Error("Task not found");
      task.status = "Completed";
      task.completedAt = new Date().toISOString();
      return task;
    },

    delete: async (taskId: number): Promise<void> => {
      await delay(300);
      const index = mockTasks.findIndex((t) => t.id === taskId);
      if (index === -1) throw new Error("Task not found");
      mockTasks.splice(index, 1);
    },
  },

  // Guest API
  guest: {
    getByToken: async (token: string): Promise<GuestToken | null> => {
      await delay(300);
      return getGuestByToken(token);
    },

    checkOut: async (token: string): Promise<void> => {
      await delay(500);
      const guest = getGuestByToken(token);
      if (!guest) throw new Error("Invalid token");
      // Update access status to "Checked out"
      guest.accessStatus = "Checked out";
      guest.isValid = false;
      // In real API, here would be updating room status and creating a task
    },
  },

  // Bookings API
  bookings: {
    getAll: async (): Promise<Booking[]> => {
      await delay(500);
      return [...mockBookings];
    },

    getById: async (id: number): Promise<Booking | null> => {
      await delay(300);
      return mockBookings.find((booking) => booking.id === id) || null;
    },

    create: async (data: Omit<Booking, "id" | "createdAt">): Promise<Booking> => {
      await delay(400);
      const newBooking: Booking = {
        ...data,
        id: Math.max(...mockBookings.map((b) => b.id), 0) + 1,
        createdAt: new Date().toISOString(),
      };
      mockBookings.push(newBooking);
      return newBooking;
    },

    update: async (id: number, data: Partial<Booking>): Promise<Booking> => {
      await delay(400);
      const booking = mockBookings.find((b) => b.id === id);
      if (!booking) throw new Error("Booking not found");
      return { ...booking, ...data };
    },

    delete: async (id: number): Promise<void> => {
      await delay(300);
      const index = mockBookings.findIndex((b) => b.id === id);
      if (index === -1) throw new Error("Booking not found");
      mockBookings.splice(index, 1);
    },
  },
};

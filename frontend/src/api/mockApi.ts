// Mock API для работы без backend
import { mockRooms, type Room } from "../mocks/rooms";
import { mockTasks, type CleaningTask } from "../mocks/tasks";
import { getGuestByToken, type GuestToken } from "../mocks/guest";

// Флаг для переключения между моками и реальным API
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === "true" || true; // По умолчанию true

// Имитация задержки сети
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
      const room = mockRooms.find((r) => r.id === id);
      if (!room) throw new Error("Room not found");
      return { ...room, ...data };
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
      // В реальном API здесь будет обновление статуса комнаты и создание задачи
    },
  },
};

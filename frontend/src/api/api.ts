// Унифицированный API клиент - автоматически переключается между моками и реальным API
import http from "./http";
import { mockApi, USE_MOCK_API } from "./mockApi";
import type { Room } from "../mocks/rooms";
import type { CleaningTask } from "../mocks/tasks";
import type { GuestToken } from "../mocks/guest";

// Rooms API
export const roomsApi = {
  getAll: async (): Promise<Room[]> => {
    if (USE_MOCK_API) {
      return mockApi.rooms.getAll();
    }
    const response = await http.get("/rooms");
    return response.data;
  },

  getById: async (id: number): Promise<Room | null> => {
    if (USE_MOCK_API) {
      return mockApi.rooms.getById(id);
    }
    const response = await http.get(`/rooms/${id}`);
    return response.data;
  },

  create: async (data: Omit<Room, "id">): Promise<Room> => {
    if (USE_MOCK_API) {
      return mockApi.rooms.create(data);
    }
    const response = await http.post("/rooms", data);
    return response.data;
  },

  update: async (id: number, data: Partial<Room>): Promise<Room> => {
    if (USE_MOCK_API) {
      return mockApi.rooms.update(id, data);
    }
    const response = await http.patch(`/rooms/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    if (USE_MOCK_API) {
      return mockApi.rooms.delete(id);
    }
    await http.delete(`/rooms/${id}`);
  },
};

// Tasks API
export const tasksApi = {
  getAll: async (): Promise<CleaningTask[]> => {
    if (USE_MOCK_API) {
      return mockApi.tasks.getAll();
    }
    const response = await http.get("/tasks");
    return response.data;
  },

  getById: async (id: number): Promise<CleaningTask | null> => {
    if (USE_MOCK_API) {
      return mockApi.tasks.getById(id);
    }
    const response = await http.get(`/tasks/${id}`);
    return response.data;
  },

  getByRoomId: async (roomId: number): Promise<CleaningTask[]> => {
    if (USE_MOCK_API) {
      return mockApi.tasks.getByRoomId(roomId);
    }
    const response = await http.get(`/tasks?room_id=${roomId}`);
    return response.data;
  },

  assign: async (taskId: number, staffId: number, staffName: string): Promise<CleaningTask> => {
    if (USE_MOCK_API) {
      return mockApi.tasks.assign(taskId, staffId, staffName);
    }
    const response = await http.patch(`/tasks/${taskId}/assign`, { staffId, staffName });
    return response.data;
  },

  complete: async (taskId: number): Promise<CleaningTask> => {
    if (USE_MOCK_API) {
      return mockApi.tasks.complete(taskId);
    }
    const response = await http.patch(`/tasks/${taskId}/complete`);
    return response.data;
  },
};

// Guest API
export const guestApi = {
  getByToken: async (token: string): Promise<GuestToken | null> => {
    if (USE_MOCK_API) {
      return mockApi.guest.getByToken(token);
    }
    const response = await http.get(`/guest/${token}`);
    return response.data;
  },

  checkOut: async (token: string): Promise<void> => {
    if (USE_MOCK_API) {
      return mockApi.guest.checkOut(token);
    }
    await http.post(`/guest/${token}/checkout`);
  },
};

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    if (USE_MOCK_API) {
      // Mock логин - возвращает токен и роль
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (email === "admin@nextstay.com" && password === "admin") {
        return {
          token: "mock-admin-token",
          role: "OWNER" as const,
          user: { id: 1, email, name: "Admin User" },
        };
      }
      if (email === "staff@nextstay.com" && password === "staff") {
        return {
          token: "mock-staff-token",
          role: "STAFF" as const,
          user: { id: 2, email, name: "Staff User" },
        };
      }
      throw new Error("Invalid credentials");
    }
    const response = await http.post("/auth/login", { email, password });
    return response.data;
  },

  logout: async () => {
    if (USE_MOCK_API) {
      return;
    }
    await http.post("/auth/logout");
  },
};

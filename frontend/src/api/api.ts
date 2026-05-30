// Unified API client - automatically switches between mock and real API
import http from "./http";
import { mockApi, USE_MOCK_API } from "./mockApi";
import type { Room } from "../mocks/rooms";
import type { CleaningTask } from "../mocks/tasks";
import type { GuestToken } from "../mocks/guest";
import type { Booking } from "../mocks/bookings";

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

  getAvailable: async (checkIn: string, checkOut: string, category?: string, capacity?: number) => {
    if (USE_MOCK_API) {
      // Mock implementation - return all available rooms
      const rooms = await mockApi.rooms.getAll();
      return {
        availableRooms: rooms.filter(r => r.status === "Available"),
        checkIn,
        checkOut,
      };
    }
    const params = new URLSearchParams({ checkIn, checkOut });
    if (category) params.append("category", category);
    if (capacity) params.append("capacity", capacity.toString());
    const response = await http.get(`/rooms/available?${params.toString()}`);
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

  create: async (roomId: number, roomNumber: string, priority: "Low" | "Medium" | "High" = "Medium", notes?: string): Promise<CleaningTask> => {
    if (USE_MOCK_API) {
      return mockApi.tasks.create(roomId, roomNumber, priority, notes);
    }
    const response = await http.post("/tasks", { roomId, roomNumber, priority, notes });
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

  delete: async (taskId: number): Promise<void> => {
    if (USE_MOCK_API) {
      return mockApi.tasks.delete(taskId);
    }
    await http.delete(`/tasks/${taskId}`);
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
export interface MeResponse {
  id: number;
  email: string;
  name: string;
  role: "OWNER" | "STAFF";
  companyCode: string | null;
}

export interface StaffUserSummary {
  id: number;
  fullName: string;
  email: string;
}

export const authApi = {
  login: async (email: string, password: string) => {
    if (USE_MOCK_API) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      if (email.includes("staff")) {
        return {
          token: "mock-staff-token",
          role: "STAFF" as const,
          user: { id: 2, email, name: "Staff User" },
        };
      }
      return {
        token: "mock-owner-token",
        role: "OWNER" as const,
        user: { id: 1, email, name: "Owner User" },
      };
    }
    const response = await http.post("/auth/login", { email, password });
    return response.data;
  },

  register: async (payload: {
    email: string;
    fullName: string;
    password: string;
    role: "OWNER" | "STAFF";
  }) => {
    if (USE_MOCK_API) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        token: "mock-register-token",
        role: payload.role,
        user: { id: Date.now(), email: payload.email, name: payload.fullName },
      };
    }
    const response = await http.post("/auth/register", payload);
    return response.data;
  },

  requestOtp: async (email: string) => {
    if (USE_MOCK_API) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { message: "Mock OTP sent", retryAfterSeconds: null };
    }
    const response = await http.post("/auth/request-otp", { email });
    return response.data;
  },

  verifyOtp: async (email: string, code: string) => {
    if (USE_MOCK_API) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (!/^\d{6}$/.test(code)) throw new Error("OTP must be 6 digits");
      if (email === "staff@nextstay.com") {
        return {
          token: "mock-staff-token",
          role: "STAFF" as const,
          user: { id: 2, email, name: "Staff User" },
        };
      }
      return {
        token: "mock-admin-token",
        role: "OWNER" as const,
        user: { id: 1, email, name: "Admin User" },
      };
    }
    const response = await http.post("/auth/verify-otp", { email, code });
    return response.data;
  },

  logout: async () => {
    if (USE_MOCK_API) {
      return;
    }
    await http.post("/auth/logout");
  },

  me: async (): Promise<MeResponse> => {
    const response = await http.get("/auth/me");
    return response.data;
  },

  updateMe: async (payload: { fullName: string }): Promise<MeResponse> => {
    const response = await http.patch("/auth/me", payload);
    return response.data;
  },
};

export const usersApi = {
  getStaffInCompany: async (): Promise<StaffUserSummary[]> => {
    const response = await http.get("/users/staff");
    return response.data;
  },
};

// Bookings API
export const bookingsApi = {
  getAll: async (): Promise<Booking[]> => {
    if (USE_MOCK_API) {
      return mockApi.bookings.getAll();
    }
    const response = await http.get("/bookings");
    return response.data;
  },

  getPage: async (
    params: { limit: number; offset: number; status?: string; search?: string }
  ): Promise<{ items: Booking[]; total: number }> => {
    if (USE_MOCK_API) {
      return mockApi.bookings.getPage(params);
    }
    const query = new URLSearchParams({
      limit: String(params.limit),
      offset: String(params.offset),
    });
    if (params.status) {
      query.set("status", params.status);
    }
    if (params.search) {
      query.set("search", params.search);
    }
    const response = await http.get(`/bookings?${query.toString()}`);
    const totalHeader = response.headers["x-total-count"];
    const total = Number(totalHeader ?? response.data.length ?? 0);
    return {
      items: response.data,
      total: Number.isFinite(total) ? total : 0,
    };
  },

  getById: async (id: number): Promise<Booking | null> => {
    if (USE_MOCK_API) {
      return mockApi.bookings.getById(id);
    }
    const response = await http.get(`/bookings/${id}`);
    return response.data;
  },

  create: async (data: Omit<Booking, "id" | "createdAt"> & { email?: string }): Promise<Booking> => {
    if (USE_MOCK_API) {
      return mockApi.bookings.create(data);
    }
    const response = await http.post("/bookings", data);
    return response.data;
  },

  update: async (id: number, data: Partial<Booking>): Promise<Booking> => {
    if (USE_MOCK_API) {
      return mockApi.bookings.update(id, data);
    }
    const response = await http.patch(`/bookings/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    if (USE_MOCK_API) {
      return mockApi.bookings.delete(id);
    }
    await http.delete(`/bookings/${id}`);
  },
};

// Stripe API
export const stripeApi = {
  createCheckoutSession: async (bookingId: number) => {
    if (USE_MOCK_API) {
      // Mock - return a fake checkout URL
      return {
        session_id: "mock_session_123",
        url: "https://checkout.stripe.com/mock",
      };
    }
    const response = await http.post("/stripe/create-checkout-session", {
      booking_id: bookingId,
    });
    return response.data;
  },

  /** Подтвердить оплату по session_id и получить бронирование с guest token (для страницы успеха) */
  confirmAndGetBooking: async (sessionId: string): Promise<Booking> => {
    if (USE_MOCK_API) {
      const list = await mockApi.bookings.getAll();
      const b = list[0];
      return { ...b, guestToken: "guest-token-mock", status: "Confirmed" } as Booking;
    }
    const response = await http.get(
      `/stripe/confirm-and-get-booking?session_id=${encodeURIComponent(sessionId)}`
    );
    return response.data;
  },
};

export interface ReportsOverviewResponse {
  companyCode: string | null;
  days: number;
  kpis: {
    totalRevenue: number;
    bookingsCount: number;
    avgOccupancyRate: number;
    avgAdr: number;
    avgRevpar: number;
  };
  revparTrend: Array<{
    company_code: string;
    date_day: string;
    total_revenue: number;
    revpar: number;
    occupancy_rate: number;
  }>;
  roomTypeRevenue: Array<{
    company_code: string;
    room_type: string;
    total_revenue: number;
    bookings_count: number;
    avg_adr: number;
  }>;
  tasksTrend: Array<{
    company_code: string;
    date_day: string;
    tasks_created: number;
    tasks_completed: number;
    completion_rate: number;
  }>;
  loyalty: Array<{
    company_code: string;
    loyalty_tier: string;
    customers: number;
  }>;
}

export const reportsApi = {
  getOverview: async (companyCode?: string, days = 30): Promise<ReportsOverviewResponse> => {
    if (USE_MOCK_API) {
      return {
        companyCode: companyCode || null,
        days,
        kpis: {
          totalRevenue: 124500,
          bookingsCount: 680,
          avgOccupancyRate: 72.4,
          avgAdr: 183.1,
          avgRevpar: 132.6,
        },
        revparTrend: [],
        roomTypeRevenue: [],
        tasksTrend: [],
        loyalty: [],
      };
    }

    const params = new URLSearchParams({ days: String(days) });
    if (companyCode) params.append("companyCode", companyCode);
    const response = await http.get(`/reports/overview?${params.toString()}`);
    return response.data;
  },
};

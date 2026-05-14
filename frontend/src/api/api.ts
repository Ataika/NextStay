// Unified API client - automatically switches between mock and real API
import http from "./http";
import { mockApi, USE_MOCK_API } from "./mockApi";
import type { Room } from "../mocks/rooms";
import type { CleaningTask } from "../mocks/tasks";
import type { GuestToken } from "../mocks/guest";
import type { Booking } from "../mocks/bookings";
import { useAuthStore } from "../store/authStore";

export interface PricingLabHotelOption {
  hotelId: number;
  hotelName: string;
  hotelSegment: string;
}

export interface PricingLabPublishedRow {
  hotelId: number;
  hotelName: string;
  hotelSegment: string;
  roomTypeId: number;
  roomTypeName: string;
  stayDate: string;
  snapshotDate: string;
  basePrice: number | null;
  dynamicPrice: number;
  priceDeltaPct: number | null;
  offeredPrice: number | null;
  availableRooms: number | null;
  bookedRooms: number | null;
  totalInventory: number | null;
  occupancyRate: number | null;
  modelVersion: string | null;
  rulesVersion: string | null;
  inRollout: number | null;
  inferenceStatus: string | null;
}

export interface PricingLabPublishedResponse {
  hotelId: number | null;
  stayDate: string | null;
  availableHotels: PricingLabHotelOption[];
  rows: PricingLabPublishedRow[];
}

export interface PricingLabDecisionResponse {
  published: Record<string, unknown>;
  decision: Record<string, unknown> | null;
  context: Record<string, unknown> | null;
  ruleMetadata: Record<string, unknown>;
}

const DEV_OWNER_TOKEN = "mock-admin-token";
const DEV_LOGIN_EMAIL = (import.meta.env.VITE_DEV_LOGIN_EMAIL ?? "").trim().toLowerCase();
const DEV_LOGIN_PASSWORD = import.meta.env.VITE_DEV_LOGIN_PASSWORD ?? "";
const DEV_LOGIN_NAME = (import.meta.env.VITE_DEV_LOGIN_NAME ?? "NextStay Owner").trim() || "NextStay Owner";
const DEV_AUTO_LOGIN_ENABLED = import.meta.env.VITE_AUTO_LOGIN_ENABLED === "true";

export const devLoginConfig = {
  enabled: DEV_LOGIN_EMAIL.length > 0 && DEV_LOGIN_PASSWORD.length > 0,
  autoLoginEnabled:
    DEV_AUTO_LOGIN_ENABLED && DEV_LOGIN_EMAIL.length > 0 && DEV_LOGIN_PASSWORD.length > 0,
  email: DEV_LOGIN_EMAIL,
  password: DEV_LOGIN_PASSWORD,
  name: DEV_LOGIN_NAME,
};

function shouldUseLiveOwnerApi(): boolean {
  return useAuthStore.getState().token === DEV_OWNER_TOKEN;
}

// Rooms API
export const roomsApi = {
  getAll: async (): Promise<Room[]> => {
    if (USE_MOCK_API && !shouldUseLiveOwnerApi()) {
      return mockApi.rooms.getAll();
    }
    const response = await http.get("/rooms");
    return response.data;
  },

  getById: async (id: number): Promise<Room | null> => {
    if (USE_MOCK_API && !shouldUseLiveOwnerApi()) {
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
    if (USE_MOCK_API && !shouldUseLiveOwnerApi()) {
      return mockApi.rooms.create(data);
    }
    const response = await http.post("/rooms", data);
    return response.data;
  },

  update: async (id: number, data: Partial<Room>): Promise<Room> => {
    if (USE_MOCK_API && !shouldUseLiveOwnerApi()) {
      return mockApi.rooms.update(id, data);
    }
    const response = await http.patch(`/rooms/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    if (USE_MOCK_API && !shouldUseLiveOwnerApi()) {
      return mockApi.rooms.delete(id);
    }
    await http.delete(`/rooms/${id}`);
  },
};

// Tasks API
export const tasksApi = {
  getAll: async (): Promise<CleaningTask[]> => {
    if (USE_MOCK_API && !shouldUseLiveOwnerApi()) {
      return mockApi.tasks.getAll();
    }
    const response = await http.get("/tasks");
    return response.data;
  },

  getById: async (id: number): Promise<CleaningTask | null> => {
    if (USE_MOCK_API && !shouldUseLiveOwnerApi()) {
      return mockApi.tasks.getById(id);
    }
    const response = await http.get(`/tasks/${id}`);
    return response.data;
  },

  getByRoomId: async (roomId: number): Promise<CleaningTask[]> => {
    if (USE_MOCK_API && !shouldUseLiveOwnerApi()) {
      return mockApi.tasks.getByRoomId(roomId);
    }
    const response = await http.get(`/tasks?room_id=${roomId}`);
    return response.data;
  },

  create: async (roomId: number, roomNumber: string, priority: "Low" | "Medium" | "High" = "Medium", notes?: string): Promise<CleaningTask> => {
    if (USE_MOCK_API && !shouldUseLiveOwnerApi()) {
      return mockApi.tasks.create(roomId, roomNumber, priority, notes);
    }
    const response = await http.post("/tasks", { roomId, roomNumber, priority, notes });
    return response.data;
  },

  assign: async (taskId: number, staffId: number, staffName: string): Promise<CleaningTask> => {
    if (USE_MOCK_API && !shouldUseLiveOwnerApi()) {
      return mockApi.tasks.assign(taskId, staffId, staffName);
    }
    const response = await http.patch(`/tasks/${taskId}/assign`, { staffId, staffName });
    return response.data;
  },

  complete: async (taskId: number): Promise<CleaningTask> => {
    if (USE_MOCK_API && !shouldUseLiveOwnerApi()) {
      return mockApi.tasks.complete(taskId);
    }
    const response = await http.patch(`/tasks/${taskId}/complete`);
    return response.data;
  },

  delete: async (taskId: number): Promise<void> => {
    if (USE_MOCK_API && !shouldUseLiveOwnerApi()) {
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
export const authApi = {
  devLogin: async (email: string, password: string) => {
    await new Promise((resolve) => setTimeout(resolve, 200));

    if (!devLoginConfig.enabled) {
      throw new Error("Dev password login is not configured.");
    }

    if (email.trim().toLowerCase() !== DEV_LOGIN_EMAIL || password !== DEV_LOGIN_PASSWORD) {
      throw new Error("Invalid email or password.");
    }

    return {
      token: DEV_OWNER_TOKEN,
      role: "OWNER" as const,
      user: { id: 1, email: DEV_LOGIN_EMAIL, name: DEV_LOGIN_NAME },
    };
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
};

// Bookings API
export const bookingsApi = {
  getAll: async (): Promise<Booking[]> => {
    if (USE_MOCK_API && !shouldUseLiveOwnerApi()) {
      return mockApi.bookings.getAll();
    }
    const response = await http.get("/bookings");
    return response.data;
  },

  getById: async (id: number): Promise<Booking | null> => {
    if (USE_MOCK_API && !shouldUseLiveOwnerApi()) {
      return mockApi.bookings.getById(id);
    }
    const response = await http.get(`/bookings/${id}`);
    return response.data;
  },

  create: async (data: Omit<Booking, "id" | "createdAt"> & { email?: string }): Promise<Booking> => {
    if (USE_MOCK_API && !shouldUseLiveOwnerApi()) {
      return mockApi.bookings.create(data);
    }
    const response = await http.post("/bookings", data);
    return response.data;
  },

  update: async (id: number, data: Partial<Booking>): Promise<Booking> => {
    if (USE_MOCK_API && !shouldUseLiveOwnerApi()) {
      return mockApi.bookings.update(id, data);
    }
    const response = await http.patch(`/bookings/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    if (USE_MOCK_API && !shouldUseLiveOwnerApi()) {
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

// ---------------------------------------------------------------------------
// Training API types
// ---------------------------------------------------------------------------

export interface TrainingHotelOption {
  hotelId: number;
  hotelName: string;
  hotelSegment: string;
}

export interface TrainingJob {
  id: number;
  hotelId: number;
  status: "pending" | "running" | "completed" | "failed";
  triggeredAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  datasetRowCount: number | null;
  modelVersion: string | null;
  configJson: { train_fraction?: number; validation_fraction?: number } | null;
}

export interface ModelRegistryEntry {
  id: number;
  hotelId: number;
  modelVersion: string;
  modelPath: string;
  schemaVersion: string | null;
  metricsJson: Record<string, unknown> | null;
  isActive: boolean;
  rowCount: number | null;
  trainedAt: string;
}

// Training API — always talks to the real backend (owner-only).
export const trainingApi = {
  listHotels: async (): Promise<TrainingHotelOption[]> => {
    const res = await http.get("/training/hotels");
    return res.data;
  },

  uploadAndTrain: async (
    hotelId: number,
    file: File,
    trainFraction = 0.7,
    validationFraction = 0.15,
  ): Promise<TrainingJob> => {
    const form = new FormData();
    form.append("hotel_id", String(hotelId));
    form.append("file", file);
    form.append("train_fraction", String(trainFraction));
    form.append("validation_fraction", String(validationFraction));
    const res = await http.post("/training/upload-and-train", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  listJobs: async (hotelId?: number): Promise<TrainingJob[]> => {
    const res = await http.get("/training/jobs", {
      params: hotelId !== undefined ? { hotel_id: hotelId } : {},
    });
    return res.data;
  },

  getJob: async (jobId: number): Promise<TrainingJob> => {
    const res = await http.get(`/training/jobs/${jobId}`);
    return res.data;
  },

  listModels: async (hotelId?: number): Promise<ModelRegistryEntry[]> => {
    const res = await http.get("/training/models", {
      params: hotelId !== undefined ? { hotel_id: hotelId } : {},
    });
    return res.data;
  },

  promoteModel: async (modelId: number): Promise<ModelRegistryEntry> => {
    const res = await http.post(`/training/models/${modelId}/promote`);
    return res.data;
  },
};

// ---------------------------------------------------------------------------
// Pricing Config API types
// ---------------------------------------------------------------------------

export interface HotelPricingConfig {
  hotelId: number;
  minPrice: number;
  maxPrice: number;
  maxDailyChangePct: number;
  weekendMultiplier: number;
  holidayMultiplier: number;
  rolloutFraction: number;
  configVersion: string;
  updatedAt: string | null;
  activeModelVersion: string | null;
  isDefault: boolean;
}

export interface UpdateHotelPricingConfig {
  minPrice: number;
  maxPrice: number;
  maxDailyChangePct: number;
  weekendMultiplier: number;
  holidayMultiplier: number;
  rolloutFraction: number;
}

// Pricing Config API — always talks to the real backend (owner-only).
export const pricingConfigApi = {
  getConfig: async (hotelId: number): Promise<HotelPricingConfig> => {
    const res = await http.get(`/pricing/config/${hotelId}`);
    return res.data;
  },

  updateConfig: async (
    hotelId: number,
    config: UpdateHotelPricingConfig,
  ): Promise<HotelPricingConfig> => {
    const res = await http.put(`/pricing/config/${hotelId}`, config);
    return res.data;
  },
};

// ---------------------------------------------------------------------------
// Pricing Lab API
// ---------------------------------------------------------------------------

// Pricing Lab API
// This intentionally always uses the real backend so the owner can inspect
// the Postgres-backed pricing pipeline even while other screens stay in mock mode.
export const pricingLabApi = {
  getPublished: async (hotelId?: number, stayDate?: string, limit = 50): Promise<PricingLabPublishedResponse> => {
    const response = await http.get("/pricing-lab/published", {
      params: {
        hotel_id: hotelId,
        stay_date: stayDate,
        limit,
      },
    });
    return response.data;
  },

  getDecision: async (
    hotelId: number,
    roomTypeId: number,
    stayDate: string,
    snapshotDate?: string
  ): Promise<PricingLabDecisionResponse> => {
    const response = await http.get("/pricing-lab/decision", {
      params: {
        hotel_id: hotelId,
        room_type_id: roomTypeId,
        stay_date: stayDate,
        snapshot_date: snapshotDate,
      },
    });
    return response.data;
  },
};

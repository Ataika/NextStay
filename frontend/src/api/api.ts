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

  passwordLogin: async (email: string, password: string) => {
    const response = await http.post("/auth/login", { email, password });
    return response.data as { token: string; role: string; user: { id: number; email: string; name: string } };
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

  updateProfile: async (name: string) => {
    const response = await http.patch("/auth/me", { name });
    return response.data as { name: string; email: string };
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    await http.post("/auth/change-password", { currentPassword, newPassword });
  },

  forgotPassword: async (email: string) => {
    const res = await http.post("/auth/forgot-password", { email });
    return res.data as { message: string; retryAfterSeconds?: number | null };
  },

  resetPassword: async (email: string, code: string, newPassword: string) => {
    await http.post("/auth/reset-password", { email, code, newPassword });
  },

  getPreferences: async (): Promise<{ chat_wallpaper: string | null; preferred_language: "en" | "it" }> => {
    const res = await http.get("/auth/me/preferences");
    return res.data;
  },

  updatePreferences: async (
    prefs: { chat_wallpaper?: string | null; preferred_language?: "en" | "it" }
  ): Promise<{ chat_wallpaper: string | null; preferred_language: "en" | "it" }> => {
    const res = await http.patch("/auth/me/preferences", prefs);
    return res.data;
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
export interface SnapshotSummary {
  snapshot_date: string;
  days_ahead: number;
  rooms_processed: number;
  snapshots_written: number;
  decisions_written: number;
  model_used: string;
  rows_by_category: Record<string, number>;
}

export const pricingPipelineApi = {
  runSnapshot: async (daysAhead = 30): Promise<SnapshotSummary> => {
    const response = await http.post("/pricing/run-snapshot", null, {
      params: { days_ahead: daysAhead },
    });
    return response.data;
  },
};

// ---------------------------------------------------------------------------
// Staff API
// ---------------------------------------------------------------------------

export interface StaffMember {
  id: number;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  hire_date: string | null;
  is_active: boolean;
  annual_days_off: number;
  hours_this_month: number;
  days_off_this_year: number;
}

export interface ShiftResponse {
  id: number;
  staff_id: number;
  shift_date: string;
  shift_type: string;
  hours: number;
  notes: string | null;
}

export const staffApi = {
  list: async (): Promise<StaffMember[]> => {
    const res = await http.get("/staff");
    return res.data;
  },

  create: async (data: {
    name: string;
    role: string;
    email?: string;
    phone?: string;
    hire_date?: string;
    annual_days_off?: number;
  }): Promise<StaffMember> => {
    const res = await http.post("/staff", data);
    return res.data;
  },

  update: async (id: number, data: {
    name?: string;
    role?: string;
    email?: string;
    phone?: string;
    is_active?: boolean;
    annual_days_off?: number;
  }): Promise<StaffMember> => {
    const res = await http.patch(`/staff/${id}`, data);
    return res.data;
  },

  delete: async (id: number): Promise<void> => {
    await http.delete(`/staff/${id}`);
  },

  getSchedule: async (weekStart: string): Promise<ShiftResponse[]> => {
    const res = await http.get("/staff/schedule", { params: { week_start: weekStart } });
    return res.data;
  },

  upsertShift: async (staffId: number, shiftDate: string, shiftType: string): Promise<ShiftResponse> => {
    const res = await http.put("/staff/schedule", {
      staff_id: staffId,
      shift_date: shiftDate,
      shift_type: shiftType,
    });
    return res.data;
  },

  deleteShift: async (shiftId: number): Promise<void> => {
    await http.delete(`/staff/schedule/${shiftId}`);
  },

  getMe: async (): Promise<StaffMember | null> => {
    try {
      const res = await http.get("/staff/me");
      return res.data;
    } catch {
      return null;
    }
  },

  getMySchedule: async (weekStart: string): Promise<ShiftResponse[]> => {
    const res = await http.get("/staff/my-schedule", { params: { week_start: weekStart } });
    return res.data;
  },

  heartbeat: async (): Promise<void> => {
    await http.post("/staff/heartbeat");
  },

  getShiftCode: async (): Promise<{ code: string; expires_in: number }> => {
    const res = await http.get("/staff/shift-code");
    return res.data;
  },

  startShift: async (code: string): Promise<{ started_at: string }> => {
    const res = await http.post("/staff/shift-start", { code });
    return res.data;
  },
};

// ---------------------------------------------------------------------------
// Reservation Holds API
// ---------------------------------------------------------------------------

export interface HoldResponse {
  id: number;
  room_id: number;
  check_in: string;
  check_out: string;
  session_id: string;
  expires_at: string;
}

export const holdsApi = {
  create: async (
    roomId: number,
    checkIn: string,
    checkOut: string,
    sessionId: string,
  ): Promise<HoldResponse> => {
    const response = await http.post("/holds", {
      room_id: roomId,
      check_in: checkIn,
      check_out: checkOut,
      session_id: sessionId,
    });
    return response.data;
  },

  release: async (holdId: number, sessionId: string): Promise<void> => {
    await http.delete(`/holds/${holdId}?session_id=${encodeURIComponent(sessionId)}`);
  },
};

// ---------------------------------------------------------------------------
// Chat API
// ---------------------------------------------------------------------------

export interface ChatMessageItem {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_name: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

export interface ChatParticipant {
  user_id: number;
  name: string;
  email: string;
  role: string;
  online: boolean;
}

export interface ChatConversation {
  id: number;
  kind: "direct" | "group";
  title: string;
  created_by_id: number | null;
  participants: ChatParticipant[];
  last_message_preview: string | null;
  last_message_at: string | null;
}

export interface ChatUserOption {
  id: number;
  name: string;
  email: string;
  role: string;
  online: boolean;
}

export const chatApi = {
  listConversations: async (): Promise<ChatConversation[]> => {
    const res = await http.get("/chat/conversations");
    return res.data;
  },

  getMessages: async (conversationId: number, limit = 100): Promise<ChatMessageItem[]> => {
    const res = await http.get(`/chat/conversations/${conversationId}/messages`, { params: { limit } });
    return res.data;
  },

  searchUsers: async (query: string, limit = 20): Promise<ChatUserOption[]> => {
    const res = await http.get("/chat/users", { params: { query, limit } });
    return res.data;
  },

  openDirectConversation: async (userId: number): Promise<ChatConversation> => {
    const res = await http.post("/chat/conversations/direct", { user_id: userId });
    return res.data;
  },

  createGroupConversation: async (title: string, memberIds: number[]): Promise<ChatConversation> => {
    const res = await http.post("/chat/conversations/group", {
      title,
      member_ids: memberIds,
    });
    return res.data;
  },

  getOnline: async (): Promise<{ id: number; name: string }[]> => {
    const res = await http.get("/chat/online");
    return res.data;
  },

  editMessage: async (messageId: number, content: string): Promise<ChatMessageItem> => {
    const res = await http.patch(`/chat/messages/${messageId}`, { content });
    return res.data;
  },

  deleteMessage: async (messageId: number): Promise<void> => {
    await http.delete(`/chat/messages/${messageId}`);
  },
};

// ---------------------------------------------------------------------------
// Hotel Profile API
// ---------------------------------------------------------------------------

export interface HotelProfileData {
  id: number;
  hotel_name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  currency: string | null;
  phone: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  wifi_name: string | null;
  wifi_password: string | null;
  house_rules: string | null;
}

export const hotelProfileApi = {
  get: async (): Promise<HotelProfileData> => {
    const res = await http.get("/hotel/profile");
    return res.data;
  },

  update: async (data: Partial<Omit<HotelProfileData, "id">>): Promise<HotelProfileData> => {
    const res = await http.patch("/hotel/profile", data);
    return res.data;
  },
};

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

// ---------------------------------------------------------------------------
// Hotel Sync Simulator API
// ---------------------------------------------------------------------------

export interface HotelSimulatorRoom {
  id: number;
  number: string;
  category: string;
  price: number;
  capacity: number;
  description: string | null;
  amenities: string[] | null;
  totalPrice: number;
  nights: number;
}

export interface HotelSyncEventPayload {
  eventId: string;
  hotelId: number;
  source: string;
  type: "booking_created" | "booking_cancelled" | "room_status_updated";
  externalBookingId?: string;
  roomId?: number;
  roomNumber?: string;
  guestName?: string;
  guestEmail?: string;
  checkIn?: string;
  checkOut?: string;
  amountPaid?: number;
  status?: string;
}

export interface HotelSyncResponse {
  eventId: string;
  eventStatus: string;
  action: string;
  bookingId: number | null;
  roomId: number | null;
  roomNumber: string | null;
  externalBookingId: string | null;
  bookingStatus: string | null;
  guestToken: string | null;
  message: string;
}

export interface HotelSyncEventLog {
  id: number;
  hotelId: number;
  externalEventId: string;
  source: string;
  eventType: string;
  status: string;
  error: string | null;
  bookingId: number | null;
  receivedAt: string;
  processedAt: string | null;
}

export interface HotelChannelBookingLog {
  id: number;
  hotelId: number;
  externalBookingId: string;
  bookingId: number | null;
  roomId: number | null;
  roomNumber: string;
  source: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  guestName: string | null;
  guestEmail: string | null;
  syncedAt: string;
  cancelledAt: string | null;
}

const HOTEL_SYNC_TOKEN = import.meta.env.VITE_HOTEL_SYNC_TOKEN || "dev-hotel-sync-token";

export const hotelSyncApi = {
  searchAvailableRooms: async (checkIn: string, checkOut: string): Promise<HotelSimulatorRoom[]> => {
    const response = await http.get("/rooms/available", {
      params: { checkIn, checkOut },
    });
    return response.data.availableRooms || [];
  },

  sendEvent: async (payload: HotelSyncEventPayload): Promise<HotelSyncResponse> => {
    const response = await http.post("/hotel-sync/events", payload, {
      headers: { "X-Hotel-Sync-Token": HOTEL_SYNC_TOKEN },
    });
    return response.data;
  },

  listEvents: async (): Promise<HotelSyncEventLog[]> => {
    const response = await http.get("/hotel-sync/events");
    return response.data;
  },

  listChannelBookings: async (): Promise<HotelChannelBookingLog[]> => {
    const response = await http.get("/hotel-sync/channel-bookings");
    return response.data;
  },
};

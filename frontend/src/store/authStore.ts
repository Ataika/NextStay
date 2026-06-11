import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "OWNER" | "STAFF" | "SYS_ADMIN" | "DIRECTOR" | "MANAGER";

export const ADMIN_ROLES: UserRole[]         = ["OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER"];
export const ENGINE_ROLES: UserRole[]        = ["OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER"];
export const ENGINE_MANAGE_ROLES: UserRole[] = ["OWNER", "SYS_ADMIN"];
export const STAFF_ROLES: UserRole[]         = ["STAFF"];

export function isAdminRole(role: UserRole | null): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

export function canAccessEngine(role: UserRole | null): boolean {
  return !!role && ENGINE_ROLES.includes(role);
}

export function canManageEngine(role: UserRole | null): boolean {
  return !!role && ENGINE_MANAGE_ROLES.includes(role);
}

interface AuthState {
  userId: number | null;
  token: string | null;
  role: UserRole | null;
  email: string | null;
  name: string | null;
  loginTime: string | null;
  staffId: number | null;
  setAuth: (userId: number, token: string, role: UserRole, email: string, name: string) => void;
  setName: (name: string) => void;
  setStaffId: (id: number | null) => void;
  setShiftStart: (time: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      token: null,
      role: null,
      email: null,
      name: null,
      loginTime: null,      // only set when staff explicitly starts their shift
      staffId: null,
      setAuth: (userId, token, role, email, name) =>
        set({ userId, token, role, email, name }),
      setName: (name) => set({ name }),
      setStaffId: (id) => set({ staffId: id }),
      setShiftStart: (time) => set({ loginTime: time }),
      clearAuth: () =>
        set({ userId: null, token: null, role: null, email: null, name: null, loginTime: null, staffId: null }),
    }),
    { name: "auth-storage" }
  )
);

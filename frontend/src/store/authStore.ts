import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "OWNER" | "STAFF";

interface AuthState {
  token: string | null;
  role: UserRole | null;
  setAuth: (token: string, role: UserRole) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      setAuth: (token, role) => set({ token, role }),
      clearAuth: () => set({ token: null, role: null }),
    }),
    { name: "auth-storage" }
  )
);

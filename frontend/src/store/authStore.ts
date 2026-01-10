import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "OWNER" | "STAFF";

interface AuthState {
  token: string | null;
  role: UserRole | null;
  setAuth: (token: string, role: UserRole) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      role: null,
      setAuth: (token: string, role: UserRole) => {
        set({ token, role });
      },
      clearAuth: () => {
        set({ token: null, role: null });
      },
      isAuthenticated: () => {
        return get().token !== null;
      },
    }),
    {
      name: "auth-storage",
    }
  )
);

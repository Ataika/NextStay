import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

interface SettingsState {
  theme: Theme;
  avatar: string | null;
  setTheme: (theme: Theme) => void;
  setAvatar: (avatar: string | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      avatar: null,
      setTheme: (theme) => set({ theme }),
      setAvatar: (avatar) => set({ avatar }),
    }),
    { name: "nextstay-settings" }
  )
);

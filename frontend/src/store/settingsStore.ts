import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";
export type Language = "en" | "it";

function getDefaultLanguage(): Language {
  if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("it")) {
    return "it";
  }
  return "en";
}

interface SettingsState {
  theme: Theme;
  language: Language;
  avatar: string | null;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  setAvatar: (avatar: string | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "system",
      language: getDefaultLanguage(),
      avatar: null,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setAvatar: (avatar) => set({ avatar }),
    }),
    { name: "nextstay-settings" }
  )
);

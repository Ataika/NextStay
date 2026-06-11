import { useEffect, useRef } from "react";
import { authApi } from "../api/api";
import { normalizeLanguage } from "../i18n";
import { useAuthStore } from "../store/authStore";
import { useSettingsStore } from "../store/settingsStore";

export default function LanguageManager() {
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.userId);
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const loadedUserRef = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!token || !userId) {
      loadedUserRef.current = null;
      return;
    }
    if (loadedUserRef.current === userId) return;

    let cancelled = false;
    loadedUserRef.current = userId;

    void authApi.getPreferences()
      .then((prefs) => {
        if (cancelled) return;
        setLanguage(normalizeLanguage(prefs.preferred_language));
      })
      .catch(() => {
        if (!cancelled) {
          loadedUserRef.current = userId;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [setLanguage, token, userId]);

  return null;
}

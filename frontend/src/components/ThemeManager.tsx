import { useEffect } from "react";
import { useSettingsStore } from "../store/settingsStore";

export default function ThemeManager() {
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      return;
    }
    if (theme === "light") {
      document.documentElement.classList.remove("dark");
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (e: MediaQueryList | MediaQueryListEvent) => {
      document.documentElement.classList.toggle("dark", e.matches);
    };
    apply(mq);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  return null;
}

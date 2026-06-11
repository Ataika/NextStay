import { useSettingsStore, type Language } from "../store/settingsStore";
import { translations } from "./translations";

type TranslationValue = string | Record<string, TranslationValue>;
type TranslationParams = Record<string, string | number>;

const localeByLanguage: Record<Language, string> = {
  en: "en-US",
  it: "it-IT",
};

function resolveTranslation(
  language: Language,
  key: string
): TranslationValue | undefined {
  const segments = key.split(".");
  let current: TranslationValue | undefined = translations[language];

  for (const segment of segments) {
    if (!current || typeof current === "string" || !(segment in current)) {
      return undefined;
    }
    current = current[segment as keyof typeof current] as TranslationValue;
  }

  return current;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params[name] ?? ""));
}

export function normalizeLanguage(value: string | null | undefined): Language {
  return value === "it" ? "it" : "en";
}

export function translate(language: Language, key: string, params?: TranslationParams): string {
  const value = resolveTranslation(language, key) ?? resolveTranslation("en", key);
  if (typeof value !== "string") return key;
  return interpolate(value, params);
}

export function roleLabel(language: Language, role: string): string {
  return translate(language, `roles.${role}`);
}

export function priorityLabel(language: Language, priority: string): string {
  return translate(language, `priorities.${priority}`);
}

export function taskStatusLabel(language: Language, status: string): string {
  const key = status === "In Progress" ? "InProgress" : status;
  return translate(language, `taskStatus.${key}`);
}

export function shiftLabel(language: Language, shiftType: string): string {
  return translate(language, `shifts.${shiftType}`);
}

export function localeForLanguage(language: Language): string {
  return localeByLanguage[language];
}

export function useI18n() {
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  return {
    language,
    setLanguage,
    locale: localeForLanguage(language),
    t: (key: string, params?: TranslationParams) => translate(language, key, params),
    roleLabel: (role: string) => roleLabel(language, role),
    priorityLabel: (priority: string) => priorityLabel(language, priority),
    taskStatusLabel: (status: string) => taskStatusLabel(language, status),
    shiftLabel: (shiftType: string) => shiftLabel(language, shiftType),
  };
}

import { useState } from "react";
import { useI18n } from "../i18n";
import type { Language } from "../store/settingsStore";

interface LanguageSelectorProps {
  compact?: boolean;
  disabled?: boolean;
  onChange?: (language: Language) => Promise<void> | void;
}

const options: Language[] = ["en", "it"];

export default function LanguageSelector({
  compact = false,
  disabled = false,
  onChange,
}: LanguageSelectorProps) {
  const { language, setLanguage, t } = useI18n();
  const [pending, setPending] = useState(false);

  const handleChange = async (nextLanguage: Language) => {
    if (disabled || pending || nextLanguage === language) return;
    setLanguage(nextLanguage);
    if (!onChange) return;
    setPending(true);
    try {
      await onChange(nextLanguage);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={`inline-flex items-center rounded-2xl border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-gray-800 ${compact ? "" : "gap-1"}`}>
      {!compact && (
        <span className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t("common.language")}
        </span>
      )}
      {options.map((option) => {
        const active = option === language;
        return (
          <button
            key={option}
            type="button"
            onClick={() => void handleChange(option)}
            disabled={disabled || pending}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
            title={option === "en" ? t("common.english") : t("common.italian")}
          >
            {option.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}

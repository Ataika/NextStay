import { useRef, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { useSettingsStore } from "../store/settingsStore";
import type { Language, Theme } from "../store/settingsStore";
import { authApi } from "../api/api";
import LanguageSelector from "../components/LanguageSelector";
import { useI18n } from "../i18n";
import toast from "react-hot-toast";

function getErrorDetail(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const response = "response" in error ? error.response : undefined;
  if (!response || typeof response !== "object") return undefined;
  const data = "data" in response ? response.data : undefined;
  if (!data || typeof data !== "object") return undefined;
  const detail = "detail" in data ? data.detail : undefined;
  return typeof detail === "string" ? detail : undefined;
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
      <div className="px-6 py-5 space-y-5">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar upload
// ---------------------------------------------------------------------------
function AvatarUpload() {
  const name      = useAuthStore((s) => s.name);
  const avatar    = useSettingsStore((s) => s.avatar);
  const setAvatar = useSettingsStore((s) => s.setAvatar);
  const fileRef   = useRef<HTMLInputElement>(null);
  const { t } = useI18n();

  const initials = name
    ? name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2)
    : "U";

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("settingsPage.avatarTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(reader.result as string);
      toast.success(t("settingsPage.avatarUpdated"));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="flex items-center gap-5">
      <div className="relative group">
        {avatar ? (
          <img src={avatar} alt="avatar" className="w-20 h-20 rounded-full object-cover ring-4 ring-gray-100 dark:ring-gray-700" />
        ) : (
          <div className="w-20 h-20 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold select-none ring-4 ring-gray-100 dark:ring-gray-700">
            {initials}
          </div>
        )}
        <button
          onClick={() => fileRef.current?.click()}
          className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
          title={t("settingsPage.changeAvatar")}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          {t("settingsPage.uploadPhoto")}
        </button>
        {avatar && (
          <button
            onClick={() => { setAvatar(null); toast.success(t("settingsPage.avatarRemoved")); }}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 border border-gray-200 dark:border-gray-600 rounded-lg transition-colors"
          >
            {t("settingsPage.removePhoto")}
          </button>
        )}
        <p className="text-xs text-gray-400 dark:text-gray-500">{t("settingsPage.avatarHelp")}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile form
// ---------------------------------------------------------------------------
function ProfileSection() {
  const name    = useAuthStore((s) => s.name);
  const email   = useAuthStore((s) => s.email);
  const setName = useAuthStore((s) => s.setName);
  const [displayName, setDisplayName] = useState(name ?? "");
  const [saving, setSaving] = useState(false);
  const { t } = useI18n();

  const dirty = displayName.trim() !== (name ?? "").trim();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || !displayName.trim()) return;
    setSaving(true);
    try {
      const res = await authApi.updateProfile(displayName.trim());
      setName(res.name);
      toast.success(t("settingsPage.profileUpdated"));
    } catch (err: unknown) {
      toast.error(getErrorDetail(err) ?? t("settingsPage.profileSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title={t("settingsPage.profile")} description={t("settingsPage.profileDescription")}>
      <AvatarUpload />
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t("settingsPage.displayName")}</label>
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full max-w-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Your name"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t("settingsPage.emailAddress")}</label>
          <input
            type="email"
            value={email ?? ""}
            disabled
            className="w-full max-w-sm px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-sm text-gray-500 dark:text-gray-400 cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{t("settingsPage.emailCannotChange")}</p>
        </div>
        <button
          type="submit"
          disabled={!dirty || saving}
          className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          {saving ? t("settingsPage.saving") : t("settingsPage.saveChanges")}
        </button>
      </form>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Change password
// ---------------------------------------------------------------------------
function PasswordSection() {
  const [current, setCurrent]     = useState("");
  const [next, setNext]           = useState("");
  const [confirm, setConfirm]     = useState("");
  const [saving, setSaving]       = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext]   = useState(false);
  const { t } = useI18n();

  const mismatch  = next !== confirm && confirm.length > 0;
  const tooShort  = next.length > 0 && next.length < 8;
  const canSubmit = current && next && confirm && !mismatch && !tooShort;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      await authApi.changePassword(current, next);
      toast.success(t("settingsPage.passwordChanged"));
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err: unknown) {
      toast.error(getErrorDetail(err) ?? t("settingsPage.passwordChangeFailed"));
    } finally {
      setSaving(false);
    }
  }

  function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
    return (
      <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
        {show ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <Section title={t("settingsPage.password")} description={t("settingsPage.passwordDescription")}>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t("settingsPage.currentPassword")}</label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="w-full pr-10 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
            <EyeToggle show={showCurrent} onToggle={() => setShowCurrent((s) => !s)} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t("settingsPage.newPassword")}</label>
          <div className="relative">
            <input
              type={showNext ? "text" : "password"}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={`w-full pr-10 px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${tooShort ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-gray-600"}`}
              placeholder="••••••••"
            />
            <EyeToggle show={showNext} onToggle={() => setShowNext((s) => !s)} />
          </div>
          {tooShort && <p className="mt-1 text-xs text-red-500">{t("settingsPage.passwordTooShort")}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t("settingsPage.confirmPassword")}</label>
          <div className="relative">
            <input
              type={showNext ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={`w-full pr-10 px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${mismatch ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-gray-600"}`}
              placeholder="••••••••"
            />
          </div>
          {mismatch && <p className="mt-1 text-xs text-red-500">{t("settingsPage.passwordMismatch")}</p>}
        </div>

        {/* Strength indicator */}
        {next.length > 0 && (
          <div>
            <div className="flex gap-1 mb-1">
              {[1, 2, 3, 4].map((level) => {
                const strength = next.length < 8 ? 1 : next.length < 12 ? 2 : /[^a-zA-Z0-9]/.test(next) && /[0-9]/.test(next) ? 4 : 3;
                return (
                  <div key={level} className={`h-1 flex-1 rounded-full transition-colors ${level <= strength ? (strength <= 1 ? "bg-red-500" : strength === 2 ? "bg-yellow-400" : strength === 3 ? "bg-blue-500" : "bg-green-500") : "bg-gray-200 dark:bg-gray-600"}`} />
                );
              })}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {next.length < 8
                ? t("settingsPage.strengthTooShort")
                : next.length < 12
                  ? t("settingsPage.strengthFair")
                  : /[^a-zA-Z0-9]/.test(next) && /[0-9]/.test(next)
                    ? t("settingsPage.strengthStrong")
                    : t("settingsPage.strengthGood")}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || saving}
          className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
        >
          {saving ? t("settingsPage.changingPassword") : t("settingsPage.changePassword")}
        </button>
      </form>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Appearance
// ---------------------------------------------------------------------------
const THEMES: { value: Theme; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: "light",
    label: "Light",
    description: "Always light interface",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    description: "Always dark interface",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
  },
  {
    value: "system",
    label: "System",
    description: "Follows your OS setting",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
];

function AppearanceSection() {
  const theme    = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const { t } = useI18n();
  const themeLabels: Record<Theme, { label: string; description: string }> = {
    light: {
      label: t("settingsPage.themeLight"),
      description: t("settingsPage.themeLightDescription"),
    },
    dark: {
      label: t("settingsPage.themeDark"),
      description: t("settingsPage.themeDarkDescription"),
    },
    system: {
      label: t("settingsPage.themeSystem"),
      description: t("settingsPage.themeSystemDescription"),
    },
  };

  return (
    <Section title={t("settingsPage.appearance")} description={t("settingsPage.appearanceDescription")}>
      <div className="flex gap-3 flex-wrap">
        {THEMES.map(({ value, label, description, icon }) => {
          const active = theme === value;
          const currentTheme = themeLabels[value];
          return (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex flex-col items-center gap-2 px-6 py-4 rounded-xl border-2 transition-all text-sm font-medium min-w-[110px] ${
                active
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                  : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/30"
              }`}
            >
              <span className={active ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}>
                {icon}
              </span>
              <span>{currentTheme.label ?? label}</span>
              <span className="text-xs font-normal text-gray-400 dark:text-gray-500 text-center">{currentTheme.description ?? description}</span>
              {active && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              )}
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function LanguageSection() {
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const { t } = useI18n();

  const handleLanguageChange = async (language: Language) => {
    try {
      await authApi.updatePreferences({ preferred_language: language });
      setLanguage(language);
      toast.success(t("settingsPage.languageSaved"));
    } catch (err: unknown) {
      toast.error(getErrorDetail(err) ?? t("settingsPage.languageSaveFailed"));
      throw err;
    }
  };

  return (
    <Section title={t("settingsPage.language")} description={t("settingsPage.languageDescription")}>
      <LanguageSelector onChange={handleLanguageChange} />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function SettingsPage() {
  const { t } = useI18n();

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t("settingsPage.title")}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("settingsPage.description")}</p>
      </div>

      <ProfileSection />
      <PasswordSection />
      <LanguageSection />
      <AppearanceSection />
    </div>
  );
}

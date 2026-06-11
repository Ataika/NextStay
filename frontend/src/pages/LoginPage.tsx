import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi, devLoginConfig } from "../api/api";
import LanguageSelector from "../components/LanguageSelector";
import { useI18n } from "../i18n";
import { useAuthStore, isAdminRole } from "../store/authStore";
import type { UserRole } from "../store/authStore";
import Button from "../ui/Button";
import Card from "../ui/Card";
import type { AxiosError } from "axios";

type Mode = "password" | "otp-email" | "otp-code";

export default function LoginPage() {
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [mode, setMode]       = useState<Mode>("password");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const token    = useAuthStore((s) => s.token);
  const role     = useAuthStore((s) => s.role);
  const setAuth  = useAuthStore((s) => s.setAuth);
  const autoLoginAttemptedRef = useRef(false);
  const { t } = useI18n();

  const redirectAfterLogin = useCallback((userRole: UserRole) => {
    navigate(isAdminRole(userRole) ? "/admin" : "/staff", { replace: true });
  }, [navigate]);

  const getErrorMessage = (error: unknown, fallback: string) => {
    const axiosError = error as AxiosError<{ detail?: string }>;
    return axiosError.response?.data?.detail || axiosError.message || fallback;
  };

  // Auto-login for dev owner account
  useEffect(() => {
    if (!devLoginConfig.autoLoginEnabled || autoLoginAttemptedRef.current || token || role) return;
    autoLoginAttemptedRef.current = true;
    void (async () => {
      try {
        const res = await authApi.devLogin(devLoginConfig.email, devLoginConfig.password);
        setAuth(res.user.id, res.token, res.role as UserRole, res.user.email, res.user.name);
        redirectAfterLogin(res.role as UserRole);
      } catch { /* ignore */ }
    })();
  }, [redirectAfterLogin, role, setAuth, token]);

  // Already logged in
  useEffect(() => {
    if (token && role) redirectAfterLogin(role);
  }, [redirectAfterLogin, role, token]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.passwordLogin(email.trim(), password);
      setAuth(res.user.id, res.token, res.role as UserRole, res.user.email, res.user.name);
      redirectAfterLogin(res.role as UserRole);
    } catch (error: unknown) {
      setError(getErrorMessage(error, t("login.invalidPassword")));
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.requestOtp(email.trim());
      if (res.retryAfterSeconds) {
        setError(t("login.requestWait", { seconds: res.retryAfterSeconds }));
        return;
      }
      setMode("otp-code");
    } catch (error: unknown) {
      setError(getErrorMessage(error, t("login.failedSendCode")));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(email.trim(), otpCode);
      setAuth(res.user.id, res.token, res.role as UserRole, res.user.email, res.user.name);
      redirectAfterLogin(res.role as UserRole);
    } catch (error: unknown) {
      setError(getErrorMessage(error, t("login.invalidCode")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-8">
      <Card className="w-full max-w-sm space-y-6" padding="lg">
        <div className="flex justify-end">
          <LanguageSelector compact />
        </div>

        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">NextStay</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {mode === "otp-code" ? t("login.promptCode") : t("login.promptSignIn")}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-3 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* ---- PASSWORD LOGIN (default) ---- */}
        {mode === "password" && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t("login.email")}</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t("login.password")}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" variant="primary" fullWidth disabled={loading}>
              {loading ? t("login.signingIn") : t("login.signIn")}
            </Button>
            <p className="text-center text-xs text-gray-400 dark:text-gray-500">
              {t("login.dontHavePassword")}{" "}
              <button
                type="button"
                className="text-blue-500 hover:underline"
                onClick={() => { setError(""); setMode("otp-email"); }}
              >
                {t("login.useEmailCode")}
              </button>
            </p>
          </form>
        )}

        {/* ---- OTP — enter email ---- */}
        {mode === "otp-email" && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t("login.email")}</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
              />
            </div>
            <Button type="submit" variant="primary" fullWidth disabled={loading}>
              {loading ? t("login.sending") : t("login.sendCode")}
            </Button>
            <p className="text-center text-xs text-gray-400 dark:text-gray-500">
              <button
                type="button"
                className="text-blue-500 hover:underline"
                onClick={() => { setError(""); setMode("password"); }}
              >
                {`<- ${t("login.backToPassword")}`}
              </button>
            </p>
          </form>
        )}

        {/* ---- OTP — enter code ---- */}
        {mode === "otp-code" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("login.codeSentTo", { email })}
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                autoFocus
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center text-lg"
                placeholder="123456"
                maxLength={6}
              />
            </div>
            <Button type="submit" variant="primary" fullWidth disabled={loading || otpCode.length !== 6}>
              {loading ? t("login.verifying") : t("login.verifyCode")}
            </Button>
            <p className="text-center text-xs text-gray-400 dark:text-gray-500">
              <button
                type="button"
                className="text-blue-500 hover:underline"
                onClick={() => { setError(""); setOtpCode(""); setMode("otp-email"); }}
              >
                {`<- ${t("login.useDifferentEmail")}`}
              </button>
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}

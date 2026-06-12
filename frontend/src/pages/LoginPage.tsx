import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi, devLoginConfig } from "../api/api";
import LanguageSelector from "../components/LanguageSelector";
import { useI18n } from "../i18n";
import { useAuthStore, isAdminRole } from "../store/authStore";
import type { UserRole } from "../store/authStore";
import Button from "../ui/Button";
import Card from "../ui/Card";
import type { AxiosError } from "axios";

type ViewMode = "email" | "login" | "otp";

const inputClass =
  "w-full px-3 py-2 text-sm rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

export default function LoginPage() {
  const [mode, setMode] = useState<ViewMode>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const autoLoginAttemptedRef = useRef(false);

  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const setAuth = useAuthStore((s) => s.setAuth);
  const { t } = useI18n();

  const redirectAfterLogin = useCallback((userRole: UserRole) => {
    navigate(isAdminRole(userRole) ? "/admin" : "/staff", { replace: true });
  }, [navigate]);

  const getErrorMessage = (err: unknown, fallback: string) => {
    const axiosError = err as AxiosError<{ detail?: string }>;
    return axiosError.response?.data?.detail || axiosError.message || fallback;
  };

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

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

  useEffect(() => {
    if (token && role) redirectAfterLogin(role);
  }, [redirectAfterLogin, role, token]);

  const goBackToEmail = () => {
    setMode("email");
    setPassword("");
    setOtpDigits(["", "", "", "", "", ""]);
    setError("");
  };

  const handleContinueEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) return;

    setLoading(true);
    try {
      await authApi.checkEmail(email.trim());
      setMode("login");
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("login.emailNotFound")));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.passwordLogin(email.trim(), password);
      setAuth(res.user.id, res.token, res.role as UserRole, res.user.email, res.user.name);
      redirectAfterLogin(res.role as UserRole);
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("login.invalidPassword")));
    } finally {
      setLoading(false);
    }
  };

  const handleStartOtp = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await authApi.requestOtp(email.trim());
      const cooldown = res.retryAfterSeconds ?? 60;
      setResendCooldown(cooldown);
      if (res.retryAfterSeconds) {
        setError(t("login.requestWait", { seconds: res.retryAfterSeconds }));
      }
      setMode("otp");
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("login.failedSendCode")));
    } finally {
      setLoading(false);
    }
  };

  const otpCode = otpDigits.join("");

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) return;
    setError("");
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(email.trim(), otpCode);
      setAuth(res.user.id, res.token, res.role as UserRole, res.user.email, res.user.name);
      redirectAfterLogin(res.role as UserRole);
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("login.invalidCode")));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpDigitChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const next = [...otpDigits];
    next[index] = char;
    setOtpDigits(next);
    if (char && index < 5) otpInputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
      const next = [...otpDigits];
      next[index - 1] = "";
      setOtpDigits(next);
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = [...otpDigits];
    for (let i = 0; i < pasted.length && i < 6; i++) next[i] = pasted[i];
    setOtpDigits(next);
    otpInputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const subtitle =
    mode === "login" || mode === "otp"
      ? t("login.promptCredentials")
      : t("login.promptSignIn");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4 py-8">
      <Card className="w-full max-w-md space-y-6 bg-gray-900 border border-gray-700" padding="lg">
        <div className="flex justify-end">
          <LanguageSelector compact />
        </div>

        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold text-white">NextStay</h1>
          <p className="text-sm text-gray-400">{subtitle}</p>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-200 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}

        {mode === "email" && (
          <form className="space-y-4" onSubmit={handleContinueEmail}>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-300">{t("login.email")}</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>
            <Button type="submit" variant="primary" fullWidth disabled={loading}>
              {loading ? t("common.loading") : t("login.continue")}
            </Button>
            <p className="text-xs text-gray-400 text-center">
              {t("login.noAccount")}{" "}
              <Link to="/register" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
                {t("login.signUp")}
              </Link>
            </p>
          </form>
        )}

        {mode === "login" && (
          <form className="space-y-4" onSubmit={handlePasswordLogin}>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => void handleStartOtp()}
              disabled={loading}
            >
              {t("login.emailSignInCode")}
            </Button>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-300">{t("login.email")}</label>
                <input
                  type="email"
                  required
                  readOnly
                  value={email}
                  className={`${inputClass} opacity-80`}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <label className="font-medium text-gray-300">{t("login.password")}</label>
                  <span className="text-gray-500">{t("login.forgotPassword")}</span>
                </div>
                <input
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                />
              </div>
            </div>

            <Button type="submit" variant="primary" fullWidth disabled={loading}>
              {loading ? t("login.signingIn") : t("login.signIn")}
            </Button>

            <p className="text-xs text-gray-400 text-center">
              {t("login.noAccount")}{" "}
              <Link to="/register" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
                {t("login.signUp")}
              </Link>
            </p>
          </form>
        )}

        {mode === "otp" && (
          <form className="space-y-4" onSubmit={handleVerifyOtp}>
            <p className="text-sm text-gray-400">
              {t("login.codeSentTo", { email })}
            </p>
            <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpInputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  autoFocus={i === 0}
                  className="w-11 h-12 text-center text-lg font-medium rounded-lg bg-gray-800 border border-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              ))}
            </div>
            <p className="text-xs text-gray-400 text-center">
              {resendCooldown > 0 ? (
                <span className="text-gray-500">{t("login.resendWait", { seconds: resendCooldown })}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleStartOtp()}
                  disabled={loading}
                  className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
                >
                  {t("login.resendCode")}
                </button>
              )}
            </p>
            <Button type="submit" variant="primary" fullWidth disabled={loading || otpCode.length !== 6}>
              {loading ? t("login.verifying") : t("login.verifyCode")}
            </Button>
          </form>
        )}

        {mode !== "email" && (
          <button
            type="button"
            onClick={goBackToEmail}
            className="w-full text-xs text-gray-500 hover:text-gray-300"
          >
            ← {t("login.goBack")}
          </button>
        )}
      </Card>
    </div>
  );
}

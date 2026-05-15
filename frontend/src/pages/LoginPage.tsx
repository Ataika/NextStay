import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi, devLoginConfig } from "../api/api";
import { useAuthStore, isAdminRole } from "../store/authStore";
import type { UserRole } from "../store/authStore";
import Button from "../ui/Button";
import Card from "../ui/Card";

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

  const redirectAfterLogin = (userRole: UserRole) => {
    navigate(isAdminRole(userRole) ? "/admin" : "/staff", { replace: true });
  };

  // Auto-login for dev owner account
  useEffect(() => {
    if (!devLoginConfig.autoLoginEnabled || autoLoginAttemptedRef.current || token || role) return;
    autoLoginAttemptedRef.current = true;
    void (async () => {
      try {
        const res = await authApi.devLogin(devLoginConfig.email, devLoginConfig.password);
        setAuth(res.token, res.role as UserRole, res.user.email, res.user.name);
        redirectAfterLogin(res.role as UserRole);
      } catch { /* ignore */ }
    })();
  }, [role, token]);

  // Already logged in
  useEffect(() => {
    if (token && role) redirectAfterLogin(role);
  }, []);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.passwordLogin(email.trim(), password);
      setAuth(res.token, res.role as UserRole, res.user.email, res.user.name);
      redirectAfterLogin(res.role as UserRole);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Invalid email or password.");
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
        setError(`Please wait ${res.retryAfterSeconds}s before requesting another code.`);
        return;
      }
      setMode("otp-code");
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Failed to send code.");
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
      setAuth(res.token, res.role as UserRole, res.user.email, res.user.name);
      redirectAfterLogin(res.role as UserRole);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || "Invalid code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-8">
      <Card className="w-full max-w-sm space-y-6" padding="lg">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">NextStay</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {mode === "otp-code" ? "Enter the 6-digit code sent to your email" : "Sign in to your account"}
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
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
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
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
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
              {loading ? "Signing in…" : "Sign In"}
            </Button>
            <p className="text-center text-xs text-gray-400 dark:text-gray-500">
              Don't have a password?{" "}
              <button
                type="button"
                className="text-blue-500 hover:underline"
                onClick={() => { setError(""); setMode("otp-email"); }}
              >
                Use email code
              </button>
            </p>
          </form>
        )}

        {/* ---- OTP — enter email ---- */}
        {mode === "otp-email" && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
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
              {loading ? "Sending…" : "Send Code"}
            </Button>
            <p className="text-center text-xs text-gray-400 dark:text-gray-500">
              <button
                type="button"
                className="text-blue-500 hover:underline"
                onClick={() => { setError(""); setMode("password"); }}
              >
                ← Back to password login
              </button>
            </p>
          </form>
        )}

        {/* ---- OTP — enter code ---- */}
        {mode === "otp-code" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                6-digit code sent to {email}
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
              {loading ? "Verifying…" : "Verify Code"}
            </Button>
            <p className="text-center text-xs text-gray-400 dark:text-gray-500">
              <button
                type="button"
                className="text-blue-500 hover:underline"
                onClick={() => { setError(""); setOtpCode(""); setMode("otp-email"); }}
              >
                ← Use a different email
              </button>
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}

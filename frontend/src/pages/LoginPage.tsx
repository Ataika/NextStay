import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/api";
import { useAuthStore } from "../store/authStore";
import Button from "../ui/Button";
import Card from "../ui/Card";

type ViewMode = "email" | "login" | "otp" | "register";

export default function LoginPage() {
  const [mode, setMode] = useState<ViewMode>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [registerRole, setRegisterRole] = useState<"OWNER" | "STAFF">("STAFF");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const redirectByRole = (role: "OWNER" | "STAFF") => {
    navigate(role === "OWNER" ? "/admin" : "/staff");
  };

  const handleContinueEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }
    setMode("login");
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await authApi.login(email.trim(), password);
      setAuth(response.token, response.role);
      redirectByRole(response.role);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message ||
        "Login failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleStartOtp = async () => {
    setError("");
    if (!email.trim()) {
      setError("Please enter your email first");
      return;
    }
    setLoading(true);
    try {
      const response = await authApi.requestOtp(email.trim());
      const cooldown = response.retryAfterSeconds ?? 60;
      setResendCooldown(cooldown);
      if (response.retryAfterSeconds) {
        setError(`Please wait ${response.retryAfterSeconds}s before requesting another code.`);
      }
      setMode("otp");
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to send sign-in code";
      setError(msg);
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
      const response = await authApi.verifyOtp(email.trim(), otpCode);
      setAuth(response.token, response.role);
      redirectByRole(response.role);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to verify code";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await authApi.register({
        email: email.trim(),
        fullName,
        password,
        role: registerRole,
      });
      setAuth(response.token, response.role);
      redirectByRole(response.role);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message ||
        "Registration failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const showBackLink = mode === "login" || mode === "otp" || mode === "register";

  const goBackToEmail = () => {
    setMode("email");
    setPassword("");
    setOtpDigits(["", "", "", "", "", ""]);
    setError("");
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
    const focusIndex = Math.min(pasted.length, 5);
    otpInputRefs.current[focusIndex]?.focus();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4 py-8">
      <Card className="w-full max-w-md space-y-6 bg-gray-900 border border-gray-700" padding="lg">
        <div className="space-y-1 text-center">
          <h2 className="text-2xl font-semibold text-white">NextStay</h2>
          {mode === "login" || mode === "otp" ? (
            <p className="text-sm text-gray-400">Enter your credentials</p>
          ) : mode === "register" ? (
            <p className="text-sm text-gray-400">Create your account</p>
          ) : (
            <p className="text-sm text-gray-400">Sign in to your account</p>
          )}
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-200 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}

        {/* Step 1: only email */}
        {mode === "email" && (
          <form className="space-y-4" onSubmit={handleContinueEmail}>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-300">Email</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="w-full px-3 py-2 text-sm rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <Button type="submit" variant="primary" fullWidth disabled={loading}>
              Continue
            </Button>
            <p className="text-xs text-gray-400 text-center">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
                className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
              >
                Sign up
              </button>
            </p>
          </form>
        )}

        {/* Step 2: password login */}
        {mode === "login" && (
          <form className="space-y-4" onSubmit={handlePasswordLogin}>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={handleStartOtp}
              disabled={loading}
            >
              Email sign-in code
            </Button>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-300">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <label className="font-medium text-gray-300">Password</label>
                  <button
                    type="button"
                    className="hover:text-gray-200"
                    onClick={(e) => e.preventDefault()}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full px-3 py-2 text-sm rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <Button type="submit" variant="primary" fullWidth disabled={loading}>
              {loading ? "Logging in..." : "Log in"}
            </Button>

            <p className="text-xs text-gray-400 text-center">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
                className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
              >
                Sign up
              </button>
            </p>
          </form>
        )}

        {/* OTP code step */}
        {mode === "otp" && (
          <form className="space-y-4" onSubmit={handleVerifyOtp}>
            <p className="text-sm text-gray-400">
              Enter the code sent to <span className="font-medium text-gray-200">{email}</span>
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
                  className="w-11 h-12 text-center text-lg font-medium rounded-lg bg-gray-800 border border-gray-600 text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                />
              ))}
            </div>
            <p className="text-xs text-gray-400 text-center">
              Didn't receive the code?{" "}
              {resendCooldown > 0 ? (
                <span className="text-gray-500">Resend ({resendCooldown})</span>
              ) : (
                <button
                  type="button"
                  onClick={handleStartOtp}
                  disabled={loading}
                  className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
                >
                  Resend
                </button>
              )}
            </p>
            <Button type="submit" variant="primary" fullWidth disabled={loading || otpCode.length !== 6}>
              {loading ? "Verifying..." : "Continue"}
            </Button>
          </form>
        )}

        {/* Register view */}
        {mode === "register" && (
          <form className="space-y-4" onSubmit={handleRegister}>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-300">Full name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-3 py-2 text-sm rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-300">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="w-full px-3 py-2 text-sm rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-300">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full px-3 py-2 text-sm rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-300">Role</label>
              <select
                value={registerRole}
                onChange={(e) => setRegisterRole(e.target.value as "OWNER" | "STAFF")}
                className="w-full px-3 py-2 text-sm rounded-md bg-gray-800 border border-gray-700 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="STAFF">Staff</option>
                <option value="OWNER">Owner</option>
              </select>
            </div>
            <Button type="submit" variant="primary" fullWidth disabled={loading}>
              {loading ? "Creating..." : "Sign up"}
            </Button>
          </form>
        )}

        {showBackLink && (
          <button
            type="button"
            onClick={goBackToEmail}
            className="w-full mt-1 text-xs text-gray-500 hover:text-gray-300 flex items-center justify-center gap-1"
          >
            <span>← Go back</span>
          </button>
        )}
      </Card>
    </div>
  );
}

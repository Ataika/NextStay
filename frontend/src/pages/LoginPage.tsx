import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/api";
import { useAuthStore } from "../store/authStore";
import Button from "../ui/Button";
import Card from "../ui/Card";

type AuthMode = "password" | "otp" | "register";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [registerRole, setRegisterRole] = useState<"OWNER" | "STAFF">("STAFF");
  const [otpCode, setOtpCode] = useState("");
  const [otpStep, setOtpStep] = useState<"email" | "code">("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const redirectByRole = (role: "OWNER" | "STAFF") => {
    navigate(role === "OWNER" ? "/admin" : "/staff");
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await authApi.login(email, password);
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await authApi.register({
        email,
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

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await authApi.requestOtp(email);
      if (response.retryAfterSeconds) {
        setError(`Please wait ${response.retryAfterSeconds}s before requesting another code.`);
        return;
      }
      setOtpStep("code");
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to send OTP";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await authApi.verifyOtp(email, otpCode);
      setAuth(response.token, response.role);
      redirectByRole(response.role);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to verify OTP";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError("");
    setLoading(false);
    if (next !== "otp") {
      setOtpStep("email");
      setOtpCode("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-8">
      <Card className="w-full max-w-md lg:max-w-lg space-y-6" padding="lg">
        <div>
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">NextStay</h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Auth mode: {mode === "password" ? "Password login" : mode === "otp" ? "OTP login" : "Register"}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button variant={mode === "password" ? "primary" : "secondary"} onClick={() => switchMode("password")}>
            Login
          </Button>
          <Button variant={mode === "otp" ? "primary" : "secondary"} onClick={() => switchMode("otp")}>
            OTP
          </Button>
          <Button variant={mode === "register" ? "primary" : "secondary"} onClick={() => switchMode("register")}>
            Register
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {mode === "password" && (
          <form className="space-y-4" onSubmit={handlePasswordLogin}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              placeholder="Email"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <Button type="submit" variant="primary" fullWidth disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        )}

        {mode === "register" && (
          <form className="space-y-4" onSubmit={handleRegister}>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              placeholder="Email"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 8 chars)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <select
              value={registerRole}
              onChange={(e) => setRegisterRole(e.target.value as "OWNER" | "STAFF")}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="STAFF">STAFF</option>
              <option value="OWNER">OWNER</option>
            </select>
            <Button type="submit" variant="primary" fullWidth disabled={loading}>
              {loading ? "Creating..." : "Create account"}
            </Button>
          </form>
        )}

        {mode === "otp" && (
          <form className="space-y-4" onSubmit={otpStep === "email" ? handleRequestOtp : handleVerifyOtp}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              placeholder="Email"
              disabled={otpStep === "code"}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {otpStep === "code" && (
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit OTP"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            )}
            <Button type="submit" variant="primary" fullWidth disabled={loading}>
              {loading ? "Please wait..." : otpStep === "email" ? "Send OTP" : "Verify OTP"}
            </Button>
            {otpStep === "code" && (
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => {
                  setOtpStep("email");
                  setOtpCode("");
                  setError("");
                }}
              >
                Change email
              </Button>
            )}
          </form>
        )}
      </Card>
    </div>
  );
}

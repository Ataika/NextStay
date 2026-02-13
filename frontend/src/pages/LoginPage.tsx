import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/api";
import { useAuthStore } from "../store/authStore";
import Button from "../ui/Button";
import Card from "../ui/Card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

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
      setStep("otp");
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

      // Redirect based on role
      if (response.role === "OWNER") {
        navigate("/admin");
      } else if (response.role === "STAFF") {
        navigate("/staff");
      } else {
        navigate("/login");
      }
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-8">
      <Card className="w-full max-w-md lg:max-w-lg xl:max-w-xl space-y-8" padding="lg">
        <div>
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white">
            NextStay
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {step === "email" ? "Enter your email to receive OTP" : "Enter the 6-digit OTP sent to your email"}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={step === "email" ? handleRequestOtp : handleVerifyOtp}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400"
                placeholder="you@example.com"
                disabled={step === "otp"}
              />
            </div>
            {step === "otp" && (
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  OTP Code
                </label>
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400"
                  placeholder="123456"
                  maxLength={6}
                />
              </div>
            )}
          </div>

          <div>
            <Button
              type="submit"
              variant="primary"
              fullWidth
              disabled={loading}
            >
              {loading
                ? step === "email" ? "Sending OTP..." : "Verifying..."
                : step === "email" ? "Send OTP" : "Verify OTP"}
            </Button>
          </div>

          {step === "otp" && (
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => {
                setStep("email");
                setOtpCode("");
                setError("");
              }}
            >
              Change Email
            </Button>
          )}

        </form>
      </Card>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { staffApi } from "../../api/api";
import { useI18n } from "../../i18n";
import { useAuthStore } from "../../store/authStore";
import Button from "../../ui/Button";

export default function ShiftStartPage() {
  const navigate      = useNavigate();
  const { t } = useI18n();
  const setShiftStart = useAuthStore((s) => s.setShiftStart);
  const loginTime     = useAuthStore((s) => s.loginTime);

  // If shift already started in this session, redirect immediately
  useEffect(() => {
    if (loginTime) navigate("/staff", { replace: true });
  }, [loginTime, navigate]);

  const [code, setCode]           = useState("");
  const [expiresIn, setExpiresIn] = useState(120);
  const [codeLoading, setCodeLoading] = useState(true);
  const [input, setInput]         = useState("");
  const [error, setError]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCode = useCallback(async () => {
    try {
      const res = await staffApi.getShiftCode();
      setCode(res.code);
      setExpiresIn(res.expires_in);
      setCodeLoading(false);
    } catch {
      setCodeLoading(false);
    }
  }, []);

  // Load code on mount and refresh whenever it expires
  useEffect(() => {
    void loadCode();
    intervalRef.current = setInterval(() => void loadCode(), 120_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [loadCode]);

  // Countdown timer
  useEffect(() => {
    const id = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          void loadCode();
          return 120;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [loadCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await staffApi.startShift(input.trim());
      setShiftStart(res.started_at);
      navigate("/staff", { replace: true });
    } catch {
      setError(t("shiftStart.invalidCode"));
      setInput("");
    } finally {
      setSubmitting(false);
    }
  };

  const pct = Math.round((expiresIn / 120) * 100);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t("shiftStart.title")}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("shiftStart.description")}
          </p>
        </div>

        {/* Code display (shown on hotel kiosk / manager tablet) */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 text-center shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            {t("shiftStart.currentCode")}
          </p>
          {codeLoading ? (
            <div className="text-4xl font-bold text-gray-300 tracking-[0.25em] h-12 flex items-center justify-center">
              ••••
            </div>
          ) : (
            <div className="text-5xl font-bold text-blue-600 dark:text-blue-400 tracking-[0.25em] tabular-nums select-none">
              {code}
            </div>
          )}

          {/* Countdown bar */}
          <div className="mt-4">
            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-1000 ${
                  expiresIn <= 20 ? "bg-red-500" : expiresIn <= 40 ? "bg-amber-500" : "bg-blue-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
              {t("shiftStart.refreshesIn", { seconds: expiresIn })}
            </p>
          </div>
        </div>

        {/* Input form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t("shiftStart.enterCode")}
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              value={input}
              onChange={(e) => { setInput(e.target.value.replace(/\D/g, "")); setError(""); }}
              placeholder="1234"
              autoFocus
              className="w-full px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={input.length !== 4 || submitting}
          >
            {submitting ? t("shiftStart.verifying") : t("shiftStart.startMyShift")}
          </Button>
        </form>

        <p className="text-center text-xs text-gray-400 dark:text-gray-500">
          {t("shiftStart.rotates")}{" "}
          <button
            onClick={() => navigate("/staff")}
            className="text-blue-500 hover:underline"
          >
            {t("shiftStart.goBack")}
          </button>
        </p>
      </div>
    </div>
  );
}

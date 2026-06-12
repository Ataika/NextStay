import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AxiosError } from "axios";
import { registerApi } from "../api/api";
import LanguageSelector from "../components/LanguageSelector";
import { useI18n } from "../i18n";
import { useAuthStore, isAdminRole } from "../store/authStore";
import type { UserRole } from "../store/authStore";
import Button from "../ui/Button";
import Card from "../ui/Card";

type Flow = "owner-hotel" | "owner-details" | "code-entry" | "staff-details";

const inputClass =
  "w-full px-3 py-2 text-sm rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

const GENDER_OPTIONS = [
  { value: "male", labelKey: "register.genderMale" as const },
  { value: "female", labelKey: "register.genderFemale" as const },
  { value: "other", labelKey: "register.genderOther" as const },
  { value: "prefer_not_to_say", labelKey: "register.genderPreferNot" as const },
];

const currentYear = new Date().getFullYear();

export default function RegisterPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [flow, setFlow] = useState<Flow>("owner-hotel");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [hotelName, setHotelName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteHotelName, setInviteHotelName] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [gender, setGender] = useState("");

  const getErrorMessage = (err: unknown, fallback: string) => {
    const axiosError = err as AxiosError<{ detail?: string }>;
    return axiosError.response?.data?.detail || axiosError.message || fallback;
  };

  const redirectAfterRegister = useCallback((userRole: UserRole) => {
    navigate(isAdminRole(userRole) ? "/admin" : "/staff", { replace: true });
  }, [navigate]);

  const resetForm = () => {
    setError("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setBirthYear("");
    setGender("");
  };

  const validatePasswords = () => {
    if (password !== confirmPassword) {
      setError(t("register.passwordMismatch"));
      return false;
    }
    return true;
  };

  const handleOwnerHotelContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!hotelName.trim()) return;
    setFlow("owner-details");
  };

  const handleOwnerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validatePasswords()) return;

    const year = Number(birthYear);
    if (!year || year < 1920 || year > currentYear - 18) {
      setError(t("register.invalidBirthYear"));
      return;
    }
    if (!gender) {
      setError(t("register.genderRequired"));
      return;
    }

    setLoading(true);
    try {
      const res = await registerApi.registerOwner({
        hotel_name: hotelName.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password,
        birth_year: year,
        gender,
      });
      setAuth(res.user.id, res.token, res.role as UserRole, res.user.email, res.user.name);
      redirectAfterRegister(res.role as UserRole);
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("register.failed")));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!inviteCode.trim()) return;

    setLoading(true);
    try {
      const res = await registerApi.verifyInvite(inviteCode.trim());
      setInviteEmail(res.email);
      setInviteHotelName(res.hotel_name);
      setEmail(res.email);
      resetForm();
      setEmail(res.email);
      setFlow("staff-details");
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("register.invalidCode")));
    } finally {
      setLoading(false);
    }
  };

  const handleStaffRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validatePasswords()) return;

    const year = Number(birthYear);
    if (!year || year < 1920 || year > currentYear - 16) {
      setError(t("register.invalidBirthYearStaff"));
      return;
    }
    if (!gender) {
      setError(t("register.genderRequired"));
      return;
    }

    setLoading(true);
    try {
      const res = await registerApi.registerStaff({
        code: inviteCode.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password,
        birth_year: year,
        gender,
      });
      setAuth(res.user.id, res.token, res.role as UserRole, res.user.email, res.user.name);
      redirectAfterRegister(res.role as UserRole);
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("register.failed")));
    } finally {
      setLoading(false);
    }
  };

  const switchToCodeFlow = () => {
    setError("");
    resetForm();
    setInviteCode("");
    setInviteEmail("");
    setInviteHotelName("");
    setFlow("code-entry");
  };

  const switchToOwnerFlow = () => {
    setError("");
    resetForm();
    setFlow("owner-hotel");
  };

  const renderPersonalFields = (isStaff: boolean) => (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t("register.firstName")}</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={inputClass}
            required
            autoComplete="given-name"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t("register.lastName")}</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={inputClass}
            required
            autoComplete="family-name"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">{t("register.email")}</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          required
          readOnly={isStaff}
          autoComplete="email"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">{t("register.password")}</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">{t("register.confirmPassword")}</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClass}
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">{t("register.birthYear")}</label>
        <input
          type="number"
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value)}
          className={inputClass}
          required
          min={1920}
          max={currentYear - (isStaff ? 16 : 18)}
          placeholder={String(currentYear - 25)}
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">{t("register.gender")}</label>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className={inputClass}
          required
        >
          <option value="">{t("register.genderSelect")}</option>
          {GENDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4 py-8">
      <Card className="w-full max-w-md space-y-5 bg-gray-900 border border-gray-700" padding="lg">
        <div className="flex justify-end">
          <LanguageSelector compact />
        </div>

        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold text-white">{t("register.title")}</h1>
          <p className="text-sm text-gray-400">
            {flow === "owner-hotel" || flow === "owner-details"
              ? t("register.ownerSubtitle")
              : t("register.staffSubtitle")}
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-400 text-center" role="alert">
            {error}
          </p>
        )}

        {flow === "owner-hotel" && (
          <form onSubmit={handleOwnerHotelContinue} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t("register.hotelName")}</label>
              <input
                type="text"
                value={hotelName}
                onChange={(e) => setHotelName(e.target.value)}
                className={inputClass}
                placeholder={t("register.hotelNamePlaceholder")}
                required
              />
            </div>
            <Button type="submit" variant="primary" fullWidth>
              {t("register.continue")}
            </Button>
            <button
              type="button"
              onClick={switchToCodeFlow}
              className="w-full text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2"
            >
              {t("register.useHotelCode")}
            </button>
          </form>
        )}

        {flow === "owner-details" && (
          <form onSubmit={handleOwnerRegister} className="space-y-4">
            <p className="text-xs text-gray-500 text-center">
              {t("register.hotelLabel")}: <span className="text-gray-300">{hotelName}</span>
            </p>
            {renderPersonalFields(false)}
            <Button type="submit" variant="primary" fullWidth disabled={loading}>
              {loading ? t("register.submitting") : t("register.createAccount")}
            </Button>
            <button
              type="button"
              onClick={() => setFlow("owner-hotel")}
              className="w-full text-sm text-gray-400 hover:text-gray-300"
            >
              {t("register.back")}
            </button>
          </form>
        )}

        {flow === "code-entry" && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t("register.hotelCode")}</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className={`${inputClass} uppercase tracking-widest`}
                placeholder="ABCD1234"
                required
              />
              <p className="mt-1 text-xs text-gray-500">{t("register.hotelCodeHint")}</p>
            </div>
            <Button type="submit" variant="primary" fullWidth disabled={loading}>
              {loading ? t("register.verifying") : t("register.verifyCode")}
            </Button>
            <button
              type="button"
              onClick={switchToOwnerFlow}
              className="w-full text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2"
            >
              {t("register.registerHotelInstead")}
            </button>
          </form>
        )}

        {flow === "staff-details" && (
          <form onSubmit={handleStaffRegister} className="space-y-4">
            <p className="text-xs text-gray-500 text-center">
              {t("register.joiningHotel")}: <span className="text-gray-300">{inviteHotelName}</span>
            </p>
            {renderPersonalFields(true)}
            <Button type="submit" variant="primary" fullWidth disabled={loading}>
              {loading ? t("register.submitting") : t("register.completeRegistration")}
            </Button>
            <button
              type="button"
              onClick={() => setFlow("code-entry")}
              className="w-full text-sm text-gray-400 hover:text-gray-300"
            >
              {t("register.back")}
            </button>
          </form>
        )}

        <Link to="/login" className="block text-center text-sm text-gray-400 hover:text-gray-300">
          {t("register.backToLogin")}
        </Link>
      </Card>
    </div>
  );
}

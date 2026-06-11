import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { stripeApi } from "../../api/api";
import type { Booking } from "../../mocks/bookings";
import Button from "../../ui/Button";
import Card from "../../ui/Card";
import LoadingSpinner from "../../ui/LoadingSpinner";
import ErrorState from "../../ui/ErrorState";
import toast from "react-hot-toast";
import { useI18n } from "../../i18n";

export default function BookingSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const sessionId = searchParams.get("session_id");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadBookingBySession(sessionId);
    } else {
      setError("No session ID provided");
      setLoading(false);
    }
  }, [sessionId]);

  const loadBookingBySession = async (sessionId: string) => {
    try {
      const data = await stripeApi.confirmAndGetBooking(sessionId);
      setBooking(data);
      toast.success(t("bookingSuccess.paymentSuccess"));
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail || t("bookingSuccess.loadFailed"));
      toast.error(t("bookingSuccess.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const guestLink = booking?.guestToken
    ? `${window.location.origin}/guest/${booking.guestToken}`
    : "";

  const copyGuestLink = () => {
    if (!guestLink) return;
    navigator.clipboard.writeText(guestLink);
    toast.success(t("bookingSuccess.linkCopied"));
  };

  const handleAccessRoom = () => {
    if (booking?.guestToken) {
      navigate(`/guest/${booking.guestToken}`);
    } else {
      toast.error(t("bookingSuccess.tokenUnavailable"));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <LoadingSpinner message={t("bookingSuccess.confirming")} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
        <ErrorState title="Error" message={error} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4 py-8">
      <Card className="max-w-2xl w-full" padding="lg">
        <div className="text-center mb-6">
          <div className="inline-block bg-green-100 dark:bg-green-900/30 rounded-full p-4 mb-4">
            <svg
              className="w-16 h-16 text-green-600 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t("bookingSuccess.title")}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
            {t("bookingSuccess.confirmed")}
          </p>
        </div>

        {booking ? (
          <>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {t("bookingSuccess.detailsTitle")}
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{t("bookingSuccess.bookingCode")}</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-white">
                    #{booking.id}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{t("bookingSuccess.guestLabel")}</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {booking.guestName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{t("bookingSuccess.roomLabel")}</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {booking.roomNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{t("bookingSuccess.checkInLabel")}</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {new Date(booking.checkIn).toLocaleDateString(locale, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">{t("bookingSuccess.checkOutLabel")}</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {new Date(booking.checkOut).toLocaleDateString(locale, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">{t("bookingSuccess.statusLabel")}</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {booking.status}
                  </span>
                </div>
              </div>
            </div>

            {booking.guestToken && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  {t("bookingSuccess.accessTitle")}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  {t("bookingSuccess.accessDesc")}
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={guestLink}
                    className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                  />
                  <Button variant="secondary" onClick={copyGuestLink}>
                    {t("bookingSuccess.copy")}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Button variant="primary" fullWidth size="lg" onClick={handleAccessRoom}>
                {t("bookingSuccess.openAccess")}
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => navigate("/book")}
              >
                {t("bookingSuccess.bookAnother")}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                {t("bookingSuccess.paymentOkNotice")}
              </p>
            </div>
            <Button
              variant="primary"
              fullWidth
              onClick={() => navigate("/book")}
            >
              {t("bookingSuccess.returnToBooking")}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

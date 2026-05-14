import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { stripeApi } from "../../api/api";
import type { Booking } from "../../mocks/bookings";
import Button from "../../ui/Button";
import Card from "../../ui/Card";
import LoadingSpinner from "../../ui/LoadingSpinner";
import ErrorState from "../../ui/ErrorState";
import toast from "react-hot-toast";

export default function BookingSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
      toast.success("Payment successful! Your booking is confirmed.");
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail || "Failed to load booking details");
      toast.error("Could not load booking details.");
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
    toast.success("Room access link copied to clipboard");
  };

  const handleAccessRoom = () => {
    if (booking?.guestToken) {
      navigate(`/guest/${booking.guestToken}`);
    } else {
      toast.error("Room access token not available.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <LoadingSpinner message="Confirming your booking..." />
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
            Payment Successful!
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
            Your booking has been confirmed.
          </p>
        </div>

        {booking ? (
          <>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Booking details
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Booking code:</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-white">
                    #{booking.id}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Guest:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {booking.guestName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Room:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {booking.roomNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Check-in:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {new Date(booking.checkIn).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Check-out:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {new Date(booking.checkOut).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Status:</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {booking.status}
                  </span>
                </div>
              </div>
            </div>

            {booking.guestToken && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Room access (guest link)
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  Save this link to open WiFi, instructions and checkout. No email needed.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={guestLink}
                    className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white"
                  />
                  <Button variant="secondary" onClick={copyGuestLink}>
                    Copy
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Button variant="primary" fullWidth size="lg" onClick={handleAccessRoom}>
                Open room access page
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => navigate("/book")}
              >
                Book another room
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Your payment was successful. If details do not appear, refresh the page
                or save this URL and open it later to see your booking and room access link.
              </p>
            </div>
            <Button
              variant="primary"
              fullWidth
              onClick={() => navigate("/book")}
            >
              Return to booking
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

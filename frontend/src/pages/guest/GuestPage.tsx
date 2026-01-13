import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { guestApi } from "../../api/api";
import type { GuestToken } from "../../mocks/guest";
import toast from "react-hot-toast";

export default function GuestPage() {
  const { token } = useParams<{ token: string }>();
  const [guest, setGuest] = useState<GuestToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [qrSize, setQrSize] = useState(200);

  useEffect(() => {
    if (token) {
      loadGuestData(token);
    } else {
      setLoading(false);
      setGuest(null);
    }
  }, [token]);

  useEffect(() => {
    const updateQrSize = () => {
      setQrSize(window.innerWidth < 640 ? 160 : 200);
    };
    updateQrSize();
    window.addEventListener("resize", updateQrSize);
    return () => window.removeEventListener("resize", updateQrSize);
  }, []);

  const loadGuestData = async (guestToken: string) => {
    try {
      setLoading(true);
      const data = await guestApi.getByToken(guestToken);
      if (!data) {
        toast.error("Invalid token");
        return;
      }
      if (!data.isValid) {
        toast.error("Token expired");
      }
      setGuest(data);
    } catch (error) {
      toast.error("Error loading data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!token || !guest) return;

    if (!confirm("Are you sure you want to check out?")) {
      return;
    }

    try {
      setCheckingOut(true);
      await guestApi.checkOut(token);
      toast.success("Check out successfully. Thank you for your visit!");
      // Reload data to make the token invalid in UI
      await loadGuestData(token);
    } catch (error) {
      toast.error("Error checking out");
      console.error(error);
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!guest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Error</h1>
          <p className="text-gray-600 dark:text-gray-400">Invalid or expired token</p>
        </div>
      </div>
    );
  }

  const qrValue = `${window.location.origin}/guest/${token}`;
  const checkInDate = new Date(guest.checkIn);
  const checkOutDate = new Date(guest.checkOut);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md lg:max-w-4xl xl:max-w-6xl">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">NextStay</h1>
          <p className="text-gray-600 dark:text-gray-300">Welcome, {guest.guestName}!</p>
        </div>

        {/* Main Card - responsive layout */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6 mb-4 lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">
          {/* Left Column - QR Code and Room Info */}
          <div className="lg:flex lg:flex-col lg:items-center">
            {/* Room Info */}
            <div className="text-center mb-4 sm:mb-6">
              <div className="inline-block bg-blue-100 dark:bg-blue-900/30 rounded-full p-3 sm:p-4 mb-3">
                <span className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">
                  #{guest.roomNumber}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-1">
                Room {guest.roomNumber}
              </h2>
              {!guest.isValid && (
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                  Token expired
                </p>
              )}
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-4 sm:mb-6 lg:mb-0">
              <div className="bg-white dark:bg-gray-700 p-3 sm:p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600">
                <QRCodeSVG
                  value={qrValue}
                  size={qrSize}
                  level="H"
                />
              </div>
            </div>
          </div>

          {/* Right Column - Booking Info and Actions */}
          <div className="lg:flex lg:flex-col lg:justify-between lg:h-full">
            {/* Booking Info */}
            <div className="space-y-3 mb-4 sm:mb-6 lg:mb-6">
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">Check-in</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {checkInDate.toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">Check-out</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {checkOutDate.toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Guest</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {guest.guestName}
                </span>
              </div>
            </div>

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={checkingOut || !guest.isValid}
              className="w-full py-3 px-4 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
            >
              {checkingOut ? "Checking out..." : "Check out"}
            </button>
          </div>
        </div>

        {/* Info */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Show the QR code to the staff for quick access
          </p>
        </div>
      </div>
    </div>
  );
}

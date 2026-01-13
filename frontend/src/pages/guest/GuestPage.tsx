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

  useEffect(() => {
    if (token) {
      loadGuestData(token);
    } else {
      setLoading(false);
      setGuest(null);
    }
  }, [token]);

  const loadGuestData = async (guestToken: string) => {
    try {
      setLoading(true);
      const data = await guestApi.getByToken(guestToken);
      if (!data) {
        toast.error("Неверный токен");
        return;
      }
      if (!data.isValid) {
        toast.error("Токен истек");
      }
      setGuest(data);
    } catch (error) {
      toast.error("Ошибка загрузки данных");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!token || !guest) return;

    if (!confirm("Вы уверены, что хотите выехать?")) {
      return;
    }

    try {
      setCheckingOut(true);
      await guestApi.checkOut(token);
      toast.success("Выезд успешно оформлен. Спасибо за визит!");
      // Перезагружаем данные, чтобы токен стал невалидным в UI
      await loadGuestData(token);
    } catch (error) {
      toast.error("Ошибка при оформлении выезда");
      console.error(error);
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Загрузка...</div>
      </div>
    );
  }

  if (!guest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Ошибка</h1>
          <p className="text-gray-600">Неверный или истекший токен</p>
        </div>
      </div>
    );
  }

  const qrValue = `${window.location.origin}/guest/${token}`;
  const checkInDate = new Date(guest.checkIn);
  const checkOutDate = new Date(guest.checkOut);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">NextStay</h1>
          <p className="text-gray-600">Добро пожаловать, {guest.guestName}!</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-4">
          {/* Room Info */}
          <div className="text-center mb-6">
            <div className="inline-block bg-blue-100 rounded-full p-4 mb-3">
              <span className="text-3xl font-bold text-blue-600">
                #{guest.roomNumber}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              Комната {guest.roomNumber}
            </h2>
            {!guest.isValid && (
              <p className="text-sm text-red-600 font-medium">
                Токен истек
              </p>
            )}
          </div>

          {/* QR Code */}
          <div className="flex justify-center mb-6">
            <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
              <QRCodeSVG
                value={qrValue}
                size={200}
                level="H"
              />
            </div>
          </div>

          {/* Booking Info */}
          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Заезд</span>
              <span className="text-sm font-medium text-gray-900">
                {checkInDate.toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Выезд</span>
              <span className="text-sm font-medium text-gray-900">
                {checkOutDate.toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-600">Гость</span>
              <span className="text-sm font-medium text-gray-900">
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
            {checkingOut ? "Оформление..." : "Оформить выезд"}
          </button>
        </div>

        {/* Info */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            Покажите QR-код персоналу для быстрого доступа
          </p>
        </div>
      </div>
    </div>
  );
}

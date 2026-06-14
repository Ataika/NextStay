import { useState, useEffect, useRef, useCallback } from "react";
import { roomsApi, bookingsApi, stripeApi, holdsApi, hotelsApi } from "../../api/api";
import type { HoldResponse, AvailableHotel } from "../../api/api";
import Button from "../../ui/Button";
import Card from "../../ui/Card";
import Modal from "../../ui/Modal";
import LoadingSpinner from "../../ui/LoadingSpinner";
import toast from "react-hot-toast";
import { useI18n } from "../../i18n";
import { resolveMediaUrl } from "../../utils/roomDisplay";

type BookingStep = "dates" | "hotels" | "rooms";

function getOrCreateSessionId(): string {
  let id = sessionStorage.getItem("nextstay_session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("nextstay_session_id", id);
  }
  return id;
}

const HOLD_SECONDS = 10 * 60; // 10 minutes

interface AvailableRoom {
  id: number;
  number: string;
  category: string;
  price: number;
  capacity: number;
  description: string | null;
  amenities: string[] | null;
  photoUrl?: string | null;
  bedType?: string | null;
  viewType?: string | null;
  areaSqm?: number | null;
  totalPrice: number;
  nights: number;
}

function calcNights(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function toIsoDateTime(date: string, hour: "checkIn" | "checkOut"): string {
  return `${date}T${hour === "checkIn" ? "14:00:00" : "12:00:00"}Z`;
}

export default function BookingPage() {
  const { t, locale } = useI18n();
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [step, setStep] = useState<BookingStep>("dates");
  const [availableHotels, setAvailableHotels] = useState<AvailableHotel[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<AvailableHotel | null>(null);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<AvailableRoom | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingData, setBookingData] = useState({
    guestName: "",
    email: "",
    specialRequests: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [activeHold, setActiveHold] = useState<HoldResponse | null>(null);
  const [holdSecondsLeft, setHoldSecondsLeft] = useState(0);
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const releaseHold = useCallback(async (hold: HoldResponse) => {
    clearHoldTimer();
    try {
      await holdsApi.release(hold.id, hold.session_id);
    } catch {
      // Best-effort — hold will expire on its own
    }
    setActiveHold(null);
    setHoldSecondsLeft(0);
  }, [clearHoldTimer]);

  useEffect(() => {
    return () => {
      clearHoldTimer();
    };
  }, [clearHoldTimer]);

  const today = new Date().toISOString().split("T")[0];
  const nights = checkIn && checkOut ? calcNights(checkIn, checkOut) : 0;

  const formatShortDate = (value: string) =>
    new Date(value).toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
    });

  const formatLongDate = (value: string) =>
    new Date(value).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const resetFlow = () => {
    setStep("dates");
    setAvailableHotels([]);
    setSelectedHotel(null);
    setAvailableRooms([]);
    setSearchError(null);
  };

  const handleSearchHotels = async () => {
    if (!checkIn || !checkOut) {
      toast.error(t("bookingPage.errorNoDates"));
      return;
    }

    if (checkOut <= checkIn) {
      toast.error(t("bookingPage.errorCheckout"));
      return;
    }

    try {
      setLoading(true);
      setSearchError(null);
      setSelectedHotel(null);
      setAvailableRooms([]);
      const checkInISO = toIsoDateTime(checkIn, "checkIn");
      const checkOutISO = toIsoDateTime(checkOut, "checkOut");
      const result = await hotelsApi.getAvailable(checkInISO, checkOutISO);
      setAvailableHotels(result.hotels || []);
      setStep("hotels");

      if (result.hotels.length === 0) {
        toast.error(t("bookingPage.errorNoHotels"));
      } else {
        toast.success(t("bookingPage.foundHotels", { count: String(result.hotels.length) }));
      }
    } catch (error: any) {
      console.error("Hotel search error:", error);
      const errorMessage = error?.response?.data?.detail || error?.message || "Failed to search hotels";
      toast.error(errorMessage);
      setSearchError(errorMessage);
      setAvailableHotels([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHotel = async (hotel: AvailableHotel) => {
    setSelectedHotel(hotel);
    try {
      setLoading(true);
      setSearchError(null);
      const checkInISO = toIsoDateTime(checkIn, "checkIn");
      const checkOutISO = toIsoDateTime(checkOut, "checkOut");
      const result = await roomsApi.getAvailable(checkInISO, checkOutISO, { hotelId: hotel.id });
      setAvailableRooms(result.availableRooms || []);
      setStep("rooms");

      if (result.availableRooms.length === 0) {
        toast.error(t("bookingPage.errorNoRooms"));
      }
    } catch (error: any) {
      console.error("Room search error:", error);
      const errorMessage = error?.response?.data?.detail || error?.message || "Failed to search rooms";
      toast.error(errorMessage);
      setSearchError(errorMessage);
      setAvailableRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const hotelsByCity = availableHotels.reduce<Record<string, AvailableHotel[]>>((acc, hotel) => {
    const cityKey = hotel.city?.trim() || t("bookingPage.otherLocations");
    if (!acc[cityKey]) acc[cityKey] = [];
    acc[cityKey].push(hotel);
    return acc;
  }, {});

  const handleBookRoom = async (room: AvailableRoom) => {
    setSelectedRoom(room);

    const sessionId = getOrCreateSessionId();
    const checkInISO = toIsoDateTime(checkIn, "checkIn");
    const checkOutISO = toIsoDateTime(checkOut, "checkOut");

    try {
      const hold = await holdsApi.create(room.id, checkInISO, checkOutISO, sessionId);
      setActiveHold(hold);

      const expiresAt = new Date(hold.expires_at).getTime();
      clearHoldTimer();
      holdTimerRef.current = setInterval(() => {
        const left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
        setHoldSecondsLeft(left);
        if (left === 0) {
          clearHoldTimer();
          setActiveHold(null);
          setShowBookingForm(false);
          toast.error(t("bookingPage.holdExpired"));
        }
      }, 1000);
      setHoldSecondsLeft(HOLD_SECONDS);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Could not hold this room. Please try again.";
      toast.error(msg);
      return;
    }

    setShowBookingForm(true);
  };

  const handleCloseBookingForm = async () => {
    if (activeHold) {
      await releaseHold(activeHold);
    }
    setShowBookingForm(false);
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRoom) return;

    if (!bookingData.guestName.trim()) {
      toast.error(t("bookingPage.errorNoName"));
      return;
    }

    if (!bookingData.email.trim()) {
      toast.error(t("bookingPage.errorNoEmail"));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(bookingData.email)) {
      toast.error(t("bookingPage.errorInvalidEmail"));
      return;
    }

    try {
      setSubmitting(true);

      const checkInDateTime = toIsoDateTime(checkIn, "checkIn");
      const checkOutDateTime = toIsoDateTime(checkOut, "checkOut");

      const booking = await bookingsApi.create({
        guestName: bookingData.guestName,
        roomId: selectedRoom.id,
        roomNumber: selectedRoom.number,
        checkIn: checkInDateTime,
        checkOut: checkOutDateTime,
        status: "Pending",
        notes: bookingData.specialRequests || undefined,
        email: bookingData.email,
        holdId: activeHold?.id,
        sessionId: activeHold?.session_id,
      });
      clearHoldTimer();
      setActiveHold(null);

      const checkoutSession = await stripeApi.createCheckoutSession(booking.id);

      if (checkoutSession.url) {
        window.location.href = checkoutSession.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.detail || "Failed to create booking");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            {t("bookingPage.title")}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {t("bookingPage.subtitle")}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
          {(["dates", "hotels", "rooms"] as BookingStep[]).map((item, index) => {
            const labels = {
              dates: t("bookingPage.stepDates"),
              hotels: t("bookingPage.stepHotels"),
              rooms: t("bookingPage.stepRooms"),
            };
            const isActive = step === item;
            const isDone =
              (item === "dates" && (step === "hotels" || step === "rooms")) ||
              (item === "hotels" && step === "rooms");
            return (
              <div key={item} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : isDone
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                        : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                  }`}
                >
                  <span>{index + 1}</span>
                  <span>{labels[item]}</span>
                </div>
                {index < 2 && <span className="text-gray-400">→</span>}
              </div>
            );
          })}
        </div>

        {/* Dates */}
        <Card className="mb-8" padding="lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t("bookingPage.checkInLabel")}
              </label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => {
                  setCheckIn(e.target.value);
                  if (step !== "dates") resetFlow();
                }}
                min={today}
                disabled={step === "rooms" && loading}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t("bookingPage.checkOutLabel")}
              </label>
              <input
                type="date"
                value={checkOut}
                onChange={(e) => {
                  setCheckOut(e.target.value);
                  if (step !== "dates") resetFlow();
                }}
                min={checkIn || today}
                disabled={step === "rooms" && loading}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>
            <div className="flex items-end">
              {step === "dates" ? (
                <Button
                  variant="primary"
                  fullWidth
                  onClick={handleSearchHotels}
                  disabled={loading || !checkIn || !checkOut}
                >
                  {loading ? t("bookingPage.searching") : t("bookingPage.searchHotels")}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    resetFlow();
                    setCheckIn("");
                    setCheckOut("");
                  }}
                >
                  {t("bookingPage.changeDates")}
                </Button>
              )}
            </div>
          </div>

          {checkIn && checkOut && checkOut > checkIn && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">
                {formatShortDate(checkIn)} – {formatShortDate(checkOut)}
              </span>
              <span className="text-gray-400">·</span>
              <span>
                {nights}{" "}
                {nights === 1 ? t("bookingPage.nights") : t("bookingPage.nightsPlural")}
              </span>
            </div>
          )}
        </Card>

        {loading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner
              message={
                step === "rooms" || selectedHotel
                  ? t("bookingPage.searchingRooms")
                  : t("bookingPage.searchingHotels")
              }
            />
          </div>
        )}

        {/* Hotels step */}
        {!loading && step === "hotels" && (
          <div>
            {availableHotels.length > 0 ? (
              <div className="space-y-8">
                {Object.entries(hotelsByCity).map(([city, hotels]) => (
                  <div key={city}>
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                      {t("bookingPage.cityHotels", { city })}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {hotels.map((hotel) => (
                        <Card
                          key={hotel.id}
                          padding="md"
                          className="hover:shadow-lg transition-shadow cursor-pointer"
                        >
                          <button
                            type="button"
                            className="w-full text-left space-y-4"
                            onClick={() => void handleSelectHotel(hotel)}
                          >
                            <div>
                              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                                {hotel.hotelName}
                              </h3>
                              {hotel.address && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                                  {hotel.address}
                                </p>
                              )}
                            </div>
                            <div className="flex items-end justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                              <div>
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                  {t("bookingPage.fromPrice", {
                                    price: hotel.minPricePerNight.toFixed(2),
                                  })}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {t("bookingPage.perNight")}
                                </p>
                              </div>
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {t("bookingPage.roomsAvailable", {
                                  count: String(hotel.availableRoomCount),
                                })}
                              </span>
                            </div>
                            <span className="inline-flex text-sm font-medium text-blue-600 dark:text-blue-400">
                              {t("bookingPage.viewRooms")} →
                            </span>
                          </button>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Card padding="lg">
                <div className="text-center py-8">
                  {searchError ? (
                    <p className="text-red-600 dark:text-red-400 mb-2 font-medium">{searchError}</p>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      {t("bookingPage.noHotelsAvailable")}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    {formatLongDate(checkIn)} – {formatLongDate(checkOut)}
                  </p>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Rooms step */}
        {!loading && step === "rooms" && selectedHotel && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setStep("hotels");
                    setSelectedHotel(null);
                    setAvailableRooms([]);
                    setSearchError(null);
                  }}
                >
                  ← {t("bookingPage.backToHotels")}
                </Button>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mt-3">
                  {selectedHotel.hotelName}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {formatLongDate(checkIn)} – {formatLongDate(checkOut)} · {nights}{" "}
                  {nights === 1 ? t("bookingPage.nights") : t("bookingPage.nightsPlural")}
                </p>
              </div>
            </div>

            {availableRooms.length > 0 ? (
              <>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  {t("bookingPage.availableRooms", { count: String(availableRooms.length) })}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {availableRooms.map((room) => (
                    <Card key={room.id} padding="md" className="hover:shadow-lg transition-shadow">
                      <div className="space-y-4">
                        {room.photoUrl && (
                          <div className="aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                            <img
                              src={resolveMediaUrl(room.photoUrl)}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                              {t("bookingPage.roomNumber", { number: room.number })}
                            </h3>
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                              {room.category}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {room.description || t("bookingPage.defaultRoomDesc")}
                          </p>
                          {(room.bedType || room.viewType || room.areaSqm) && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                              {[room.bedType, room.viewType, room.areaSqm ? `${room.areaSqm} m²` : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>

                        {room.amenities && room.amenities.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                              {t("bookingPage.amenitiesLabel")}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {room.amenities.slice(0, 3).map((amenity, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300"
                                >
                                  {amenity}
                                </span>
                              ))}
                              {room.amenities.length > 3 && (
                                <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                                  {t("bookingPage.moreAmenities", {
                                    count: String(room.amenities.length - 3),
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {room.nights}{" "}
                              {room.nights !== 1
                                ? t("bookingPage.nightsPlural")
                                : t("bookingPage.nights")}
                            </span>
                            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                              ${room.totalPrice.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>${room.price.toFixed(2)}/night</span>
                            <span>
                              {t("bookingPage.capacity")} {room.capacity}
                            </span>
                          </div>
                        </div>

                        <Button variant="primary" fullWidth onClick={() => void handleBookRoom(room)}>
                          {t("bookingPage.bookNow")}
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <Card padding="lg">
                <div className="text-center py-8">
                  {searchError ? (
                    <p className="text-red-600 dark:text-red-400 mb-2 font-medium">{searchError}</p>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      {t("bookingPage.noRoomsAvailable")}
                    </p>
                  )}
                </div>
              </Card>
            )}
          </div>
        )}

        {!loading && step === "dates" && !checkIn && !checkOut && (
          <Card padding="lg">
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">{t("bookingPage.selectDates")}</p>
            </div>
          </Card>
        )}
      </div>

      {/* Booking Form Modal */}
      <Modal
        isOpen={showBookingForm}
        onClose={() => void handleCloseBookingForm()}
        title={t("bookingPage.bookingFormTitle")}
        size="lg"
      >
        {selectedRoom && (
          <form onSubmit={handleSubmitBooking} className="space-y-4">
            {/* Hold countdown banner */}
            {activeHold && holdSecondsLeft > 0 && (
              <div className={`flex items-center justify-between rounded-lg px-4 py-2 text-sm font-medium ${
                holdSecondsLeft <= 60
                  ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                  : "bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              }`}>
                <span>{t("bookingPage.roomHeld")}</span>
                <span className="tabular-nums">
                  {Math.floor(holdSecondsLeft / 60)}:{String(holdSecondsLeft % 60).padStart(2, "0")} left
                </span>
              </div>
            )}

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-gray-900 dark:text-white">
                  {t("bookingPage.roomNumber", { number: selectedRoom.number })}
                </span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  ${selectedRoom.totalPrice.toFixed(2)}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {new Date(checkIn).toLocaleDateString(locale)} -{" "}
                {new Date(checkOut).toLocaleDateString(locale)} ({selectedRoom.nights}{" "}
                {selectedRoom.nights !== 1 ? t("bookingPage.nightsPlural") : t("bookingPage.nights")})
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t("bookingPage.fullName")} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={bookingData.guestName}
                onChange={(e) =>
                  setBookingData({ ...bookingData, guestName: e.target.value })
                }
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder={t("bookingPage.namePlaceholder")}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t("bookingPage.emailLabel")} <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={bookingData.email}
                onChange={(e) =>
                  setBookingData({ ...bookingData, email: e.target.value })
                }
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder={t("bookingPage.emailPlaceholder")}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t("bookingPage.specialRequests")}
              </label>
              <textarea
                value={bookingData.specialRequests}
                onChange={(e) =>
                  setBookingData({ ...bookingData, specialRequests: e.target.value })
                }
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder={t("bookingPage.requestsPlaceholder")}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => void handleCloseBookingForm()}
                disabled={submitting}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                fullWidth
                disabled={submitting}
              >
                {submitting ? t("bookingPage.processing") : t("bookingPage.confirmBooking")}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

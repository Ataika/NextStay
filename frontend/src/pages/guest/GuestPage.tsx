import { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { guestApi, hotelProfileApi, type HotelProfileData } from "../../api/api";
import LanguageSelector from "../../components/LanguageSelector";
import { useI18n } from "../../i18n";
import { formatDuration } from "../../utils/format";
import type { GuestToken } from "../../mocks/guest";
import LoadingSpinner from "../../ui/LoadingSpinner";
import ErrorState from "../../ui/ErrorState";
import Button from "../../ui/Button";
import Card from "../../ui/Card";
import Modal from "../../ui/Modal";
import toast from "react-hot-toast";

const googleMapsEmbedApiKey = import.meta.env.VITE_GOOGLE_MAPS_EMBED_API_KEY?.trim() ?? "";

function buildHotelLocationQuery(hotelProfile: HotelProfileData | null): string | null {
  if (!hotelProfile) return null;

  const address = hotelProfile.address?.trim();
  if (address) {
    return address;
  }

  if (hotelProfile.lat !== null && hotelProfile.lng !== null) {
    return `${hotelProfile.lat},${hotelProfile.lng}`;
  }

  return null;
}

function buildGoogleMapsLink(query: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}`;
}

function buildGoogleMapsEmbedUrl(query: string): string {
  if (googleMapsEmbedApiKey) {
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(googleMapsEmbedApiKey)}&q=${encodeURIComponent(query)}`;
  }

  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`;
}

export default function GuestPage() {
  const { token } = useParams<{ token: string }>();
  const { locale, t } = useI18n();
  const [guest, setGuest] = useState<GuestToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [qrSize, setQrSize] = useState(200);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactMessage, setContactMessage] = useState("");
  const [justCheckedOut, setJustCheckedOut] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [hotelProfile, setHotelProfile] = useState<HotelProfileData | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const checkoutCountdown = useMemo(() => {
    if (!guest?.checkOut || guest.accessStatus !== "Active") return null;
    const checkout = new Date(guest.checkOut);
    if (checkout <= now) return null;
    return formatDuration(now, checkout);
  }, [guest, now]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setGuest(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const data = await guestApi.getByToken(token);
        if (cancelled) return;

        if (!data) {
          toast.error(t("guest.invalidToast"));
          setGuest(null);
          return;
        }
        if (!data.isValid) {
          toast.error(t("guest.expiredToast"));
        }
        setGuest(data);
      } catch (error) {
        if (!cancelled) {
          toast.error(t("guest.loadError"));
          setGuest(null);
          console.error(error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, t]);

  useEffect(() => {
    const updateQrSize = () => {
      setQrSize(window.innerWidth < 640 ? 160 : 200);
    };
    updateQrSize();
    window.addEventListener("resize", updateQrSize);
    return () => window.removeEventListener("resize", updateQrSize);
  }, []);

  useEffect(() => {
    hotelProfileApi.get().then(setHotelProfile).catch(() => {});
  }, []);

  const handleCheckout = async () => {
    if (!token || !guest) return;

    setShowCheckoutModal(true);
  };

  const confirmCheckout = async () => {
    if (!token || !guest) return;

    try {
      setCheckingOut(true);
      setShowCheckoutModal(false);
      await guestApi.checkOut(token);
      setJustCheckedOut(true);
    } catch (error) {
      toast.error(t("guest.checkoutError"));
      console.error(error);
    } finally {
      setCheckingOut(false);
    }
  };

  const handleCopyPassword = () => {
    if (guest?.wifi.password) {
      navigator.clipboard.writeText(guest.wifi.password);
      toast.success(t("guest.wifiCopied"));
    }
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactMessage.trim()) {
      toast.error(t("guest.messageRequired"));
      return;
    }
    // In real app, this would send to backend
    toast.success(t("guest.messageSent"));
    setContactMessage("");
    setShowContactForm(false);
  };

  const handleQuickAction = (action: string) => {
    toast.success(
      locale === "it-IT"
        ? `Richiesta inviata: ${action}. La gestiremo a breve.`
        : `${action} request sent! We'll process it shortly.`
    );
  };

  const handleCopyGuestLink = () => {
    if (token) {
      const link = `${window.location.origin}/guest/${token}`;
      navigator.clipboard.writeText(link);
      toast.success(t("guest.guestLinkCopied"));
    }
  };

  const handleCopyBookingInfo = () => {
    if (guest) {
      const bookingInfo = `${t("guest.bookingDetails")}:
${t("guest.roomLabel", { room: guest.roomNumber })}
${locale === "it-IT" ? "Ospite" : "Guest"}: ${guest.guestName}
${t("guest.checkIn")}: ${new Date(guest.checkIn).toLocaleDateString(locale)}
${t("guest.checkOut")}: ${new Date(guest.checkOut).toLocaleDateString(locale)}
${locale === "it-IT" ? "ID prenotazione" : "Booking ID"}: ${guest.bookingId}`;
      navigator.clipboard.writeText(bookingInfo);
      toast.success(t("guest.bookingInfoCopied"));
    }
  };

  const getAccessStatusColor = (status: GuestToken["accessStatus"]) => {
    switch (status) {
      case "Active":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700";
      case "Expired":
        return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700";
      case "Checked out":
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600";
      default:
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600";
    }
  };

  const getAccessStatusMessage = (status: GuestToken["accessStatus"]) => {
    switch (status) {
      case "Active":
        return t("guest.accessMessageActive");
      case "Expired":
        return t("guest.accessMessageExpired");
      case "Checked out":
        return t("guest.accessMessageCheckedOut");
      default:
        return "";
    }
  };

  if (loading) {
    return <LoadingSpinner message={t("guest.loading")} fullScreen={true} />;
  }

  if (justCheckedOut) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4 py-8">
        <Card className="max-w-md w-full text-center" padding="lg">
          <div className="mb-4 flex justify-end">
            <LanguageSelector compact />
          </div>
          <div className="mb-6">
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
              {t("guest.farewellTitle")}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
              {t("guest.farewellThanks")}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
              {t("guest.farewellHope")}
            </p>
          </div>
          <div className="space-y-3">
            <Button
              variant="primary"
              fullWidth
              onClick={() => toast.success(t("guest.reviewToast"))}
            >
              {t("guest.leaveReview")}
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => (window.location.href = "/book")}
            >
              {t("guest.bookAgain")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!guest) {
    return (
      <ErrorState
        title={t("guest.invalidTitle")}
        message={t("guest.invalidMessage")}
        fullScreen={true}
      />
    );
  }

  const qrValue = `${window.location.origin}/guest/${token}`;
  const checkInDate = new Date(guest.checkIn);
  const checkOutDate = new Date(guest.checkOut);
  const activeFromDate = new Date(guest.instructions.activeFrom);
  const activeUntilDate = new Date(guest.instructions.activeUntil);
  const hotelLocationQuery = buildHotelLocationQuery(hotelProfile);
  const hotelMapLink = hotelLocationQuery ? buildGoogleMapsLink(hotelLocationQuery) : null;
  const hotelMapEmbedUrl = hotelLocationQuery ? buildGoogleMapsEmbedUrl(hotelLocationQuery) : null;
  const nextStayPromo = locale === "it-IT"
    ? {
        eyebrow: "Scopri NextStay",
        title: "Vuoi vedere la piattaforma dietro il tuo soggiorno?",
        text: "Apri la pagina pubblica di NextStay per conoscere il progetto, il modello di business e i modi per contattare il team.",
        cta: "Visita la pagina NextStay",
      }
    : {
        eyebrow: "Discover NextStay",
        title: "Want to see the platform behind your stay?",
        text: "Open the public NextStay page to explore the project, the business model, and a few ways to reach the team.",
        cta: "Visit the NextStay page",
      };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md lg:max-w-2xl space-y-4">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="mb-4 flex justify-end">
            <LanguageSelector compact />
          </div>
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">NextStay</h1>
            <p className="text-gray-600 dark:text-gray-300">{t("guest.welcome", { name: guest.guestName })}</p>
          </div>
        </div>

        {/* Main Card - Status, Room Number and QR Code */}
        <Card className="mb-4 rounded-2xl shadow-xl" padding="lg">
          <div className="text-center">
            {/* Access Status Badge */}
            <div className="mb-6">
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className={`px-3 py-1 text-sm font-semibold rounded-full border ${getAccessStatusColor(guest.accessStatus)}`}>
                  {guest.accessStatus === "Active"
                    ? t("guest.accessActive")
                    : guest.accessStatus === "Expired"
                      ? t("guest.accessExpired")
                      : t("guest.accessCheckedOut")}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {getAccessStatusMessage(guest.accessStatus)}
              </p>
              {checkoutCountdown && (
                <p className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                  {locale === "it-IT" ? "Tempo rimanente" : "Time remaining"}: {checkoutCountdown}
                </p>
              )}
            </div>

            {/* Room Number */}
            <div className="mb-6">
              <div className="inline-block bg-blue-100 dark:bg-blue-900/30 rounded-full p-4 sm:p-6 mb-4">
                <span className="text-4xl sm:text-5xl font-bold text-blue-600 dark:text-blue-400">
                  #{guest.roomNumber}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white mb-2">
                {t("guest.roomLabel", { room: guest.roomNumber })}
              </h2>
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-6">
              <div className="bg-white p-4 sm:p-6 rounded-lg border-2 border-gray-200 dark:border-gray-600 shadow-sm">
                <QRCodeCanvas
                  value={qrValue}
                  size={qrSize}
                  level="H"
                  bgColor="#ffffff"
                  fgColor="#000000"
                  includeMargin
                  role="img"
                  aria-label={t("guest.qrAlt")}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <Button
                variant="primary"
                fullWidth
                onClick={() => setShowDetailsModal(true)}
              >
                {t("guest.details")}
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setShowAccessModal(true)}
              >
                {t("guest.howToAccess")}
              </Button>
            </div>

            {/* Booking Info */}
            <div className="space-y-2 text-sm border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">{t("guest.checkIn")}</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {checkInDate.toLocaleDateString(locale, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">{t("guest.checkOut")}</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {checkOutDate.toLocaleDateString(locale, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>

            {/* Checkout Button */}
            <div className="mt-6">
              <Button
                variant="danger"
                size="lg"
                fullWidth
                onClick={handleCheckout}
                disabled={checkingOut || !guest.isValid}
              >
                {checkingOut ? t("guest.checkingOut") : t("guest.checkout")}
              </Button>
            </div>
          </div>
        </Card>

        {/* Copy / Share */}
        <Card padding="md" className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            {t("guest.shareCopy")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={handleCopyGuestLink}
            >
              {t("guest.copyGuestLink")}
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={handleCopyBookingInfo}
            >
              {t("guest.copyBookingInfo")}
            </Button>
          </div>
        </Card>

        {/* Contact / Support */}
        <Card padding="md" className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("guest.needHelp")}
            </h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowContactForm(!showContactForm)}
            >
              {showContactForm ? t("common.cancel") : t("guest.contactHotel")}
            </Button>
          </div>

          {!showContactForm ? (
            <div className="space-y-2 text-sm">
              {guest.contact.phone && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">{t("guest.phone")}</span>
                  <a
                    href={`tel:${guest.contact.phone}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {guest.contact.phone}
                  </a>
                </div>
              )}
              {guest.contact.whatsapp && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">{t("guest.whatsapp")}</span>
                  <a
                    href={`https://wa.me/${guest.contact.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {guest.contact.whatsapp}
                  </a>
                </div>
              )}
              {guest.contact.email && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">{t("guest.email")}</span>
                  <a
                    href={`mailto:${guest.contact.email}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {guest.contact.email}
                  </a>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t("guest.yourMessage")}
                </label>
                <textarea
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder={t("guest.messagePlaceholder")}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                >
                  {t("guest.sendMessage")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowContactForm(false)}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </form>
          )}
        </Card>

        {/* Hotel Location Map */}
        {hotelProfile && hotelMapEmbedUrl && hotelMapLink && (
          <Card className="rounded-2xl shadow-xl overflow-hidden" padding="sm">
            <div className="px-2 pt-2 pb-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5">{t("guest.hotelLocation")}</h3>
              {hotelProfile.address && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{hotelProfile.address}</p>
              )}
            </div>
            <div className="h-52 w-full rounded-xl overflow-hidden">
              <iframe
                title={`${hotelProfile.hotel_name} location`}
                src={hotelMapEmbedUrl}
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
            <div className="px-2 py-2">
              <a
                href={hotelMapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {t("guest.openInGoogleMaps")}
              </a>
            </div>
          </Card>
        )}

        <Link to="/nextstay" className="block group">
          <Card className="overflow-hidden rounded-3xl border border-amber-200 bg-transparent shadow-xl transition-transform duration-200 group-hover:-translate-y-0.5" padding="none">
            <div className="relative bg-[linear-gradient(135deg,#fef3c7_0%,#fff7ed_55%,#ffffff_100%)] px-5 py-5 sm:px-6">
              <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-amber-300/30 blur-2xl" />
              <div className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
                  {nextStayPromo.eyebrow}
                </p>
                <h3 className="mt-2 text-lg font-bold text-gray-900">
                  {nextStayPromo.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {nextStayPromo.text}
                </p>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <span>{nextStayPromo.cta}</span>
                  <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                </div>
              </div>
            </div>
          </Card>
        </Link>

        {/* Info */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t("guest.showQrHint")}
          </p>
        </div>
      </div>

      {/* Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title={t("guest.details")}
        size="lg"
      >
        <div className="space-y-6">
          {/* Wi-Fi Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              {t("guest.wifiInfo")}
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t("guest.networkName")}</p>
                <p className="text-base font-medium text-gray-900 dark:text-white">{guest.wifi.ssid}</p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t("guest.password")}</p>
                  <p className="text-base font-mono font-medium text-gray-900 dark:text-white break-all">
                    {guest.wifi.password}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyPassword}
                >
                  {t("guest.copyPassword")}
                </Button>
              </div>
            </div>
          </div>

          {/* House Rules */}
          {guest.houseRules && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {t("guest.houseRules")}
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <span className="text-gray-500 dark:text-gray-400 mt-0.5">🔇</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white mb-1">{t("guest.quietHours")}</p>
                    <p className="text-gray-600 dark:text-gray-400">{guest.houseRules.quietHours}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-gray-500 dark:text-gray-400 mt-0.5">🚪</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white mb-1">{t("guest.checkoutTime")}</p>
                    <p className="text-gray-600 dark:text-gray-400">{guest.houseRules.checkOutTime}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-gray-500 dark:text-gray-400 mt-0.5">🚭</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white mb-1">{t("guest.smokingPolicy")}</p>
                    <p className="text-gray-600 dark:text-gray-400">{guest.houseRules.smokingPolicy}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {guest.accessStatus === "Active" && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {locale === "it-IT" ? "Azioni rapide" : "Quick actions"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    handleQuickAction("Cleaning");
                    setShowDetailsModal(false);
                  }}
                >
                  {locale === "it-IT" ? "Richiedi pulizia" : "Request cleaning"}
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    handleQuickAction("Issue report");
                    setShowDetailsModal(false);
                  }}
                >
                  {locale === "it-IT" ? "Segnala un problema" : "Report an issue"}
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    handleQuickAction("Late checkout");
                    setShowDetailsModal(false);
                  }}
                >
                  {locale === "it-IT" ? "Richiedi late check-out" : "Late checkout request"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* How to Access Modal */}
      <Modal
        isOpen={showAccessModal}
        onClose={() => setShowAccessModal(false)}
        title={t("guest.howToAccess")}
        size="md"
      >
        <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
          <p>{guest.instructions.accessInfo}</p>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
            <p className="font-medium text-blue-900 dark:text-blue-300 mb-1">
              {locale === "it-IT" ? "Periodo attivo:" : "Active period:"}
            </p>
            <p className="text-blue-800 dark:text-blue-400">
              {activeFromDate.toLocaleString(locale, {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })} - {activeUntilDate.toLocaleString(locale, {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 border border-yellow-200 dark:border-yellow-800">
            <p className="font-medium text-yellow-900 dark:text-yellow-300 mb-1">
              {locale === "it-IT" ? "La porta non si apre?" : "Door not opening?"}
            </p>
            <p className="text-yellow-800 dark:text-yellow-400">{guest.instructions.doorTroubleshooting}</p>
          </div>
        </div>
      </Modal>

      {/* Checkout Confirmation Modal */}
      <Modal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        title={locale === "it-IT" ? "Conferma check-out" : "Confirm checkout"}
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowCheckoutModal(false)}
              disabled={checkingOut}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={confirmCheckout}
              disabled={checkingOut}
            >
              {checkingOut
                ? t("guest.checkingOut")
                : locale === "it-IT"
                  ? "Conferma check-out"
                  : "Confirm checkout"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="text-center">
            <div className="inline-block bg-red-100 dark:bg-red-900/30 rounded-full p-3 mb-4">
              <svg
                className="w-12 h-12 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <p className="text-base text-gray-700 dark:text-gray-300 mb-2">
              {locale === "it-IT"
                ? "Sei sicuro di voler effettuare il check-out?"
                : "Are you sure you want to check out?"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {locale === "it-IT"
                ? "Questa azione non puo essere annullata. La tua chiave di accesso verra disattivata."
                : "This action cannot be undone. Your access key will be deactivated."}
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

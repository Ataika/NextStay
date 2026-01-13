import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { guestApi } from "../../api/api";
import type { GuestToken } from "../../mocks/guest";
import LoadingSpinner from "../../ui/LoadingSpinner";
import ErrorState from "../../ui/ErrorState";
import Button from "../../ui/Button";
import Card from "../../ui/Card";
import Modal from "../../ui/Modal";
import toast from "react-hot-toast";

export default function GuestPage() {
  const { token } = useParams<{ token: string }>();
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

    setShowCheckoutModal(true);
  };

  const confirmCheckout = async () => {
    if (!token || !guest) return;

    try {
      setCheckingOut(true);
      setShowCheckoutModal(false);
      await guestApi.checkOut(token);
      // Reload data to make the token invalid in UI
      await loadGuestData(token);
      setJustCheckedOut(true);
    } catch (error) {
      toast.error("Error checking out");
      console.error(error);
    } finally {
      setCheckingOut(false);
    }
  };

  const handleCopyPassword = () => {
    if (guest?.wifi.password) {
      navigator.clipboard.writeText(guest.wifi.password);
      toast.success("Wi-Fi password copied to clipboard!");
    }
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactMessage.trim()) {
      toast.error("Please enter a message");
      return;
    }
    // In real app, this would send to backend
    toast.success("Message sent! We'll get back to you soon.");
    setContactMessage("");
    setShowContactForm(false);
  };

  const handleQuickAction = (action: string) => {
    toast.success(`${action} request sent! We'll process it shortly.`);
  };

  const handleCopyGuestLink = () => {
    if (token) {
      const link = `${window.location.origin}/guest/${token}`;
      navigator.clipboard.writeText(link);
      toast.success("Guest link copied to clipboard!");
    }
  };

  const handleCopyBookingInfo = () => {
    if (guest) {
      const bookingInfo = `Booking Details:
Room: ${guest.roomNumber}
Guest: ${guest.guestName}
Check-in: ${new Date(guest.checkIn).toLocaleDateString("en-US")}
Check-out: ${new Date(guest.checkOut).toLocaleDateString("en-US")}
Booking ID: ${guest.bookingId}`;
      navigator.clipboard.writeText(bookingInfo);
      toast.success("Booking info copied to clipboard!");
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
        return "Your access key is active and ready to use.";
      case "Expired":
        return "Your access key has expired. Please contact support if you need assistance.";
      case "Checked out":
        return "You have checked out. Thank you for staying with us!";
      default:
        return "";
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading..." fullScreen={true} />;
  }

  if (!guest) {
    return (
      <ErrorState
        title="Invalid or expired token"
        message="The token you're using is invalid or has expired. Please contact support."
        fullScreen={true}
      />
    );
  }

  // Checkout completion screen
  if (justCheckedOut && guest.accessStatus === "Checked out") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4 py-8">
        <Card className="max-w-md w-full text-center" padding="lg">
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
              Checkout completed
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
              Thank you for staying with us!
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
              We hope you enjoyed your stay at NextStay. We'd love to hear about your experience!
            </p>
          </div>
          <div className="space-y-3">
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                // In real app, this would open a review form or redirect to review platform
                toast.success("Thank you! Your feedback helps us improve.");
              }}
            >
              Leave a review
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setJustCheckedOut(false)}
            >
              View booking details
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const qrValue = `${window.location.origin}/guest/${token}`;
  const checkInDate = new Date(guest.checkIn);
  const checkOutDate = new Date(guest.checkOut);
  const activeFromDate = new Date(guest.instructions.activeFrom);
  const activeUntilDate = new Date(guest.instructions.activeUntil);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md lg:max-w-2xl space-y-4">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">NextStay</h1>
          <p className="text-gray-600 dark:text-gray-300">Welcome, {guest.guestName}!</p>
        </div>

        {/* Main Card - Status, Room Number and QR Code */}
        <Card className="mb-4 rounded-2xl shadow-xl" padding="lg">
          <div className="text-center">
            {/* Access Status Badge */}
            <div className="mb-6">
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className={`px-3 py-1 text-sm font-semibold rounded-full border ${getAccessStatusColor(guest.accessStatus)}`}>
                  {guest.accessStatus}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {getAccessStatusMessage(guest.accessStatus)}
              </p>
            </div>

            {/* Room Number */}
            <div className="mb-6">
              <div className="inline-block bg-blue-100 dark:bg-blue-900/30 rounded-full p-4 sm:p-6 mb-4">
                <span className="text-4xl sm:text-5xl font-bold text-blue-600 dark:text-blue-400">
                  #{guest.roomNumber}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white mb-2">
                Room {guest.roomNumber}
              </h2>
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-6">
              <div className="bg-white dark:bg-gray-700 p-4 sm:p-6 rounded-lg border-2 border-gray-200 dark:border-gray-600">
                <QRCodeSVG
                  value={qrValue}
                  size={qrSize}
                  level="H"
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
                Details
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => setShowAccessModal(true)}
              >
                How to access
              </Button>
            </div>

            {/* Booking Info */}
            <div className="space-y-2 text-sm border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Check-in</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {checkInDate.toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Check-out</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {checkOutDate.toLocaleDateString("en-US", {
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
                {checkingOut ? "Checking out..." : "Check out"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Copy / Share */}
        <Card padding="md" className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Share & Copy
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={handleCopyGuestLink}
            >
              Copy guest link
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={handleCopyBookingInfo}
            >
              Copy booking info
            </Button>
          </div>
        </Card>

        {/* Contact / Support */}
        <Card padding="md" className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Need help?
            </h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowContactForm(!showContactForm)}
            >
              {showContactForm ? "Cancel" : "Contact hotel"}
            </Button>
          </div>

          {!showContactForm ? (
            <div className="space-y-2 text-sm">
              {guest.contact.phone && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 dark:text-gray-400">Phone:</span>
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
                  <span className="text-gray-600 dark:text-gray-400">WhatsApp:</span>
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
                  <span className="text-gray-600 dark:text-gray-400">Email:</span>
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
                  Your message
                </label>
                <textarea
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder="Describe your issue or question..."
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                >
                  Send message
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowContactForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </Card>

        {/* Info */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Show the QR code to the staff for quick access
          </p>
        </div>
      </div>

      {/* Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title="Details"
        size="lg"
      >
        <div className="space-y-6">
          {/* Wi-Fi Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Wi-Fi Information
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Network name (SSID)</p>
                <p className="text-base font-medium text-gray-900 dark:text-white">{guest.wifi.ssid}</p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Password</p>
                  <p className="text-base font-mono font-medium text-gray-900 dark:text-white break-all">
                    {guest.wifi.password}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyPassword}
                >
                  Copy password
                </Button>
              </div>
            </div>
          </div>

          {/* House Rules */}
          {guest.houseRules && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                House rules
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <span className="text-gray-500 dark:text-gray-400 mt-0.5">🔇</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white mb-1">Quiet hours</p>
                    <p className="text-gray-600 dark:text-gray-400">{guest.houseRules.quietHours}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-gray-500 dark:text-gray-400 mt-0.5">🚪</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white mb-1">Check-out time</p>
                    <p className="text-gray-600 dark:text-gray-400">{guest.houseRules.checkOutTime}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-gray-500 dark:text-gray-400 mt-0.5">🚭</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white mb-1">Smoking policy</p>
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
                Quick actions
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
                  Request cleaning
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    handleQuickAction("Issue report");
                    setShowDetailsModal(false);
                  }}
                >
                  Report an issue
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => {
                    handleQuickAction("Late checkout");
                    setShowDetailsModal(false);
                  }}
                >
                  Late checkout request
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
        title="How to access the hotel / room"
        size="md"
      >
        <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
          <p>{guest.instructions.accessInfo}</p>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
            <p className="font-medium text-blue-900 dark:text-blue-300 mb-1">Active period:</p>
            <p className="text-blue-800 dark:text-blue-400">
              {activeFromDate.toLocaleString("en-US", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })} - {activeUntilDate.toLocaleString("en-US", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 border border-yellow-200 dark:border-yellow-800">
            <p className="font-medium text-yellow-900 dark:text-yellow-300 mb-1">Door not opening?</p>
            <p className="text-yellow-800 dark:text-yellow-400">{guest.instructions.doorTroubleshooting}</p>
          </div>
        </div>
      </Modal>

      {/* Checkout Confirmation Modal */}
      <Modal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        title="Confirm checkout"
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowCheckoutModal(false)}
              disabled={checkingOut}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={confirmCheckout}
              disabled={checkingOut}
            >
              {checkingOut ? "Checking out..." : "Confirm checkout"}
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
              Are you sure you want to check out?
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This action cannot be undone. Your access key will be deactivated.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

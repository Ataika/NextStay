import { useState } from "react";
import { roomsApi, bookingsApi, stripeApi } from "../../api/api";
import Button from "../../ui/Button";
import Card from "../../ui/Card";
import Modal from "../../ui/Modal";
import LoadingSpinner from "../../ui/LoadingSpinner";
import toast from "react-hot-toast";

interface AvailableRoom {
  id: number;
  number: string;
  category: string;
  price: number;
  capacity: number;
  description: string | null;
  amenities: string[] | null;
  totalPrice: number;
  nights: number;
}

export default function BookingPage() {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<AvailableRoom | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingData, setBookingData] = useState({
    guestName: "",
    email: "",
    phone: "",
    specialRequests: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const handleSearch = async () => {
    if (!checkIn || !checkOut) {
      toast.error("Please select both check-in and check-out dates");
      return;
    }

    if (checkOut <= checkIn) {
      toast.error("Check-out date must be after check-in date");
      return;
    }

    try {
      setLoading(true);
      setSearchError(null);
      // Convert dates to ISO format with time (backend expects YYYY-MM-DDTHH:MM:SSZ)
      const checkInISO = `${checkIn}T14:00:00Z`;
      const checkOutISO = `${checkOut}T12:00:00Z`;
      const result = await roomsApi.getAvailable(checkInISO, checkOutISO);
      setAvailableRooms(result.availableRooms || []);

      if (result.availableRooms.length === 0) {
        toast.error("No rooms available for the selected dates");
      } else {
        toast.success(`Found ${result.availableRooms.length} available room(s)`);
      }
    } catch (error: any) {
      console.error("Search error:", error);
      const errorMessage = error?.response?.data?.detail || error?.message || "Failed to search rooms";
      toast.error(errorMessage);
      setSearchError(errorMessage);
      setAvailableRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBookRoom = (room: AvailableRoom) => {
    setSelectedRoom(room);
    setShowBookingForm(true);
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedRoom) return;

    if (!bookingData.guestName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    if (!bookingData.email.trim()) {
      toast.error("Please enter your email");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(bookingData.email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      setSubmitting(true);

      // Format dates for API (ISO format with time)
      const checkInDateTime = `${checkIn}T14:00:00Z`;
      const checkOutDateTime = `${checkOut}T12:00:00Z`;

      // Step 1: Create booking with Pending status
      const booking = await bookingsApi.create({
        guestName: bookingData.guestName,
        roomId: selectedRoom.id,
        roomNumber: selectedRoom.number,
        checkIn: checkInDateTime,
        checkOut: checkOutDateTime,
        status: "Pending",
        notes: bookingData.specialRequests || undefined,
        email: bookingData.email,
      });

      // Step 2: Create Stripe Checkout session
      const checkoutSession = await stripeApi.createCheckoutSession(booking.id);

      // Step 3: Redirect to Stripe Checkout
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
            Book Your Stay
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Find and reserve the perfect room for your stay
          </p>
        </div>

        {/* Search Form */}
        <Card className="mb-8" padding="lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Check-in Date
              </label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                min={today}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Check-out Date
              </label>
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                min={checkIn || today}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="primary"
                fullWidth
                onClick={handleSearch}
                disabled={loading || !checkIn || !checkOut}
              >
                {loading ? "Searching..." : "Search Rooms"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Results */}
        {loading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner message="Searching for available rooms..." />
          </div>
        )}

        {!loading && availableRooms.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Available Rooms ({availableRooms.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableRooms.map((room) => (
                <Card key={room.id} padding="md" className="hover:shadow-lg transition-shadow">
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                          Room {room.number}
                        </h3>
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          {room.category}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {room.description || "Comfortable room for your stay"}
                      </p>
                    </div>

                    {room.amenities && room.amenities.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                          Amenities:
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
                              +{room.amenities.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {room.nights} night{room.nights !== 1 ? "s" : ""}
                        </span>
                        <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          ${room.totalPrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>${room.price.toFixed(2)}/night</span>
                        <span>Capacity: {room.capacity}</span>
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      fullWidth
                      onClick={() => handleBookRoom(room)}
                    >
                      Book Now
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {!loading && availableRooms.length === 0 && checkIn && checkOut && (
          <Card padding="lg">
            <div className="text-center py-8">
              {searchError ? (
                <>
                  <p className="text-red-600 dark:text-red-400 mb-2 font-medium">
                    Error: {searchError}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                    Check-in: {new Date(checkIn).toLocaleDateString()} | Check-out: {new Date(checkOut).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Please check your dates and try again.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-gray-600 dark:text-gray-400 mb-2">
                    No rooms available for the selected dates. Please try different dates.
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    Check-in: {new Date(checkIn).toLocaleDateString()} | Check-out: {new Date(checkOut).toLocaleDateString()}
                  </p>
                </>
              )}
            </div>
          </Card>
        )}

        {!loading && !checkIn && !checkOut && (
          <Card padding="lg">
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">
                Select your check-in and check-out dates to search for available rooms.
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Booking Form Modal */}
      <Modal
        isOpen={showBookingForm}
        onClose={() => setShowBookingForm(false)}
        title="Complete Your Booking"
        size="lg"
      >
        {selectedRoom && (
          <form onSubmit={handleSubmitBooking} className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-gray-900 dark:text-white">
                  Room {selectedRoom.number}
                </span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  ${selectedRoom.totalPrice.toFixed(2)}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {new Date(checkIn).toLocaleDateString()} -{" "}
                {new Date(checkOut).toLocaleDateString()} ({selectedRoom.nights} nights)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={bookingData.guestName}
                onChange={(e) =>
                  setBookingData({ ...bookingData, guestName: e.target.value })
                }
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={bookingData.email}
                onChange={(e) =>
                  setBookingData({ ...bookingData, email: e.target.value })
                }
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Phone (Optional)
              </label>
              <input
                type="tel"
                value={bookingData.phone}
                onChange={(e) =>
                  setBookingData({ ...bookingData, phone: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Special Requests (Optional)
              </label>
              <textarea
                value={bookingData.specialRequests}
                onChange={(e) =>
                  setBookingData({ ...bookingData, specialRequests: e.target.value })
                }
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder="Any special requests or notes..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => setShowBookingForm(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                fullWidth
                disabled={submitting}
              >
                {submitting ? "Processing..." : "Confirm Booking"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

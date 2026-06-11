import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { hotelSyncApi } from "../../api/api";
import type {
  HotelChannelBookingLog,
  HotelSimulatorRoom,
  HotelSyncEventLog,
  HotelSyncResponse,
} from "../../api/api";
import Button from "../../ui/Button";
import Card from "../../ui/Card";
import EmptyState from "../../ui/EmptyState";
import LoadingSpinner from "../../ui/LoadingSpinner";
import PageHeader from "../../ui/PageHeader";

const HOTEL_ID = 1;
const SOURCE = "hotel_site_simulator";

function dateAfter(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function makeEventId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HotelSiteSimulatorPage() {
  const [checkIn, setCheckIn] = useState(dateAfter(1));
  const [checkOut, setCheckOut] = useState(dateAfter(3));
  const [guestName, setGuestName] = useState("External Demo Guest");
  const [guestEmail, setGuestEmail] = useState("guest.demo@example.com");
  const [rooms, setRooms] = useState<HotelSimulatorRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastResponse, setLastResponse] = useState<HotelSyncResponse | null>(null);
  const [lastExternalBookingId, setLastExternalBookingId] = useState<string | null>(null);
  const [events, setEvents] = useState<HotelSyncEventLog[]>([]);
  const [channelBookings, setChannelBookings] = useState<HotelChannelBookingLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) || null,
    [rooms, selectedRoomId],
  );

  const checkInIso = `${checkIn}T14:00:00Z`;
  const checkOutIso = `${checkOut}T12:00:00Z`;

  const loadLogs = async () => {
    try {
      setLogsLoading(true);
      const [eventRows, bookingRows] = await Promise.all([
        hotelSyncApi.listEvents(),
        hotelSyncApi.listChannelBookings(),
      ]);
      setEvents(eventRows);
      setChannelBookings(bookingRows);
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  const searchRooms = async () => {
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      toast.error("Choose a valid date range.");
      return;
    }

    try {
      setLoadingRooms(true);
      const available = await hotelSyncApi.searchAvailableRooms(checkInIso, checkOutIso);
      setRooms(available);
      setSelectedRoomId(available[0]?.id ?? null);
      if (!available.length) toast.error("No available rooms for this date range.");
    } catch (err) {
      console.error(err);
      setRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    void searchRooms();
    void loadLogs();
  }, []);

  const createExternalBooking = async () => {
    if (!selectedRoom) {
      toast.error("Select a room.");
      return;
    }
    if (!guestName.trim() || !guestEmail.trim()) {
      toast.error("Guest name and email are required.");
      return;
    }

    const externalBookingId = `SIM-${Date.now()}`;
    try {
      setSyncing(true);
      const response = await hotelSyncApi.sendEvent({
        eventId: makeEventId("booking-created"),
        hotelId: HOTEL_ID,
        source: SOURCE,
        type: "booking_created",
        externalBookingId,
        roomId: selectedRoom.id,
        roomNumber: selectedRoom.number,
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        checkIn: checkInIso,
        checkOut: checkOutIso,
        amountPaid: selectedRoom.totalPrice,
      });
      setLastResponse(response);
      setLastExternalBookingId(externalBookingId);
      toast.success("External booking synchronized.");
      await Promise.all([searchRooms(), loadLogs()]);
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const cancelLastExternalBooking = async () => {
    if (!lastExternalBookingId) return;

    try {
      setSyncing(true);
      const response = await hotelSyncApi.sendEvent({
        eventId: makeEventId("booking-cancelled"),
        hotelId: HOTEL_ID,
        source: SOURCE,
        type: "booking_cancelled",
        externalBookingId: lastExternalBookingId,
      });
      setLastResponse(response);
      setLastExternalBookingId(null);
      toast.success("External cancellation synchronized.");
      await Promise.all([searchRooms(), loadLogs()]);
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Hotel Site Simulator"
        subtitle="External booking channel and synchronization audit"
        action={
          <Button variant="secondary" size="sm" onClick={() => void loadLogs()}>
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)] gap-5">
        <div className="space-y-5">
          <Card padding="md">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Check-in
                <input
                  type="date"
                  value={checkIn}
                  min={dateAfter(0)}
                  onChange={(event) => setCheckIn(event.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </label>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Check-out
                <input
                  type="date"
                  value={checkOut}
                  min={checkIn || dateAfter(1)}
                  onChange={(event) => setCheckOut(event.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </label>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300 md:col-span-1">
                Guest
                <input
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </label>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300 md:col-span-1">
                Email
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(event) => setGuestEmail(event.target.value)}
                  className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </label>
              <div className="flex items-end">
                <Button fullWidth onClick={() => void searchRooms()} disabled={loadingRooms}>
                  {loadingRooms ? "Searching..." : "Search"}
                </Button>
              </div>
            </div>
          </Card>

          <Card padding="none">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                External Hotel Booking Form
              </h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">{rooms.length} available</span>
            </div>

            {loadingRooms ? (
              <LoadingSpinner message="Loading rooms..." />
            ) : rooms.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No rooms found" message="Change dates and search again." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-900/60">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Room</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Type</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Capacity</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Total</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Select</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {rooms.map((room) => (
                      <tr key={room.id} className={room.id === selectedRoomId ? "bg-blue-50 dark:bg-blue-950/20" : ""}>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">#{room.number}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{room.category}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{room.capacity}</td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          ${room.totalPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="radio"
                            name="selected-room"
                            checked={room.id === selectedRoomId}
                            onChange={() => setSelectedRoomId(room.id)}
                            className="h-4 w-4"
                            aria-label={`Select room ${room.number}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-3 justify-end">
              <Button
                variant="secondary"
                onClick={() => void cancelLastExternalBooking()}
                disabled={!lastExternalBookingId || syncing}
              >
                Cancel Last External Booking
              </Button>
              <Button onClick={() => void createExternalBooking()} disabled={!selectedRoom || syncing}>
                {syncing ? "Syncing..." : "Book on Hotel Site"}
              </Button>
            </div>
          </Card>

          {lastResponse && (
            <Card padding="md">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Last Sync Result</h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Action</span>
                  <p className="font-medium text-gray-900 dark:text-white">{lastResponse.action}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Booking</span>
                  <p className="font-medium text-gray-900 dark:text-white">{lastResponse.bookingId ?? "-"}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Room</span>
                  <p className="font-medium text-gray-900 dark:text-white">{lastResponse.roomNumber ?? "-"}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Status</span>
                  <p className="font-medium text-gray-900 dark:text-white">{lastResponse.bookingStatus ?? "-"}</p>
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card padding="none">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Channel Bookings</h2>
            </div>
            {logsLoading ? (
              <LoadingSpinner message="Loading channel bookings..." />
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {channelBookings.slice(0, 8).map((booking) => (
                  <div key={booking.id} className="p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-gray-900 dark:text-white">{booking.externalBookingId}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          booking.status === "active"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {booking.status}
                      </span>
                    </div>
                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                      Room #{booking.roomNumber} - {booking.guestName || "Guest"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                      {formatDate(booking.checkIn)} to {formatDate(booking.checkOut)}
                    </p>
                  </div>
                ))}
                {!channelBookings.length && (
                  <div className="p-4">
                    <EmptyState title="No channel bookings" message="Create an external booking to populate this log." />
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card padding="none">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Sync Events</h2>
            </div>
            {logsLoading ? (
              <LoadingSpinner message="Loading sync events..." />
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {events.slice(0, 8).map((event) => (
                  <div key={event.id} className="p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-gray-900 dark:text-white">{event.eventType}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          event.status === "processed"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : event.status === "failed"
                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {event.status}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-gray-600 dark:text-gray-400">{event.externalEventId}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">{formatDate(event.receivedAt)}</p>
                    {event.error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{event.error}</p>}
                  </div>
                ))}
                {!events.length && (
                  <div className="p-4">
                    <EmptyState title="No sync events" message="Events will appear after simulator actions." />
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

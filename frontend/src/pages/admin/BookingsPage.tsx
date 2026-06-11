import { useState, useEffect, useMemo } from "react";
import { bookingsApi } from "../../api/api";
import type { Booking } from "../../mocks/bookings";
import PageHeader from "../../ui/PageHeader";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import LoadingSpinner from "../../ui/LoadingSpinner";
import ErrorState from "../../ui/ErrorState";
import EmptyState from "../../ui/EmptyState";
import Modal from "../../ui/Modal";
import toast from "react-hot-toast";
import { useI18n } from "../../i18n";

type StatusFilter = Booking["status"] | "All";

export default function BookingsPage() {
  const { t, locale } = useI18n();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await bookingsApi.getAll();
      setBookings(data);
    } catch (err) {
      setError(t("bookings.failedLoad"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const matchesStatus =
        statusFilter === "All" || booking.status === statusFilter;
      const matchesSearch =
        searchQuery === "" ||
        booking.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.roomNumber.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [bookings, statusFilter, searchQuery]);

  const getStatusColor = (status: Booking["status"]) => {
    switch (status) {
      case "Confirmed":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
      case "Upcoming":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300";
      case "Checked-in":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
      case "Checked-out":
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300";
      case "Pending":
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300";
      default:
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleDeleteBooking = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await bookingsApi.delete(deleteTarget.id);
      toast.success(t("bookings.deleted"));
      setDeleteTarget(null);
      await loadBookings();
    } catch (err) {
      toast.error(t("bookings.deleteFailed"));
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message={t("bookings.loading")} />;
  }

  if (error) {
    return <ErrorState title={t("bookings.errorTitle")} message={error} onRetry={loadBookings} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("bookings.title")}
        subtitle={t("bookings.subtitle")}
      />

      {/* Filters */}
      <Card padding="md">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder={t("bookings.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            />
          </div>
          <div className="md:w-64">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            >
              <option value="All">{t("bookings.allStatuses")}</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Upcoming">Upcoming</option>
              <option value="Checked-in">Checked-in</option>
              <option value="Checked-out">Checked-out</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Bookings Table */}
      {filteredBookings.length === 0 ? (
        <Card>
          <EmptyState
            title={t("bookings.noBookingsFound")}
            message={t("bookings.noBookingsMessage")}
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t("bookings.colGuest")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t("bookings.colRoom")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t("bookings.colCheckIn")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t("bookings.colCheckOut")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t("bookings.colStatus")}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t("bookings.colActions")}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredBookings.map((booking) => (
                  <tr
                    key={booking.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {booking.guestName}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {t("bookings.roomNumber", { number: booking.roomNumber })}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {formatDate(booking.checkIn)}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {formatDate(booking.checkOut)}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          booking.status
                        )}`}
                      >
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteTarget(booking)}
                      >
                        {t("bookings.delete")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title={t("bookings.deleteTitle")}
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={handleDeleteBooking}
              disabled={deleting}
            >
              {deleting ? t("bookings.deleting") : t("bookings.delete")}
            </Button>
          </div>
        }
      >
        {deleteTarget && (
          <p className="text-gray-700 dark:text-gray-300">
            {t("bookings.deleteConfirm", {
              id: String(deleteTarget.id),
              name: deleteTarget.guestName,
              room: deleteTarget.roomNumber,
            })}
          </p>
        )}
      </Modal>
    </div>
  );
}

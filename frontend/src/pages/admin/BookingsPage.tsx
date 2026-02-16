import { useState, useEffect } from "react";
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

type StatusFilter = Booking["status"] | "All";

export default function BookingsPage() {
  const [pageSize, setPageSize] = useState(20);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadBookings();
  }, [page, statusFilter, searchQuery]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      const offset = (page - 1) * pageSize;
      const result = await bookingsApi.getPage({
        limit: pageSize,
        offset,
        status: statusFilter === "All" ? undefined : statusFilter,
        search: searchQuery.trim() || undefined,
      });
      if (result.total > 0 && result.items.length === 0 && page > 1) {
        setPage((p) => p - 1);
        return;
      }
      setBookings(result.items);
      setTotalCount(result.total);
    } catch (err) {
      setError("Failed to load bookings");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const showingFrom = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);
  const visiblePageNumbers = (() => {
    const maxButtons = 7;
    if (pageCount <= maxButtons) {
      return Array.from({ length: pageCount }, (_, i) => i + 1);
    }
    let start = Math.max(1, page - 3);
    let end = Math.min(pageCount, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  })();

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
    return date.toLocaleDateString("en-US", {
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
      toast.success("Booking deleted");
      setDeleteTarget(null);
      await loadBookings();
    } catch (err) {
      toast.error("Failed to delete booking");
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading bookings..." />;
  }

  if (error) {
    return <ErrorState title="Error loading bookings" message={error} onRetry={loadBookings} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        subtitle="Manage guest reservations and check-ins"
      />

      {/* Filters */}
      <Card padding="md">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by guest name or room number..."
              value={searchQuery}
              onChange={(e) => {
                setPage(1);
                setSearchQuery(e.target.value);
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            />
          </div>
          <div className="md:w-64">
            <select
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value as StatusFilter);
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            >
              <option value="All">All statuses</option>
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
      {bookings.length === 0 ? (
        <Card>
          <EmptyState
            title="No bookings found"
            message="Try changing the search filters to see more bookings."
          />
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Guest Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Room
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Check-in
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Check-out
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {bookings.map((booking) => (
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
                        Room #{booking.roomNumber}
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
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card padding="md">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {showingFrom}-{showingTo} of {totalCount}
          </p>
          <div className="flex items-center gap-3">
            <select
              value={pageSize}
              onChange={(e) => {
                setPage(1);
                setPageSize(Number(e.target.value));
              }}
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              Prev
            </Button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Page {page} / {pageCount}
            </span>
            <div className="flex items-center gap-1">
              {visiblePageNumbers.map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`px-2 py-1 text-xs rounded border ${
                    n === page
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount || loading}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete booking"
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={handleDeleteBooking}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        {deleteTarget && (
          <p className="text-gray-700 dark:text-gray-300">
            Delete booking #{deleteTarget.id} — {deleteTarget.guestName}, Room {deleteTarget.roomNumber}? This cannot be undone.
          </p>
        )}
      </Modal>
    </div>
  );
}

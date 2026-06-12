import { useState, useEffect, useMemo } from "react";
import type { Room } from "../../mocks/rooms";
import { tasksApi, roomsApi, bookingsApi, hotelProfileApi } from "../../api/api";
import type { CleaningTask } from "../../mocks/tasks";
import type { Booking } from "../../mocks/bookings";
import { useAuthStore, canManageEngine } from "../../store/authStore";
import AdminDashboardSidebar from "../../components/admin/AdminDashboardSidebar";
import AdminRoomListItem from "../../components/admin/AdminRoomListItem";
import AdminStatsCards from "../../components/admin/AdminStatsCards";
import RoomFormModal, { EMPTY_ROOM_FORM, type RoomFormValues } from "../../components/admin/RoomFormModal";
import RoomDetailsModal from "../../components/RoomDetailsModal";
import EmptyState from "../../ui/EmptyState";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import { paginate, totalPages } from "../../utils/adminDashboard";
import Modal from "../../ui/Modal";
import LoadingSpinner from "../../ui/LoadingSpinner";
import toast from "react-hot-toast";
import { useI18n } from "../../i18n";

const ROOMS_PAGE_SIZE = 8;

type StatusFilter = Room["status"] | "All";
type CategoryFilter = string | "All";

export default function AdminPage() {
  const { t, locale } = useI18n();
  const role     = useAuthStore((s) => s.role);
  const authName = useAuthStore((s) => s.name);
  const canAdmin = canManageEngine(role); // OWNER + SYS_ADMIN can add/delete rooms
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [roomPage, setRoomPage] = useState(1);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedTask, setSelectedTask] = useState<CleaningTask | null>(null);
  const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false);
  const [showRoomFormModal, setShowRoomFormModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showMaintenanceConfirmModal, setShowMaintenanceConfirmModal] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ roomId: number; newStatus: Room["status"] } | null>(null);
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [showRoomDetailsModal, setShowRoomDetailsModal] = useState(false);
  const [roomDetailsView, setRoomDetailsView] = useState<"details" | "edit">("details");
  const [loading, setLoading] = useState(true);
  const [hotelName, setHotelName] = useState("");
  const [roomForm, setRoomForm] = useState<RoomFormValues>(EMPTY_ROOM_FORM);
  const [roomFormSaving, setRoomFormSaving] = useState(false);

  useEffect(() => {
    loadTasks();
    loadRooms();
    loadBookings();
    void hotelProfileApi.get().then((profile) => setHotelName(profile.hotel_name)).catch(() => {});
  }, []);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const data = await roomsApi.getAll();
      setRooms(data);
    } catch (error) {
      toast.error(t("admin.errorLoadRooms"));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    try {
      const data = await tasksApi.getAll();
      setTasks(data);
    } catch (error) {
      toast.error(t("admin.errorLoadTasks"));
      console.error(error);
    }
  };

  const loadBookings = async () => {
    try {
      const data = await bookingsApi.getAll();
      setBookings(data);
    } catch (error) {
      toast.error(t("admin.errorLoadBookings"));
      console.error(error);
    }
  };

  // Analytics
  const stats = useMemo(() => {
    return {
      total: rooms.length,
      available: rooms.filter((r) => r.status === "Available").length,
      occupied: rooms.filter((r) => r.status === "Occupied").length,
      cleaning: rooms.filter((r) => r.status === "Cleaning").length,
      maintenance: rooms.filter((r) => r.status === "Maintenance").length,
      // Rooms needing cleaning (have pending/in-progress tasks)
      needsCleaning: rooms.filter((r) => {
        const roomTasks = tasks.filter((t) => t.roomId === r.id);
        return roomTasks.some((t) => t.status === "Pending" || t.status === "In Progress");
      }).length,
    };
  }, [rooms, tasks]);

  const pricingSummary = useMemo(() => {
    const pricedRooms = rooms.filter((room) => room.dynamicPrice !== null && room.dynamicPrice !== undefined);
    if (pricedRooms.length === 0) {
      return null;
    }

    return {
      pricedRooms: pricedRooms.length,
      stayDate: pricedRooms[0].pricingStayDate ?? null,
      snapshotDate: pricedRooms[0].pricingSnapshotDate ?? null,
    };
  }, [rooms]);

  const categories = useMemo(
    () => [...new Set(rooms.map((room) => room.category).filter(Boolean))].sort(),
    [rooms]
  );

  // Filtering rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesStatus =
        statusFilter === "All" || room.status === statusFilter;
      const matchesCategory =
        categoryFilter === "All" || room.category === categoryFilter;
      const matchesSearch =
        searchQuery === "" ||
        room.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [rooms, statusFilter, categoryFilter, searchQuery]);

  const pageCount = totalPages(filteredRooms.length, ROOMS_PAGE_SIZE);
  const pagedRooms = useMemo(
    () => paginate(filteredRooms, roomPage, ROOMS_PAGE_SIZE),
    [filteredRooms, roomPage]
  );

  useEffect(() => {
    setRoomPage(1);
  }, [statusFilter, categoryFilter, searchQuery]);

  const confirmMaintenanceChange = async () => {
    if (!pendingStatusChange) return;

    try {
      await roomsApi.update(pendingStatusChange.roomId, { status: pendingStatusChange.newStatus });
      await loadRooms();
      const updatedRooms = await roomsApi.getAll();
      const room = updatedRooms.find((r) => r.id === pendingStatusChange.roomId);
      toast.success(t("admin.roomSetMaintenance", { number: room?.number || String(pendingStatusChange.roomId) }));
      setShowMaintenanceConfirmModal(false);
      setPendingStatusChange(null);
      // Update selectedRoom if it's the same room
      if (selectedRoom && selectedRoom.id === pendingStatusChange.roomId && room) {
        setSelectedRoom(room);
      }
      // Ensure scroll is restored after modal operations
      setTimeout(() => {
        const openModals = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
        if (openModals.length === 0) {
          document.body.style.overflow = "";
        }
      }, 100);
    } catch (error) {
      toast.error(t("admin.errorUpdateStatus"));
      console.error(error);
    }
  };

  const handleViewDetails = (roomId: number) => {
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      setSelectedRoom(room);
      setRoomDetailsView("details");
      setShowRoomDetailsModal(true);
    }
  };

  const handleAddRoom = () => {
    setIsEditingRoom(false);
    setRoomForm(EMPTY_ROOM_FORM);
    setShowRoomFormModal(true);
  };

  const handleSaveRoom = async (values: RoomFormValues) => {
    if (!values.number.trim()) {
      toast.error(t("admin.roomNumberRequired"));
      return;
    }
    if (!values.category.trim()) {
      toast.error(t("admin.categoryRequired"));
      return;
    }
    if (values.capacity === null || values.capacity === undefined || values.capacity <= 0) {
      toast.error(t("admin.capacityRequired"));
      return;
    }
    if (values.price === null || values.price === undefined || values.price <= 0) {
      toast.error(t("admin.priceRequired"));
      return;
    }

    try {
      setRoomFormSaving(true);
      const roomData = { ...values };

      if (isEditingRoom && selectedRoom) {
        await roomsApi.update(selectedRoom.id, roomData);
        toast.success(t("admin.roomUpdated", { number: values.number }));
        await loadRooms();
        // Reload and update selectedRoom with fresh data from API
        const updatedRooms = await roomsApi.getAll();
        const updatedRoom = updatedRooms.find((r) => r.id === selectedRoom.id);
        if (updatedRoom) {
          setSelectedRoom(updatedRoom);
        }
        setRoomDetailsView("details");
        setIsEditingRoom(false);
        // Ensure scroll is restored after modal operations
        setTimeout(() => {
          const openModals = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
          if (openModals.length === 0) {
            document.body.style.overflow = "";
          }
        }, 100);
      } else {
        await roomsApi.create(roomData);
        toast.success(t("admin.roomCreated", { number: values.number }));
        setShowRoomFormModal(false);
        await loadRooms();
      }
    } catch (error) {
      toast.error(isEditingRoom ? t("admin.errorUpdateRoom") : t("admin.errorCreateRoom"));
      console.error(error);
    } finally {
      setRoomFormSaving(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!selectedRoom) return;

    try {
      await roomsApi.delete(selectedRoom.id);
      toast.success(t("admin.roomDeleted", { number: selectedRoom.number }));
      setShowDeleteConfirmModal(false);
      setShowRoomDetailsModal(false);
      setSelectedRoom(null);
      await loadRooms();
      // Ensure scroll is restored after modal operations
      setTimeout(() => {
        const openModals = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
        if (openModals.length === 0) {
          document.body.style.overflow = "";
        }
      }, 100);
    } catch (error) {
      toast.error(t("admin.errorDeleteRoom"));
      console.error(error);
    }
  };

  // Removed getStatusDescription - not used in new structure

  const getTaskStatusColor = (status: CleaningTask["status"]) => {
    switch (status) {
      case "Pending":
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300";
      case "In Progress":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300";
      case "Completed":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
      default:
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300";
    }
  };

  const getPriorityColor = (priority: CleaningTask["priority"]) => {
    switch (priority) {
      case "High":
        return "text-red-600 dark:text-red-400";
      case "Medium":
        return "text-yellow-600 dark:text-yellow-400";
      case "Low":
        return "text-gray-600 dark:text-gray-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const getPriorityIcon = (priority: CleaningTask["priority"]) => {
    switch (priority) {
      case "High":
        return "⚠️";
      case "Medium":
        return "⏱️";
      case "Low":
        return "•";
      default:
        return "•";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };


  if (loading) {
    return <LoadingSpinner message={t("admin.loadingRooms")} />;
  }

  const displayName = authName?.split(" ")[0] ?? hotelName ?? t("admin.title");

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            {t("admin.welcome", { name: displayName })}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t("admin.welcomeSubtitle")}
          </p>
        </div>
        {canAdmin && (
          <Button variant="primary" size="sm" onClick={handleAddRoom} className="shrink-0">
            {t("admin.addRoom")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <AdminStatsCards
            total={stats.total}
            available={stats.available}
            occupied={stats.occupied}
            cleaning={stats.cleaning}
          />

          {pricingSummary && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
              {t("admin.pricingActive", { count: String(pricingSummary.pricedRooms) })}
              {pricingSummary.stayDate ? ` ${t("admin.pricingStayDate", { date: pricingSummary.stayDate })}` : ""}
              {pricingSummary.snapshotDate ? ` ${t("admin.pricingSnapshotDate", { date: pricingSummary.snapshotDate })}` : ""}
            </div>
          )}

          <Card padding="sm">
            <div className="flex flex-col lg:flex-row gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                <input
                  type="text"
                  placeholder={t("admin.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="lg:w-40 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="All">{t("admin.allStatuses")}</option>
                <option value="Available">{t("admin.available")}</option>
                <option value="Occupied">{t("admin.occupied")}</option>
                <option value="Cleaning">{t("admin.cleaning")}</option>
                <option value="Maintenance">{t("admin.maintenance")}</option>
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="lg:w-40 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="All">{t("admin.allCategories")}</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          <div>
            <div className="flex items-center justify-between mb-2 px-0.5">
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white">
                {t("admin.roomsCount", { count: String(filteredRooms.length) })}
              </h2>
            </div>
            {filteredRooms.length === 0 ? (
              <Card>
                <EmptyState
                  title={t("admin.noRoomsFound")}
                  message={t("admin.noRoomsMessage")}
                />
              </Card>
            ) : (
              <div className="space-y-2">
                {pagedRooms.map((room) => (
                  <AdminRoomListItem
                    key={room.id}
                    room={room}
                    bookings={bookings}
                    onClick={handleViewDetails}
                  />
                ))}
              </div>
            )}

            {filteredRooms.length > ROOMS_PAGE_SIZE && (
              <div className="flex items-center justify-between mt-3 px-1">
                <p className="text-xs text-gray-500">
                  {t("admin.pageOf", { page: String(roomPage), total: String(pageCount) })}
                </p>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={roomPage <= 1}
                    onClick={() => setRoomPage((p) => Math.max(1, p - 1))}
                  >
                    ‹
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={roomPage >= pageCount}
                    onClick={() => setRoomPage((p) => Math.min(pageCount, p + 1))}
                  >
                    ›
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="hidden xl:block">
          <AdminDashboardSidebar rooms={rooms} bookings={bookings} tasks={tasks} />
        </div>
      </div>

      <RoomDetailsModal
        isOpen={showRoomDetailsModal}
        room={selectedRoom}
        bookings={bookings}
        view={roomDetailsView}
        onViewChange={setRoomDetailsView}
        onClose={() => {
          setShowRoomDetailsModal(false);
          setSelectedRoom(null);
          setRoomDetailsView("details");
          setIsEditingRoom(false);
          setAmenitiesInput("");
        }}
        onRoomUpdated={(room) => {
          setSelectedRoom(room);
          void loadRooms();
        }}
        onTasksChanged={() => {
          void loadTasks();
          void loadRooms();
        }}
        onMaintenance={(room) => {
          setPendingStatusChange({ roomId: room.id, newStatus: "Maintenance" });
          setShowMaintenanceConfirmModal(true);
        }}
      />

      <RoomFormModal
        isOpen={showRoomFormModal}
        isEditing={isEditingRoom}
        initialValues={roomForm}
        saving={roomFormSaving}
        onClose={() => {
          setShowRoomFormModal(false);
          setRoomForm(EMPTY_ROOM_FORM);
        }}
        onSubmit={handleSaveRoom}
      />

      {/* Task Details Modal */}
      <Modal
        isOpen={showTaskDetailsModal}
        onClose={() => {
          setShowTaskDetailsModal(false);
          setSelectedTask(null);
        }}
        title={selectedTask ? `Task #${selectedTask.id} - Room #${selectedTask.roomNumber}` : "Task Details"}
        size="md"
        footer={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowTaskDetailsModal(false);
                setSelectedTask(null);
              }}
            >
              Close
            </Button>
          </div>
        }
      >
        {selectedTask && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Status
              </label>
              <p className="text-base text-gray-900 dark:text-white mt-1">
                <span className={`px-2 py-1 text-xs font-semibold rounded ${getTaskStatusColor(selectedTask.status)}`}>
                  {selectedTask.status}
                </span>
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Priority
              </label>
              <p className="text-base text-gray-900 dark:text-white mt-1">
                <span className="mr-2">{getPriorityIcon(selectedTask.priority)}</span>
                <span className={getPriorityColor(selectedTask.priority)}>
                  {selectedTask.priority}
                </span>
              </p>
            </div>
            {selectedTask.assignedToName && (
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Assigned to
                </label>
                <p className="text-base text-gray-900 dark:text-white mt-1">
                  {selectedTask.assignedToName}
                </p>
              </div>
            )}
            {selectedTask.notes && (
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Notes
                </label>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  {selectedTask.notes}
                </p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Created
              </label>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                {formatDate(selectedTask.createdAt)}
              </p>
            </div>
            {selectedTask.completedAt && (
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Completed
                </label>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  {formatDate(selectedTask.completedAt)}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Maintenance Confirmation Modal */}
      <Modal
        isOpen={showMaintenanceConfirmModal}
        onClose={() => {
          setShowMaintenanceConfirmModal(false);
          setPendingStatusChange(null);
        }}
        title="Danger Zone"
        size="sm"
        footer={
          <div className="flex flex-col gap-2 w-full">
            <Button variant="danger" size="sm" fullWidth onClick={confirmMaintenanceChange}>
              Mark as Maintenance
            </Button>
            {canAdmin && (
              <Button
                variant="danger"
                size="sm"
                fullWidth
                onClick={() => {
                  setShowMaintenanceConfirmModal(false);
                  setPendingStatusChange(null);
                  if (selectedRoom) {
                    setShowDeleteConfirmModal(true);
                  }
                }}
              >
                Delete Room
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              onClick={() => {
                setShowMaintenanceConfirmModal(false);
                setPendingStatusChange(null);
              }}
            >
              Cancel
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to mark{" "}
              <span className="font-semibold">Room #{rooms.find((r) => r.id === pendingStatusChange?.roomId)?.number || selectedRoom?.number || pendingStatusChange?.roomId}</span>{" "}
              as Maintenance?
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              The room will be unavailable for booking until maintenance is complete.
            </p>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirmModal}
        onClose={() => setShowDeleteConfirmModal(false)}
        title="Confirm Delete"
        size="sm"
        footer={
          <div className="flex gap-2 w-full">
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              onClick={() => setShowDeleteConfirmModal(false)}
            >
              Cancel
            </Button>
            {canAdmin && (
              <Button variant="danger" size="sm" fullWidth onClick={handleDeleteRoom}>
                Delete
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to delete{" "}
              <span className="font-semibold">Room #{selectedRoom?.number}</span>?
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              This action cannot be undone.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

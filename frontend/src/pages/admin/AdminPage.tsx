import { useState, useEffect, useMemo, useRef } from "react";
import type { Room } from "../../mocks/rooms";
import { tasksApi, roomsApi, bookingsApi } from "../../api/api";
import type { CleaningTask } from "../../mocks/tasks";
import type { Booking } from "../../mocks/bookings";
import RoomCard from "../../components/RoomCard";
import EmptyState from "../../ui/EmptyState";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import Popover from "../../ui/Popover";
import Modal from "../../ui/Modal";
import LoadingSpinner from "../../ui/LoadingSpinner";
import { layout } from "../../constants/designTokens";
import toast from "react-hot-toast";

type StatusFilter = Room["status"] | "All";

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "All", label: "All" },
  { value: "Available", label: "Available" },
  { value: "Occupied", label: "Occupied" },
  { value: "Cleaning", label: "Cleaning" },
  { value: "Maintenance", label: "Maintenance" },
];

const statusColors = {
  Available: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700",
  Occupied: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700",
  Maintenance: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700",
  Cleaning: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
  // Dirty is kept for backward compatibility but should not be used as room status
  Dirty: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
};

export default function AdminPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [statusFilters, setStatusFilters] = useState<Set<StatusFilter>>(new Set(["All"]));
  const [filterOpen, setFilterOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedTask, setSelectedTask] = useState<CleaningTask | null>(null);
  const [showAssignStaffModal, setShowAssignStaffModal] = useState(false);
  const [assignStaffId, setAssignStaffId] = useState<string>("");
  const [assignStaffName, setAssignStaffName] = useState("");
  const [showCreateTaskForm, setShowCreateTaskForm] = useState(false);
  const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false);
  const [taskPriority, setTaskPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [taskNotes, setTaskNotes] = useState("");
  const [showRoomFormModal, setShowRoomFormModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showMaintenanceConfirmModal, setShowMaintenanceConfirmModal] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ roomId: number; newStatus: Room["status"] } | null>(null);
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [showRoomDetailsModal, setShowRoomDetailsModal] = useState(false);
  const [roomDetailsView, setRoomDetailsView] = useState<"details" | "edit" | "cleaning">("details");
  const [loading, setLoading] = useState(true);
  const [amenitiesInput, setAmenitiesInput] = useState("");
  const [roomForm, setRoomForm] = useState<Omit<Room, "id">>({
    number: "",
    category: "",
    status: "Available",
    price: null as any,
    capacity: null as any,
    description: "",
    amenities: [],
  });

  useEffect(() => {
    loadTasks();
    loadRooms();
    loadBookings();
  }, []);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const data = await roomsApi.getAll();
      setRooms(data);
    } catch (error) {
      toast.error("Error loading rooms");
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
      toast.error("Error loading tasks");
      console.error(error);
    }
  };

  const loadBookings = async () => {
    try {
      const data = await bookingsApi.getAll();
      setBookings(data);
    } catch (error) {
      toast.error("Error loading bookings");
      console.error(error);
    }
  };

  const stats = useMemo(() => ({
    total: rooms.length,
    available: rooms.filter((r) => r.status === "Available").length,
    occupied: rooms.filter((r) => r.status === "Occupied").length,
    cleaning: rooms.filter((r) => r.status === "Cleaning").length,
    maintenance: rooms.filter((r) => r.status === "Maintenance").length,
  }), [rooms]);

  const toggleStatusFilter = (value: StatusFilter) => {
    setStatusFilters((prev) => {
      if (value === "All") {
        return prev.has("All") ? new Set() : new Set(["All"]);
      }
      const next = new Set(prev);
      next.delete("All");
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      if (next.size === 0) return new Set(["All"]);
      return next;
    });
  };

  // Filtering rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesStatus =
        statusFilters.size === 0 ||
        statusFilters.has("All") ||
        statusFilters.has(room.status);
      const matchesSearch =
        searchQuery === "" ||
        room.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [rooms, statusFilters, searchQuery]);

  const confirmMaintenanceChange = async () => {
    if (!pendingStatusChange) return;

    try {
      await roomsApi.update(pendingStatusChange.roomId, { status: pendingStatusChange.newStatus });
      await loadRooms();
      const updatedRooms = await roomsApi.getAll();
      const room = updatedRooms.find((r) => r.id === pendingStatusChange.roomId);
      toast.success(`Room #${room?.number || pendingStatusChange.roomId} set to Maintenance`);
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
      toast.error("Error updating room status");
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

  const handleCreateTask = async () => {
    if (!selectedRoom) return;

    try {
      await tasksApi.create(
        selectedRoom.id,
        selectedRoom.number,
        taskPriority,
        taskNotes || undefined
      );
      toast.success(`Cleaning task created for Room #${selectedRoom.number}`);
      setShowCreateTaskForm(false);
      setTaskNotes("");
      setTaskPriority("Medium");
      await loadTasks();
    } catch (error) {
      toast.error("Error creating task");
      console.error(error);
    }
  };

  const handleAddRoom = () => {
    setIsEditingRoom(false);
    setRoomForm({
      number: "",
      category: "",
      status: "Available",
      price: null as any,
      capacity: null as any,
      description: "",
      amenities: [],
    });
    setAmenitiesInput("");
    setShowRoomFormModal(true);
  };


  const handleSaveRoom = async () => {
    // Validation of required fields
    if (!roomForm.number.trim()) {
      toast.error("Please fill in the Room Number field");
      return;
    }
    if (!roomForm.category.trim()) {
      toast.error("Please fill in the Category field");
      return;
    }
    if (roomForm.capacity === null || roomForm.capacity === undefined || roomForm.capacity <= 0) {
      toast.error("Please fill in the Capacity field with a valid number");
      return;
    }
    if (roomForm.price === null || roomForm.price === undefined || roomForm.price < 0) {
      toast.error("Please fill in the Price per night field with a valid number");
      return;
    }

    try {
      // Convert amenities input string to array before saving
      const amenitiesArray = amenitiesInput
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0);
      
      const roomData = {
        ...roomForm,
        amenities: amenitiesArray,
      };

      if (isEditingRoom && selectedRoom) {
        await roomsApi.update(selectedRoom.id, roomData);
        toast.success(`Room #${roomForm.number} updated successfully`);
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
        toast.success(`Room #${roomForm.number} created successfully`);
        setShowRoomFormModal(false);
        await loadRooms();
      }
    } catch (error) {
      toast.error(`Error ${isEditingRoom ? "updating" : "creating"} room`);
      console.error(error);
    }
  };

  const handleDeleteRoom = async () => {
    if (!selectedRoom) return;

    try {
      await roomsApi.delete(selectedRoom.id);
      toast.success(`Room #${selectedRoom.number} deleted successfully`);
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
      toast.error("Error deleting room");
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

  // Get current booking for room
  const getCurrentBooking = (roomId: number): Booking | null => {
    return bookings.find(
      (b) => b.roomId === roomId && (b.status === "Checked-in" || b.status === "Upcoming")
    ) || null;
  };

  // Get cleaning tasks for room
  const getRoomTasks = (roomId: number): CleaningTask[] => {
    return tasks.filter((t) => t.roomId === roomId);
  };

  // Removed getLastCleaned - not used in new structure

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };


  if (loading) {
    return <LoadingSpinner message="Loading rooms..." />;
  }

  const statsCards = [
    {
      label: "Total rooms",
      value: stats.total,
      sub: null,
      className:
        "bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-600 text-slate-900 dark:text-gray-200",
    },
    {
      label: "Available",
      value: stats.available,
      sub: "Ready to sell",
      className:
        "bg-slate-100 dark:bg-gray-800/80 border border-emerald-300 dark:border-green-600/60 text-slate-900 dark:text-gray-200",
    },
    {
      label: "Occupied",
      value: stats.occupied,
      sub: "Currently occupied",
      className:
        "bg-slate-100 dark:bg-gray-800/80 border border-blue-300 dark:border-blue-600/60 text-slate-900 dark:text-gray-200",
    },
    {
      label: "Cleaning",
      value: stats.cleaning,
      sub: "Being cleaned",
      className:
        "bg-slate-100 dark:bg-gray-800/80 border border-amber-300 dark:border-amber-500/60 text-slate-900 dark:text-gray-200",
    },
    {
      label: "Maintenance",
      value: stats.maintenance,
      sub: "Cannot be sold",
      className:
        "bg-slate-100 dark:bg-gray-800/80 border border-rose-300 dark:border-red-600/60 text-slate-900 dark:text-gray-200",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Page title */}
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Rooms</h1>

      {/* Room Availability - stats row */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Room Availability</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {statsCards.map((card) => (
            <div key={card.label} className={`p-3 rounded-lg ${card.className}`}>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{card.label}</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">{card.value}</div>
              {card.sub && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{card.sub}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Search and Filter - one line */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative h-[42px]">
          <input
            type="text"
            placeholder="Search by number or category"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-full pl-4 pr-11 text-sm rounded-lg bg-slate-200 dark:bg-gray-800 border border-slate-300 dark:border-gray-600 text-slate-900 dark:text-gray-100 placeholder-slate-500 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-200 rounded transition-colors"
            aria-label="Search"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
        <div className="relative flex items-center gap-3 h-[42px]">
          <button
            ref={filterButtonRef}
            type="button"
            onClick={() => setFilterOpen(!filterOpen)}
            className="h-full flex items-center gap-2 px-5 rounded-lg bg-slate-200 dark:bg-gray-700 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 hover:bg-slate-300 dark:hover:bg-gray-600 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter
          </button>
          <button
            type="button"
            onClick={handleAddRoom}
            className="h-full px-5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            Add room
          </button>
        </div>
      </div>

      <Popover
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        anchorRef={filterButtonRef}
        placement="bottom-start"
        gap={0}
        className="w-56 p-4 pt-3"
      >
        <div className="space-y-2">
          {FILTER_OPTIONS.map((opt) => {
            const checked =
              opt.value === "All"
                ? statusFilters.has("All")
                : statusFilters.has("All") || statusFilters.has(opt.value as Room["status"]);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleStatusFilter(opt.value)}
                  className="w-4 h-4 rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-gray-800"
                />
                <span
                  className={`text-sm ${opt.value === "All" && checked ? "text-blue-400" : "text-gray-300 group-hover:text-white"}`}
                >
                  {opt.label}
                </span>
              </label>
            );
          })}
        </div>
      </Popover>

      {/* Rooms Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-400">
            Rooms ({filteredRooms.length})
          </h2>
        </div>
        {filteredRooms.length === 0 ? (
          <Card className="bg-gray-800/80 border-gray-600">
            <EmptyState
              title="No rooms found"
              message="Try changing the search filters to see more rooms."
            />
          </Card>
        ) : (
          <div className={layout.grid.cards}>
            {filteredRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onClick={handleViewDetails}
              />
            ))}
          </div>
        )}
      </div>

      {/* Room Details Modal */}
      <Modal
        isOpen={showRoomDetailsModal}
        onClose={() => {
          setShowRoomDetailsModal(false);
          setSelectedRoom(null);
          setSelectedTask(null);
          setRoomDetailsView("details");
          setShowCreateTaskForm(false);
          setTaskNotes("");
          setTaskPriority("Medium");
          setIsEditingRoom(false);
          setAmenitiesInput("");
        }}
        title="Room Details"
        size="xl"
        footer={
          roomDetailsView === "edit" ? (
            <div className="flex gap-2 w-full">
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                onClick={() => {
                  setRoomDetailsView("details");
                  setIsEditingRoom(false);
                  // Restore amenities input from roomForm when canceling
                  if (selectedRoom) {
                    setAmenitiesInput(selectedRoom.amenities?.join(", ") || "");
                  }
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" fullWidth onClick={handleSaveRoom}>
                Save Changes
              </Button>
            </div>
          ) : null
        }
      >
        {selectedRoom && (() => {
          const currentBooking = getCurrentBooking(selectedRoom.id);
          const roomTasks = getRoomTasks(selectedRoom.id);
          const currentTask = roomTasks.find(t => t.status === "Pending" || t.status === "In Progress");

          if (roomDetailsView === "edit") {
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Room Number *
                    </label>
                    <input
                      type="text"
                      value={roomForm.number}
                      onChange={(e) => setRoomForm({ ...roomForm, number: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                      placeholder="e.g., 101"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Category *
                    </label>
                    <input
                      type="text"
                      value={roomForm.category}
                      onChange={(e) => setRoomForm({ ...roomForm, category: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                      placeholder="e.g., Standard, Deluxe, Suite"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Status *
                    </label>
                    <select
                      value={roomForm.status}
                      onChange={(e) =>
                        setRoomForm({
                          ...roomForm,
                          status: e.target.value as Room["status"],
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    >
                      <option value="Available">Available</option>
                      <option value="Occupied">Occupied</option>
                      <option value="Cleaning">Cleaning</option>
                      <option value="Maintenance">Maintenance</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Capacity *
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={roomForm.capacity === null || roomForm.capacity === undefined ? "" : roomForm.capacity}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "") {
                          setRoomForm({ ...roomForm, capacity: null as any });
                        } else {
                          const numValue = parseInt(value);
                          if (!isNaN(numValue) && numValue > 0) {
                            setRoomForm({ ...roomForm, capacity: numValue });
                          }
                        }
                      }}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Price per night ($) *
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    value={roomForm.price === null || roomForm.price === undefined ? "" : roomForm.price}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "") {
                        setRoomForm({ ...roomForm, price: null as any });
                      } else {
                        // Allow only numbers and dot
                        const cleanedValue = value.replace(/[^0-9.]/g, '');
                        // Check that the dot is only one
                        const parts = cleanedValue.split('.');
                        const finalValue = parts.length > 2 
                          ? parts[0] + '.' + parts.slice(1).join('')
                          : cleanedValue;
                        const numValue = parseFloat(finalValue);
                        if (!isNaN(numValue) && numValue >= 0) {
                          setRoomForm({ ...roomForm, price: numValue });
                        } else if (finalValue === '' || finalValue === '.') {
                          setRoomForm({ ...roomForm, price: null as any });
                        }
                      }
                    }}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={roomForm.description}
                    onChange={(e) => setRoomForm({ ...roomForm, description: e.target.value })}
                    rows={3}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    placeholder="Room description..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    Amenities (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={amenitiesInput}
                    onChange={(e) => setAmenitiesInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    placeholder="e.g., Wi-Fi, TV, Air conditioner"
                  />
                </div>
              </div>
            );
          }

          if (roomDetailsView === "cleaning") {
            return (
              <div className="space-y-4">
                <Card padding="sm">
                  <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                    Cleaning
                  </h3>
                  {currentTask ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">
                          Current Task
                        </label>
                        <div className="p-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`px-1.5 py-0.5 text-xs font-semibold rounded ${getTaskStatusColor(currentTask.status)}`}>
                              {currentTask.status}
                            </span>
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {getPriorityIcon(currentTask.priority)} {currentTask.priority}
                            </span>
                          </div>
                          {currentTask.notes && (
                            <p className="text-xs text-gray-700 dark:text-gray-300 mt-1.5">
                              {currentTask.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        {currentTask.status !== "Completed" && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="sm:flex-1"
                            onClick={async () => {
                              try {
                                await tasksApi.complete(currentTask.id);
                                toast.success("Task marked as completed");
                                await loadTasks();
                                // Update the list of rooms to see the new status (Available)
                                await loadRooms();
                                // Update selectedRoom, if it was selected
                                if (selectedRoom) {
                                  const updatedRooms = await roomsApi.getAll();
                                  const updatedRoom = updatedRooms.find((r) => r.id === selectedRoom.id);
                                  if (updatedRoom) {
                                    setSelectedRoom(updatedRoom);
                                  }
                                }
                              } catch (error) {
                                toast.error("Error completing task");
                                console.error(error);
                              }
                            }}
                          >
                            Mark Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : showCreateTaskForm ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                              Priority
                            </label>
                            <select
                              value={taskPriority}
                              onChange={(e) => setTaskPriority(e.target.value as "Low" | "Medium" | "High")}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                            >
                              <option value="Low">Low</option>
                              <option value="Medium">Medium</option>
                              <option value="High">High</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                              Notes (optional)
                            </label>
                            <textarea
                              value={taskNotes}
                              onChange={(e) => setTaskNotes(e.target.value)}
                              rows={3}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors resize-none"
                              placeholder="Add any special instructions..."
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="sm:flex-1"
                          onClick={() => {
                            setShowCreateTaskForm(false);
                            setTaskNotes("");
                            setTaskPriority("Medium");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          className="sm:flex-1"
                          onClick={handleCreateTask}
                        >
                          Create Task
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                        No active cleaning task
                      </p>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setShowCreateTaskForm(true)}
                      >
                        Create Cleaning Task
                      </Button>
                    </div>
                  )}
                </Card>

                {/* Action Buttons */}
                <div className="flex gap-2 w-full mt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    onClick={() => {
                      if (selectedRoom) {
                        setIsEditingRoom(true);
                        setRoomForm({
                          number: selectedRoom.number,
                          category: selectedRoom.category,
                          status: selectedRoom.status,
                          price: selectedRoom.price,
                          capacity: selectedRoom.capacity,
                          description: selectedRoom.description || "",
                          amenities: selectedRoom.amenities || [],
                        });
                        setAmenitiesInput(selectedRoom.amenities?.join(", ") || "");
                        setRoomDetailsView("edit");
                      }
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    fullWidth
                    onClick={() => {
                      if (selectedRoom) {
                        setPendingStatusChange({ roomId: selectedRoom.id, newStatus: "Maintenance" });
                        setShowMaintenanceConfirmModal(true);
                      }
                    }}
                  >
                    Danger Zone
                  </Button>
                </div>
              </div>
            );
          }

          return (
            <div className="space-y-4">
              {/* Header: Room #XXX, Current status */}
              <div className="flex items-center gap-2 pb-3 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Room #{selectedRoom.number}
                </h2>
                <span
                  className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusColors[selectedRoom.status]}`}
                >
                  {selectedRoom.status}
                </span>
              </div>

              {/* Primary info */}
              <Card padding="sm">
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                  Primary Info
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
                      Room Type
                    </label>
                    <p className="text-sm text-gray-900 dark:text-white">
                      {selectedRoom.category}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
                        Capacity
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {selectedRoom.capacity} people
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
                        Price
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {selectedRoom.price.toLocaleString("en-US")} $/night
                      </p>
                    </div>
                  </div>
                  {selectedRoom.amenities && selectedRoom.amenities.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">
                        Amenities
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {selectedRoom.amenities.map((amenity, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded"
                          >
                            {amenity}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Booking (if there is one) */}
              {currentBooking && (
                <Card padding="sm">
                  <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                    Booking
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
                        Guest Name
                      </label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {currentBooking.guestName}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
                          Check-in
                        </label>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {formatDate(currentBooking.checkIn)}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
                          Check-out
                        </label>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {formatDate(currentBooking.checkOut)}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
                        Status
                      </label>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${
                          currentBooking.status === "Checked-in"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                            : currentBooking.status === "Upcoming"
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {currentBooking.status}
                      </span>
                    </div>
                  </div>
                </Card>
              )}

              {/* Cleaning */}
              <Card padding="sm">
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
                  Cleaning
                </h3>
                {currentTask ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 block">
                        Current Task
                      </label>
                      <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${getTaskStatusColor(currentTask.status)}`}>
                            {currentTask.status}
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {getPriorityIcon(currentTask.priority)} {currentTask.priority}
                          </span>
                        </div>
                        {currentTask.notes && (
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                            {currentTask.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
                          Status
                        </label>
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${getTaskStatusColor(currentTask.status)}`}>
                          {currentTask.status}
                        </span>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
                          Assigned Staff
                        </label>
                        <p className="text-sm text-gray-900 dark:text-white">
                          {currentTask.assignedToName || (
                            <span className="text-gray-500 dark:text-gray-400 italic">Not assigned</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      {!currentTask.assignedToName && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="sm:flex-1"
                          onClick={() => {
                            setSelectedTask(currentTask);
                            setAssignStaffId("");
                            setAssignStaffName("");
                            setShowAssignStaffModal(true);
                          }}
                        >
                          Assign Staff
                        </Button>
                      )}
                      {currentTask.status !== "Completed" && (
                        <Button
                          variant="primary"
                          size="sm"
                          className="sm:flex-1"
                          onClick={async () => {
                            try {
                              await tasksApi.complete(currentTask.id);
                              toast.success("Task marked as completed");
                              await loadTasks();
                            } catch (error) {
                              toast.error("Error completing task");
                              console.error(error);
                            }
                          }}
                        >
                          Mark Complete
                        </Button>
                      )}
                    </div>
                  </div>
                ) : showCreateTaskForm ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                            Priority
                          </label>
                          <select
                            value={taskPriority}
                            onChange={(e) => setTaskPriority(e.target.value as "Low" | "Medium" | "High")}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                            Notes (optional)
                          </label>
                          <textarea
                            value={taskNotes}
                            onChange={(e) => setTaskNotes(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors resize-none"
                            placeholder="Add any special instructions..."
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="sm:flex-1"
                        onClick={() => {
                          setShowCreateTaskForm(false);
                          setTaskNotes("");
                          setTaskPriority("Medium");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="sm:flex-1"
                        onClick={handleCreateTask}
                      >
                        Create Task
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                      No active cleaning task
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setShowCreateTaskForm(true)}
                    >
                      Create Cleaning Task
                    </Button>
                  </div>
                )}
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-2 w-full mt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    if (selectedRoom) {
                      setIsEditingRoom(true);
                      setRoomForm({
                        number: selectedRoom.number,
                        category: selectedRoom.category,
                        status: selectedRoom.status,
                        price: selectedRoom.price,
                        capacity: selectedRoom.capacity,
                        description: selectedRoom.description || "",
                        amenities: selectedRoom.amenities || [],
                      });
                      setAmenitiesInput(selectedRoom.amenities?.join(", ") || "");
                      setRoomDetailsView("edit");
                    }
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    if (selectedRoom) {
                      setPendingStatusChange({ roomId: selectedRoom.id, newStatus: "Maintenance" });
                      setShowMaintenanceConfirmModal(true);
                    }
                  }}
                >
                  Danger Zone
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Room Form Modal (Create/Edit) */}
      <Modal
        isOpen={showRoomFormModal}
        onClose={() => {
          setShowRoomFormModal(false);
          setRoomForm({
            number: "",
            category: "",
            status: "Available",
            price: null as any,
            capacity: null as any,
            description: "",
            amenities: [],
          });
          setAmenitiesInput("");
        }}
        title={isEditingRoom ? `Edit Room #${roomForm.number}` : "Add New Room"}
        size="lg"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setShowRoomFormModal(false);
                setRoomForm({
                  number: "",
                  category: "",
                  status: "Available",
                  price: null as any,
                  capacity: null as any,
                  description: "",
                  amenities: [],
                });
                setAmenitiesInput("");
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" fullWidth onClick={handleSaveRoom}>
              {isEditingRoom ? "Save Changes" : "Create Room"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Room Number *
              </label>
              <input
                type="text"
                value={roomForm.number}
                onChange={(e) => setRoomForm({ ...roomForm, number: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder="e.g., 101"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category *
              </label>
              <input
                type="text"
                value={roomForm.category}
                onChange={(e) => setRoomForm({ ...roomForm, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder="e.g., Standard, Deluxe, Suite"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status *
              </label>
              <select
                value={roomForm.status}
                onChange={(e) =>
                  setRoomForm({
                    ...roomForm,
                    status: e.target.value as Room["status"],
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                <option value="Available">Available</option>
                <option value="Occupied">Occupied</option>
                <option value="Cleaning">Cleaning</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Capacity *
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={roomForm.capacity === null || roomForm.capacity === undefined ? "" : roomForm.capacity}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "") {
                    setRoomForm({ ...roomForm, capacity: null as any });
                  } else {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue > 0) {
                      setRoomForm({ ...roomForm, capacity: numValue });
                    }
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Price per night ($) *
            </label>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*\.?[0-9]*"
              value={roomForm.price === null || roomForm.price === undefined ? "" : roomForm.price}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "") {
                  setRoomForm({ ...roomForm, price: null as any });
                } else {
                  // Allow only numbers and dot
                  const cleanedValue = value.replace(/[^0-9.]/g, '');
                  // Check that the dot is only one
                  const parts = cleanedValue.split('.');
                  const finalValue = parts.length > 2 
                    ? parts[0] + '.' + parts.slice(1).join('')
                    : cleanedValue;
                  const numValue = parseFloat(finalValue);
                  if (!isNaN(numValue) && numValue >= 0) {
                    setRoomForm({ ...roomForm, price: numValue });
                  } else if (finalValue === '' || finalValue === '.') {
                    setRoomForm({ ...roomForm, price: null as any });
                  }
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={roomForm.description}
              onChange={(e) => setRoomForm({ ...roomForm, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              placeholder="Room description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Amenities (comma-separated)
            </label>
            <input
              type="text"
              value={amenitiesInput}
              onChange={(e) => setAmenitiesInput(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              placeholder="e.g., Wi-Fi, TV, Air conditioner"
            />
          </div>
        </div>
      </Modal>

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

      {/* Assign Staff Modal */}
      <Modal
        isOpen={showAssignStaffModal}
        onClose={() => {
          setShowAssignStaffModal(false);
          setAssignStaffId("");
          setAssignStaffName("");
          setSelectedTask(null);
        }}
        title={selectedTask ? `Assign Staff - Task #${selectedTask.id}` : "Assign Staff"}
        size="sm"
        footer={
          <div className="flex gap-2 w-full">
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              onClick={() => {
                setShowAssignStaffModal(false);
                setAssignStaffId("");
                setAssignStaffName("");
                setSelectedTask(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              fullWidth
              onClick={async () => {
                if (!selectedTask) return;
                const trimmedName = assignStaffName.trim();
                const idNumber = Number(assignStaffId);
                if (!trimmedName) {
                  toast.error("Please enter staff name");
                  return;
                }
                if (!assignStaffId || Number.isNaN(idNumber) || idNumber <= 0) {
                  toast.error("Please enter valid staff ID (number)");
                  return;
                }
                try {
                  await tasksApi.assign(selectedTask.id, idNumber, trimmedName);
                  toast.success("Staff assigned to task");
                  setShowAssignStaffModal(false);
                  setAssignStaffId("");
                  setAssignStaffName("");
                  setSelectedTask(null);
                  await loadTasks();
                } catch (error) {
                  toast.error("Error assigning staff");
                  console.error(error);
                }
              }}
            >
              Assign
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {selectedTask && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg border border-gray-200 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-300">
              <div className="font-semibold mb-1">
                Task #{selectedTask.id} · Room #{selectedTask.roomNumber}
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-[11px] font-semibold rounded ${getTaskStatusColor(selectedTask.status)}`}>
                  {selectedTask.status}
                </span>
                <span className="text-[11px]">
                  {getPriorityIcon(selectedTask.priority)} {selectedTask.priority}
                </span>
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Staff ID
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={assignStaffId}
              onChange={(e) => setAssignStaffId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              placeholder="Enter staff internal ID"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Staff Name
            </label>
            <input
              type="text"
              value={assignStaffName}
              onChange={(e) => setAssignStaffName(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              placeholder="e.g., Maria Ivanova"
            />
          </div>
        </div>
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
            <Button variant="danger" size="sm" fullWidth onClick={handleDeleteRoom}>
              Delete
            </Button>
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

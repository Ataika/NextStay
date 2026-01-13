import { useState, useEffect, useMemo } from "react";
import type { Room } from "../../mocks/rooms";
import { tasksApi, roomsApi, bookingsApi } from "../../api/api";
import type { CleaningTask } from "../../mocks/tasks";
import type { Booking } from "../../mocks/bookings";
import RoomCard from "../../components/RoomCard";
import EmptyState from "../../ui/EmptyState";
import PageHeader from "../../ui/PageHeader";
import Card from "../../ui/Card";
import Button from "../../ui/Button";
import Modal from "../../ui/Modal";
import Drawer from "../../ui/Drawer";
import LoadingSpinner from "../../ui/LoadingSpinner";
import { layout, colors } from "../../constants/designTokens";
import toast from "react-hot-toast";

type StatusFilter = Room["status"] | "All";

const statusColors = {
  Available: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700",
  Occupied: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700",
  Maintenance: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700",
  // Dirty is no longer a room status - it's a cleaning state
  Dirty: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
};

export default function AdminPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedTask, setSelectedTask] = useState<CleaningTask | null>(null);
  const [showCreateTaskForm, setShowCreateTaskForm] = useState(false);
  const [showTaskDetailsModal, setShowTaskDetailsModal] = useState(false);
  const [taskPriority, setTaskPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [taskNotes, setTaskNotes] = useState("");
  const [showRoomFormModal, setShowRoomFormModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showMaintenanceConfirmModal, setShowMaintenanceConfirmModal] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ roomId: number; newStatus: Room["status"] } | null>(null);
  const [isEditingRoom, setIsEditingRoom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roomForm, setRoomForm] = useState<Omit<Room, "id">>({
    number: "",
    category: "",
    status: "Available",
    price: 0,
    capacity: 2,
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

  // Analytics
  const stats = useMemo(() => {
    return {
      total: rooms.length,
      available: rooms.filter((r) => r.status === "Available").length,
      occupied: rooms.filter((r) => r.status === "Occupied").length,
      maintenance: rooms.filter((r) => r.status === "Maintenance").length,
      // Rooms needing cleaning (have pending/in-progress tasks)
      needsCleaning: rooms.filter((r) => {
        const roomTasks = tasks.filter((t) => t.roomId === r.id);
        return roomTasks.some((t) => t.status === "Pending" || t.status === "In Progress");
      }).length,
    };
  }, [rooms, tasks]);

  // Tasks analytics
  const tasksStats = useMemo(() => {
    return {
      pending: tasks.filter((t) => t.status === "Pending").length,
      inProgress: tasks.filter((t) => t.status === "In Progress").length,
      completed: tasks.filter((t) => t.status === "Completed").length,
    };
  }, [tasks]);

  // Upcoming tasks (Pending + In Progress, sorted by priority and date)
  const upcomingTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status === "Pending" || t.status === "In Progress")
      .sort((a, b) => {
        const priorityOrder = { High: 3, Medium: 2, Low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      })
      .slice(0, 5);
  }, [tasks]);

  // Filtering rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesStatus =
        statusFilter === "All" || room.status === statusFilter;
      const matchesSearch =
        searchQuery === "" ||
        room.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [rooms, statusFilter, searchQuery]);

  const handleStatusChange = async (roomId: number, newStatus: Room["status"], currentStatus: Room["status"]) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return;

    // If status didn't change, do nothing
    if (newStatus === currentStatus) return;

    // Maintenance requires confirmation
    if (newStatus === "Maintenance") {
      setPendingStatusChange({ roomId, newStatus });
      setShowMaintenanceConfirmModal(true);
      return;
    }

    // Available → only if clean (no active cleaning tasks)
    if (newStatus === "Available") {
      const roomTasks = getRoomTasks(roomId);
      const hasActiveTasks = roomTasks.some(
        (t) => t.status === "Pending" || t.status === "In Progress"
      );
      
      if (hasActiveTasks) {
        toast.error("Cannot set room as Available: active cleaning tasks exist");
        return;
      }

      try {
        await roomsApi.update(roomId, { status: newStatus });
        await loadRooms();
        toast.success(`Room #${room.number} set to Available`);
      } catch (error) {
        toast.error("Error updating room status");
        console.error(error);
      }
      return;
    }

    // Dirty → trigger cleaning task (but Dirty is not a room status anymore, so this shouldn't happen)
    // But for backward compatibility, if someone tries to set Dirty, create a task instead
    if (newStatus === "Dirty") {
      try {
        await tasksApi.create(roomId, room.number, "High");
        toast.success(`Cleaning task created for Room #${room.number}`);
        await loadTasks();
        // Don't change room status to Dirty
      } catch (error) {
        toast.error("Error creating cleaning task");
        console.error(error);
      }
      return;
    }

    // Occupied - direct change
    try {
      await roomsApi.update(roomId, { status: newStatus });
      await loadRooms();
      toast.success(`Room #${room.number} set to ${newStatus}`);
    } catch (error) {
      toast.error("Error updating room status");
      console.error(error);
    }
  };

  const confirmMaintenanceChange = async () => {
    if (!pendingStatusChange) return;

    try {
      await roomsApi.update(pendingStatusChange.roomId, { status: pendingStatusChange.newStatus });
      await loadRooms();
      const room = rooms.find((r) => r.id === pendingStatusChange.roomId);
      toast.success(`Room #${room?.number || pendingStatusChange.roomId} set to Maintenance`);
      setShowMaintenanceConfirmModal(false);
      setPendingStatusChange(null);
    } catch (error) {
      toast.error("Error updating room status");
      console.error(error);
    }
  };

  const handleViewDetails = (roomId: number) => {
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      setSelectedRoom(room);
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
      price: 0,
      capacity: 2,
      description: "",
      amenities: [],
    });
    setShowRoomFormModal(true);
  };

  const handleEditRoom = () => {
    if (!selectedRoom) return;
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
    setShowRoomFormModal(true);
  };

  const handleSaveRoom = async () => {
    try {
      if (isEditingRoom && selectedRoom) {
        await roomsApi.update(selectedRoom.id, roomForm);
        toast.success(`Room #${roomForm.number} updated successfully`);
      } else {
        await roomsApi.create(roomForm);
        toast.success(`Room #${roomForm.number} created successfully`);
      }
      setShowRoomFormModal(false);
      await loadRooms();
      if (isEditingRoom) {
        setSelectedRoom(null);
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
      setSelectedRoom(null);
      await loadRooms();
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

  const handleTaskClick = (task: CleaningTask) => {
    setSelectedTask(task);
    setShowTaskDetailsModal(true);
  };

  if (loading) {
    return <LoadingSpinner message="Loading rooms..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administration Panel"
        subtitle="Management of rooms and statuses"
        action={
          <Button variant="primary" onClick={handleAddRoom}>
            Add room
          </Button>
        }
      />

      {/* Room Availability */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">
          Room Availability
        </h3>
        <div className={layout.grid.stats}>
          <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total rooms</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
          </div>
          <div className={`p-4 rounded-lg border ${colors.success.light}`}>
            <div className="text-sm text-green-700 dark:text-green-400 mb-1">Available</div>
            <div className="text-2xl font-bold text-green-800 dark:text-green-300">{stats.available}</div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">Ready to sell</p>
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="text-sm text-blue-700 dark:text-blue-400 mb-1">Occupied</div>
            <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">{stats.occupied}</div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Currently occupied</p>
          </div>
          <div className={`p-4 rounded-lg border ${colors.danger.light}`}>
            <div className="text-sm text-red-700 dark:text-red-400 mb-1">Maintenance</div>
            <div className="text-2xl font-bold text-red-800 dark:text-red-300">{stats.maintenance}</div>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Cannot be sold</p>
          </div>
        </div>
      </Card>

      {/* Cleaning Workload */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">
          Cleaning Workload
        </h3>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => {
              const pendingTasks = tasks.filter((t) => t.status === "Pending");
              if (pendingTasks.length > 0) {
                // Scroll to tasks section or show filtered view
                // For now, just show first task
                handleTaskClick(pendingTasks[0]);
              }
            }}
            className="text-center p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
          >
            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              {tasksStats.pending}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Pending</div>
          </button>
          <button
            onClick={() => {
              const inProgressTasks = tasks.filter((t) => t.status === "In Progress");
              if (inProgressTasks.length > 0) {
                handleTaskClick(inProgressTasks[0]);
              }
            }}
            className="text-center p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
          >
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
              {tasksStats.inProgress}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">In progress</div>
          </button>
          <button
            onClick={() => {
              const completedTasks = tasks.filter((t) => t.status === "Completed");
              if (completedTasks.length > 0) {
                handleTaskClick(completedTasks[0]);
              }
            }}
            className="text-center p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
          >
            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
              {tasksStats.completed}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
          </button>
        </div>

        {/* Upcoming Tasks List */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Upcoming tasks ({upcomingTasks.length})
          </h4>
          {upcomingTasks.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-3">
              No upcoming tasks
            </p>
          ) : (
            <div className="space-y-1">
              {upcomingTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => handleTaskClick(task)}
                  className="flex items-center gap-4 p-2 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                >
                  {/* Status indicator */}
                  <div className="flex-shrink-0 w-2 h-2 rounded-full">
                    {task.status === "Pending" && (
                      <div className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500" />
                    )}
                    {task.status === "In Progress" && (
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    )}
                    {task.status === "Completed" && (
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    )}
                  </div>
                  
                  {/* Room */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Room #{task.roomNumber}
                    </span>
                  </div>
                  
                  {/* Assigned staff */}
                  <div className="flex-1 min-w-0 text-sm text-gray-600 dark:text-gray-400">
                    {task.assignedToName || (
                      <span className="text-gray-400 dark:text-gray-500 italic">Unassigned</span>
                    )}
                  </div>
                  
                  {/* Priority */}
                  <div className="flex-shrink-0 flex items-center gap-1.5">
                    <span className="text-xs">{getPriorityIcon(task.priority)}</span>
                    <span className={`text-xs font-medium ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Filters */}
      <Card padding="md">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by number or category..."
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
              <option value="All">All statuses</option>
              <option value="Available">Available</option>
              <option value="Occupied">Occupied</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Rooms Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white">
            Rooms ({filteredRooms.length})
          </h2>
        </div>
        {filteredRooms.length === 0 ? (
          <Card>
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
                onStatusChange={handleStatusChange}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        )}
      </div>

      {/* Room Details Drawer */}
      <Drawer
        isOpen={!!selectedRoom}
        onClose={() => {
          setSelectedRoom(null);
          setShowCreateTaskForm(false);
          setTaskNotes("");
          setTaskPriority("Medium");
        }}
        title=""
        width="lg"
      >
        {selectedRoom && (() => {
          const currentBooking = getCurrentBooking(selectedRoom.id);
          const roomTasks = getRoomTasks(selectedRoom.id);
          const currentTask = roomTasks.find(t => t.status === "Pending" || t.status === "In Progress");

          return (
            <div className="space-y-6">
              {/* Header: Room #XXX, Current status, Quick actions */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Room #{selectedRoom.number}
                  </h2>
                  <span
                    className={`px-3 py-1 text-sm font-semibold rounded-full ${statusColors[selectedRoom.status]}`}
                  >
                    {selectedRoom.status}
                  </span>
                </div>
                <Button variant="secondary" size="sm" onClick={handleEditRoom}>
                  Edit
                </Button>
              </div>

              {/* Primary info */}
              <Card padding="md">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">
                  Primary Info
                </h3>
                <div className="space-y-4">
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

              {/* Booking (если есть) */}
              {currentBooking && (
                <Card padding="md">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">
                    Booking
                  </h3>
                  <div className="space-y-4">
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
              <Card padding="md">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">
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
                            toast("Assign staff functionality coming soon", { icon: "ℹ️" });
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

              {/* Danger zone (всегда внизу, отделена визуально) */}
              <div className="mt-6 pt-6 border-t-2 border-red-200 dark:border-red-800">
                <Card padding="md" className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
                  <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-4 uppercase tracking-wide">
                    Danger Zone
                  </h3>
                  <div className="space-y-3">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        handleStatusChange(selectedRoom.id, "Maintenance", selectedRoom.status);
                      }}
                    >
                      Mark as Maintenance
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setShowDeleteConfirmModal(true)}
                    >
                      Delete Room
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          );
        })()}
      </Drawer>

      {/* Room Form Modal (Create/Edit) */}
      <Modal
        isOpen={showRoomFormModal}
        onClose={() => {
          setShowRoomFormModal(false);
          setRoomForm({
            number: "",
            category: "",
            status: "Available",
            price: 0,
            capacity: 2,
            description: "",
            amenities: [],
          });
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
                  price: 0,
                  capacity: 2,
                  description: "",
                  amenities: [],
                });
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
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Capacity *
              </label>
              <input
                type="number"
                min="1"
                value={roomForm.capacity}
                onChange={(e) =>
                  setRoomForm({ ...roomForm, capacity: parseInt(e.target.value) || 1 })
                }
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
              type="number"
              min="0"
              step="0.01"
              value={roomForm.price}
              onChange={(e) =>
                setRoomForm({ ...roomForm, price: parseFloat(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
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
              value={roomForm.amenities?.join(", ") || ""}
              onChange={(e) =>
                setRoomForm({
                  ...roomForm,
                  amenities: e.target.value
                    .split(",")
                    .map((a) => a.trim())
                    .filter((a) => a.length > 0),
                })
              }
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

      {/* Maintenance Confirmation Modal */}
      <Modal
        isOpen={showMaintenanceConfirmModal}
        onClose={() => {
          setShowMaintenanceConfirmModal(false);
          setPendingStatusChange(null);
        }}
        title="Confirm Maintenance"
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setShowMaintenanceConfirmModal(false);
                setPendingStatusChange(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" fullWidth onClick={confirmMaintenanceChange}>
              Mark as Maintenance
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to mark{" "}
              <span className="font-semibold">Room #{rooms.find((r) => r.id === pendingStatusChange?.roomId)?.number || pendingStatusChange?.roomId}</span>{" "}
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
          <div className="flex gap-3 w-full">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowDeleteConfirmModal(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" fullWidth onClick={handleDeleteRoom}>
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

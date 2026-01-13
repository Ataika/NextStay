import { useState, useMemo } from "react";
import { mockRooms } from "../../mocks/rooms";
import type { Room } from "../../mocks/rooms";
import RoomCard from "../../components/RoomCard";

type StatusFilter = Room["status"] | "All";

export default function AdminPage() {
  const [rooms, setRooms] = useState<Room[]>(mockRooms);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Analytics
  const stats = useMemo(() => {
    return {
      total: rooms.length,
      available: rooms.filter((r) => r.status === "Available").length,
      occupied: rooms.filter((r) => r.status === "Occupied").length,
      dirty: rooms.filter((r) => r.status === "Dirty").length,
      maintenance: rooms.filter((r) => r.status === "Maintenance").length,
    };
  }, [rooms]);

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

  const handleStatusChange = (roomId: number, newStatus: Room["status"]) => {
    setRooms((prevRooms) =>
      prevRooms.map((room) =>
        room.id === roomId ? { ...room, status: newStatus } : room
      )
    );
  };

  const handleViewDetails = (roomId: number) => {
    const room = rooms.find((r) => r.id === roomId);
    if (room) {
      setSelectedRoom(room);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Administration Panel</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">Management of rooms and statuses</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total rooms</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg shadow-sm p-4 border border-green-200 dark:border-green-800">
          <div className="text-sm text-green-700 dark:text-green-400 mb-1">Available</div>
          <div className="text-2xl font-bold text-green-800 dark:text-green-300">{stats.available}</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg shadow-sm p-4 border border-blue-200 dark:border-blue-800">
          <div className="text-sm text-blue-700 dark:text-blue-400 mb-1">Occupied</div>
          <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">{stats.occupied}</div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg shadow-sm p-4 border border-yellow-200 dark:border-yellow-800">
          <div className="text-sm text-yellow-700 dark:text-yellow-400 mb-1">Requires cleaning</div>
          <div className="text-2xl font-bold text-yellow-800 dark:text-yellow-300">{stats.dirty}</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg shadow-sm p-4 border border-red-200 dark:border-red-800">
          <div className="text-sm text-red-700 dark:text-red-400 mb-1">Maintenance</div>
          <div className="text-2xl font-bold text-red-800 dark:text-red-300">{stats.maintenance}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
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
              <option value="Dirty">Requires cleaning</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>
        </div>
      </div>

      {/* Rooms Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white">
            Rooms ({filteredRooms.length})
          </h2>
        </div>
        {filteredRooms.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 sm:p-12 border border-gray-200 dark:border-gray-700 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg">Rooms not found</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
              Try changing the search filters
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
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

      {/* Room Details Modal */}
      {selectedRoom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedRoom(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Room #{selectedRoom.number}
              </h2>
              <button
                onClick={() => setSelectedRoom(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                aria-label="Close"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Category
                </label>
                <p className="text-lg text-gray-900 dark:text-white mt-1">
                  {selectedRoom.category}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Status
                </label>
                <p className="text-lg text-gray-900 dark:text-white mt-1">
                  {selectedRoom.status === "Available"
                    ? "Available"
                    : selectedRoom.status === "Occupied"
                    ? "Occupied"
                    : selectedRoom.status === "Dirty"
                    ? "Requires cleaning"
                    : "Maintenance"}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Price
                </label>
                <p className="text-lg text-gray-900 dark:text-white mt-1">
                  {selectedRoom.price.toLocaleString("ru-RU")} $
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Capacity
                </label>
                <p className="text-lg text-gray-900 dark:text-white mt-1">
                  {selectedRoom.capacity} people
                </p>
              </div>

              {selectedRoom.description && (
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Description
                  </label>
                  <p className="text-gray-700 dark:text-gray-300 mt-1">
                    {selectedRoom.description}
                  </p>
                </div>
              )}

              {selectedRoom.amenities && selectedRoom.amenities.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Amenities
                  </label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedRoom.amenities.map((amenity, idx) => (
                      <span
                        key={idx}
                        className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-full"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedRoom(null)}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

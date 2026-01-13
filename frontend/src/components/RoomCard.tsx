import type { Room } from "../mocks/rooms";

interface RoomCardProps {
  room: Room;
  onStatusChange?: (roomId: number, newStatus: Room["status"]) => void;
  onViewDetails?: (roomId: number) => void;
}

const statusColors = {
  Available: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700",
  Occupied: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700",
  Dirty: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
  Maintenance: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700",
};

const statusIcons = {
  Available: "✓",
  Occupied: "👤",
  Dirty: "🧹",
  Maintenance: "🔧",
};

export default function RoomCard({
  room,
  onStatusChange,
  onViewDetails,
}: RoomCardProps) {
  const statusColor = statusColors[room.status];
  const statusIcon = statusIcons[room.status];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Status Badge */}
      <div className={`px-4 py-2 border-b ${statusColor}`}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm flex items-center gap-2">
            <span>{statusIcon}</span>
            {room.status}
          </span>
          <span className="text-xs font-medium dark:text-gray-300">#{room.number}</span>
        </div>
      </div>

      {/* Room Content */}
      <div className="p-4">
        <div className="mb-3">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">
            {room.category}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {room.description}
          </p>
        </div>

        {/* Room Details */}
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-4">
          <div className="flex items-center gap-1">
            <span>👥</span>
            <span>{room.capacity} people</span>
          </div>
          <div className="font-semibold text-gray-800 dark:text-white">
            {room.price.toLocaleString("ru-RU")} ₽
          </div>
        </div>

        {/* Amenities */}
        {room.amenities && room.amenities.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-1">
              {room.amenities.slice(0, 3).map((amenity, idx) => (
                <span
                  key={idx}
                  className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded"
                >
                  {amenity}
                </span>
              ))}
              {room.amenities.length > 3 && (
                <span className="text-xs text-gray-500 dark:text-gray-500 px-2 py-1">
                  +{room.amenities.length - 3}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2">
          {onStatusChange && (
            <select
              value={room.status}
              onChange={(e) =>
                onStatusChange(room.id, e.target.value as Room["status"])
              }
              className="flex-1 text-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
            >
              <option value="Available">Available</option>
              <option value="Occupied">Occupied</option>
              <option value="Dirty">Dirty</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          )}
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(room.id)}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white text-xs font-medium rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              Details
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

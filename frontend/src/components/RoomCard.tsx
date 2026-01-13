import type { Room } from "../mocks/rooms";

interface RoomCardProps {
  room: Room;
  onStatusChange?: (roomId: number, newStatus: Room["status"]) => void;
  onViewDetails?: (roomId: number) => void;
}

const statusColors = {
  Available: "bg-green-100 text-green-800 border-green-300",
  Occupied: "bg-blue-100 text-blue-800 border-blue-300",
  Dirty: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Maintenance: "bg-red-100 text-red-800 border-red-300",
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
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 overflow-hidden">
      {/* Status Badge */}
      <div className={`px-4 py-2 border-b ${statusColor}`}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm flex items-center gap-2">
            <span>{statusIcon}</span>
            {room.status}
          </span>
          <span className="text-xs font-medium">#{room.number}</span>
        </div>
      </div>

      {/* Room Content */}
      <div className="p-4">
        <div className="mb-3">
          <h3 className="text-lg font-bold text-gray-800 mb-1">
            {room.category}
          </h3>
          <p className="text-sm text-gray-600 line-clamp-2">
            {room.description}
          </p>
        </div>

        {/* Room Details */}
        <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
          <div className="flex items-center gap-1">
            <span>👥</span>
            <span>{room.capacity} чел.</span>
          </div>
          <div className="font-semibold text-gray-800">
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
                  className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                >
                  {amenity}
                </span>
              ))}
              {room.amenities.length > 3 && (
                <span className="text-xs text-gray-500 px-2 py-1">
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
              className="flex-1 text-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="Available">Доступна</option>
              <option value="Occupied">Занята</option>
              <option value="Dirty">Требует уборки</option>
              <option value="Maintenance">На ремонте</option>
            </select>
          )}
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(room.id)}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              Детали
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

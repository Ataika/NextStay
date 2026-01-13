import type { Room } from "../mocks/rooms";
import Button from "../ui/Button";

interface RoomCardProps {
  room: Room;
  onStatusChange?: (roomId: number, newStatus: Room["status"], currentStatus: Room["status"]) => void;
  onViewDetails?: (roomId: number) => void;
}

const statusColors = {
  Available: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700",
  Occupied: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700",
  Maintenance: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700",
};

const statusIcons = {
  Available: "✓",
  Occupied: "👤",
  Maintenance: "🔧",
};

// Amenity icons mapping
const getAmenityIcon = (amenity: string): string => {
  const iconMap: Record<string, string> = {
    "Wi-Fi": "📶",
    "TV": "📺",
    "Air conditioner": "❄️",
    "Mini bar": "🍷",
    "Jacuzzi": "🛁",
    "Balcony": "🌅",
    "Living room": "🛋️",
    "Terrace": "🏞️",
  };
  return iconMap[amenity] || "✨";
};

export default function RoomCard({
  room,
  onStatusChange,
  onViewDetails,
}: RoomCardProps) {
  // Handle "Dirty" status for backward compatibility (should not be used as room status anymore)
  const roomStatus = room.status === "Dirty" ? "Available" : room.status;
  const statusColor = statusColors[roomStatus] || statusColors.Available;
  const statusIcon = statusIcons[roomStatus] || statusIcons.Available;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
      {/* Header: Room # + Status badge */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            Room #{room.number}
          </span>
          <span
            className={`px-2 py-0.5 text-xs font-semibold rounded-full flex items-center gap-1 ${statusColor}`}
            title={
              roomStatus === "Available"
                ? "Ready to sell - room is clean and available for booking"
                : roomStatus === "Maintenance"
                ? "Under maintenance - cannot be sold"
                : "Currently occupied by guests"
            }
          >
            <span>{statusIcon}</span>
            <span>{roomStatus}</span>
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Type */}
        <div className="mb-2">
          <span className="text-sm font-medium text-gray-800 dark:text-white">
            {room.category}
          </span>
        </div>

        {/* Capacity + Price */}
        <div className="flex items-center justify-between text-sm mb-3">
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
            <span>👥</span>
            <span>{room.capacity}</span>
          </div>
          <div className="font-semibold text-gray-900 dark:text-white">
            {room.price.toLocaleString("en-US")} $<span className="text-xs font-normal text-gray-500 dark:text-gray-400">/night</span>
          </div>
        </div>

        {/* Amenities (иконки) */}
        {room.amenities && room.amenities.length > 0 && (
          <div className="mb-4 flex-1">
            <div className="flex flex-wrap gap-2">
              {room.amenities.map((amenity, idx) => (
                <span
                  key={idx}
                  className="text-base"
                  title={amenity}
                >
                  {getAmenityIcon(amenity)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions: Details (primary) + Status dropdown (secondary) */}
        <div className="flex gap-2 mt-auto">
          {onViewDetails && (
            <Button
              variant="primary"
              size="sm"
              fullWidth
              onClick={() => onViewDetails(room.id)}
            >
              Details
            </Button>
          )}
          {onStatusChange && (
            <select
              value={roomStatus}
              onChange={(e) => {
                const newStatus = e.target.value as Room["status"];
                onStatusChange(room.id, newStatus, roomStatus);
              }}
              className="text-xs px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors hover:bg-gray-50 dark:hover:bg-gray-600"
              title="Change room status"
            >
              <option value="Available">Available</option>
              <option value="Occupied">Occupied</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          )}
        </div>
      </div>
    </div>
  );
}

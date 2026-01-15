import type { Room } from "../mocks/rooms";

interface RoomCardProps {
  room: Room;
  onClick?: (roomId: number) => void;
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

export default function RoomCard({
  room,
  onClick,
}: RoomCardProps) {
  // Handle "Dirty" status for backward compatibility (should not be used as room status anymore)
  const roomStatus = room.status === "Dirty" ? "Available" : room.status;
  const statusColor = statusColors[roomStatus] || statusColors.Available;
  const statusIcon = statusIcons[roomStatus] || statusIcons.Available;

  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg hover:shadow-blue-500/20 hover:ring-2 hover:ring-blue-500/50 transition-all duration-200 border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col cursor-pointer"
      onClick={() => onClick?.(room.id)}
    >
      {/* Header: Room # + Status badge */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-gray-900 dark:text-white">
            Room #{room.number}
          </span>
          <span
            className={`px-1.5 py-0.5 text-xs font-semibold rounded-full flex items-center gap-0.5 ${statusColor}`}
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
      <div className="p-3 flex-1 flex flex-col">
        {/* Type */}
        <div className="mb-1.5">
          <span className="text-xs font-medium text-gray-800 dark:text-white">
            {room.category}
          </span>
        </div>

        {/* Capacity + Price */}
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
            <span>👥</span>
            <span>{room.capacity}</span>
          </div>
          <div className="font-semibold text-gray-900 dark:text-white">
            {room.price.toLocaleString("en-US")} $<span className="text-xs font-normal text-gray-500 dark:text-gray-400">/night</span>
          </div>
        </div>

        {/* Amenities (текстом) */}
        {room.amenities && room.amenities.length > 0 && (
          <div className="mb-3 flex-1">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {room.amenities.join(", ")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

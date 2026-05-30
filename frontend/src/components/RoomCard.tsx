import type { Room } from "../mocks/rooms";

interface RoomCardProps {
  room: Room;
  onClick?: (roomId: number) => void;
}

const statusColors = {
  Available:
    "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-600/50",
  Occupied:
    "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-600/50",
  Cleaning:
    "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-500/50",
  Maintenance:
    "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-600/50",
};

const statusDots = {
  Available: "bg-green-500 dark:bg-green-400",
  Occupied: "bg-blue-500 dark:bg-blue-400",
  Cleaning: "bg-amber-500 dark:bg-amber-400",
  Maintenance: "bg-red-500 dark:bg-red-400",
};

export default function RoomCard({
  room,
  onClick,
}: RoomCardProps) {
  // Handle "Dirty" status for backward compatibility (should not be used as room status anymore)
  const roomStatus = room.status === "Dirty" ? "Cleaning" : room.status;
  const statusColor = statusColors[roomStatus] || statusColors.Available;
  const statusDot = statusDots[roomStatus] || statusDots.Available;

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors overflow-hidden flex flex-col cursor-pointer shadow-sm"
      onClick={() => onClick?.(room.id)}
    >
      {/* Header: Room # + Status pill - compact */}
      <div className="p-3 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            Room #{room.number}
          </span>
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full flex items-center gap-1.5 shrink-0 ${statusColor}`}
            title={
              roomStatus === "Available"
                ? "Ready to sell"
                : roomStatus === "Cleaning"
                ? "Room is being cleaned"
                : roomStatus === "Maintenance"
                ? "Under maintenance"
                : "Currently occupied"
            }
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} />
            {roomStatus}
          </span>
        </div>

        {/* Type */}
        <span className="text-xs text-gray-500 dark:text-gray-400">{room.category}</span>

        {/* Capacity + Price */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>{room.capacity}</span>
          </div>
          <span className="font-semibold text-gray-900 dark:text-white">
            {room.price.toLocaleString("en-US")} $
            <span className="text-gray-500 dark:text-gray-400 font-normal">/night</span>
          </span>
        </div>
      </div>
    </div>
  );
}

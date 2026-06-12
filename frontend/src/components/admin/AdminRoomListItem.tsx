import type { Room } from "../../mocks/rooms";
import { useI18n } from "../../i18n";
import { getRoomPhotoUrl } from "../../utils/roomDisplay";
import { getActiveGuestName } from "../../utils/adminDashboard";
import type { Booking } from "../../mocks/bookings";

interface AdminRoomListItemProps {
  room: Room;
  bookings: Booking[];
  onClick: (roomId: number) => void;
}

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  Available: {
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  Occupied: {
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  Cleaning: {
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  Maintenance: {
    badge: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    dot: "bg-red-500",
  },
};

export default function AdminRoomListItem({ room, bookings, onClick }: AdminRoomListItemProps) {
  const { t } = useI18n();
  const status = room.status === "Dirty" ? "Cleaning" : room.status;
  const styles = STATUS_STYLES[status] ?? STATUS_STYLES.Available;
  const guestName = status === "Occupied" ? getActiveGuestName(room.id, bookings) : null;

  const statusHint =
    status === "Available"
      ? t("admin.readyToSell")
      : status === "Occupied" && guestName
        ? t("admin.guestLabel", { name: guestName })
        : status === "Cleaning"
          ? t("admin.beingCleaned")
          : status === "Maintenance"
            ? t("admin.cannotBeSold")
            : null;

  const displayPrice =
    room.dynamicPrice != null
      ? room.dynamicPrice
      : room.price;

  return (
    <button
      type="button"
      onClick={() => onClick(room.id)}
      className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors text-left group"
    >
      <div className="w-16 h-14 rounded-lg overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-700">
        <img
          src={getRoomPhotoUrl(room)}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {t("taskCard.room", { room: room.number })}
          </p>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${styles.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
            {status === "Available"
              ? t("admin.available")
              : status === "Occupied"
                ? t("admin.occupied")
                : status === "Cleaning"
                  ? t("admin.cleaning")
                  : t("admin.maintenance")}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
          {room.category}
          {statusHint ? ` · ${statusHint}` : ""}
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          👥 {room.capacity}
        </p>
      </div>

      <div className="text-right shrink-0 pr-1">
        <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
          ${displayPrice.toLocaleString("en-US")}
        </p>
        <p className="text-[10px] text-gray-400">{t("admin.perNight")}</p>
      </div>

      <span className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 px-1">
        ⋮
      </span>
    </button>
  );
}

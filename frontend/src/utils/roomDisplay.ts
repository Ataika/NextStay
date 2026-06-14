import type { Room } from "../mocks/rooms";

const CATEGORY_PHOTOS: Record<string, string> = {
  Standard:
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=80",
  Deluxe:
    "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=900&q=80",
  Suite:
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=900&q=80",
};

const CATEGORY_DEFAULTS: Record<string, { areaSqm: number; bedType: string; viewType: string }> = {
  Standard: { areaSqm: 22, bedType: "Queen", viewType: "City" },
  Deluxe: { areaSqm: 28, bedType: "King", viewType: "City" },
  Suite: { areaSqm: 45, bedType: "King", viewType: "Sea" },
};

const AMENITY_ICONS: Record<string, string> = {
  "Wi-Fi": "📶",
  "WiFi": "📶",
  TV: "📺",
  "Air conditioner": "❄️",
  "Air conditioning": "❄️",
  "Mini bar": "🍷",
  "Mini-bar": "🍷",
  Safe: "🔒",
  Hairdryer: "💨",
  Bathrobes: "🥋",
  Kettle: "☕",
  Slippers: "🥿",
  Toiletries: "🧴",
  Cosmetics: "🧴",
  Balcony: "🌅",
  Jacuzzi: "🛁",
  "Living room": "🛋️",
  Terrace: "🌴",
};

export function resolveMediaUrl(url: string): string {
  if (!url) return url;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";
  const origin = apiBase.replace(/\/api\/v1\/?$/, "");
  return `${origin}${url.startsWith("/") ? url : `/${url}`}`;
}

export function getRoomPhotoUrl(room: Room): string {
  if (room.photoUrl) return resolveMediaUrl(room.photoUrl);
  return CATEGORY_PHOTOS[room.category] ?? CATEGORY_PHOTOS.Standard;
}

export function inferRoomFloor(room: Room): number {
  if (room.floor != null) return room.floor;
  const digits = room.number.replace(/\D/g, "");
  if (digits.length >= 3) return Math.floor(parseInt(digits, 10) / 100);
  return 1;
}

export function getRoomDisplayDetails(room: Room) {
  const defaults = CATEGORY_DEFAULTS[room.category] ?? CATEGORY_DEFAULTS.Standard;
  return {
    areaSqm: room.areaSqm ?? defaults.areaSqm,
    bedType: room.bedType ?? defaults.bedType,
    viewType: room.viewType ?? defaults.viewType,
    floor: inferRoomFloor(room),
  };
}

export function getAmenityIcon(amenity: string): string {
  return AMENITY_ICONS[amenity] ?? "✨";
}

export const ROOM_STATUS_COLORS: Record<Room["status"], string> = {
  Available: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700",
  Occupied: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700",
  Maintenance: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700",
  Cleaning: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
  Dirty: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
};

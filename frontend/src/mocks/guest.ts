export interface GuestToken {
  token: string;
  bookingId: number;
  roomId: number;
  roomNumber: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  isValid: boolean;
}

// Моки токенов для гостей
export const mockGuestTokens: GuestToken[] = [
  {
    token: "guest-token-abc123",
    bookingId: 1,
    roomId: 2,
    roomNumber: "102",
    guestName: "Иван Иванов",
    checkIn: "2024-01-14T14:00:00Z",
    checkOut: "2024-01-16T12:00:00Z",
    isValid: true,
  },
  {
    token: "guest-token-xyz789",
    bookingId: 2,
    roomId: 8,
    roomNumber: "203",
    guestName: "Петр Петров",
    checkIn: "2024-01-15T14:00:00Z",
    checkOut: "2024-01-17T12:00:00Z",
    isValid: true,
  },
  {
    token: "guest-token-expired",
    bookingId: 3,
    roomId: 1,
    roomNumber: "101",
    guestName: "Мария Сидорова",
    checkIn: "2024-01-10T14:00:00Z",
    checkOut: "2024-01-12T12:00:00Z",
    isValid: false, // Истекший токен
  },
];

// Функция для получения данных гостя по токену
export function getGuestByToken(token: string): GuestToken | null {
  return mockGuestTokens.find((gt) => gt.token === token) || null;
}

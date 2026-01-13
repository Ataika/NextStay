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

// Mock tokens for guests
export const mockGuestTokens: GuestToken[] = [
  {
    token: "guest-token-abc123",
    bookingId: 1,
    roomId: 2,
    roomNumber: "102",
    guestName: "John Doe",
    checkIn: "2024-01-14T14:00:00Z",
    checkOut: "2024-01-16T12:00:00Z",
    isValid: true,
  },
  {
    token: "guest-token-xyz789",
    bookingId: 2,
    roomId: 8,
    roomNumber: "203",
    guestName: "Jane Doe",
    checkIn: "2024-01-15T14:00:00Z",
    checkOut: "2024-01-17T12:00:00Z",
    isValid: true,
  },
  {
    token: "guest-token-expired",
    bookingId: 3,
    roomId: 1,
    roomNumber: "101",
    guestName: "Mary Smith",
    checkIn: "2024-01-10T14:00:00Z",
    checkOut: "2024-01-12T12:00:00Z",
    isValid: false, // Expired token
  },
];

// Function to get guest data by token
export function getGuestByToken(token: string): GuestToken | null {
  return mockGuestTokens.find((gt) => gt.token === token) || null;
}

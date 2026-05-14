export interface GuestToken {
  token: string;
  bookingId: number;
  roomId: number;
  roomNumber: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  isValid: boolean;
  // Access status
  accessStatus: "Active" | "Expired" | "Checked out";
  // WiFi information
  wifi: {
    ssid: string;
    password: string;
  };
  // Hotel contact
  contact: {
    phone?: string;
    whatsapp?: string;
    email?: string;
  };
  // Instructions
  instructions: {
    accessInfo: string;
    activeFrom: string; // ISO date string
    activeUntil: string; // ISO date string
    doorTroubleshooting: string;
  };
  // House rules
  houseRules?: {
    quietHours: string;
    checkOutTime: string;
    smokingPolicy: string;
  };
}

// Mock tokens for guests
export const mockGuestTokens: GuestToken[] = [
  {
    token: "guest-token-abc123",
    bookingId: 1,
    roomId: 2,
    roomNumber: "102",
    guestName: "John Doe",
    checkIn: "2026-01-14T14:00:00Z",
    checkOut: "2026-01-16T12:00:00Z",
    isValid: true,
    accessStatus: "Active",
    wifi: {
      ssid: "NextStay_Guest",
      password: "Welcome2026!",
    },
    contact: {
      phone: "+1 (555) 123-4567",
      whatsapp: "+1 (555) 123-4567",
      email: "support@nextstay.com",
    },
    instructions: {
      accessInfo: "Use the QR code at the main entrance and your room door. The code is active during your stay.",
      activeFrom: "2026-01-14T14:00:00Z",
      activeUntil: "2026-01-16T12:00:00Z",
      doorTroubleshooting: "If the door doesn't open, ensure your phone screen is bright and hold the QR code close to the scanner. Contact support if issues persist.",
    },
    houseRules: {
      quietHours: "22:00 - 08:00",
      checkOutTime: "12:00",
      smokingPolicy: "No smoking in rooms. Designated smoking areas available.",
    },
  },
  {
    token: "guest-token-xyz789",
    bookingId: 2,
    roomId: 8,
    roomNumber: "203",
    guestName: "Jane Doe",
    checkIn: "2026-01-15T14:00:00Z",
    checkOut: "2026-01-17T12:00:00Z",
    isValid: true,
    accessStatus: "Active",
    wifi: {
      ssid: "NextStay_Guest",
      password: "Welcome2026!",
    },
    contact: {
      phone: "+1 (555) 123-4567",
      whatsapp: "+1 (555) 123-4567",
      email: "support@nextstay.com",
    },
    instructions: {
      accessInfo: "Use the QR code at the main entrance and your room door. The code is active during your stay.",
      activeFrom: "2026-01-15T14:00:00Z",
      activeUntil: "2026-01-17T12:00:00Z",
      doorTroubleshooting: "If the door doesn't open, ensure your phone screen is bright and hold the QR code close to the scanner. Contact support if issues persist.",
    },
    houseRules: {
      quietHours: "22:00 - 08:00",
      checkOutTime: "12:00",
      smokingPolicy: "No smoking in rooms. Designated smoking areas available.",
    },
  },
  {
    token: "guest-token-expired",
    bookingId: 3,
    roomId: 1,
    roomNumber: "101",
    guestName: "Mary Smith",
    checkIn: "2026-01-10T14:00:00Z",
    checkOut: "2026-01-12T12:00:00Z",
    isValid: false, // Expired token
    accessStatus: "Expired",
    wifi: {
      ssid: "NextStay_Guest",
      password: "Welcome2026!",
    },
    contact: {
      phone: "+1 (555) 123-4567",
      whatsapp: "+1 (555) 123-4567",
      email: "support@nextstay.com",
    },
    instructions: {
      accessInfo: "Use the QR code at the main entrance and your room door. The code is active during your stay.",
      activeFrom: "2026-01-10T14:00:00Z",
      activeUntil: "2026-01-12T12:00:00Z",
      doorTroubleshooting: "If the door doesn't open, ensure your phone screen is bright and hold the QR code close to the scanner. Contact support if issues persist.",
    },
    houseRules: {
      quietHours: "22:00 - 08:00",
      checkOutTime: "12:00",
      smokingPolicy: "No smoking in rooms. Designated smoking areas available.",
    },
  },
];

// Function to get guest data by token
export function getGuestByToken(token: string): GuestToken | null {
  return mockGuestTokens.find((gt) => gt.token === token) || null;
}

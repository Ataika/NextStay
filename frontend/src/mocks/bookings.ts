export interface Booking {
  id: number;
  guestName: string;
  roomId: number;
  roomNumber: string;
  checkIn: string; // ISO date string
  checkOut: string; // ISO date string
  status: "Pending" | "Confirmed" | "Upcoming" | "Checked-in" | "Checked-out" | "Cancelled" | "Expired";
  createdAt: string; // ISO date string
  notes?: string;
  email?: string;
  guestToken?: string; // Token for guest access
}

export const mockBookings: Booking[] = [
  {
    id: 1,
    guestName: "John Doe",
    roomId: 2,
    roomNumber: "102",
    checkIn: "2026-01-14T14:00:00Z",
    checkOut: "2026-01-16T12:00:00Z",
    status: "Confirmed",
    createdAt: "2026-01-10T10:00:00Z",
    notes: "VIP guest",
  },
  {
    id: 2,
    guestName: "Jane Smith",
    roomId: 3,
    roomNumber: "103",
    checkIn: "2026-01-20T14:00:00Z",
    checkOut: "2026-01-22T12:00:00Z",
    status: "Pending",
    createdAt: "2026-01-12T09:00:00Z",
  },
  {
    id: 3,
    guestName: "Bob Johnson",
    roomId: 8,
    roomNumber: "303",
    checkIn: "2026-01-15T14:00:00Z",
    checkOut: "2026-01-17T12:00:00Z",
    status: "Checked-in",
    createdAt: "2026-01-11T11:00:00Z",
  },
  {
    id: 4,
    guestName: "Alice Williams",
    roomId: 1,
    roomNumber: "101",
    checkIn: "2026-01-08T14:00:00Z",
    checkOut: "2026-01-10T12:00:00Z",
    status: "Checked-out",
    createdAt: "2026-01-05T08:00:00Z",
    notes: "Early checkout",
  },
  {
    id: 5,
    guestName: "Charlie Brown",
    roomId: 4,
    roomNumber: "201",
    checkIn: "2026-01-18T14:00:00Z",
    checkOut: "2026-01-20T12:00:00Z",
    status: "Pending",
    createdAt: "2026-01-13T14:00:00Z",
  },
];

export interface Room {
  id: number;
  number: string;
  category: string;
  status: "Available" | "Occupied" | "Dirty" | "Maintenance" | "Cleaning";
  price: number;
  dynamicPrice?: number | null;
  priceSource?: string | null;
  pricingStayDate?: string | null;
  pricingSnapshotDate?: string | null;
  pricingStatus?: string | null;
  capacity: number;
  description?: string;
  amenities?: string[];
  photoUrl?: string | null;
  areaSqm?: number | null;
  bedType?: string | null;
  viewType?: string | null;
  floor?: number | null;
}

export const mockRooms: Room[] = [
  {
    id: 1,
    number: "101",
    category: "Standard",
    status: "Available",
    price: 25,
    capacity: 2,
    description: "Comfortable standard room with a view of the city",
    amenities: ["Wi-Fi", "TV", "Air conditioner"],
  },
  {
    id: 2,
    number: "102",
    category: "Standard",
    status: "Occupied",
    price: 25,
    capacity: 2,
    description: "Standard room with a balcony",
    amenities: ["Wi-Fi", "TV", "Air conditioner", "Balcony"],
  },
  {
    id: 3,
    number: "201",
    category: "Deluxe",
    status: "Dirty",
    price: 45,
    capacity: 3,
    description: "Large deluxe room with a view of the sea",
    amenities: ["Wi-Fi", "TV", "Air conditioner", "Mini bar", "Jacuzzi"],
  },
  {
    id: 4,
    number: "202",
    category: "Deluxe",
    status: "Available",
    price: 45,
    capacity: 3,
    description: "Deluxe room with a panoramic window",
    amenities: ["Wi-Fi", "TV", "Air conditioner", "Mini bar"],
  },
  {
    id: 5,
    number: "301",
    category: "Suite",
    status: "Maintenance",
    price: 75,
    capacity: 4,
    description: "Luxurious suite with a living room",
    amenities: ["Wi-Fi", "TV", "Air conditioner", "Mini bar", "Jacuzzi", "Living room"],
  },
  {
    id: 6,
    number: "302",
    category: "Suite",
    status: "Available",
    price: 75,
    capacity: 4,
    description: "Presidential suite",
    amenities: ["Wi-Fi", "TV", "Air conditioner", "Mini bar", "Jacuzzi", "Living room", "Terrace"],
  },
  {
    id: 7,
    number: "103",
    category: "Standard",
    status: "Dirty",
    price: 25,
    capacity: 2,
    description: "Standard room",
    amenities: ["Wi-Fi", "TV", "Air conditioner"],
  },
  {
    id: 8,
    number: "203",
    category: "Deluxe",
    status: "Occupied",
    price: 50,
    capacity: 3,
    description: "Deluxe room",
    amenities: ["Wi-Fi", "TV", "Air conditioner", "Mini bar"],
  },
];

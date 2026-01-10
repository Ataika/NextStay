export interface Room {
  id: number;
  number: string;
  category: string;
  status: "Available" | "Occupied" | "Dirty" | "Maintenance";
  price: number;
  capacity: number;
  description?: string;
  amenities?: string[];
}

export const mockRooms: Room[] = [
  {
    id: 1,
    number: "101",
    category: "Standard",
    status: "Available",
    price: 2500,
    capacity: 2,
    description: "Уютный стандартный номер с видом на город",
    amenities: ["Wi-Fi", "TV", "Кондиционер"],
  },
  {
    id: 2,
    number: "102",
    category: "Standard",
    status: "Occupied",
    price: 2500,
    capacity: 2,
    description: "Стандартный номер с балконом",
    amenities: ["Wi-Fi", "TV", "Кондиционер", "Балкон"],
  },
  {
    id: 3,
    number: "201",
    category: "Deluxe",
    status: "Dirty",
    price: 4500,
    capacity: 3,
    description: "Просторный номер люкс с видом на море",
    amenities: ["Wi-Fi", "TV", "Кондиционер", "Мини-бар", "Джакузи"],
  },
  {
    id: 4,
    number: "202",
    category: "Deluxe",
    status: "Available",
    price: 4500,
    capacity: 3,
    description: "Номер люкс с панорамным окном",
    amenities: ["Wi-Fi", "TV", "Кондиционер", "Мини-бар"],
  },
  {
    id: 5,
    number: "301",
    category: "Suite",
    status: "Maintenance",
    price: 7500,
    capacity: 4,
    description: "Роскошный сьют с гостиной",
    amenities: ["Wi-Fi", "TV", "Кондиционер", "Мини-бар", "Джакузи", "Гостиная"],
  },
  {
    id: 6,
    number: "302",
    category: "Suite",
    status: "Available",
    price: 7500,
    capacity: 4,
    description: "Президентский сьют",
    amenities: ["Wi-Fi", "TV", "Кондиционер", "Мини-бар", "Джакузи", "Гостиная", "Терраса"],
  },
  {
    id: 7,
    number: "103",
    category: "Standard",
    status: "Dirty",
    price: 2500,
    capacity: 2,
    description: "Стандартный номер",
    amenities: ["Wi-Fi", "TV", "Кондиционер"],
  },
  {
    id: 8,
    number: "203",
    category: "Deluxe",
    status: "Occupied",
    price: 4500,
    capacity: 3,
    description: "Номер люкс",
    amenities: ["Wi-Fi", "TV", "Кондиционер", "Мини-бар"],
  },
];

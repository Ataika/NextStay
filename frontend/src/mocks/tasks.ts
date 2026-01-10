export interface CleaningTask {
  id: number;
  roomId: number;
  roomNumber: string;
  status: "Pending" | "In Progress" | "Completed";
  priority: "Low" | "Medium" | "High";
  assignedTo?: number; // staff ID
  assignedToName?: string;
  createdAt: string;
  completedAt?: string;
  notes?: string;
}

export const mockTasks: CleaningTask[] = [
  {
    id: 1,
    roomId: 3,
    roomNumber: "201",
    status: "Pending",
    priority: "High",
    createdAt: "2024-01-15T10:00:00Z",
    notes: "Срочная уборка после выезда",
  },
  {
    id: 2,
    roomId: 7,
    roomNumber: "103",
    status: "In Progress",
    priority: "Medium",
    assignedTo: 1,
    assignedToName: "Мария Иванова",
    createdAt: "2024-01-15T09:30:00Z",
    notes: "Обычная уборка",
  },
  {
    id: 3,
    roomId: 1,
    roomNumber: "101",
    status: "Completed",
    priority: "Low",
    assignedTo: 2,
    assignedToName: "Анна Петрова",
    createdAt: "2024-01-15T08:00:00Z",
    completedAt: "2024-01-15T09:15:00Z",
    notes: "Уборка завершена",
  },
  {
    id: 4,
    roomId: 4,
    roomNumber: "202",
    status: "Pending",
    priority: "Medium",
    createdAt: "2024-01-15T11:00:00Z",
  },
  {
    id: 5,
    roomId: 6,
    roomNumber: "302",
    status: "Pending",
    priority: "High",
    createdAt: "2024-01-15T11:30:00Z",
    notes: "VIP номер - требуется особое внимание",
  },
];

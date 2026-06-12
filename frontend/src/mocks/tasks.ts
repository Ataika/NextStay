export type TaskType = "cleaning" | "maintenance" | "inventory" | "guest_request";
export type TaskPriority = "Low" | "Medium" | "High" | "Urgent";

export interface TaskChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export const DEFAULT_TASK_CHECKLIST_LABELS = [
  "Cleaning room",
  "Change bedding",
  "Refill mini bar",
] as const;

export interface CleaningTask {
  id: number;
  roomId: number;
  roomNumber: string;
  status: "Pending" | "In Progress" | "Completed";
  priority: TaskPriority;
  taskType?: TaskType;
  assignedTo?: number; // staff ID
  assignedToName?: string;
  createdAt: string;
  completedAt?: string;
  dueAt?: string | null;
  notes?: string;
  checklist?: TaskChecklistItem[];
}

export interface CreateTaskPayload {
  roomId: number;
  roomNumber: string;
  priority?: TaskPriority;
  taskType?: TaskType;
  notes?: string;
  dueAt?: string;
  staffId?: number;
  staffName?: string;
  checklistItems?: string[];
}

export const mockTasks: CleaningTask[] = [
  {
    id: 1,
    roomId: 3,
    roomNumber: "201",
    status: "Pending",
    priority: "High",
    createdAt: "2026-01-15T10:00:00Z",
    notes: "Urgent cleaning after check-out",
  },
  {
    id: 2,
    roomId: 7,
    roomNumber: "103",
    status: "In Progress",
    priority: "Medium",
    assignedTo: 1,
    assignedToName: "Maria Ivanova",
    createdAt: "2026-01-15T09:30:00Z",
    notes: "Regular cleaning",
  },
  {
    id: 3,
    roomId: 1,
    roomNumber: "101",
    status: "Completed",
    priority: "Low",
    assignedTo: 2,
    assignedToName: "Anna Petrova",
    createdAt: "2026-01-15T08:00:00Z",
    completedAt: "2026-01-15T09:15:00Z",
    notes: "Cleaning completed",
  },
  {
    id: 4,
    roomId: 4,
    roomNumber: "202",
    status: "Pending",
    priority: "Medium",
    createdAt: "2026-01-15T11:00:00Z",
  },
  {
    id: 5,
    roomId: 6,
    roomNumber: "302",
    status: "Pending",
    priority: "High",
    createdAt: "2026-01-15T11:30:00Z",
    notes: "VIP room - requires special attention",
  },
];

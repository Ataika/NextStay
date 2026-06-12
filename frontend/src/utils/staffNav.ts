export type StaffTab = "overview" | "tasks" | "schedule" | "calendar" | "hours";

export const STAFF_PATHS: Record<StaffTab, string> = {
  overview: "/staff",
  tasks: "/staff/tasks",
  schedule: "/staff/schedule",
  calendar: "/staff/calendar",
  hours: "/staff/hours",
};

export function staffTabFromPath(pathname: string): StaffTab {
  if (pathname.startsWith("/staff/tasks")) return "tasks";
  if (pathname.startsWith("/staff/schedule")) return "schedule";
  if (pathname.startsWith("/staff/calendar")) return "calendar";
  if (pathname.startsWith("/staff/hours")) return "hours";
  return "overview";
}

export function isStaffNavPath(pathname: string): boolean {
  return pathname === "/staff" || pathname.startsWith("/staff/");
}

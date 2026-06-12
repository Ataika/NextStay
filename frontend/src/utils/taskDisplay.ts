import type { CleaningTask, TaskType } from "../mocks/tasks";
import { DEFAULT_TASK_CHECKLIST_LABELS } from "../mocks/tasks";

export function resolveTaskChecklist(task: CleaningTask) {
  if (task.checklist?.length) return task.checklist;
  return DEFAULT_TASK_CHECKLIST_LABELS.map((label, index) => ({
    id: String(index),
    label,
    checked: task.status === "Completed",
  }));
}

export function taskPrimaryLabel(task: CleaningTask): string {
  const first = resolveTaskChecklist(task)[0];
  return first?.label ?? "Task";
}

export function taskTypeIcon(taskType?: TaskType): string {
  switch (taskType) {
    case "maintenance":
      return "🔧";
    case "inventory":
      return "📦";
    case "guest_request":
      return "🛎️";
    default:
      return "🧹";
  }
}

export function taskTypeAccent(taskType?: TaskType): string {
  switch (taskType) {
    case "maintenance":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-300";
    case "inventory":
      return "bg-violet-500/15 text-violet-600 dark:text-violet-300";
    case "guest_request":
      return "bg-rose-500/15 text-rose-600 dark:text-rose-300";
    default:
      return "bg-blue-500/15 text-blue-600 dark:text-blue-300";
  }
}

export function priorityAccent(priority: CleaningTask["priority"]): string {
  switch (priority) {
    case "High":
    case "Urgent":
      return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
    case "Medium":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    default:
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  }
}

export function formatTaskTime(value: string | null | undefined, locale: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

export function allChecklistItemsChecked(task: CleaningTask): boolean {
  return resolveTaskChecklist(task).every((item) => item.checked);
}

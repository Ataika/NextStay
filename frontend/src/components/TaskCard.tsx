import type { CleaningTask } from "../mocks/tasks";
import { useI18n } from "../i18n";
import Button from "../ui/Button";
import { allChecklistItemsChecked, resolveTaskChecklist } from "../utils/taskDisplay";

interface TaskCardProps {
  task: CleaningTask;
  onStart?: (taskId: number) => void;
  onComplete?: (taskId: number) => void;
  onDelete?: (taskId: number) => void;
  onChecklistToggle?: (taskId: number, itemId: string, checked: boolean) => void;
  currentStaffId?: number;
  allowStaffActions?: boolean;
}

const priorityColors = {
  Low: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600",
  Medium: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
  High: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700",
  Urgent: "bg-red-200 dark:bg-red-900/40 text-red-900 dark:text-red-200 border-red-400 dark:border-red-700",
};

const statusColors = {
  Pending: "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700",
  "In Progress": "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
  Completed: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
};

const statusIcons = {
  Pending: "⏳",
  "In Progress": "🔄",
  Completed: "✅",
};

export default function TaskCard({
  task,
  onStart,
  onComplete,
  onDelete,
  onChecklistToggle,
  currentStaffId = 1,
  allowStaffActions = true,
}: TaskCardProps) {
  const { locale, priorityLabel, t } = useI18n();
  const priorityColor = priorityColors[task.priority];
  const statusColor = statusColors[task.status];
  const statusIcon = statusIcons[task.status];
  const checklist = resolveTaskChecklist(task);

  const isAssignedToMe = task.assignedTo === currentStaffId;
  const isUnassigned = !task.assignedTo;
  const canWorkTask = allowStaffActions && task.status !== "Completed" && (isAssignedToMe || isUnassigned);
  const canStart = canWorkTask && task.status === "Pending" && isUnassigned && onStart;
  const allChecked = allChecklistItemsChecked(task);
  const canComplete =
    canWorkTask &&
    task.status !== "Completed" &&
    allChecked &&
    onComplete &&
    (task.status === "In Progress" || (task.status === "Pending" && isAssignedToMe));

  return (
    <div className={`rounded-lg border-2 p-4 mb-3 ${statusColor} transition-all`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{statusIcon}</span>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              {t("taskCard.room", { room: task.roomNumber })}
            </h3>
          </div>
          {task.assignedToName && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t("taskCard.executor", { name: task.assignedToName })}
            </p>
          )}
        </div>
        <span className={`px-2 py-1 text-xs font-semibold rounded border ${priorityColor}`}>
          {priorityLabel(task.priority)}
        </span>
      </div>

      {task.notes && (
        <div className="mb-3">
          <p className="text-sm text-gray-700 dark:text-gray-300">{task.notes}</p>
        </div>
      )}

      <div className="mb-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t("taskCard.checklist")}
        </p>
        {checklist.map((item) => {
          const interactive = canWorkTask && !!onChecklistToggle;
          return (
            <label
              key={item.id}
              className={`flex items-center gap-2 text-sm ${
                interactive ? "cursor-pointer" : "cursor-default"
              }`}
            >
              <input
                type="checkbox"
                checked={item.checked}
                disabled={!interactive}
                onChange={(event) => onChecklistToggle?.(task.id, item.id, event.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
              />
              <span
                className={
                  item.checked
                    ? "line-through text-gray-500 dark:text-gray-500"
                    : "text-gray-900 dark:text-gray-200"
                }
              >
                {item.label}
              </span>
            </label>
          );
        })}
        {canWorkTask && !allChecked && (
          <p className="text-xs text-amber-600 dark:text-amber-400">{t("taskCard.completeAllHint")}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {canStart && (
          <Button variant="primary" fullWidth onClick={() => onStart(task.id)}>
            {t("taskCard.start")}
          </Button>
        )}
        {canComplete && (
          <Button
            variant="primary"
            fullWidth
            className="!bg-green-600 dark:!bg-green-500 hover:!bg-green-700 dark:hover:!bg-green-600 focus:!ring-green-500 dark:focus:!ring-green-400"
            onClick={() => onComplete(task.id)}
          >
            {t("taskCard.complete")}
          </Button>
        )}
        {task.status === "Completed" && (
          <div className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium rounded-lg text-center">
            {t("taskCard.completed")}
          </div>
        )}
        {task.status === "Pending" && task.assignedTo && !isAssignedToMe && (
          <div className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium rounded-lg text-center">
            {t("taskCard.assignedElsewhere")}
          </div>
        )}
        {onDelete && task.status !== "Completed" && (
          <Button variant="danger" size="sm" onClick={() => onDelete(task.id)}>
            {t("taskCard.delete")}
          </Button>
        )}
      </div>

      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        {t("taskCard.created", { value: new Date(task.createdAt).toLocaleString(locale) })}
        {task.completedAt &&
          ` • ${t("taskCard.completedAt", { value: new Date(task.completedAt).toLocaleString(locale) })}`}
      </div>
    </div>
  );
}

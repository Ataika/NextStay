import type { CleaningTask } from "../mocks/tasks";
import Button from "../ui/Button";

interface TaskCardProps {
  task: CleaningTask;
  onStart?: (taskId: number) => void;
  onComplete?: (taskId: number) => void;
  onDelete?: (taskId: number) => void;
  currentStaffId?: number;
}

const priorityColors = {
  Low: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600",
  Medium: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700",
  High: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700",
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
  currentStaffId = 1,
}: TaskCardProps) {
  const priorityColor = priorityColors[task.priority];
  const statusColor = statusColors[task.status];
  const statusIcon = statusIcons[task.status];

  const isAssignedToMe = task.assignedTo === currentStaffId;
  const canStart = task.status === "Pending" && !task.assignedTo;
  const canComplete = task.status === "In Progress" && isAssignedToMe;

  return (
    <div
      className={`rounded-lg border-2 p-4 mb-3 ${statusColor} transition-all`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{statusIcon}</span>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              Room #{task.roomNumber}
            </h3>
          </div>
          {task.assignedToName && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Executor: {task.assignedToName}
            </p>
          )}
        </div>
        <span
          className={`px-2 py-1 text-xs font-semibold rounded border ${priorityColor}`}
        >
          {task.priority === "High"
            ? "High"
            : task.priority === "Medium"
            ? "Medium"
            : "Low"}
        </span>
      </div>

      {/* Notes */}
      {task.notes && (
        <div className="mb-3">
          <p className="text-sm text-gray-700 dark:text-gray-300">{task.notes}</p>
        </div>
      )}

      {/* Checklist */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={task.status === "Completed"}
            disabled
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
          />
          <span className={task.status === "Completed" ? "line-through text-gray-500 dark:text-gray-500" : "text-gray-900 dark:text-gray-200"}>
            Cleaning room
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={task.status === "Completed"}
            disabled
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
          />
          <span className={task.status === "Completed" ? "line-through text-gray-500 dark:text-gray-500" : "text-gray-900 dark:text-gray-200"}>
            Change bedding
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={task.status === "Completed"}
            disabled
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
          />
          <span className={task.status === "Completed" ? "line-through text-gray-500 dark:text-gray-500" : "text-gray-900 dark:text-gray-200"}>
            Refill mini bar
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 items-center">
        {canStart && onStart && (
          <Button
            variant="primary"
            fullWidth
            onClick={() => onStart(task.id)}
          >
            Start
          </Button>
        )}
        {canComplete && onComplete && (
          <Button
            variant="primary"
            fullWidth
            className="!bg-green-600 dark:!bg-green-500 hover:!bg-green-700 dark:hover:!bg-green-600 focus:!ring-green-500 dark:focus:!ring-green-400"
            onClick={() => onComplete(task.id)}
          >
            Complete
          </Button>
        )}
        {task.status === "Completed" && (
          <div className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium rounded-lg text-center">
            Completed
          </div>
        )}
        {task.status === "Pending" && task.assignedTo && !isAssignedToMe && (
          <div className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium rounded-lg text-center">
            Assigned to someone else
          </div>
        )}
        {onDelete && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDelete(task.id)}
          >
            Delete
          </Button>
        )}
      </div>

      {/* Timestamp */}
      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Created: {new Date(task.createdAt).toLocaleString("en-US")}
        {task.completedAt &&
          ` • Completed: ${new Date(task.completedAt).toLocaleString("en-US")}`}
      </div>
    </div>
  );
}

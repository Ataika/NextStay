import type { CleaningTask } from "../mocks/tasks";

interface TaskCardProps {
  task: CleaningTask;
  onStart?: (taskId: number) => void;
  onComplete?: (taskId: number) => void;
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
              Комната #{task.roomNumber}
            </h3>
          </div>
          {task.assignedToName && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Исполнитель: {task.assignedToName}
            </p>
          )}
        </div>
        <span
          className={`px-2 py-1 text-xs font-semibold rounded border ${priorityColor}`}
        >
          {task.priority === "High"
            ? "Высокий"
            : task.priority === "Medium"
            ? "Средний"
            : "Низкий"}
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
            Уборка комнаты
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
            Замена постельного белья
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
            Пополнение мини-бара
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {canStart && onStart && (
          <button
            onClick={() => onStart(task.id)}
            className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            Начать
          </button>
        )}
        {canComplete && onComplete && (
          <button
            onClick={() => onComplete(task.id)}
            className="flex-1 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors"
          >
            Завершить
          </button>
        )}
        {task.status === "Completed" && (
          <div className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium rounded-lg text-center">
            Завершено
          </div>
        )}
        {task.status === "Pending" && task.assignedTo && !isAssignedToMe && (
          <div className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium rounded-lg text-center">
            Назначено другому
          </div>
        )}
      </div>

      {/* Timestamp */}
      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Создано: {new Date(task.createdAt).toLocaleString("ru-RU")}
        {task.completedAt &&
          ` • Завершено: ${new Date(task.completedAt).toLocaleString("ru-RU")}`}
      </div>
    </div>
  );
}

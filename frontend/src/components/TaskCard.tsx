import type { CleaningTask } from "../mocks/tasks";

interface TaskCardProps {
  task: CleaningTask;
  onStart?: (taskId: number) => void;
  onComplete?: (taskId: number) => void;
  currentStaffId?: number;
}

const priorityColors = {
  Low: "bg-gray-100 text-gray-700 border-gray-300",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-300",
  High: "bg-red-100 text-red-700 border-red-300",
};

const statusColors = {
  Pending: "bg-gray-50 border-gray-200",
  "In Progress": "bg-blue-50 border-blue-200",
  Completed: "bg-green-50 border-green-200",
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
            <h3 className="font-bold text-lg text-gray-900">
              Комната #{task.roomNumber}
            </h3>
          </div>
          {task.assignedToName && (
            <p className="text-sm text-gray-600">
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
          <p className="text-sm text-gray-700">{task.notes}</p>
        </div>
      )}

      {/* Checklist */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={task.status === "Completed"}
            disabled
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className={task.status === "Completed" ? "line-through text-gray-500" : ""}>
            Уборка комнаты
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={task.status === "Completed"}
            disabled
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className={task.status === "Completed" ? "line-through text-gray-500" : ""}>
            Замена постельного белья
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={task.status === "Completed"}
            disabled
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className={task.status === "Completed" ? "line-through text-gray-500" : ""}>
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
          <div className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 font-medium rounded-lg text-center">
            Завершено
          </div>
        )}
        {task.status === "Pending" && task.assignedTo && !isAssignedToMe && (
          <div className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 font-medium rounded-lg text-center">
            Назначено другому
          </div>
        )}
      </div>

      {/* Timestamp */}
      <div className="mt-3 text-xs text-gray-500">
        Создано: {new Date(task.createdAt).toLocaleString("ru-RU")}
        {task.completedAt &&
          ` • Завершено: ${new Date(task.completedAt).toLocaleString("ru-RU")}`}
      </div>
    </div>
  );
}

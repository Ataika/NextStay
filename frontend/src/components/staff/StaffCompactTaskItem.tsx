import type { CleaningTask } from "../../mocks/tasks";
import { useI18n } from "../../i18n";
import Button from "../../ui/Button";
import {
  allChecklistItemsChecked,
  formatTaskTime,
  priorityAccent,
  resolveTaskChecklist,
  taskPrimaryLabel,
  taskTypeAccent,
  taskTypeIcon,
} from "../../utils/taskDisplay";

interface StaffCompactTaskItemProps {
  task: CleaningTask;
  expanded: boolean;
  onToggleExpand: () => void;
  currentStaffId: number;
  onStart?: (taskId: number) => void;
  onComplete?: (taskId: number) => void;
  onChecklistToggle?: (taskId: number, itemId: string, checked: boolean) => void;
}

export default function StaffCompactTaskItem({
  task,
  expanded,
  onToggleExpand,
  currentStaffId,
  onStart,
  onComplete,
  onChecklistToggle,
}: StaffCompactTaskItemProps) {
  const { locale, priorityLabel, t } = useI18n();
  const checklist = resolveTaskChecklist(task);
  const isAssignedToMe = task.assignedTo === currentStaffId;
  const isUnassigned = !task.assignedTo;
  const canWork = task.status !== "Completed" && (isAssignedToMe || isUnassigned);
  const allChecked = allChecklistItemsChecked(task);
  const canStart = canWork && task.status === "Pending" && isUnassigned && onStart;
  const canComplete =
    canWork &&
    allChecked &&
    onComplete &&
    (task.status === "In Progress" || (task.status === "Pending" && isAssignedToMe));

  const timeLabel = formatTaskTime(task.dueAt ?? task.createdAt, locale);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 overflow-hidden">
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${taskTypeAccent(task.taskType)}`}
        >
          {taskTypeIcon(task.taskType)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {t("taskCard.room", { room: task.roomNumber })}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {taskPrimaryLabel(task)}
            {task.notes ? ` · ${task.notes}` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              task.status === "Completed"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                : priorityAccent(task.priority)
            }`}
          >
            {task.status === "Completed" ? t("taskCard.done") : priorityLabel(task.priority)}
          </span>
          <p className="text-[11px] text-gray-400 mt-1 tabular-nums">{timeLabel}</p>
        </div>
        <span className="text-gray-400 text-sm shrink-0">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700/80">
          <div className="pt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t("taskCard.checklist")}
            </p>
            {checklist.map((item) => (
              <label
                key={item.id}
                className={`flex items-center gap-2 text-sm ${canWork && onChecklistToggle ? "cursor-pointer" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  disabled={!canWork || !onChecklistToggle}
                  onChange={(event) =>
                    onChecklistToggle?.(task.id, item.id, event.target.checked)
                  }
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
                />
                <span className={item.checked ? "line-through text-gray-500" : "text-gray-800 dark:text-gray-200"}>
                  {item.label}
                </span>
              </label>
            ))}
            {canWork && !allChecked && (
              <p className="text-xs text-amber-600 dark:text-amber-400">{t("taskCard.completeAllHint")}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {canStart && (
              <Button variant="primary" size="sm" onClick={() => onStart(task.id)}>
                {t("taskCard.start")}
              </Button>
            )}
            {canComplete && (
              <Button
                variant="primary"
                size="sm"
                className="!bg-emerald-600 hover:!bg-emerald-700"
                onClick={() => onComplete(task.id)}
              >
                {t("taskCard.complete")}
              </Button>
            )}
            {task.status === "Completed" && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium py-2">
                {t("taskCard.completed")}
              </span>
            )}
            {task.status === "Pending" && task.assignedTo && !isAssignedToMe && (
              <span className="text-xs text-gray-500 py-2">{t("taskCard.assignedElsewhere")}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

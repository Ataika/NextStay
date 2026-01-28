import { useState, useEffect, useMemo } from "react";
import { tasksApi } from "../../api/api";
import type { CleaningTask } from "../../mocks/tasks";
import TaskCard from "../../components/TaskCard";
import LoadingSpinner from "../../ui/LoadingSpinner";
import ErrorState from "../../ui/ErrorState";
import EmptyState from "../../ui/EmptyState";
import PageHeader from "../../ui/PageHeader";
import Card from "../../ui/Card";
import { layout, colors } from "../../constants/designTokens";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import toast from "react-hot-toast";

type StatusFilter = CleaningTask["status"] | "All";
type PriorityFilter = CleaningTask["priority"] | "All";

export default function StaffPage() {
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("All");
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CleaningTask | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Mock data for the current staff
  const currentStaffId = 1;
  const currentStaffName = "Maria Ivanova";

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await tasksApi.getAll();
      setTasks(data);
    } catch (error) {
      const errorMessage = "Error loading tasks";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (taskId: number) => {
    try {
      await tasksApi.assign(taskId, currentStaffId, currentStaffName);
      toast.success("Task started");
      await loadTasks();
    } catch (error) {
      toast.error("Error starting task");
      console.error(error);
    }
  };

  const handleComplete = async (taskId: number) => {
    try {
      await tasksApi.complete(taskId);
      toast.success("Task completed. Room status updated to Available.");
      await loadTasks();
    } catch (error) {
      toast.error("Error completing task");
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await tasksApi.delete(deleteTarget.id);
      toast.success("Task deleted");
      setDeleteTarget(null);
      await loadTasks();
    } catch (error) {
      toast.error("Error deleting task");
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesStatus = statusFilter === "All" || task.status === statusFilter;
      const matchesPriority = priorityFilter === "All" || task.priority === priorityFilter;
      const matchesMyTasks = !onlyMyTasks || task.assignedTo === currentStaffId;
      return matchesStatus && matchesPriority && matchesMyTasks;
    });
  }, [tasks, statusFilter, priorityFilter, onlyMyTasks, currentStaffId]);

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "Pending").length,
      inProgress: tasks.filter((t) => t.status === "In Progress").length,
      completed: tasks.filter((t) => t.status === "Completed").length,
    };
  }, [tasks]);

  if (loading) {
    return <LoadingSpinner message="Loading tasks..." fullScreen={false} />;
  }

  if (error) {
    return <ErrorState title="Error loading tasks" message={error} onRetry={loadTasks} />;
  }

  return (
    <div className={layout.container}>
      <PageHeader
        title="My tasks"
        subtitle="Management of cleaning tasks"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Card padding="sm" className={colors.neutral.light}>
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Pending</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.pending}</div>
        </Card>
        <Card padding="sm" className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800">
          <div className="text-xs text-blue-700 dark:text-blue-400 mb-1">In progress</div>
          <div className="text-xl font-bold text-blue-800 dark:text-blue-300">{stats.inProgress}</div>
        </Card>
        <Card padding="sm" className={`${colors.success.light} hidden sm:block`}>
          <div className="text-xs text-green-700 dark:text-green-400 mb-1">Completed</div>
          <div className="text-xl font-bold text-green-800 dark:text-green-300">{stats.completed}</div>
        </Card>
        <Card padding="sm" className={`${colors.neutral.light} hidden sm:block`}>
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="md" className="mb-6">
        <div className="space-y-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        >
          <option value="All">All statuses</option>
          <option value="Pending">Pending</option>
          <option value="In Progress">In progress</option>
          <option value="Completed">Completed</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        >
          <option value="All">All priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <input
            type="checkbox"
            checked={onlyMyTasks}
            onChange={(e) => setOnlyMyTasks(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-400 dark:ring-offset-gray-800 dark:bg-gray-700 dark:border-gray-600"
          />
          <span className="text-sm text-gray-900 dark:text-white">Only my tasks</span>
        </label>
        </div>
      </Card>

      {/* Tasks List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
            Tasks ({filteredTasks.length})
          </h2>
        </div>

        {filteredTasks.length === 0 ? (
          <Card>
            <EmptyState
              title="No tasks"
              message="Try changing the filters to see more tasks."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onStart={handleStart}
                onComplete={handleComplete}
                onDelete={(id) => setDeleteTarget(filteredTasks.find((t) => t.id === id) ?? null)}
                currentStaffId={currentStaffId}
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title="Delete task"
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button variant="secondary" fullWidth onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" fullWidth onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        {deleteTarget && (
          <p className="text-gray-700 dark:text-gray-300">
            Delete task for Room #{deleteTarget.roomNumber}? This cannot be undone.
          </p>
        )}
      </Modal>
    </div>
  );
}

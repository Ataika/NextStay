import { useState, useEffect, useMemo } from "react";
import { tasksApi } from "../../api/api";
import type { CleaningTask } from "../../mocks/tasks";
import TaskCard from "../../components/TaskCard";
import toast from "react-hot-toast";

type StatusFilter = CleaningTask["status"] | "All";
type PriorityFilter = CleaningTask["priority"] | "All";

export default function StaffPage() {
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("All");
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);

  // Mock data for the current staff
  const currentStaffId = 1;
  const currentStaffName = "Maria Ivanova";

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await tasksApi.getAll();
      setTasks(data);
    } catch (error) {
      toast.error("Error loading tasks");
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
      toast.success("Task completed");
      await loadTasks();
    } catch (error) {
      toast.error("Error completing task");
      console.error(error);
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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">My tasks</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">Management of cleaning tasks</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Pending</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.pending}</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
          <div className="text-xs text-blue-700 dark:text-blue-400 mb-1">In progress</div>
          <div className="text-xl font-bold text-blue-800 dark:text-blue-300">{stats.inProgress}</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800 hidden sm:block">
          <div className="text-xs text-green-700 dark:text-green-400 mb-1">Completed</div>
          <div className="text-xl font-bold text-green-800 dark:text-green-300">{stats.completed}</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 hidden sm:block">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total</div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-2">
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

      {/* Tasks List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
            Tasks ({filteredTasks.length})
          </h2>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">No tasks</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Try changing the filters
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onStart={handleStart}
                onComplete={handleComplete}
                currentStaffId={currentStaffId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

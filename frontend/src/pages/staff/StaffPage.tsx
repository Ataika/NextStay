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

  // Моковые данные для текущего сотрудника
  const currentStaffId = 1;
  const currentStaffName = "Мария Иванова";

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await tasksApi.getAll();
      setTasks(data);
    } catch (error) {
      toast.error("Ошибка загрузки задач");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (taskId: number) => {
    try {
      await tasksApi.assign(taskId, currentStaffId, currentStaffName);
      toast.success("Задача начата");
      await loadTasks();
    } catch (error) {
      toast.error("Ошибка при начале задачи");
      console.error(error);
    }
  };

  const handleComplete = async (taskId: number) => {
    try {
      await tasksApi.complete(taskId);
      toast.success("Задача завершена");
      await loadTasks();
    } catch (error) {
      toast.error("Ошибка при завершении задачи");
      console.error(error);
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesStatus = statusFilter === "All" || task.status === statusFilter;
      const matchesPriority = priorityFilter === "All" || task.priority === priorityFilter;
      return matchesStatus && matchesPriority;
    });
  }, [tasks, statusFilter, priorityFilter]);

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
        <div className="text-gray-600">Загрузка задач...</div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6 pb-20">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Мои задачи</h1>
        <p className="text-sm text-gray-600">Управление задачами уборки</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <div className="text-xs text-gray-600 mb-1">Ожидают</div>
          <div className="text-xl font-bold text-gray-900">{stats.pending}</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <div className="text-xs text-blue-700 mb-1">В работе</div>
          <div className="text-xl font-bold text-blue-800">{stats.inProgress}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">Все статусы</option>
          <option value="Pending">Ожидают</option>
          <option value="In Progress">В работе</option>
          <option value="Completed">Завершены</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">Все приоритеты</option>
          <option value="High">Высокий</option>
          <option value="Medium">Средний</option>
          <option value="Low">Низкий</option>
        </select>
      </div>

      {/* Tasks List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">
            Задачи ({filteredTasks.length})
          </h2>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-500">Нет задач</p>
            <p className="text-sm text-gray-400 mt-1">
              Попробуйте изменить фильтры
            </p>
          </div>
        ) : (
          <div>
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tasksApi } from "../api/api";
import type { CleaningTask } from "../mocks/tasks";
import { useAuthStore } from "../store/authStore";

const POLL_MS = 30_000;
const STORE_KEY = "nextstay-notif-seen";
const COMPLETED_STORE_KEY = "nextstay-notif-completed-seen";

function loadSeen(key: string, email: string): Set<number> {
  try {
    const raw = localStorage.getItem(`${key}:${email}`);
    if (raw) return new Set(JSON.parse(raw) as number[]);
  } catch {
    /* ignore */
  }
  return new Set();
}

function saveSeen(key: string, email: string, ids: Set<number>) {
  try {
    localStorage.setItem(`${key}:${email}`, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function useTaskNotifications() {
  const role = useAuthStore((s) => s.role);
  const email = useAuthStore((s) => s.email);
  const staffId = useAuthStore((s) => s.staffId);
  const isStaff = role === "STAFF";

  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [seenIds, setSeenIds] = useState<Set<number>>(() =>
    email ? loadSeen(STORE_KEY, email) : new Set()
  );
  const [seenCompletedIds, setSeenCompletedIds] = useState<Set<number>>(() =>
    email ? loadSeen(COMPLETED_STORE_KEY, email) : new Set()
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    if (!role) return;
    try {
      setTasks(await tasksApi.getAll());
    } catch {
      /* silently ignore poll errors */
    }
  }, [role]);

  useEffect(() => {
    void fetch();
    timerRef.current = setInterval(() => void fetch(), POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetch]);

  const relevantTasks = useMemo(() => {
    if (isStaff && staffId != null) {
      return tasks.filter((task) => task.assignedTo === staffId);
    }
    return tasks;
  }, [tasks, isStaff, staffId]);

  const unseenTasks = useMemo(() => {
    if (isStaff) {
      return relevantTasks.filter(
        (task) => task.status !== "Completed" && !seenIds.has(task.id)
      );
    }
    return relevantTasks.filter(
      (task) => task.status === "Completed" && !seenCompletedIds.has(task.id)
    );
  }, [relevantTasks, isStaff, seenIds, seenCompletedIds]);

  const pendingTasks = relevantTasks.filter(
    (task) => task.status === "Pending" || task.status === "In Progress"
  );

  const activeTasks = pendingTasks;
  const activeTaskCount = activeTasks.length;
  const hasUrgentTask = activeTasks.some(
    (task) => task.priority === "High" || task.priority === "Urgent"
  );

  const markAllSeen = useCallback(() => {
    if (isStaff) {
      const next = new Set(seenIds);
      tasks.forEach((task) => next.add(task.id));
      setSeenIds(next);
      if (email) saveSeen(STORE_KEY, email, next);
      return;
    }

    const next = new Set(seenCompletedIds);
    tasks
      .filter((task) => task.status === "Completed")
      .forEach((task) => next.add(task.id));
    setSeenCompletedIds(next);
    if (email) saveSeen(COMPLETED_STORE_KEY, email, next);
  }, [tasks, seenIds, seenCompletedIds, email, isStaff]);

  return {
    unseenTasks,
    pendingTasks,
    activeTaskCount,
    hasUrgentTask,
    markAllSeen,
    refetch: fetch,
    notificationMode: isStaff ? ("new" as const) : ("completed" as const),
  };
}

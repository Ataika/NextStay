import { useCallback, useEffect, useRef, useState } from "react";
import { tasksApi } from "../api/api";
import type { CleaningTask } from "../mocks/tasks";
import { useAuthStore } from "../store/authStore";

const POLL_MS   = 30_000;
const STORE_KEY = "nextstay-notif-seen";

function loadSeen(email: string): Set<number> {
  try {
    const raw = localStorage.getItem(`${STORE_KEY}:${email}`);
    if (raw) return new Set(JSON.parse(raw) as number[]);
  } catch { /* ignore */ }
  return new Set();
}

function saveSeen(email: string, ids: Set<number>) {
  try {
    localStorage.setItem(`${STORE_KEY}:${email}`, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

export function useTaskNotifications() {
  const role    = useAuthStore((s) => s.role);
  const email   = useAuthStore((s) => s.email);
  const staffId = useAuthStore((s) => s.staffId);

  const [tasks, setTasks]     = useState<CleaningTask[]>([]);
  const [seenIds, setSeenIds] = useState<Set<number>>(() =>
    email ? loadSeen(email) : new Set()
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    if (!role) return;
    try {
      setTasks(await tasksApi.getAll());
    } catch { /* silently ignore poll errors */ }
  }, [role]);

  useEffect(() => {
    void fetch();
    timerRef.current = setInterval(() => void fetch(), POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetch]);

  // For STAFF, only surface tasks assigned to this staff member
  const relevantTasks = (role === "STAFF" && staffId != null)
    ? tasks.filter((t) => t.assignedTo === staffId)
    : tasks;

  const unseenTasks  = relevantTasks.filter((t) => t.status !== "Completed" && !seenIds.has(t.id));
  const pendingTasks = relevantTasks.filter((t) => t.status === "Pending" || t.status === "In Progress");

  const markAllSeen = useCallback(() => {
    const next = new Set(seenIds);
    tasks.forEach((t) => next.add(t.id));
    setSeenIds(next);
    if (email) saveSeen(email, next);
  }, [tasks, seenIds, email]);

  return { unseenTasks, pendingTasks, markAllSeen, refetch: fetch };
}

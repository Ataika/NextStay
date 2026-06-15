import { useCallback, useEffect, useRef, useState } from "react";
import { chatApi } from "../api/api";
import { useAuthStore, type UserRole } from "../store/authStore";

const POLL_MS = 15_000;
const CHAT_ROLES = new Set<UserRole>(["OWNER", "SYS_ADMIN", "DIRECTOR", "MANAGER", "STAFF"]);

export function useChatNotifications() {
  const role = useAuthStore((s) => s.role);
  const token = useAuthStore((s) => s.token);
  const [unreadCount, setUnreadCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUnread = useCallback(async () => {
    if (!token || !role || !CHAT_ROLES.has(role)) {
      setUnreadCount(0);
      return;
    }
    try {
      const conversations = await chatApi.listConversations();
      const total = conversations.reduce((sum, conversation) => sum + (conversation.unread_count ?? 0), 0);
      setUnreadCount(total);
    } catch {
      /* ignore poll errors */
    }
  }, [role, token]);

  useEffect(() => {
    void fetchUnread();
    timerRef.current = setInterval(() => void fetchUnread(), POLL_MS);
    const onUnreadChanged = () => void fetchUnread();
    window.addEventListener("chat-unread-changed", onUnreadChanged);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener("chat-unread-changed", onUnreadChanged);
    };
  }, [fetchUnread]);

  return { unreadCount, refetchUnread: fetchUnread };
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "../store/authStore";
import { chatApi, type ChatConversation, type ChatMessageItem } from "../api/api";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

function getWsUrl(token: string): string {
  const httpBase = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
  const wsBase = httpBase.replace(/^http/, "ws");
  return `${wsBase}/api/v1/ws/chat?token=${encodeURIComponent(token)}`;
}

export interface OnlineUser {
  id: number;
  name: string;
}

export interface TypingUser {
  userId: number;
  userName: string;
  expiresAt: number; // Date.now() + 3000
}

type MessagesByConversation = Record<number, ChatMessageItem[]>;
type TypingByConversation = Record<number, TypingUser[]>;

const TYPING_TTL_MS = 3000;

function sortConversations(conversations: ChatConversation[]): ChatConversation[] {
  return [...conversations].sort((a, b) => {
    const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    return b.id - a.id;
  });
}

function applyOnlineState(conversations: ChatConversation[], onlineUsers: OnlineUser[]): ChatConversation[] {
  const onlineIds = new Set(onlineUsers.map((u) => u.id));
  return conversations.map((c) => ({
    ...c,
    participants: c.participants.map((p) => ({ ...p, online: onlineIds.has(p.user_id) })),
  }));
}

function upsertConversation(conversations: ChatConversation[], next: ChatConversation): ChatConversation[] {
  const others = conversations.filter((c) => c.id !== next.id);
  return sortConversations([next, ...others]);
}

export function useChat() {
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.userId);

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<MessagesByConversation>({});
  const [online, setOnline] = useState<OnlineUser[]>([]);
  const [typing, setTyping] = useState<TypingByConversation>({});
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);
  const onlineRef = useRef<OnlineUser[]>([]);
  const activeConversationIdRef = useRef<number | null>(null);

  // Purge expired typing indicators every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTyping((current) => {
        const next: TypingByConversation = {};
        let changed = false;
        for (const [key, users] of Object.entries(current)) {
          const alive = users.filter((u) => u.expiresAt > now);
          next[Number(key)] = alive;
          if (alive.length !== users.length) changed = true;
        }
        return changed ? next : current;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const refreshConversations = useCallback(async () => {
    const nextConversations = await chatApi.listConversations();
    const withPresence = applyOnlineState(sortConversations(nextConversations), onlineRef.current);
    setConversations(withPresence);
    setActiveConversationId((current) => {
      if (current && withPresence.some((c) => c.id === current)) return current;
      return withPresence[0]?.id ?? null;
    });
  }, []);

  const markConversationRead = useCallback(async (conversationId: number) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, unread_count: 0 }
          : conversation
      )
    );
    try {
      await chatApi.markConversationRead(conversationId);
      window.dispatchEvent(new CustomEvent("chat-unread-changed"));
    } catch {
      /* keep optimistic UI */
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: number, force = false) => {
    if (!force && messagesByConversation[conversationId]) {
      void markConversationRead(conversationId);
      return;
    }
    setLoadingMessages(true);
    try {
      const msgs = await chatApi.getMessages(conversationId, 100);
      setMessagesByConversation((current) => ({ ...current, [conversationId]: msgs }));
      await markConversationRead(conversationId);
    } finally {
      setLoadingMessages(false);
    }
  }, [markConversationRead, messagesByConversation]);

  useEffect(() => {
    if (!token) {
      setConversations([]);
      setMessagesByConversation({});
      setOnline([]);
      setActiveConversationId(null);
      setLoadingConversations(false);
      return;
    }
    let cancelled = false;
    setLoadingConversations(true);
    void (async () => {
      try {
        const presence = await chatApi.getOnline().catch(() => [] as OnlineUser[]);
        if (cancelled) return;
        onlineRef.current = presence;
        setOnline(presence);
        await refreshConversations();
      } catch {
        if (!cancelled) setConversations([]);
      } finally {
        if (!cancelled) setLoadingConversations(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshConversations, token]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId) return;
    void loadMessages(activeConversationId);
  }, [activeConversationId, loadMessages]);

  const connect = useCallback(() => {
    if (!token || unmounted.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl(token));
    wsRef.current = ws;

    ws.onopen = () => { if (!unmounted.current) setConnected(true); };

    ws.onmessage = (event) => {
      if (unmounted.current) return;
      try {
        const data = JSON.parse(event.data as string) as Record<string, unknown>;
        const type = data.type as string;

        if (type === "presence") {
          const onlineUsers = data.online as OnlineUser[];
          onlineRef.current = onlineUsers;
          setOnline(onlineUsers);
          setConversations((c) => applyOnlineState(c, onlineUsers));
          return;
        }

        if (type === "typing") {
          const convId = data.conversation_id as number;
          const userId = data.user_id as number;
          const userName = data.user_name as string;
          const expiresAt = Date.now() + TYPING_TTL_MS;
          setTyping((current) => {
            const existing = (current[convId] ?? []).filter((u) => u.userId !== userId);
            return { ...current, [convId]: [...existing, { userId, userName, expiresAt }] };
          });
          return;
        }

        if (type === "message_edited") {
          const msgId = data.id as number;
          const convId = data.conversation_id as number;
          const newContent = data.content as string;
          const editedAt = data.edited_at as string;
          setMessagesByConversation((current) => {
            const msgs = current[convId];
            if (!msgs) return current;
            return {
              ...current,
              [convId]: msgs.map((m) =>
                m.id === msgId ? { ...m, content: newContent, edited_at: editedAt } : m
              ),
            };
          });
          return;
        }

        if (type === "message_deleted") {
          const msgId = data.id as number;
          const convId = data.conversation_id as number;
          const deletedAt = data.deleted_at as string;
          setMessagesByConversation((current) => {
            const msgs = current[convId];
            if (!msgs) return current;
            return {
              ...current,
              [convId]: msgs.map((m) =>
                m.id === msgId ? { ...m, deleted_at: deletedAt } : m
              ),
            };
          });
          return;
        }

        if (type === "message") {
          const message = data as unknown as ChatMessageItem;
          const isActiveConversation = message.conversation_id === activeConversationIdRef.current;
          const isOwnMessage = message.sender_id === userId;

          setMessagesByConversation((current) => {
            const existing = current[message.conversation_id] ?? [];
            if (existing.some((item) => item.id === message.id)) return current;
            return { ...current, [message.conversation_id]: [...existing, message] };
          });
          setConversations((current) => {
            const target = current.find((c) => c.id === message.conversation_id);
            if (!target) { void refreshConversations(); return current; }
            const updated = {
              ...target,
              last_message_preview:
                target.kind === "group"
                  ? `${message.sender_name}: ${message.content}`
                  : message.content,
              last_message_at: message.created_at,
              unread_count:
                isActiveConversation || isOwnMessage
                  ? 0
                  : (target.unread_count ?? 0) + 1,
            };
            return upsertConversation(
              current.map((c) => (c.id === updated.id ? updated : c)),
              updated,
            );
          });

          if (isActiveConversation && !isOwnMessage) {
            void markConversationRead(message.conversation_id);
          } else if (!isOwnMessage) {
            window.dispatchEvent(new CustomEvent("chat-unread-changed"));
          }
        }
      } catch {
        // Ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (unmounted.current) return;
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => { ws.close(); };
  }, [markConversationRead, refreshConversations, token, userId]);

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => { void refreshConversations(); }, 15000);
    return () => clearInterval(interval);
  }, [refreshConversations, token]);

  const selectConversation = useCallback((conversationId: number) => {
    setActiveConversationId(conversationId);
    void markConversationRead(conversationId);
  }, [markConversationRead]);

  const openDirectConversation = useCallback(async (userId: number) => {
    const conversation = await chatApi.openDirectConversation(userId);
    const withPresence = applyOnlineState([conversation], onlineRef.current)[0];
    setConversations((current) => upsertConversation(current, withPresence));
    setActiveConversationId(withPresence.id);
    await loadMessages(withPresence.id, true);
    return withPresence;
  }, [loadMessages]);

  const createGroupConversation = useCallback(async (title: string, memberIds: number[]) => {
    const conversation = await chatApi.createGroupConversation(title, memberIds);
    const withPresence = applyOnlineState([conversation], onlineRef.current)[0];
    setConversations((current) => upsertConversation(current, withPresence));
    setActiveConversationId(withPresence.id);
    setMessagesByConversation((current) => ({
      ...current,
      [withPresence.id]: current[withPresence.id] ?? [],
    }));
    return withPresence;
  }, []);

  const sendMessage = useCallback((conversationId: number, content: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", conversation_id: conversationId, content }));
    }
  }, []);

  const sendTyping = useCallback((conversationId: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing", conversation_id: conversationId }));
    }
  }, []);

  const editMessage = useCallback(async (messageId: number, content: string) => {
    const updated = await chatApi.editMessage(messageId, content);
    setMessagesByConversation((current) => {
      const msgs = current[updated.conversation_id];
      if (!msgs) return current;
      return {
        ...current,
        [updated.conversation_id]: msgs.map((m) => (m.id === messageId ? updated : m)),
      };
    });
  }, []);

  const deleteMessage = useCallback(async (messageId: number, conversationId: number) => {
    await chatApi.deleteMessage(messageId);
    const now = new Date().toISOString();
    setMessagesByConversation((current) => {
      const msgs = current[conversationId];
      if (!msgs) return current;
      return {
        ...current,
        [conversationId]: msgs.map((m) => (m.id === messageId ? { ...m, deleted_at: now } : m)),
      };
    });
  }, []);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [activeConversationId, conversations],
  );

  const activeMessages = activeConversationId ? (messagesByConversation[activeConversationId] ?? []) : [];
  const activeTyping = activeConversationId ? (typing[activeConversationId] ?? []) : [];
  const totalUnreadCount = useMemo(
    () => conversations.reduce((sum, conversation) => sum + (conversation.unread_count ?? 0), 0),
    [conversations],
  );

  return {
    conversations,
    activeConversation,
    activeConversationId,
    messages: activeMessages,
    typingUsers: activeTyping,
    online,
    connected,
    loadingConversations,
    loadingMessages,
    totalUnreadCount,
    selectConversation,
    openDirectConversation,
    createGroupConversation,
    sendMessage,
    sendTyping,
    editMessage,
    deleteMessage,
    markConversationRead,
    refreshConversations,
  };
}

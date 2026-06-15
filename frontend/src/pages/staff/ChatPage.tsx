import { useDeferredValue, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent } from "react";
import { authApi, chatApi, type ChatConversation, type ChatUserOption } from "../../api/api";
import { useI18n } from "../../i18n";
import { useAuthStore } from "../../store/authStore";
import { useChat } from "../../hooks/useChat";
import Button from "../../ui/Button";
import toast from "react-hot-toast";

interface WallpaperPreset {
  id: string;
  label: string;
  value: string;
}

const PRESETS: WallpaperPreset[] = [
  { id: "default", label: "Default", value: "" },
  { id: "slate", label: "Slate", value: "linear-gradient(135deg, #1e293b 0%, #334155 100%)" },
  { id: "ocean", label: "Ocean", value: "linear-gradient(135deg, #0f4c81 0%, #1a7abf 100%)" },
  { id: "forest", label: "Forest", value: "linear-gradient(135deg, #113b29 0%, #1d6b45 100%)" },
  { id: "ember", label: "Ember", value: "linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)" },
  { id: "dawn", label: "Dawn", value: "linear-gradient(135deg, #be185d 0%, #fb7185 100%)" },
  { id: "steel", label: "Steel", value: "linear-gradient(135deg, #0f172a 0%, #475569 100%)" },
  { id: "mist", label: "Mist", value: "linear-gradient(135deg, #dbeafe 0%, #f8fafc 100%)" },
];

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-violet-500",
];

function formatTime(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatConversationTime(iso: string | null, locale: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function avatarColor(userId: number): string {
  return AVATAR_COLORS[userId % AVATAR_COLORS.length];
}

function normalizeWallpaperImageUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.startsWith("image:") ? trimmed.slice("image:".length).trim() : trimmed;
  const legacy = normalized.startsWith("url(") && normalized.endsWith(")")
    ? normalized.slice(4, -1).trim().replace(/^['"]|['"]$/g, "")
    : normalized;

  try {
    return new URL(legacy).toString();
  } catch {
    return null;
  }
}

function wallpaperStyle(value: string): CSSProperties {
  const imageUrl = normalizeWallpaperImageUrl(value);
  if (imageUrl) {
    return {
      backgroundImage: `url("${imageUrl.replace(/"/g, '\\"')}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }

  return value ? { background: value } : {};
}

async function imageUrlLoads(url: string): Promise<boolean> {
  return await new Promise((resolve) => {
    const image = new Image();
    image.referrerPolicy = "no-referrer";
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

function conversationSubtitle(
  conversation: ChatConversation,
  currentUserId: number | null,
  roleLabel: (role: string) => string,
  directMessageLabel: string,
  memberLabel: (count: number) => string,
  onlineLabel: string
): string {
  if (conversation.kind === "direct") {
    const other = conversation.participants.find((participant) => participant.user_id !== currentUserId);
    if (!other) return directMessageLabel;
    return `${roleLabel(other.role)}${other.online ? ` · ${onlineLabel}` : ""}`;
  }

  return memberLabel(conversation.participants.length);
}

function conversationSearchText(conversation: ChatConversation): string {
  return [
    conversation.title,
    conversation.last_message_preview ?? "",
    ...conversation.participants.flatMap((participant) => [participant.name, participant.email, participant.role]),
  ]
    .join(" ")
    .toLowerCase();
}

function buildGroupTitle(members: ChatUserOption[]): string {
  return members.map((member) => member.name).join(", ");
}

interface WallpaperPickerProps {
  current: string;
  onSelect: (value: string) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

function WallpaperPicker({ current, onSelect, onClose, saving }: WallpaperPickerProps) {
  const { t } = useI18n();
  const [customUrl, setCustomUrl] = useState("");
  const currentImageUrl = useMemo(() => normalizeWallpaperImageUrl(current) ?? "", [current]);

  useEffect(() => {
    setCustomUrl(currentImageUrl);
  }, [currentImageUrl]);

  const applyCustomUrl = async () => {
    const normalized = normalizeWallpaperImageUrl(customUrl);
    if (!normalized) {
      toast.error(t("chat.wallpaperInvalidUrl"));
      return;
    }

    const reachable = await imageUrlLoads(normalized);
    if (!reachable) {
      toast.error(t("chat.wallpaperUnreachable"));
      return;
    }

    await onSelect(`image:${normalized}`);
  };

  return (
    <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t("chat.wallpaperTitle")}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t("chat.wallpaperDescription")}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          aria-label={t("chat.wallpaperClosePicker")}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => void onSelect(preset.value)}
            title={preset.label}
            className={`h-14 rounded-xl border-2 transition-transform ${
              current === preset.value
                ? "border-blue-500 scale-[1.03]"
                : "border-transparent hover:border-gray-300 dark:hover:border-gray-500"
            }`}
            style={preset.value ? { background: preset.value } : { background: "transparent", borderStyle: "dashed" }}
          >
            {!preset.value && (
              <span className="text-[10px] font-medium text-gray-400">{t("common.off")}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
        <label className="mb-2 block text-xs font-medium text-gray-600 dark:text-gray-300">
          {t("chat.customImageUrl")}
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={customUrl}
            onChange={(event) => setCustomUrl(event.target.value)}
            placeholder="https://example.com/wallpaper.jpg"
            className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 outline-none ring-0 transition focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <Button size="sm" disabled={!customUrl.trim() || saving} onClick={() => void applyCustomUrl()}>
            {t("common.apply")}
          </Button>
        </div>
        {currentImageUrl && (
          <button
            onClick={() => void onSelect("")}
            className="mt-3 text-xs font-medium text-gray-500 transition-colors hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
          >
            {t("chat.wallpaperRemoveImage")}
          </button>
        )}
      </div>

      {saving && (
        <p className="mt-3 text-center text-xs text-gray-400">{t("chat.wallpaperSaving")}</p>
      )}
    </div>
  );
}

export default function ChatPage() {
  const { name: myName, role, userId } = useAuthStore();
  const { locale, t, roleLabel } = useI18n();
  const {
    conversations,
    activeConversation,
    messages,
    typingUsers,
    online,
    connected,
    loadingConversations,
    loadingMessages,
    selectConversation,
    openDirectConversation,
    createGroupConversation,
    sendMessage,
    sendTyping,
    editMessage,
    deleteMessage,
  } = useChat();

  const [input, setInput] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [wallpaper, setWallpaper] = useState("");
  const [savingWallpaper, setSavingWallpaper] = useState(false);
  const [showListOnMobile, setShowListOnMobile] = useState(true);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [hoverMessageId, setHoverMessageId] = useState<number | null>(null);
  const lastTypingSentRef = useRef(0);

  const [listFilter, setListFilter] = useState("");
  const deferredListFilter = useDeferredValue(listFilter.trim());

  const [recipientQuery, setRecipientQuery] = useState("");
  const deferredRecipientQuery = useDeferredValue(recipientQuery.trim());
  const [recipientResults, setRecipientResults] = useState<ChatUserOption[]>([]);
  const [searchingRecipients, setSearchingRecipients] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<ChatUserOption[]>([]);
  const [optionalGroupTitle, setOptionalGroupTitle] = useState("");
  const [creatingConversation, setCreatingConversation] = useState(false);
  const recipientInputRef = useRef<HTMLInputElement>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    authApi.getPreferences()
      .then((prefs) => setWallpaper(prefs.chat_wallpaper ?? ""))
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!deferredRecipientQuery) {
      setSearchingRecipients(false);
      setRecipientResults([]);
      return;
    }

    let cancelled = false;
    setSearchingRecipients(true);

    void (async () => {
      try {
        const results = await chatApi.searchUsers(deferredRecipientQuery);
        if (!cancelled) {
          const selectedIds = new Set(selectedRecipients.map((recipient) => recipient.id));
          setRecipientResults(results.filter((user) => !selectedIds.has(user.id)));
        }
      } catch {
        if (!cancelled) setRecipientResults([]);
      } finally {
        if (!cancelled) setSearchingRecipients(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deferredRecipientQuery, selectedRecipients]);

  useEffect(() => {
    if (!activeConversation) {
      setShowListOnMobile(true);
    }
  }, [activeConversation]);

  const filteredConversations = useMemo(() => {
    if (!deferredListFilter) return conversations;
    const query = deferredListFilter.toLowerCase();
    return conversations.filter((conversation) => conversationSearchText(conversation).includes(query));
  }, [conversations, deferredListFilter]);

  const activeSubtitle = activeConversation
    ? conversationSubtitle(
        activeConversation,
        userId,
        roleLabel,
        t("chat.privateChat"),
        (count) => t("chat.members", {
          count,
          label: locale === "it-IT"
            ? (count === 1 ? "membro" : "membri")
            : (count === 1 ? "member" : "members"),
        }),
        t("chat.online")
      )
    : t("chat.chooseConversationPrompt");

  const wallpaperCss = wallpaperStyle(wallpaper);
  const hasWallpaper = Boolean(wallpaper);

  const openConversation = (conversationId: number) => {
    selectConversation(conversationId);
    setShowListOnMobile(false);
  };

  const resetComposer = () => {
    setRecipientQuery("");
    setRecipientResults([]);
    setSelectedRecipients([]);
    setOptionalGroupTitle("");
  };

  const addRecipient = (user: ChatUserOption) => {
    setSelectedRecipients((current) => (
      current.some((recipient) => recipient.id === user.id)
        ? current
        : [...current, user]
    ));
    setRecipientQuery("");
    setRecipientResults([]);
    recipientInputRef.current?.focus();
  };

  const removeRecipient = (userId: number) => {
    setSelectedRecipients((current) => current.filter((recipient) => recipient.id !== userId));
  };

  const handleRecipientKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !recipientQuery && selectedRecipients.length > 0) {
      setSelectedRecipients((current) => current.slice(0, -1));
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (recipientResults.length > 0) {
        addRecipient(recipientResults[0]);
        return;
      }
      if (selectedRecipients.length > 0) {
        void startSelectedConversation();
      }
    }
  };

  const startSelectedConversation = async () => {
    if (selectedRecipients.length === 0 || creatingConversation) return;

    setCreatingConversation(true);
    try {
      if (selectedRecipients.length === 1) {
        await openDirectConversation(selectedRecipients[0].id);
      } else {
        const title = optionalGroupTitle.trim() || buildGroupTitle(selectedRecipients);
        await createGroupConversation(title, selectedRecipients.map((recipient) => recipient.id));
      }
      resetComposer();
      setShowListOnMobile(false);
    } catch {
      toast.error(
        selectedRecipients.length === 1
          ? t("chat.openChatFailed")
          : t("chat.createGroupFailed")
      );
    } finally {
      setCreatingConversation(false);
    }
  };

  const handleSendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed || !connected || !activeConversation) return;
    sendMessage(activeConversation.id, trimmed);
    setInput("");
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInput(event.target.value);
    if (activeConversation && connected) {
      const now = Date.now();
      if (now - lastTypingSentRef.current > 1500) {
        lastTypingSentRef.current = now;
        sendTyping(activeConversation.id);
      }
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const startEdit = (messageId: number, content: string) => {
    setEditingMessageId(messageId);
    setEditContent(content);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditContent("");
  };

  const submitEdit = async () => {
    if (!editingMessageId || !editContent.trim()) return;
    setSavingEdit(true);
    try {
      await editMessage(editingMessageId, editContent.trim());
      cancelEdit();
    } catch {
      toast.error("Failed to edit message");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!activeConversation) return;
    try {
      await deleteMessage(messageId, activeConversation.id);
    } catch {
      toast.error("Failed to delete message");
    }
  };

  const handleSelectWallpaper = async (value: string) => {
    setWallpaper(value);
    setSavingWallpaper(true);
    try {
      const prefs = await authApi.updatePreferences({ chat_wallpaper: value || null });
      setWallpaper(prefs.chat_wallpaper ?? "");
    } catch {
      toast.error(t("chat.wallpaperSaveFailed"));
    } finally {
      setSavingWallpaper(false);
    }
  };

  return (
    <>
      <div className="h-[calc(100vh-8rem)] overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 md:h-[calc(100vh-5.75rem)]">
        <div className="flex h-full min-h-0">
          <aside
            className={`h-full w-full border-r border-gray-200 bg-slate-50/90 dark:border-gray-700 dark:bg-gray-900/80 md:flex md:w-[340px] md:flex-col ${
              showListOnMobile ? "flex flex-col" : "hidden"
            }`}
          >
            <div className="border-b border-gray-200 px-4 py-4 dark:border-gray-700">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
                  {t("chat.messenger")}
                </p>
                <h1 className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{t("chat.staffConversations")}</h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t("chat.onlineNow", { count: online.length })}
                </p>
              </div>

              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {t("chat.newChat")}
                </p>

                <div
                  className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-slate-50 px-2 py-1.5 focus-within:border-blue-500 dark:border-gray-600 dark:bg-gray-700/60"
                  onClick={() => recipientInputRef.current?.focus()}
                >
                  {selectedRecipients.map((recipient) => (
                    <button
                      key={recipient.id}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeRecipient(recipient.id);
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                    >
                      <span>{recipient.name}</span>
                      <span aria-hidden>×</span>
                    </button>
                  ))}
                  <input
                    ref={recipientInputRef}
                    type="search"
                    value={recipientQuery}
                    onChange={(event) => setRecipientQuery(event.target.value)}
                    onKeyDown={handleRecipientKeyDown}
                    placeholder={selectedRecipients.length === 0 ? t("chat.recipientPlaceholder") : t("chat.addMoreRecipients")}
                    className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
                  />
                </div>

                {deferredRecipientQuery && (
                  <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-gray-100 p-1 dark:border-gray-700">
                    {searchingRecipients && (
                      <p className="px-2 py-2 text-xs text-gray-400">{t("chat.searching")}</p>
                    )}
                    {!searchingRecipients && recipientResults.length === 0 && (
                      <p className="px-2 py-2 text-sm text-gray-500 dark:text-gray-400">{t("chat.noStaffMatch")}</p>
                    )}
                    {recipientResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => addRecipient(user)}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-gray-50 dark:hover:bg-gray-700/60"
                      >
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold text-white ${avatarColor(user.id)}`}>
                          {getInitials(user.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
                          <p className="truncate text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                        </div>
                        {user.online && (
                          <span className="text-[11px] font-medium text-emerald-500">{t("chat.online")}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {selectedRecipients.length >= 2 && (
                  <input
                    value={optionalGroupTitle}
                    onChange={(event) => setOptionalGroupTitle(event.target.value)}
                    placeholder={t("chat.groupTitleOptional")}
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                )}

                {selectedRecipients.length > 0 && (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedRecipients.length === 1
                        ? t("chat.privateChatHint", { name: selectedRecipients[0].name })
                        : t("chat.groupChatHint", { count: String(selectedRecipients.length) })}
                    </p>
                    <button
                      type="button"
                      onClick={() => void startSelectedConversation()}
                      disabled={creatingConversation}
                      className="shrink-0 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {creatingConversation
                        ? t("chat.openingChat")
                        : selectedRecipients.length === 1
                          ? t("chat.openPrivateChat")
                          : t("chat.createGroupAction")}
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-3 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.6-5.4a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="search"
                    value={listFilter}
                    onChange={(event) => setListFilter(event.target.value)}
                    placeholder={t("chat.filterConversations")}
                    className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {loadingConversations ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-gray-400">{t("chat.loadingConversations")}</p>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                  <svg className="h-10 w-10 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16h6m-9 5l1.4-3.7A8.96 8.96 0 013 12c0-4.97 4.03-9 9-9s9 4.03 9 9-4.03 9-9 9c-1.55 0-3.01-.39-4.3-1.08L3 21z" />
                  </svg>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t("chat.noConversations")}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredConversations.map((conversation) => {
                    const isActive = activeConversation?.id === conversation.id;
                    const unreadCount = conversation.unread_count ?? 0;
                    const directPartner = conversation.participants.find((participant) => participant.user_id !== userId);
                    const statusLabel = conversation.kind === "group"
                      ? conversationSubtitle(
                          conversation,
                          userId,
                          roleLabel,
                          t("chat.privateChat"),
                          (count) => t("chat.members", {
                            count,
                            label: locale === "it-IT"
                              ? (count === 1 ? "membro" : "membri")
                              : (count === 1 ? "member" : "members"),
                          }),
                          t("chat.online")
                        )
                      : directPartner?.online
                        ? t("chat.online")
                        : t("chat.offline");

                    return (
                      <button
                        key={conversation.id}
                        onClick={() => openConversation(conversation.id)}
                        className={`w-full rounded-3xl border px-4 py-3 text-left transition ${
                          isActive
                            ? "border-blue-500 bg-blue-50 shadow-sm dark:border-blue-400 dark:bg-blue-900/20"
                            : unreadCount > 0
                              ? "border-blue-200 bg-blue-50/70 dark:border-blue-800 dark:bg-blue-950/20"
                              : "border-transparent bg-white hover:border-gray-200 hover:bg-white dark:bg-gray-800 dark:hover:border-gray-700 dark:hover:bg-gray-700/60"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xs font-bold text-white ${avatarColor(conversation.id)}`}>
                            {conversation.kind === "group"
                              ? "GR"
                              : getInitials(directPartner?.name ?? conversation.title)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className={`truncate text-sm text-gray-900 dark:text-white ${
                                  unreadCount > 0 ? "font-bold" : "font-semibold"
                                }`}>
                                  {conversation.title}
                                </p>
                                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                  {statusLabel}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {unreadCount > 0 && (
                                    <span className="inline-flex min-w-[1.25rem] h-5 px-1.5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white tabular-nums">
                                      {unreadCount > 99 ? "99+" : unreadCount}
                                    </span>
                                  )}
                                  <p className="text-[11px] text-gray-400">
                                    {formatConversationTime(conversation.last_message_at, locale)}
                                  </p>
                                </div>
                                <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                  conversation.kind === "group"
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                }`}>
                                  {conversation.kind === "group" ? t("chat.conversationGroup") : t("chat.privateChat")}
                                </span>
                              </div>
                            </div>
                            <p className={`mt-2 truncate text-sm ${
                              unreadCount > 0
                                ? "font-medium text-gray-800 dark:text-gray-100"
                                : "text-gray-600 dark:text-gray-300"
                            }`}>
                              {conversation.last_message_preview ?? t("chat.noMessagesPreview")}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <section className={`min-h-0 flex-1 flex-col ${showListOnMobile ? "hidden md:flex" : "flex"}`}>
            <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-4 dark:border-gray-700">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  onClick={() => setShowListOnMobile(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 text-gray-500 transition hover:bg-gray-100 md:hidden dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                  aria-label={t("chat.backToConversations")}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold text-white ${
                  activeConversation ? avatarColor(activeConversation.id) : "bg-gray-400"
                }`}>
                  {activeConversation
                    ? activeConversation.kind === "group"
                      ? "GR"
                      : getInitials(activeConversation.title)
                    : "CH"}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                    {activeConversation?.title ?? t("chat.chooseConversation")}
                  </h2>
                  <p className="truncate text-sm text-gray-500 dark:text-gray-400">{activeSubtitle}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-2 lg:flex">
                  {activeConversation?.participants.slice(0, 4).map((participant) => (
                    <div
                      key={participant.user_id}
                      title={`${participant.name}${participant.online ? ` · ${t("chat.online")}` : ""}`}
                      className={`relative flex h-9 w-9 items-center justify-center rounded-2xl text-[11px] font-bold text-white ${avatarColor(participant.user_id)}`}
                    >
                      {getInitials(participant.name)}
                      {participant.online && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-gray-800" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="relative">
                  <button
                    onClick={() => setShowPicker((current) => !current)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 text-gray-500 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                    title={t("chat.changeWallpaper")}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.6-4.6a2 2 0 012.8 0L16 16m-2-2l1.6-1.6a2 2 0 012.8 0L20 14m-6-7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                  {showPicker && (
                    <WallpaperPicker
                      current={wallpaper}
                      onSelect={handleSelectWallpaper}
                      onClose={() => setShowPicker(false)}
                      saving={savingWallpaper}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden" style={wallpaperCss}>
              {hasWallpaper && (
                <div className="absolute inset-0 bg-white/35 backdrop-blur-[1px] dark:bg-slate-950/45" />
              )}

              <div className="relative z-10 flex h-full min-h-0 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                  {!activeConversation ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                      <svg className="h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h6m-8 8l1.7-4.4A8.96 8.96 0 013 12c0-4.97 4.03-9 9-9s9 4.03 9 9-4.03 9-9 9c-1.54 0-3-.39-4.3-1.08L3 20z" />
                      </svg>
                      <div>
                        <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t("chat.chooseConversation")}</p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {t("chat.startChatPrompt")}
                        </p>
                      </div>
                    </div>
                  ) : loadingMessages && messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <p className="text-sm text-gray-400">{t("chat.loadingMessages")}</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                      <div className={`flex h-16 w-16 items-center justify-center rounded-[22px] text-lg font-bold text-white ${avatarColor(activeConversation.id)}`}>
                        {activeConversation.kind === "group" ? "GR" : getInitials(activeConversation.title)}
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">{t("chat.noMessages")}</p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {t("chat.firstMessagePrompt", { title: activeConversation.title })}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((message) => {
                        const isMe = message.sender_id === userId;
                        const isAdmin = role === "OWNER" || role === "SYS_ADMIN";
                        const canDelete = isMe || isAdmin;
                        const showSenderName = activeConversation.kind === "group" && !isMe;
                        const isDeleted = Boolean(message.deleted_at);
                        const isEditing = editingMessageId === message.id;

                        return (
                          <div
                            key={message.id}
                            className={`group flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}
                            onMouseEnter={() => setHoverMessageId(message.id)}
                            onMouseLeave={() => setHoverMessageId(null)}
                          >
                            {!isMe && (
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl text-[10px] font-bold text-white ${avatarColor(message.sender_id)}`}>
                                {getInitials(message.sender_name)}
                              </div>
                            )}

                            <div className={`max-w-[82%] sm:max-w-[70%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                              {showSenderName && (
                                <span className="px-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                                  {message.sender_name}
                                </span>
                              )}

                              {isDeleted ? (
                                <div className="rounded-[24px] px-4 py-3 text-sm italic text-gray-400 dark:text-gray-500">
                                  Message deleted
                                </div>
                              ) : isEditing ? (
                                <div className="flex w-full min-w-[200px] flex-col gap-2 rounded-[24px] bg-yellow-50 px-4 py-3 shadow-sm dark:bg-yellow-900/20">
                                  <input
                                    autoFocus
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submitEdit(); }
                                      if (e.key === "Escape") cancelEdit();
                                    }}
                                    maxLength={2000}
                                    className="w-full bg-transparent text-sm text-gray-900 outline-none dark:text-white"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => void submitEdit()}
                                      disabled={savingEdit || !editContent.trim()}
                                      className="rounded-xl bg-blue-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={cancelEdit}
                                      className="rounded-xl bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-600 dark:text-gray-200"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="relative">
                                  {/* Action buttons (show on hover) */}
                                  {hoverMessageId === message.id && canDelete && (
                                    <div className={`absolute -top-8 z-10 flex gap-1 ${isMe ? "right-0" : "left-0"}`}>
                                      {isMe && (
                                        <button
                                          onClick={() => startEdit(message.id, message.content)}
                                          className="rounded-xl bg-white px-2 py-1 text-[11px] font-medium text-gray-600 shadow-md transition hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                                        >
                                          Edit
                                        </button>
                                      )}
                                      <button
                                        onClick={() => void handleDeleteMessage(message.id)}
                                        className="rounded-xl bg-white px-2 py-1 text-[11px] font-medium text-red-500 shadow-md transition hover:bg-red-50 dark:bg-gray-700 dark:hover:bg-red-900/30"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                  <div
                                    className={`rounded-[24px] px-4 py-3 text-sm leading-relaxed shadow-sm ${
                                      isMe
                                        ? "rounded-br-md bg-blue-600 text-white"
                                        : "rounded-bl-md bg-white/95 text-gray-900 dark:bg-gray-800/95 dark:text-white"
                                    }`}
                                  >
                                    {message.content}
                                    {message.edited_at && (
                                      <span className="ml-1 text-[10px] opacity-60">(edited)</span>
                                    )}
                                  </div>
                                </div>
                              )}

                              <span className={`px-1 text-[11px] text-gray-400 ${isMe ? "text-right" : "text-left"}`}>
                                {formatTime(message.created_at, locale)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={bottomRef} />
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-gray-700 dark:bg-gray-800/90">
                  {typingUsers.length > 0 && (
                    <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                      {typingUsers.length === 1
                        ? `${typingUsers[0].userName} is typing…`
                        : `${typingUsers.map((u) => u.userName).join(", ")} are typing…`}
                    </p>
                  )}
                  {!connected && (
                    <p className="mb-2 text-center text-xs font-medium text-amber-500">
                      {t("chat.reconnecting")}
                    </p>
                  )}
                  <div className="flex items-end gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl text-xs font-bold text-white ${avatarColor(userId ?? 0)}`}>
                      {getInitials(myName ?? "U")}
                    </div>
                    <div className="flex-1 rounded-[24px] border border-gray-300 bg-gray-50 px-3 py-2 focus-within:border-blue-500 dark:border-gray-600 dark:bg-gray-700">
                      <input
                        type="text"
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder={
                          activeConversation
                            ? connected
                              ? t("chat.messagePlaceholder", { title: activeConversation.title })
                              : t("chat.connecting")
                            : t("chat.chooseFirst")
                        }
                        disabled={!connected || !activeConversation}
                        maxLength={2000}
                        className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed dark:text-white"
                      />
                    </div>
                    <button
                      onClick={handleSendMessage}
                      disabled={!connected || !activeConversation || !input.trim()}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={t("chat.sendMessage")}
                    >
                      <svg className="h-4 w-4 rotate-90" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

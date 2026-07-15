"use client";

import {
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  MdCheck,
  MdClose,
  MdCloseFullscreen,
  MdDeleteOutline,
  MdEdit,
  MdHistory,
  MdOpenInFull,
  MdOpenInNew,
  MdOutlineAddComment,
  MdOutlineDock,
  MdOutlineSend,
  MdPushPin,
  MdRefresh,
  MdThumbDownOffAlt,
  MdThumbUpOffAlt,
} from "react-icons/md";
import { IconAi } from "@/components/icons";
import {
  ApiError,
  AssistantTransportError,
  agentApi,
  authApi,
  type AssistantOperation,
} from "@/lib/api";
import { recoveryCopy } from "@/lib/ai-stream-protocol";
import type {
  AgentConversation,
  AgentMessage,
  AgentMessageFeedback,
  AssistantRecovery,
  PropertySummary,
} from "@/lib/types";
import { FormattedMessage } from "@/features/ai/formatted-message";
import { PropertyCard } from "@/ui";
import {
  clampFloatingPosition,
  floatingPanelSize,
  type FloatingPosition,
} from "@/features/ai/assistant-panel-layout";

const SUGGESTIONS = [
  "Find me available stays in Calabar",
  "How does booking and payment work on Staynex?",
  "What should I check before choosing a stay?",
];

/**
 * Rotating status phrases shown while the agent works (Claude.ai-style).
 * Order matters: starts familiar, then narrates progress.
 */
const THINKING_PHRASES = [
  "Thinking",
  "Looking into it",
  "Checking verified stays",
  "Reviewing the details",
  "Putting it together",
  "Almost there",
];
const THINKING_ROTATE_MS = 2200;

type Msg = {
  id?: string;
  role: "USER" | "AGENT";
  content: string;
  feedback?: AgentMessageFeedback | null;
  properties?: PropertySummary[];
  note?: "refused" | "unavailable";
  recovery?: AssistantRecovery;
  requestId?: string;
};

type SendOptions = {
  operation?: AssistantOperation;
};

// Remembers the active conversation across reloads so the panel reopens where the
// user left off (server is the source of truth — this only stores the id).
const ACTIVE_KEY = "staynex_ai_active_conversation";

// ---------------------------------------------------------------------------
// Local session chat registry.
// The server lists conversations only for signed-in users; a guest's chats are
// capability-based (accessible by id only). This registry mirrors the guest's
// chat list in localStorage so the history drawer never "forgets" a session
// conversation. On merge the server list wins — once a chat is claimed at
// sign-in it arrives from the server and the local copy is pruned.
// ---------------------------------------------------------------------------

const LOCAL_CHATS_KEY = "staynex_ai_chats";
const LOCAL_CHATS_MAX = 20;
const PANEL_MODE_KEY = "staynex_ai_panel_mode";

type DesktopPanelMode = "docked" | "floating";

type LocalChat = {
  id: string;
  title: string | null;
  pinned: boolean;
  updatedAt: string;
  preview: string | null;
};

function readLocalChats(): LocalChat[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_CHATS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is LocalChat =>
        Boolean(c) && typeof (c as LocalChat).id === "string",
    );
  } catch {
    return [];
  }
}

function writeLocalChats(chats: LocalChat[]) {
  try {
    window.localStorage.setItem(
      LOCAL_CHATS_KEY,
      JSON.stringify(chats.slice(0, LOCAL_CHATS_MAX)),
    );
  } catch {
    /* storage unavailable (private mode / quota) — history simply won't persist */
  }
}

function upsertLocalChat(partial: {
  id: string;
  title?: string | null;
  preview?: string | null;
  pinned?: boolean;
}) {
  const chats = readLocalChats();
  const existing = chats.find((c) => c.id === partial.id);
  const merged: LocalChat = {
    id: partial.id,
    title:
      partial.title !== undefined ? partial.title : (existing?.title ?? null),
    pinned: partial.pinned ?? existing?.pinned ?? false,
    preview:
      partial.preview !== undefined
        ? partial.preview
        : (existing?.preview ?? null),
    updatedAt: new Date().toISOString(),
  };
  writeLocalChats([merged, ...chats.filter((c) => c.id !== partial.id)]);
}

function removeLocalChat(id: string) {
  writeLocalChats(readLocalChats().filter((c) => c.id !== id));
}

/** Compact "2m ago"-style timestamp for the history drawer. */
function relativeTime(iso: string): string {
  const diffMs = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diffMs)) return "";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function AssistantWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editedMessage, setEditedMessage] = useState("");
  const [feedbackBusyId, setFeedbackBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [desktopMode, setDesktopMode] = useState<DesktopPanelMode>("docked");
  const [expanded, setExpanded] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [floatingPosition, setFloatingPosition] = useState<FloatingPosition>({
    x: 32,
    y: 32,
  });

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  const identityLoadedRef = useRef(false);
  // Accumulates the streamed reply so onDone can snapshot a preview for the
  // local chat registry without racing React state updates.
  const streamedRef = useRef("");
  const busyRef = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    const storedMode = window.localStorage.getItem(PANEL_MODE_KEY);
    if (storedMode === "docked" || storedMode === "floating") {
      setDesktopMode(storedMode);
      if (storedMode === "floating") {
        const size = floatingPanelSize(
          false,
          window.innerWidth,
          window.innerHeight,
        );
        setFloatingPosition(
          clampFloatingPosition(
            {
              x: window.innerWidth - size.width - 64,
              y: 72,
            },
            size,
            window.innerWidth,
            window.innerHeight,
          ),
        );
      }
    }
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const docked = open && isDesktop && desktopMode === "docked";
    document.body.classList.toggle("staynex-ai-docked", docked);
    document.body.style.setProperty(
      "--staynex-ai-dock-width",
      expanded ? "520px" : "420px",
    );
    return () => {
      document.body.classList.remove("staynex-ai-docked");
      document.body.style.removeProperty("--staynex-ai-dock-width");
    };
  }, [desktopMode, expanded, isDesktop, open]);

  useEffect(() => {
    if (!isDesktop || desktopMode !== "floating") return;
    function keepPanelOnScreen() {
      const size = floatingPanelSize(
        expanded,
        window.innerWidth,
        window.innerHeight,
      );
      setFloatingPosition((position) =>
        clampFloatingPosition(
          position,
          size,
          window.innerWidth,
          window.innerHeight,
        ),
      );
    }
    keepPanelOnScreen();
    window.addEventListener("resize", keepPanelOnScreen);
    return () => window.removeEventListener("resize", keepPanelOnScreen);
  }, [desktopMode, expanded, isDesktop]);

  const refreshConversations = useCallback(async () => {
    let server: AgentConversation[] = [];
    try {
      server = await agentApi.listConversations();
    } catch {
      server = [];
    }
    const serverIds = new Set(server.map((c) => c.id));
    // Prune local copies the server now owns (claimed at sign-in), then merge
    // the remaining session chats after the server list (which is pinned-first).
    const all = readLocalChats();
    const locals = all.filter((c) => !serverIds.has(c.id));
    if (locals.length !== all.length) writeLocalChats(locals);
    locals.sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
    );
    setConversations([
      ...server,
      ...locals.map((c) => ({
        id: c.id,
        title: c.title,
        pinned: c.pinned,
        updatedAt: c.updatedAt,
        preview: c.preview,
      })),
    ]);
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      void refreshConversations();
      if (!identityLoadedRef.current) {
        identityLoadedRef.current = true;
        void authApi
          .me()
          .then((user) => setFirstName(safeFirstName(user?.name)))
          .catch(() => setFirstName(null));
      }
    }
  }, [open, refreshConversations]);

  // Persist the active id only when set, so a closed panel (activeId null on
  // mount) never wipes a stored id before the restore effect can read it.
  // Clearing is explicit in newChat() and the failed-restore path.
  useEffect(() => {
    if (activeId) window.localStorage.setItem(ACTIVE_KEY, activeId);
  }, [activeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  // Match Gemini-in-Chrome continuity: keep the panel open across Staynex pages,
  // but dismiss transient history chrome after navigation.
  useEffect(() => {
    setHistoryOpen(false);
  }, [pathname]);

  // Escape closes the drawer first, then the panel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setHistoryOpen((h) => {
        if (!h) setOpen(false);
        return false;
      });
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function resetInput() {
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }

  // Append a text delta to the in-flight agent message (created on first chunk).
  function appendToAgent(text: string) {
    streamedRef.current += text;
    setMessages((m) => {
      const copy = [...m];
      const last = copy[copy.length - 1];
      if (last && last.role === "AGENT") {
        copy[copy.length - 1] = { ...last, content: last.content + text };
      } else {
        copy.push({ role: "AGENT", content: text });
      }
      return copy;
    });
  }

  async function sendMessage(text: string, options: SendOptions = {}) {
    const message = text.trim();
    const operation = options.operation;
    if (!message || busyRef.current || (operation && !activeId)) return;
    busyRef.current = true;
    const startedNew = !activeId;
    resetInput();
    setEditingMessageId(null);
    if (!operation) {
      setMessages((current) => [
        ...current,
        { role: "USER", content: message },
      ]);
    } else if (operation.type === "retry") {
      const assistantMessageId = operation.assistantMessageId;
      setMessages((current) =>
        current.filter((item) => item.id !== assistantMessageId),
      );
    } else {
      const userMessageId = operation.userMessageId;
      setMessages((current) => {
        const userIndex = current.findIndex(
          (item) => item.id === userMessageId,
        );
        if (userIndex < 0) return current;
        return current
          .slice(0, userIndex + 1)
          .map((item, index) =>
            index === userIndex ? { ...item, content: message } : item,
          );
      });
    }
    setBusy(true);
    streamedRef.current = "";
    try {
      const slug = pathname.match(/^\/stays\/([^/?#]+)/)?.[1];
      await agentApi.askStream(
        {
          message,
          conversationId: activeId ?? undefined,
          pagePath: pathname,
          ...(slug ? { propertySlug: decodeURIComponent(slug) } : {}),
          ...(operation ? { operation } : {}),
        },
        {
          onChunk: (t) => appendToAgent(t),
          onDone: (meta) => {
            if (meta.conversationId) {
              setActiveId(meta.conversationId);
              // Mirror into the session registry so guests keep their chat list.
              upsertLocalChat({
                id: meta.conversationId,
                ...(startedNew
                  ? { title: message.replace(/\s+/g, " ").slice(0, 60) }
                  : {}),
                ...(streamedRef.current
                  ? { preview: streamedRef.current.slice(0, 100) }
                  : {}),
              });
            }
            const note = meta.refused
              ? "refused"
              : meta.unavailable
                ? "unavailable"
                : undefined;
            setMessages((current) => {
              const copy = [...current];
              const agentIndex = lastIndexWhere(
                copy,
                (item) => item.role === "AGENT",
              );
              const userIndex = lastIndexWhere(
                copy,
                (item, index) => item.role === "USER" && index < agentIndex,
              );
              if (userIndex >= 0 && meta.userMessageId) {
                copy[userIndex] = {
                  ...copy[userIndex],
                  id: meta.userMessageId,
                };
              }
              if (agentIndex >= 0) {
                copy[agentIndex] = {
                  ...copy[agentIndex],
                  id: meta.messageId || copy[agentIndex].id,
                  note,
                  feedback: null,
                  properties: meta.properties,
                  recovery: meta.recovery,
                  requestId: meta.requestId,
                };
              }
              return copy;
            });
            void refreshConversations();
          },
        },
      );
    } catch (err) {
      if (operation && activeId) {
        const restored = await agentApi.messages(activeId).catch(() => null);
        if (restored) {
          setMessages(restored.map(toMessageState));
          return;
        }
      }
      const applicationThrottled =
        err instanceof ApiError && err.code === "AI_APPLICATION_THROTTLED";
      const recovery: AssistantRecovery = applicationThrottled
        ? "application_throttled"
        : err instanceof AssistantTransportError
          ? err.recovery
          : err instanceof ApiError && err.recovery
            ? err.recovery
            : "transport_interrupted";
      const requestId =
        err instanceof AssistantTransportError || err instanceof ApiError
          ? (err.requestId ?? undefined)
          : undefined;
      const content = recoveryCopy(recovery);
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        // Mark a partially-streamed reply, else add a fresh notice.
        if (last && last.role === "AGENT" && last.content.length > 0) {
          copy[copy.length - 1] = {
            ...last,
            note: "unavailable",
            recovery,
            requestId,
          };
          return copy;
        }
        return [
          ...copy,
          { role: "AGENT", content, note: "unavailable", recovery, requestId },
        ];
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function setFeedback(message: Msg, requested: AgentMessageFeedback) {
    if (!activeId || !message.id || feedbackBusyId) return;
    const previous = message.feedback ?? null;
    const next = previous === requested ? null : requested;
    setFeedbackBusyId(message.id);
    setMessages((current) =>
      current.map((item) =>
        item.id === message.id ? { ...item, feedback: next } : item,
      ),
    );
    try {
      await agentApi.setFeedback(activeId, message.id, next);
    } catch {
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id ? { ...item, feedback: previous } : item,
        ),
      );
    } finally {
      setFeedbackBusyId(null);
    }
  }

  function regenerate(message: Msg) {
    if (!message.id || busyRef.current) return;
    const agentIndex = messages.findIndex((item) => item.id === message.id);
    const userMessage = [...messages.slice(0, agentIndex)]
      .reverse()
      .find((item) => item.role === "USER");
    if (!userMessage) return;
    void sendMessage(userMessage.content, {
      operation: {
        type: "retry",
        assistantMessageId: message.id,
      },
    });
  }

  function beginMessageEdit(message: Msg) {
    if (!message.id || busyRef.current) return;
    setEditingMessageId(message.id);
    setEditedMessage(message.content);
  }

  function saveMessageEdit(message: Msg) {
    if (!message.id) return;
    void sendMessage(editedMessage, {
      operation: { type: "edit", userMessageId: message.id },
    });
  }

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setEditingMessageId(null);
    setHistoryOpen(false);
    window.localStorage.removeItem(ACTIVE_KEY);
    inputRef.current?.focus();
  }

  const openConversation = useCallback(async (id: string) => {
    setHistoryOpen(false);
    try {
      const msgs: AgentMessage[] = await agentApi.messages(id);
      setActiveId(id);
      setMessages(msgs.map(toMessageState));
      setEditingMessageId(null);
    } catch {
      // Stored/clicked conversation is gone or no longer ours — reset cleanly.
      removeLocalChat(id);
      setActiveId(null);
      setMessages([]);
      window.localStorage.removeItem(ACTIVE_KEY);
    }
  }, []);

  // Restore the last conversation the first time the panel opens this session.
  useEffect(() => {
    if (!open || restoredRef.current) return;
    restoredRef.current = true;
    const stored = window.localStorage.getItem(ACTIVE_KEY);
    if (stored) void openConversation(stored);
  }, [open, openConversation]);

  async function togglePin(c: AgentConversation) {
    await agentApi.setPinned(c.id, !c.pinned).catch(() => {});
    upsertLocalChat({ id: c.id, pinned: !c.pinned });
    void refreshConversations();
  }

  async function saveRename(id: string) {
    const title = editTitle.trim();
    setEditingId(null);
    if (title) {
      await agentApi.rename(id, title).catch(() => {});
      upsertLocalChat({ id, title });
    }
    void refreshConversations();
  }

  async function remove(id: string) {
    setConfirmDeleteId(null);
    await agentApi.remove(id).catch(() => {});
    removeLocalChat(id);
    if (activeId === id) newChat();
    void refreshConversations();
  }

  function setPanelMode(mode: DesktopPanelMode) {
    setDesktopMode(mode);
    window.localStorage.setItem(PANEL_MODE_KEY, mode);
    if (mode === "floating") {
      const size = floatingPanelSize(
        expanded,
        window.innerWidth,
        window.innerHeight,
      );
      setFloatingPosition(
        clampFloatingPosition(
          {
            x: window.innerWidth - size.width - 64,
            y: 72,
          },
          size,
          window.innerWidth,
          window.innerHeight,
        ),
      );
    }
  }

  function toggleExpanded() {
    setExpanded((value) => {
      const next = !value;
      if (desktopMode === "floating") {
        const size = floatingPanelSize(
          next,
          window.innerWidth,
          window.innerHeight,
        );
        setFloatingPosition((position) =>
          clampFloatingPosition(
            position,
            size,
            window.innerWidth,
            window.innerHeight,
          ),
        );
      }
      return next;
    });
  }

  function startDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!isDesktop || desktopMode !== "floating") return;
    if ((event.target as HTMLElement).closest("button")) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: floatingPosition.x,
      originY: floatingPosition.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePanel(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || !panel || drag.pointerId !== event.pointerId) return;
    const rect = panel.getBoundingClientRect();
    setFloatingPosition({
      x: Math.min(
        Math.max(12, drag.originX + event.clientX - drag.startX),
        Math.max(12, window.innerWidth - rect.width - 12),
      ),
      y: Math.min(
        Math.max(12, drag.originY + event.clientY - drag.startY),
        Math.max(12, window.innerHeight - rect.height - 12),
      ),
    });
  }

  function stopDrag(event: ReactPointerEvent<HTMLElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const floatingStyle: CSSProperties | undefined =
    isDesktop && desktopMode === "floating"
      ? { left: floatingPosition.x, top: floatingPosition.y }
      : undefined;

  const desktopPanelClass =
    desktopMode === "docked"
      ? expanded
        ? "md:inset-y-0 md:right-0 md:h-dvh md:w-[520px] md:rounded-none md:border-l md:border-border"
        : "md:inset-y-0 md:right-0 md:h-dvh md:w-[420px] md:rounded-none md:border-l md:border-border"
      : expanded
        ? "md:h-[min(800px,calc(100dvh-32px))] md:w-[min(760px,calc(100vw-32px))] md:rounded-lg md:border md:border-border"
        : "md:h-[min(600px,calc(100dvh-32px))] md:w-[min(440px,calc(100vw-32px))] md:rounded-lg md:border md:border-border";

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls="staynex-ai-panel"
          aria-label="Open Staynex AI"
          className="fixed bottom-4 right-4 z-[var(--z-drawer)] inline-flex min-h-12 animate-scale-in items-center rounded-full border border-primary/10 bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span>Ask Staynex AI</span>
        </button>
      )}

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[var(--z-overlay)] animate-fade-in bg-black/20 md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          {/* Panel */}
          <div
            ref={panelRef}
            id="staynex-ai-panel"
            role="dialog"
            aria-modal={!isDesktop}
            aria-label="Staynex AI"
            data-mode={isDesktop ? desktopMode : "mobile"}
            data-expanded={expanded}
            style={floatingStyle}
            className={`staynex-ai-panel fixed inset-0 z-[var(--z-modal)] flex h-[100dvh] max-h-[100dvh] animate-slide-up flex-col overflow-hidden bg-surface-raised shadow-xl md:inset-auto md:max-h-none md:animate-scale-in ${desktopPanelClass}`}
          >
            {/* Header */}
            <header
              onPointerDown={startDrag}
              onPointerMove={movePanel}
              onPointerUp={stopDrag}
              onPointerCancel={stopDrag}
              className={`flex h-14 shrink-0 touch-none select-none items-center justify-between gap-2 border-b border-border/80 px-3 min-[380px]:px-4 ${desktopMode === "floating" ? "md:cursor-move" : ""}`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
                  <IconAi className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-tight text-ink">
                    Staynex AI
                  </p>
                  <p className="hidden text-2xs text-muted-foreground min-[360px]:block">
                    Verified-stay guidance
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setHistoryOpen((v) => !v)}
                  aria-label="Open chat history"
                  aria-expanded={historyOpen}
                  aria-controls="staynex-ai-history"
                  className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MdHistory className="size-[18px]" aria-hidden />
                  Chats
                </button>
                <IconButton label="New chat" onClick={newChat}>
                  <MdOutlineAddComment className="size-[18px]" />
                </IconButton>
                <span className="hidden md:contents">
                  <IconButton
                    label={expanded ? "Restore panel size" : "Expand panel"}
                    onClick={toggleExpanded}
                  >
                    {expanded ? (
                      <MdCloseFullscreen className="size-[18px]" />
                    ) : (
                      <MdOpenInFull className="size-[18px]" />
                    )}
                  </IconButton>
                  <IconButton
                    label={
                      desktopMode === "docked"
                        ? "Pop out assistant"
                        : "Dock assistant to the right"
                    }
                    onClick={() =>
                      setPanelMode(
                        desktopMode === "docked" ? "floating" : "docked",
                      )
                    }
                  >
                    {desktopMode === "docked" ? (
                      <MdOpenInNew className="size-[19px]" />
                    ) : (
                      <MdOutlineDock className="size-[19px]" />
                    )}
                  </IconButton>
                </span>
                <IconButton
                  label="Close Staynex AI"
                  onClick={() => setOpen(false)}
                  emphasis
                >
                  <MdClose className="size-5" />
                </IconButton>
              </div>
            </header>

            {/* Body — the history drawer slides over the conversation, not instead of it */}
            <div className="relative flex min-h-0 flex-1 flex-col">
              {/* Message feed */}
              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-5">
                {messages.length === 0 ? (
                  <div className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center py-8 md:py-10">
                    <div className="space-y-1">
                      <p className="text-xl font-medium tracking-tight text-primary md:text-2xl">
                        {firstName ? `Hello, ${firstName}.` : "Hello."}
                      </p>
                      <h3 className="text-xl font-regular tracking-tight text-ink md:text-2xl">
                        How can I help you today?
                      </h3>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-2">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => void sendMessage(s)}
                          className="inline-flex min-h-10 items-center gap-2 rounded-md bg-secondary px-3.5 py-2 text-left text-sm text-ink transition-colors hover:bg-primary-subtle hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <IconAi className="size-4 shrink-0 text-primary" />
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((t, i) => {
                    const streaming =
                      busy && i === messages.length - 1 && t.role === "AGENT";
                    const lastAgentIndex = lastIndexWhere(
                      messages,
                      (message) => message.role === "AGENT",
                    );
                    const lastUserIndex = lastIndexWhere(
                      messages,
                      (message) => message.role === "USER",
                    );
                    const canRegenerate =
                      t.role === "AGENT" &&
                      i === lastAgentIndex &&
                      Boolean(t.id) &&
                      !busy;
                    const canEdit =
                      t.role === "USER" &&
                      i === lastUserIndex &&
                      lastAgentIndex > i &&
                      Boolean(t.id) &&
                      !busy;
                    return (
                      <div
                        key={t.id ?? `${t.role}-${i}`}
                        className={
                          t.role === "USER"
                            ? "flex animate-slide-up justify-end"
                            : "flex animate-slide-up justify-start"
                        }
                      >
                        {t.role === "USER" ? (
                          <div className="flex max-w-[88%] flex-col items-end gap-1">
                            {editingMessageId === t.id ? (
                              <div className="w-full min-w-[min(18rem,78vw)] rounded-lg border border-primary/30 bg-background p-2 shadow-sm">
                                <textarea
                                  autoFocus
                                  rows={3}
                                  value={editedMessage}
                                  onChange={(event) =>
                                    setEditedMessage(event.target.value)
                                  }
                                  aria-label="Edit your message"
                                  className="w-full resize-none bg-transparent px-1 py-1 text-sm leading-relaxed text-ink outline-none"
                                />
                                <div className="mt-1 flex justify-end gap-1">
                                  <MessageActionButton
                                    label="Cancel editing"
                                    onClick={() => setEditingMessageId(null)}
                                  >
                                    <MdClose className="size-[18px]" />
                                  </MessageActionButton>
                                  <MessageActionButton
                                    label="Save and resend message"
                                    disabled={!editedMessage.trim()}
                                    onClick={() => saveMessageEdit(t)}
                                  >
                                    <MdCheck className="size-[18px]" />
                                  </MessageActionButton>
                                </div>
                              </div>
                            ) : (
                              <div className="whitespace-pre-wrap rounded-lg rounded-br-md bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground">
                                {t.content}
                              </div>
                            )}
                            {canEdit && editingMessageId !== t.id && (
                              <MessageActionButton
                                label="Edit message"
                                onClick={() => beginMessageEdit(t)}
                              >
                                <MdEdit className="size-[17px]" />
                              </MessageActionButton>
                            )}
                          </div>
                        ) : (
                          <div className="w-full max-w-[92%]">
                            <div
                              className={`w-fit max-w-full rounded-lg rounded-bl-md px-3.5 py-2.5 text-sm leading-relaxed ${
                                t.note === "refused"
                                  ? "border border-warning-border bg-warning-surface text-warning"
                                  : t.note === "unavailable"
                                    ? "border border-border bg-secondary text-muted-foreground"
                                    : "bg-secondary text-ink"
                              }`}
                            >
                              <FormattedMessage
                                content={t.content}
                                onNavigate={() => setOpen(false)}
                              />
                              {streaming && (
                                <span
                                  className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse-soft rounded-full bg-primary align-[-2px]"
                                  aria-hidden
                                />
                              )}
                              {t.recovery && t.recovery !== "none" && (
                                <RecoveryNotice
                                  recovery={t.recovery}
                                  requestId={t.requestId}
                                />
                              )}
                            </div>

                            {t.properties && t.properties.length > 0 && (
                              <div
                                className="mt-2.5 grid gap-2.5"
                                aria-label="Verified stays from this answer"
                              >
                                {t.properties.map((property) => (
                                  <PropertyCard
                                    key={property.id}
                                    property={property}
                                    href={`/stays/${property.slug}`}
                                    variant="assistant"
                                  />
                                ))}
                              </div>
                            )}

                            {!streaming && t.id && (
                              <div
                                className="mt-1 flex items-center gap-0.5"
                                aria-label="Message actions"
                              >
                                <MessageActionButton
                                  label={
                                    t.feedback === "UP"
                                      ? "Remove positive feedback"
                                      : "Helpful response"
                                  }
                                  active={t.feedback === "UP"}
                                  disabled={feedbackBusyId === t.id}
                                  onClick={() => void setFeedback(t, "UP")}
                                >
                                  <MdThumbUpOffAlt className="size-[17px]" />
                                </MessageActionButton>
                                <MessageActionButton
                                  label={
                                    t.feedback === "DOWN"
                                      ? "Remove negative feedback"
                                      : "Unhelpful response"
                                  }
                                  active={t.feedback === "DOWN"}
                                  disabled={feedbackBusyId === t.id}
                                  onClick={() => void setFeedback(t, "DOWN")}
                                >
                                  <MdThumbDownOffAlt className="size-[17px]" />
                                </MessageActionButton>
                                {canRegenerate && (
                                  <MessageActionButton
                                    label="Regenerate response"
                                    onClick={() => regenerate(t)}
                                  >
                                    <MdRefresh className="size-[18px]" />
                                  </MessageActionButton>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                {busy && messages[messages.length - 1]?.role === "USER" && (
                  <ThinkingIndicator />
                )}
                <div ref={endRef} />
              </div>

              {/* Composer */}
              <div className="shrink-0 bg-surface-raised px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:px-4">
                <form
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    void sendMessage(input);
                  }}
                  className="mx-auto max-w-2xl rounded-lg border border-border bg-background/95 shadow-sm transition-all focus-within:border-primary/35 focus-within:shadow-md"
                >
                  <div className="flex items-end gap-2 p-2.5">
                    <textarea
                      ref={inputRef}
                      value={input}
                      rows={1}
                      onChange={(e) => {
                        setInput(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = `${e.target.scrollHeight}px`;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void sendMessage(input);
                        }
                      }}
                      placeholder="Message Staynex AI"
                      aria-label="Message Staynex AI"
                      className="max-h-40 min-h-[48px] flex-1 resize-none overflow-y-auto bg-transparent px-2.5 py-2.5 text-base leading-6 text-ink outline-none placeholder:text-muted-foreground md:text-sm"
                    />
                    <button
                      type="submit"
                      aria-label="Send message"
                      disabled={busy || !input.trim()}
                      className="mb-0.5 mr-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground"
                    >
                      <MdOutlineSend className="size-[18px]" aria-hidden />
                    </button>
                  </div>
                </form>
                {/* Persistent transparency line — under the input, not atop the panel. */}
                <p className="mt-2 px-2 text-center text-2xs text-muted-foreground">
                  Staynex uses security in depth. AI can make mistakes — confirm
                  live availability and prices on the property page.
                </p>
              </div>

              {/* History drawer */}
              {historyOpen && (
                <>
                  <div
                    className="absolute inset-0 z-10 animate-fade-in bg-black/20"
                    onClick={() => setHistoryOpen(false)}
                    aria-hidden
                  />
                  <div
                    id="staynex-ai-history"
                    role="dialog"
                    aria-label="Chat history"
                    className="absolute inset-y-0 left-0 z-20 flex w-[88%] max-w-[340px] animate-slide-in-left flex-col border-r border-border bg-surface-raised shadow-xl md:rounded-r-lg"
                  >
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <p className="font-semibold text-ink">Chats</p>
                      <IconButton
                        label="Close chat history"
                        onClick={() => setHistoryOpen(false)}
                      >
                        <MdClose className="size-5" />
                      </IconButton>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3">
                      <button
                        type="button"
                        onClick={newChat}
                        className="mb-3 flex w-full items-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:border-primary/30 hover:bg-secondary"
                      >
                        <MdOutlineAddComment className="size-[18px]" /> New chat
                      </button>
                      {conversations.length === 0 ? (
                        <div className="space-y-1.5 px-1 py-8 text-center">
                          <p className="text-sm font-medium text-ink">
                            No conversations yet
                          </p>
                          <p className="text-caption leading-relaxed text-muted-foreground">
                            Your chats will appear here. Sign in to keep them
                            across devices.
                          </p>
                        </div>
                      ) : (
                        <ul className="space-y-0.5">
                          {conversations.map((c) => (
                            <li
                              key={c.id}
                              className="group rounded-lg transition-colors hover:bg-secondary"
                            >
                              {editingId === c.id ? (
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    void saveRename(c.id);
                                  }}
                                  className="flex gap-1 p-1.5"
                                >
                                  <input
                                    autoFocus
                                    value={editTitle}
                                    onChange={(e) =>
                                      setEditTitle(e.target.value)
                                    }
                                    aria-label="Chat name"
                                    className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm"
                                  />
                                  <IconButton label="Save name" type="submit">
                                    <MdCheck className="size-[18px]" />
                                  </IconButton>
                                </form>
                              ) : (
                                <div className="flex items-center gap-0.5 p-1.5">
                                  <button
                                    type="button"
                                    onClick={() => void openConversation(c.id)}
                                    className="min-w-0 flex-1 rounded-md px-1.5 py-1 text-left"
                                  >
                                    <span className="flex items-baseline gap-1.5">
                                      {c.pinned && (
                                        <span
                                          className="shrink-0 text-primary"
                                          aria-label="Pinned"
                                        >
                                          <MdPushPin className="size-3" />
                                        </span>
                                      )}
                                      <span
                                        className={`truncate text-sm ${
                                          activeId === c.id
                                            ? "font-semibold text-primary"
                                            : "font-medium text-ink"
                                        }`}
                                      >
                                        {c.title ?? "New chat"}
                                      </span>
                                      <span className="ml-auto shrink-0 text-caption text-muted-foreground">
                                        {relativeTime(c.updatedAt)}
                                      </span>
                                    </span>
                                    {c.preview && (
                                      <span className="mt-0.5 block truncate text-caption text-muted-foreground">
                                        {c.preview}
                                      </span>
                                    )}
                                  </button>
                                  {confirmDeleteId === c.id ? (
                                    <span className="flex shrink-0 items-center gap-0.5">
                                      <span className="text-caption font-medium text-error">
                                        Delete?
                                      </span>
                                      <IconButton
                                        label="Confirm delete"
                                        onClick={() => void remove(c.id)}
                                      >
                                        <MdCheck className="size-[18px]" />
                                      </IconButton>
                                      <IconButton
                                        label="Cancel delete"
                                        onClick={() => setConfirmDeleteId(null)}
                                      >
                                        <MdClose className="size-[18px]" />
                                      </IconButton>
                                    </span>
                                  ) : (
                                    <span className="flex shrink-0 items-center gap-0.5">
                                      <IconButton
                                        label={
                                          c.pinned ? "Unpin chat" : "Pin chat"
                                        }
                                        onClick={() => void togglePin(c)}
                                      >
                                        <MdPushPin
                                          className={`size-[18px] ${c.pinned ? "text-primary" : ""}`}
                                        />
                                      </IconButton>
                                      <IconButton
                                        label="Rename chat"
                                        onClick={() => {
                                          setEditingId(c.id);
                                          setEditTitle(c.title ?? "");
                                        }}
                                      >
                                        <MdEdit className="size-[18px]" />
                                      </IconButton>
                                      <IconButton
                                        label="Delete chat"
                                        onClick={() => setConfirmDeleteId(c.id)}
                                      >
                                        <MdDeleteOutline className="size-[18px]" />
                                      </IconButton>
                                    </span>
                                  )}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function RecoveryNotice({
  recovery,
  requestId,
}: {
  recovery: AssistantRecovery;
  requestId?: string;
}) {
  const labels: Partial<Record<AssistantRecovery, string>> = {
    application_throttled: "Staynex message limit reached",
    provider_rate_limited: "Model quota busy — Staynex limit not reached",
    provider_overloaded: "Model temporarily overloaded",
    provider_timeout: "Model response timed out",
    provider_unconfigured: "AI model temporarily offline",
    provider_error: "AI model connection unavailable",
    partial_response: "Partial response — verify details",
    transport_interrupted: "Browser connection interrupted",
  };
  const reference = requestId ? requestId.slice(-8) : null;

  return (
    <div
      role="status"
      className="mt-2 border-t border-current/15 pt-2 text-[11px] font-medium leading-4"
    >
      <span>{labels[recovery] ?? "Recovery needed"}</span>
      {reference && (
        <span
          className="ml-1 opacity-70"
          title={`Support reference ${requestId}`}
        >
          · Ref {reference}
        </span>
      )}
    </div>
  );
}

/**
 * "Working" bubble with a rotating status word and soft bouncing dots.
 * The rotating text is aria-hidden; screen readers get one stable
 * announcement via role="status".
 */
function ThinkingIndicator() {
  const [phrase, setPhrase] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => setPhrase((v) => (v + 1) % THINKING_PHRASES.length),
      THINKING_ROTATE_MS,
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex justify-start" role="status">
      <span className="sr-only">Staynex AI is thinking</span>
      <p
        aria-hidden
        className="flex items-center gap-2 rounded-lg rounded-bl-sm bg-secondary px-3 py-2 text-sm text-muted-foreground"
      >
        <span key={phrase} className="animate-fade-in">
          {THINKING_PHRASES[phrase]}
        </span>
        <span className="thinking-dots">
          <i />
          <i />
          <i />
        </span>
      </p>
    </div>
  );
}

function lastIndexWhere<T>(
  items: T[],
  predicate: (item: T, index: number) => boolean,
): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index], index)) return index;
  }
  return -1;
}

function toMessageState(message: AgentMessage): Msg {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    feedback: message.feedback,
    properties: message.properties,
  };
}

function safeFirstName(name: string | null | undefined): string | null {
  const normalized = name?.normalize("NFKC").trim();
  if (!normalized) return null;
  const first = normalized.split(/\s+/)[0]?.replace(/[^\p{L}'-]/gu, "");
  return first && first.length <= 40 ? first : null;
}

function MessageActionButton({
  label,
  onClick,
  active,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-8 place-items-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 ${
        active
          ? "bg-primary-subtle text-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function IconButton({
  label,
  onClick,
  type = "button",
  emphasis = false,
  children,
}: {
  label: string;
  onClick?: () => void;
  type?: "button" | "submit";
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid size-9 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        emphasis
          ? "bg-secondary text-ink hover:bg-primary-subtle hover:text-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

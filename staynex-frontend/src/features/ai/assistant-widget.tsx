"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ApiError, agentApi } from "@/lib/api";
import type { AgentConversation, AgentMessage } from "@/lib/types";
import { FormattedMessage } from "@/features/ai/formatted-message";

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

type Msg = { role: "USER" | "AGENT"; content: string; note?: "refused" | "unavailable" };

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
      (c): c is LocalChat => Boolean(c) && typeof (c as LocalChat).id === "string",
    );
  } catch {
    return [];
  }
}

function writeLocalChats(chats: LocalChat[]) {
  try {
    window.localStorage.setItem(LOCAL_CHATS_KEY, JSON.stringify(chats.slice(0, LOCAL_CHATS_MAX)));
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
    title: partial.title !== undefined ? partial.title : (existing?.title ?? null),
    pinned: partial.pinned ?? existing?.pinned ?? false,
    preview: partial.preview !== undefined ? partial.preview : (existing?.preview ?? null),
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
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  // Accumulates the streamed reply so onDone can snapshot a preview for the
  // local chat registry without racing React state updates.
  const streamedRef = useRef("");

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
        Number(b.pinned) - Number(a.pinned) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
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

  async function sendMessage(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    const startedNew = !activeId;
    resetInput();
    setMessages((m) => [...m, { role: "USER", content: message }]);
    setBusy(true);
    streamedRef.current = "";
    try {
      const slug = pathname.match(/^\/stays\/([^/?#]+)/)?.[1];
      await agentApi.askStream(
        {
          message,
          conversationId: activeId ?? undefined,
          ...(slug ? { propertySlug: decodeURIComponent(slug) } : {}),
        },
        {
          onChunk: (t) => appendToAgent(t),
          onDone: (meta) => {
            if (meta.conversationId) {
              setActiveId(meta.conversationId);
              // Mirror into the session registry so guests keep their chat list.
              upsertLocalChat({
                id: meta.conversationId,
                ...(startedNew ? { title: message.replace(/\s+/g, " ").slice(0, 60) } : {}),
                ...(streamedRef.current ? { preview: streamedRef.current.slice(0, 100) } : {}),
              });
            }
            // Tag the just-streamed agent message with its final state, if any.
            const note = meta.refused ? "refused" : meta.unavailable ? "unavailable" : undefined;
            if (note) {
              setMessages((m) => {
                const copy = [...m];
                const last = copy[copy.length - 1];
                if (last && last.role === "AGENT") copy[copy.length - 1] = { ...last, note };
                return copy;
              });
            }
            void refreshConversations();
          },
        },
      );
    } catch (err) {
      const rateLimited = err instanceof ApiError && err.status === 429;
      const content = rateLimited
        ? "You're sending messages quickly — please wait a few seconds and try again."
        : "Staynex AI is unavailable right now. You can still search and book directly.";
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        // Mark a partially-streamed reply, else add a fresh notice.
        if (last && last.role === "AGENT" && last.content.length > 0) {
          copy[copy.length - 1] = { ...last, note: "unavailable" };
          return copy;
        }
        return [...copy, { role: "AGENT", content, note: "unavailable" }];
      });
    } finally {
      setBusy(false);
    }
  }

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setHistoryOpen(false);
    window.localStorage.removeItem(ACTIVE_KEY);
    inputRef.current?.focus();
  }

  const openConversation = useCallback(async (id: string) => {
    setHistoryOpen(false);
    try {
      const msgs: AgentMessage[] = await agentApi.messages(id);
      setActiveId(id);
      setMessages(msgs.map((m) => ({ role: m.role, content: m.content })));
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

  return (
    <>
      {/* FAB trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="staynex-ai-panel"
        className="fixed bottom-4 right-4 z-40 inline-flex h-11 animate-scale-in items-center gap-2 whitespace-nowrap rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary-hover"
      >
        <SparkIcon />
        {open ? "Close" : "Staynex AI"}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 animate-fade-in bg-black/20"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          {/* Panel */}
          <div
            id="staynex-ai-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Staynex AI"
            className="fixed inset-0 z-50 flex animate-slide-up flex-col bg-surface-raised sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[420px] sm:animate-slide-in-right sm:border-l sm:border-border sm:shadow-xl"
          >
            {/* Header */}
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <SparkIcon />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold leading-tight text-ink">Staynex AI</p>
                  <p className="text-caption text-muted-foreground">Helps you find &amp; book stays</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {/* Labeled — the drawer must be discoverable, not hidden behind an icon */}
                <button
                  type="button"
                  onClick={() => setHistoryOpen((v) => !v)}
                  aria-expanded={historyOpen}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <HistoryIcon />
                  Chats
                </button>
                <IconButton label="New chat" onClick={newChat}>
                  <PlusIcon />
                </IconButton>
                {/* Close button — prominent, always visible */}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close Staynex AI"
                  title="Close"
                  className="ml-1 grid size-8 place-items-center rounded-lg bg-secondary text-ink transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <CloseIcon />
                </button>
              </div>
            </header>

            {/* Body — the history drawer slides over the conversation, not instead of it */}
            <div className="relative flex min-h-0 flex-1 flex-col">
              {/* Message feed */}
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messages.length === 0 ? (
                  <div className="space-y-6 pt-1">
                    <div className="space-y-2.5">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <SparkIcon />
                      </span>
                      <h3 className="text-base font-semibold text-ink">
                        Hi, I&apos;m Staynex AI
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        I can help you find verified stays and walk you through booking. I&apos;m an
                        AI assistant, not a person — I can&apos;t confirm payments, promise
                        availability, or handle refunds.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-overline text-muted-foreground">Try asking</p>
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => void sendMessage(s)}
                          className="block w-full rounded-xl border border-border px-3 py-2.5 text-left text-sm text-ink transition-colors hover:border-primary/30 hover:bg-secondary"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((t, i) => {
                    const streaming = busy && i === messages.length - 1 && t.role === "AGENT";
                    return (
                      <div
                        key={i}
                        className={
                          t.role === "USER"
                            ? "flex animate-slide-up justify-end"
                            : "flex animate-slide-up justify-start"
                        }
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                            t.role === "USER"
                              ? "whitespace-pre-wrap rounded-br-sm bg-primary text-primary-foreground"
                              : t.note === "refused"
                                ? "rounded-bl-sm border border-warning-border bg-warning-surface text-warning"
                                : t.note === "unavailable"
                                  ? "rounded-bl-sm border border-border bg-secondary text-muted-foreground"
                                  : "rounded-bl-sm bg-secondary text-ink"
                          }`}
                        >
                          {t.role === "USER" ? (
                            t.content
                          ) : (
                            <FormattedMessage content={t.content} onNavigate={() => setOpen(false)} />
                          )}
                          {streaming && (
                            <span
                              className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse-soft rounded-full bg-primary align-[-2px]"
                              aria-hidden
                            />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                {busy && messages[messages.length - 1]?.role === "USER" && <ThinkingIndicator />}
                <div ref={endRef} />
              </div>

              {/* Composer */}
              <div className="border-t border-border px-3 py-3">
                <form
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    void sendMessage(input);
                  }}
                  className="rounded-[28px] border border-border bg-background/95 shadow-[0_10px_30px_rgba(15,23,42,0.08)] transition-colors focus-within:border-primary/35"
                >
                  <div className="flex items-end gap-2 p-2">
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
                      className="max-h-40 min-h-[52px] flex-1 resize-none overflow-y-auto bg-transparent px-3 py-3 text-sm leading-6 text-ink outline-none placeholder:text-muted-foreground"
                    />
                    <button
                      type="submit"
                      aria-label="Send message"
                      disabled={busy || !input.trim()}
                      className="mb-1 mr-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground"
                    >
                      <ArrowUpIcon />
                    </button>
                  </div>
                </form>
                {/* Persistent transparency line — under the input, not atop the panel. */}
                <p className="mt-2 px-2 text-center text-caption text-muted-foreground">
                  Staynex AI can make mistakes — confirm availability and prices on the
                  property page.
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
                    role="dialog"
                    aria-label="Chat history"
                    className="absolute inset-y-0 left-0 z-20 flex w-[88%] max-w-[340px] animate-slide-in-left flex-col border-r border-border bg-surface-raised shadow-xl"
                  >
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <p className="font-semibold text-ink">Chats</p>
                      <IconButton label="Close chat history" onClick={() => setHistoryOpen(false)}>
                        <CloseIcon />
                      </IconButton>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3">
                      <button
                        type="button"
                        onClick={newChat}
                        className="mb-3 flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:border-primary/30 hover:bg-secondary"
                      >
                        <PlusIcon /> New chat
                      </button>
                      {conversations.length === 0 ? (
                        <div className="space-y-1.5 px-1 py-8 text-center">
                          <p className="text-sm font-medium text-ink">No conversations yet</p>
                          <p className="text-caption leading-relaxed text-muted-foreground">
                            Your chats will appear here. Sign in to keep them across devices.
                          </p>
                        </div>
                      ) : (
                        <ul className="space-y-0.5">
                          {conversations.map((c) => (
                            <li key={c.id} className="group rounded-lg transition-colors hover:bg-secondary">
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
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    aria-label="Chat name"
                                    className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm"
                                  />
                                  <IconButton label="Save name" type="submit">
                                    <CheckIcon />
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
                                        <span className="shrink-0 text-primary" aria-label="Pinned">
                                          <PinIcon filled small />
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
                                      <IconButton label="Confirm delete" onClick={() => void remove(c.id)}>
                                        <CheckIcon />
                                      </IconButton>
                                      <IconButton
                                        label="Cancel delete"
                                        onClick={() => setConfirmDeleteId(null)}
                                      >
                                        <CloseIcon />
                                      </IconButton>
                                    </span>
                                  ) : (
                                    <span className="flex shrink-0 items-center gap-0.5">
                                      <IconButton
                                        label={c.pinned ? "Unpin chat" : "Pin chat"}
                                        onClick={() => void togglePin(c)}
                                      >
                                        <PinIcon filled={c.pinned} />
                                      </IconButton>
                                      <IconButton
                                        label="Rename chat"
                                        onClick={() => {
                                          setEditingId(c.id);
                                          setEditTitle(c.title ?? "");
                                        }}
                                      >
                                        <EditIcon />
                                      </IconButton>
                                      <IconButton
                                        label="Delete chat"
                                        onClick={() => setConfirmDeleteId(c.id)}
                                      >
                                        <TrashIcon />
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
        className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-secondary px-3 py-2 text-sm text-muted-foreground"
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

function IconButton({
  label,
  onClick,
  type = "button",
  children,
}: {
  label: string;
  onClick?: () => void;
  type?: "button" | "submit";
  children: React.ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

/* Icons — 24px viewBox, currentColor */
const svg = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "size-4",
  "aria-hidden": true,
};

const SparkIcon = () => (
  <svg {...svg} className="size-4 text-current">
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  </svg>
);
const HistoryIcon = () => (
  <svg {...svg}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 4v4h4M12 8v4l3 2" />
  </svg>
);
const PlusIcon = () => (
  <svg {...svg}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const CloseIcon = () => (
  <svg {...svg}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
const CheckIcon = () => (
  <svg {...svg}>
    <path d="m20 6-11 11-5-5" />
  </svg>
);
const EditIcon = () => (
  <svg {...svg}>
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const TrashIcon = () => (
  <svg {...svg}>
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </svg>
);
const PinIcon = ({ filled, small }: { filled: boolean; small?: boolean }) => (
  <svg {...svg} className={small ? "size-3" : "size-4"} fill={filled ? "currentColor" : "none"}>
    <path d="M12 17v5M7 4h10l-1 7 3 3H5l3-3-1-7Z" />
  </svg>
);
const ArrowUpIcon = () => (
  <svg {...svg}>
    <path d="M12 19V5" />
    <path d="m6 11 6-6 6 6" />
  </svg>
);

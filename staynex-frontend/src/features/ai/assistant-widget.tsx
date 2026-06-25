"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { agentApi } from "@/lib/api";
import type { AgentConversation, AgentMessage } from "@/lib/types";

const SUGGESTIONS = [
  "Find me available stays in Calabar",
  "How does booking and payment work on Staynex?",
  "What should I check before choosing a stay?",
];

type Msg = { role: "USER" | "AGENT"; content: string; note?: "refused" | "unavailable" };

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

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await agentApi.listConversations());
    } catch {
      setConversations([]);
    }
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      void refreshConversations();
    }
  }, [open, refreshConversations]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
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

  async function sendMessage(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    resetInput();
    setMessages((m) => [...m, { role: "USER", content: message }]);
    setBusy(true);
    try {
      const slug = pathname.match(/^\/stays\/([^/?#]+)/)?.[1];
      const reply = await agentApi.ask({
        message,
        conversationId: activeId ?? undefined,
        ...(slug ? { propertySlug: decodeURIComponent(slug) } : {}),
      });
      setActiveId(reply.conversationId);
      setMessages((m) => [
        ...m,
        {
          role: "AGENT",
          content: reply.reply,
          note: reply.refused ? "refused" : reply.unavailable ? "unavailable" : undefined,
        },
      ]);
      void refreshConversations();
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "AGENT",
          content: "Staynex AI is unavailable right now. You can still search and book directly.",
          note: "unavailable",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setHistoryOpen(false);
    inputRef.current?.focus();
  }

  async function openConversation(id: string) {
    setActiveId(id);
    setHistoryOpen(false);
    try {
      const msgs: AgentMessage[] = await agentApi.messages(id);
      setMessages(msgs.map((m) => ({ role: m.role, content: m.content })));
    } catch {
      setMessages([]);
    }
  }

  async function togglePin(c: AgentConversation) {
    await agentApi.setPinned(c.id, !c.pinned).catch(() => {});
    void refreshConversations();
  }

  async function saveRename(id: string) {
    const title = editTitle.trim();
    setEditingId(null);
    if (title) await agentApi.rename(id, title).catch(() => {});
    void refreshConversations();
  }

  async function remove(id: string) {
    await agentApi.remove(id).catch(() => {});
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
        className="fixed bottom-4 right-4 z-40 inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary-hover"
      >
        <SparkIcon />
        {open ? "Close" : "Staynex AI"}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          {/* Panel */}
          <div
            id="staynex-ai-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Staynex AI"
            className="fixed inset-0 z-50 flex flex-col bg-surface-raised sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[420px] sm:border-l sm:border-border sm:shadow-xl"
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
                <IconButton
                  label={historyOpen ? "Hide chats" : "Conversation history"}
                  onClick={() => setHistoryOpen((v) => !v)}
                >
                  <HistoryIcon />
                </IconButton>
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

            {historyOpen ? (
              /* History panel */
              <div className="flex-1 overflow-y-auto p-3">
                <button
                  type="button"
                  onClick={newChat}
                  className="mb-2 flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-secondary"
                >
                  <PlusIcon /> New chat
                </button>
                {conversations.length === 0 ? (
                  <p className="px-1 py-6 text-center text-caption text-muted-foreground">
                    No saved chats yet. Sign in to keep your history.
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {conversations.map((c) => (
                      <li key={c.id} className="group rounded-md hover:bg-secondary">
                        {editingId === c.id ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              void saveRename(c.id);
                            }}
                            className="flex gap-1 p-1"
                          >
                            <input
                              autoFocus
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              aria-label="Chat name"
                              className="h-8 flex-1 rounded border border-border bg-background px-2 text-sm"
                            />
                            <IconButton label="Save name" type="submit">
                              <CheckIcon />
                            </IconButton>
                          </form>
                        ) : (
                          <div className="flex items-center gap-0.5 p-1">
                            <button
                              type="button"
                              onClick={() => void openConversation(c.id)}
                              className={`flex-1 truncate rounded px-2 py-1.5 text-left text-sm ${
                                activeId === c.id ? "font-semibold text-primary" : "text-ink"
                              }`}
                            >
                              {c.pinned && <span aria-hidden>📌 </span>}
                              {c.title ?? "New chat"}
                            </button>
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
                            <IconButton label="Delete chat" onClick={() => void remove(c.id)}>
                              <TrashIcon />
                            </IconButton>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <>
                {/* Message feed */}
                <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  {messages.length === 0 ? (
                    <div className="space-y-5">
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        Hi, I&apos;m Staynex AI — an AI assistant, not a person. I can help you
                        find available stays and walk you through booking. I can&apos;t confirm
                        payments, promise availability, or handle refunds.
                      </p>
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
                    messages.map((t, i) => (
                      <div
                        key={i}
                        className={t.role === "USER" ? "flex justify-end" : "flex justify-start"}
                      >
                        <p
                          className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                            t.role === "USER"
                              ? "rounded-br-sm bg-primary text-primary-foreground"
                              : t.note === "refused"
                                ? "rounded-bl-sm border border-warning-border bg-warning-surface text-warning"
                                : t.note === "unavailable"
                                  ? "rounded-bl-sm border border-border bg-secondary text-muted-foreground"
                                  : "rounded-bl-sm bg-secondary text-ink"
                          }`}
                        >
                          {t.content}
                        </p>
                      </div>
                    ))
                  )}
                  {busy && (
                    <div className="flex justify-start" aria-live="polite">
                      <p className="rounded-2xl rounded-bl-sm bg-secondary px-3 py-2 text-sm text-muted-foreground">
                        Thinking…
                      </p>
                    </div>
                  )}
                  <div ref={endRef} />
                </div>

                {/* Input bar — textarea that grows with content */}
                <form
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    void sendMessage(input);
                  }}
                  className="flex items-end gap-2 border-t border-border px-3 py-3"
                >
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
                    placeholder="Ask about stays or booking… (Shift+Enter for new line)"
                    aria-label="Message Staynex AI"
                    className="max-h-36 min-h-[44px] flex-1 resize-none overflow-y-auto rounded-md border border-border bg-background px-3 py-2.5 text-sm text-ink outline-none transition-[height] focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <button
                    type="submit"
                    disabled={busy || !input.trim()}
                    className="inline-flex h-11 shrink-0 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    Send
                  </button>
                </form>
              </>
            )}
          </div>
        </>
      )}
    </>
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
const PinIcon = ({ filled }: { filled: boolean }) => (
  <svg {...svg} fill={filled ? "currentColor" : "none"}>
    <path d="M12 17v5M7 4h10l-1 7 3 3H5l3-3-1-7Z" />
  </svg>
);

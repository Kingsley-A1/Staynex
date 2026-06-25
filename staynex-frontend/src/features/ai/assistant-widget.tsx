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

  const inputRef = useRef<HTMLInputElement>(null);
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

  async function sendMessage(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
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
        { role: "AGENT", content: "The agent is unavailable right now. You can still search and book directly.", note: "unavailable" },
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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="staynex-agent-panel"
        className="fixed bottom-4 right-4 z-40 inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary-hover"
      >
        <SparkIcon />
        {open ? "Close" : "Staynex Agent"}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            id="staynex-agent-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Staynex Agent"
            className="fixed inset-0 z-50 flex flex-col bg-surface-raised sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[420px] sm:border-l sm:border-border sm:shadow-xl"
          >
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-semibold text-ink">
                  <SparkIcon /> Staynex Agent
                </p>
                <p className="text-caption">AI agent · helps you find &amp; book stays</p>
              </div>
              <div className="flex items-center gap-1">
                <IconButton
                  label={historyOpen ? "Hide chats" : "Show chats"}
                  onClick={() => setHistoryOpen((v) => !v)}
                >
                  <HistoryIcon />
                </IconButton>
                <IconButton label="New chat" onClick={newChat}>
                  <PlusIcon />
                </IconButton>
                <IconButton label="Close Staynex Agent" onClick={() => setOpen(false)}>
                  <CloseIcon />
                </IconButton>
              </div>
            </header>

            {historyOpen ? (
              <div className="flex-1 overflow-y-auto p-3">
                <button
                  type="button"
                  onClick={newChat}
                  className="mb-2 flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-secondary"
                >
                  <PlusIcon /> New chat
                </button>
                {conversations.length === 0 ? (
                  <p className="px-1 py-6 text-center text-caption">
                    No saved chats yet. Sign in to keep your history.
                  </p>
                ) : (
                  <ul className="space-y-1">
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
                          <div className="flex items-center gap-1 p-1">
                            <button
                              type="button"
                              onClick={() => openConversation(c.id)}
                              className={`flex-1 truncate rounded px-2 py-1.5 text-left text-sm ${
                                activeId === c.id ? "font-semibold text-primary" : "text-ink"
                              }`}
                            >
                              {c.pinned && <span aria-hidden>📌 </span>}
                              {c.title ?? "New chat"}
                            </button>
                            <IconButton label={c.pinned ? "Unpin chat" : "Pin chat"} onClick={() => togglePin(c)}>
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
                            <IconButton label="Delete chat" onClick={() => remove(c.id)}>
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
                <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  {messages.length === 0 ? (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Hi, I'm Staynex Agent — an AI, not a person. I can help you find available
                        stays and walk you through booking. I can't confirm payments, promise
                        availability, or handle refunds.
                      </p>
                      <div className="space-y-2">
                        <p className="text-overline">Try asking</p>
                        {SUGGESTIONS.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => sendMessage(s)}
                            className="block w-full rounded-lg border border-border px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-secondary"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    messages.map((t, i) => (
                      <div key={i} className={t.role === "USER" ? "flex justify-end" : "flex justify-start"}>
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

                <form
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    void sendMessage(input);
                  }}
                  className="flex gap-2 border-t border-border px-3 py-3"
                >
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about stays or booking…"
                    aria-label="Message Staynex Agent"
                    className="h-11 flex-1 rounded-md border border-border bg-background px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <button
                    type="submit"
                    disabled={busy || !input.trim()}
                    className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
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

/* Icons — 20px grid, currentColor */
const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className: "size-4", "aria-hidden": true };
const SparkIcon = () => (
  <svg {...svg} className="size-4 text-current"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>
);
const HistoryIcon = () => (<svg {...svg}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 4v4h4M12 8v4l3 2" /></svg>);
const PlusIcon = () => (<svg {...svg}><path d="M12 5v14M5 12h14" /></svg>);
const CloseIcon = () => (<svg {...svg}><path d="M6 6l12 12M18 6 6 18" /></svg>);
const CheckIcon = () => (<svg {...svg}><path d="m20 6-11 11-5-5" /></svg>);
const EditIcon = () => (<svg {...svg}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>);
const TrashIcon = () => (<svg {...svg}><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></svg>);
const PinIcon = ({ filled }: { filled: boolean }) => (
  <svg {...svg} fill={filled ? "currentColor" : "none"}><path d="M12 17v5M7 4h10l-1 7 3 3H5l3-3-1-7Z" /></svg>
);

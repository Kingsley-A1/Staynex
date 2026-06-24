"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/ui";
import { assistantApi } from "@/lib/api";

interface Turn {
  role: "user" | "assistant";
  text: string;
  note?: "refused" | "unavailable";
}

const INTRO: Turn = {
  role: "assistant",
  text: "Hi, I'm the Staynex Assistant — an AI, not a person. I can explain stays, rooms, and how booking works. I can't confirm payments, promise availability, or handle refunds.",
};

export function AssistantWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([INTRO]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setTurns((t) => [...t, { role: "user", text: message }]);
    setBusy(true);
    try {
      const propertySlug = propertySlugFromPath(pathname);
      const reply = await assistantApi.ask({
        message,
        conversationId,
        ...(propertySlug ? { propertySlug } : {}),
      });
      setConversationId(reply.conversationId);
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          text: reply.reply,
          note: reply.refused ? "refused" : reply.unavailable ? "unavailable" : undefined,
        },
      ]);
    } catch {
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          text: "The assistant is unavailable right now. You can still search and book directly.",
          note: "unavailable",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="staynex-assistant-panel"
        className="fixed bottom-4 right-4 z-40 shadow-lg"
      >
        {open ? "Close assistant" : "Ask Staynex"}
      </Button>

      {open && (
        <div
          id="staynex-assistant-panel"
          role="dialog"
          aria-modal="false"
          aria-label="Staynex Assistant"
          className="fixed inset-x-3 bottom-20 z-40 flex max-h-[70dvh] flex-col overflow-hidden rounded-2xl border border-border bg-surface-raised shadow-xl sm:left-auto sm:right-4 sm:w-96"
        >
          <header className="border-b border-border px-4 py-3">
            <p className="font-semibold text-ink">Staynex Assistant</p>
            <p className="text-caption">Bounded, tool-first help · AI assistant</p>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {turns.map((t, i) => (
              <div
                key={i}
                className={t.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <p
                  className={
                    t.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : t.note === "refused"
                        ? "max-w-[85%] rounded-2xl rounded-bl-sm border border-warning-border bg-warning-surface px-3 py-2 text-sm text-warning"
                        : t.note === "unavailable"
                          ? "max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground"
                          : "max-w-[85%] rounded-2xl rounded-bl-sm bg-secondary px-3 py-2 text-sm text-ink"
                  }
                >
                  {t.text}
                </p>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start" aria-live="polite">
                <p className="rounded-2xl rounded-bl-sm bg-secondary px-3 py-2 text-sm text-muted-foreground">
                  Thinking…
                </p>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={send} className="flex gap-2 border-t border-border px-3 py-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about stays or booking…"
              aria-label="Message the Staynex Assistant"
              className="h-11 flex-1 rounded-md border border-border bg-background px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" disabled={busy || !input.trim()}>
              Send
            </Button>
          </form>
        </div>
      )}
    </>
  );
}

function propertySlugFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/stays\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

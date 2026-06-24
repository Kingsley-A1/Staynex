"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Field, Input, Textarea, LinkButton } from "@/ui";
import { reviewsApi } from "@/lib/api";
import type { BookingReviewContext } from "@/lib/types";

export function ReviewForm({ bookingId }: { bookingId: string }) {
  const [ctx, setCtx] = useState<BookingReviewContext | null>(null);
  const [authError, setAuthError] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    reviewsApi
      .bookingContext(bookingId)
      .then((c) => active && setCtx(c))
      .catch((err: unknown) => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("401")) setAuthError(true);
        else setLoadError("We couldn't load this booking.");
      });
    return () => {
      active = false;
    };
  }, [bookingId]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setSubmitError(null);
    try {
      await reviewsApi.submit(bookingId, { rating, body, title: title || undefined });
      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not submit your review");
      setBusy(false);
    }
  }

  if (authError) {
    return (
      <div className="surface-card space-y-3 p-6 text-center">
        <p className="text-muted-foreground">Sign in to review your stay.</p>
        <LinkButton href={`/sign-in?next=/reviews/submit?booking=${bookingId}`}>Sign in</LinkButton>
      </div>
    );
  }
  if (loadError) {
    return <div className="surface-card p-6 text-sm text-error" role="alert">{loadError}</div>;
  }
  if (!ctx) {
    return <div className="surface-card p-6 text-muted-foreground">Loading…</div>;
  }
  if (done) {
    return (
      <div className="surface-card space-y-3 p-6 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-success-surface text-lg font-bold text-success">
          ✓
        </div>
        <h1 className="text-title-md text-ink">Thanks for your review</h1>
        <p className="text-muted-foreground">
          It's been submitted and will appear publicly once our team approves it.
        </p>
        <LinkButton href="/reviews" variant="secondary">
          See published reviews
        </LinkButton>
      </div>
    );
  }
  if (!ctx.canReview) {
    return (
      <div className="surface-card space-y-3 p-6 text-center">
        <p className="text-muted-foreground">{ctx.reason ?? "You can't review this stay."}</p>
        <Link href="/reviews" className="text-sm font-semibold text-primary">
          See published reviews
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="surface-card space-y-4 p-6">
      <div>
        <h1 className="text-title-md text-ink">Review your stay</h1>
        <p className="text-caption">
          {ctx.propertyName} · {ctx.roomName}
        </p>
      </div>

      <fieldset>
        <legend className="text-label text-ink">Your rating</legend>
        <div className="mt-1.5 flex gap-1" role="radiogroup" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={() => setRating(n)}
              className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className={`size-7 ${n <= rating ? "text-warning" : "text-border"}`}
                fill="currentColor"
              >
                <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 17.77l-5.2 2.73.99-5.78-4.21-4.1 5.82-.85L12 3.5Z" />
              </svg>
            </button>
          ))}
        </div>
      </fieldset>

      <Field label="Title (optional)" htmlFor="title">
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      </Field>
      <Field label="Your review" htmlFor="body" required>
        <Textarea
          id="body"
          required
          minLength={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What stood out about your stay?"
        />
      </Field>

      {submitError && (
        <p className="text-sm text-error" role="alert">
          {submitError}
        </p>
      )}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Submitting…" : "Submit review"}
      </Button>
    </form>
  );
}

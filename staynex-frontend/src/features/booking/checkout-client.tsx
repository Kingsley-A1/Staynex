"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Button, Field, Input } from "@/ui";
import { guestApi } from "@/lib/api";
import { formatNairaFromKobo } from "@/lib/format";
import type { HoldSummary } from "@/lib/types";

export function CheckoutClient({ holdId }: { holdId: string }) {
  const [hold, setHold] = useState<HoldSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    guestApi
      .getHold(holdId)
      .then((h) => {
        if (active) setHold(h);
      })
      .catch((err) => {
        if (active) setLoadError(err instanceof Error ? err.message : "Could not load reservation");
      });
    return () => {
      active = false;
    };
  }, [holdId]);

  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setPayError(null);
    try {
      const result = await guestApi.checkout({ holdId, email });
      window.location.href = result.authorizationUrl;
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Payment could not be started");
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="surface-card p-5 text-sm text-error" role="alert">
        {loadError}
      </div>
    );
  }
  if (!hold) {
    return <div className="surface-card p-5 text-muted-foreground">Loading reservation…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="surface-card space-y-2 p-5">
        <h2 className="text-title-sm">{hold.propertyName}</h2>
        <p className="text-caption">
          {hold.roomName} · {hold.checkIn} → {hold.checkOut} · {hold.nights} night
          {hold.nights === 1 ? "" : "s"}
        </p>
        <div className="flex justify-between border-t border-border pt-2 text-sm">
          <span className="text-muted-foreground">
            {formatNairaFromKobo(hold.nightlyPriceKobo)} × {hold.nights}
          </span>
          <span className="font-bold text-ink">{formatNairaFromKobo(hold.totalKobo)}</span>
        </div>
        {hold.expired ? (
          <p className="text-sm text-error">This reservation has expired — please search again.</p>
        ) : (
          <p className="text-caption">
            Hold expires at {new Date(hold.expiresAt).toLocaleTimeString()}.
          </p>
        )}
      </div>

      {!hold.expired && (
        <form onSubmit={pay} className="surface-card space-y-4 p-5">
          <Field label="Email for your receipt" htmlFor="email" required>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>
          {payError && (
            <p className="text-sm text-error" role="alert">
              {payError}
            </p>
          )}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Starting payment…" : `Pay ${formatNairaFromKobo(hold.totalKobo)} with Paystack`}
          </Button>
          <p className="text-caption">You'll be redirected to Paystack's secure test checkout.</p>
        </form>
      )}
    </div>
  );
}

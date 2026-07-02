"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const AssistantWidget = dynamic(
  () =>
    import("@/features/ai/assistant-widget").then(
      (module) => module.AssistantWidget,
    ),
  { ssr: false },
);

export function DeferredAssistantWidget() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => setReady(true), {
        timeout: 3000,
      });
      return () => window.cancelIdleCallback(id);
    }

    const id = window.setTimeout(() => setReady(true), 1500);
    return () => window.clearTimeout(id);
  }, []);

  return ready ? <AssistantWidget /> : null;
}

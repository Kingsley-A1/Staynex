"use client";

import dynamic from "next/dynamic";

const AssistantWidget = dynamic(
  () =>
    import("@/features/ai/assistant-widget").then(
      (module) => module.AssistantWidget,
    ),
  { ssr: false },
);

export function DeferredAssistantWidget() {
  return <AssistantWidget />;
}

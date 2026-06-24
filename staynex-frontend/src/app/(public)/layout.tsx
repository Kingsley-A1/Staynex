import type { ReactNode } from "react";
import { PublicHeader } from "@/components/public-header";
import { AssistantWidget } from "@/features/ai/assistant-widget";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <PublicHeader />
      {children}
      <AssistantWidget />
    </div>
  );
}

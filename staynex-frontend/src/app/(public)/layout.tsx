import type { ReactNode } from "react";
import { PublicHeader } from "@/components/public-header";
import { SiteFooter } from "@/components/site-footer";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <PublicHeader />
      {children}
      <SiteFooter />
    </div>
  );
}

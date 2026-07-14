"use client";

import { track } from "@vercel/analytics";
import type { ComponentProps } from "react";
import { LinkButton } from "@/ui";

type Placement = "hero" | "final" | "sign_in";

export function HostAcquisitionLink({
  placement,
  ...props
}: ComponentProps<typeof LinkButton> & { placement: Placement }) {
  return (
    <LinkButton
      {...props}
      onClick={(event) => {
        track("Host acquisition CTA clicked", {
          placement,
          destination: String(props.href),
        });
        props.onClick?.(event);
      }}
    />
  );
}

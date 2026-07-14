export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface StaynexEmailInput {
  /** Validated application origin supplied by orchestration or preview fixtures. */
  appOrigin: string;
}

export type EmailStatusTone = "success" | "warning" | "error" | "info";

export interface EmailDetail {
  label: string;
  value: string | number | null | undefined;
}

export interface EmailCta {
  label: string;
  url: string;
}

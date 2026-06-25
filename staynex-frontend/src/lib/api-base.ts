function normalizeApiBase(input: string | undefined): string {
  const raw = input?.trim();
  if (!raw) return "http://localhost:4000";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

export const API_BASE = normalizeApiBase(process.env.NEXT_PUBLIC_API_URL);

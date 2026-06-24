import { BadRequestException } from "@nestjs/common";
import type { ZodType } from "zod";

type ValidationIssue = {
  path: string;
  message: string;
};

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (result.success) return result.data;

  throw new BadRequestException({
    message: "Invalid request body",
    issues: result.error.issues.map<ValidationIssue>((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

export function parseQuery<T>(schema: ZodType<T>, query: unknown): T {
  const result = schema.safeParse(query);
  if (result.success) return result.data;

  throw new BadRequestException({
    message: "Invalid query parameters",
    issues: result.error.issues.map<ValidationIssue>((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

export function requiredHeader(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new BadRequestException(`Missing required header: ${name}`);
  }
  return trimmed;
}

import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export type ApiErrorBody = {
  error: {
    message: string;
    code?: string;
    fields?: Record<string, string>;
  };
};

export function apiError(
  message: string,
  status: number,
  opts: { code?: string; fields?: Record<string, string> } = {}
) {
  const body: ApiErrorBody = {
    error: {
      message,
      ...(opts.code ? { code: opts.code } : {}),
      ...(opts.fields ? { fields: opts.fields } : {}),
    },
  };
  return NextResponse.json(body, { status });
}

export function unauthorized() {
  return apiError("Unauthorized", 401, { code: "unauthorized" });
}

// Turns a failed zod safeParse into a 400 with one message per field,
// instead of a single string joining every issue together.
export function validationError(error: ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_root";
    if (!(key in fields)) fields[key] = issue.message;
  }
  const message = Object.values(fields).join(", ") || "Validation failed";
  return apiError(message, 400, { code: "validation_error", fields });
}

// For business-logic errors thrown from src/lib (e.g. OrderError), which
// carry their own message and HTTP status.
export function fromCaughtError(err: unknown, fallbackMessage: string) {
  const status = (err as { status?: number })?.status ?? 500;
  const message = (err instanceof Error && err.message) || fallbackMessage;
  return apiError(message, status);
}

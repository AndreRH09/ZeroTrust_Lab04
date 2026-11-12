// Formato uniforme de error (design.md §4): { code, message, requestId }, sin stack.
import { z } from "zod";

export const ErrorCode = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "INTERNAL_ERROR",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiError = z.object({
  code: ErrorCode,
  message: z.string(),
  requestId: z.string(),
});
export type ApiError = z.infer<typeof ApiError>;

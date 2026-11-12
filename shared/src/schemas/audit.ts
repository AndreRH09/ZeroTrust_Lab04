// Auditoría (CA-08.3, CA-10.1, CA-10.2).
import { z } from "zod";

export const AuditEventType = z.enum([
  "PROJECT_CREATED",
  "PROJECT_UPDATED",
  "PROJECT_PUBLISHED",
  "DONATION_CREATED",
  "DONATION_CONFIRMED",
  "DONATION_REJECTED",
  "AUTHZ_DENIED",
]);
export type AuditEventType = z.infer<typeof AuditEventType>;

export const AuditOutcome = z.enum(["SUCCESS", "DENIED", "CONFLICT"]);
export type AuditOutcome = z.infer<typeof AuditOutcome>;

export const AuditQuery = z
  .object({
    eventType: AuditEventType,
    from: z.iso.datetime().optional(),
    to: z.iso.datetime().optional(),
  })
  .strict();
export type AuditQuery = z.infer<typeof AuditQuery>;

export interface AuditEvent {
  eventId: string;
  eventType: AuditEventType;
  timestamp: string;
  requestId: string;
  actorRef: string;
  action: string;
  resourceRef: string;
  outcome: AuditOutcome;
}

// Registro de eventos de auditoría (CA-08.3, CA-10.2, research R-08).
// actorRef = HMAC-SHA256(sub, STACK_ID): seudónimo estable por despliegue, nunca el sub en claro.
// Nunca se guardan tokens, claves de idempotencia ni importes.
import { createHmac } from "node:crypto";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import type { AuditEventType, AuditOutcome } from "@aqp/shared";
import { ddb, tables } from "../shared/dynamo.js";
import { newId, nowIso } from "../shared/ids.js";
import { log } from "../shared/logger.js";

export function actorRefFor(sub: string): string {
  const pepper = process.env.STACK_ID ?? "local";
  return createHmac("sha256", pepper).update(sub).digest("hex").slice(0, 32);
}

export interface AuditInput {
  eventType: AuditEventType;
  requestId: string;
  sub: string;
  action: string;
  resourceRef: string;
  outcome: AuditOutcome;
}

export function buildAuditItem(input: AuditInput) {
  const eventId = newId();
  const timestamp = nowIso();
  return {
    eventType: input.eventType,
    sk: `${timestamp}#${eventId}`,
    eventId,
    timestamp,
    requestId: input.requestId,
    actorRef: actorRefFor(input.sub),
    action: input.action,
    resourceRef: input.resourceRef,
    outcome: input.outcome,
  };
}

/**
 * Persiste el evento. Un fallo de auditoría no revierte la operación de negocio ya confirmada,
 * pero queda registrado en los logs para su investigación.
 */
export async function record(input: AuditInput): Promise<void> {
  const item = buildAuditItem(input);
  try {
    await ddb.send(new PutCommand({ TableName: tables.audit, Item: item }));
  } catch (err) {
    log({
      level: "ERROR",
      requestId: input.requestId,
      action: "audit.record",
      outcome: "ERROR",
      eventType: input.eventType,
      errorName: err instanceof Error ? err.name : "UnknownError",
    });
  }
}

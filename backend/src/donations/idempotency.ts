// Idempotencia de POST /v1/donations (AD-05, CA-05.4, research R-07).
import { createHash } from "node:crypto";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import type { CreateDonationBody } from "@aqp/shared";
import { ddb, tables } from "../shared/dynamo.js";

export const IDEMPOTENCY_TTL_SECONDS = 86_400;

export interface IdempotencyRecord {
  pk: string;
  payloadHash: string;
  donationId: string;
  responseStatus: number;
  responseBody: unknown;
  expiresAt: number;
}

export const idempotencyPk = (sub: string, key: string): string => `${sub}#createDonation#${key}`;

/** SHA-256 del JSON canónico { projectId, amountCents } (orden de claves fijo). */
export function payloadHash(body: CreateDonationBody): string {
  const canonical = JSON.stringify({ projectId: body.projectId, amountCents: body.amountCents });
  return createHash("sha256").update(canonical).digest("hex");
}

export const nowEpoch = (): number => Math.floor(Date.now() / 1000);
export const expiresAtFrom = (epoch: number): number => epoch + IDEMPOTENCY_TTL_SECONDS;

/** Lee el registro vigente; ignora los expirados aunque el TTL aún no los haya borrado. */
export async function findActive(pk: string): Promise<IdempotencyRecord | undefined> {
  const out = await ddb.send(
    new GetCommand({ TableName: tables.idempotency, Key: { pk }, ConsistentRead: true }),
  );
  const rec = out.Item as IdempotencyRecord | undefined;
  if (!rec || rec.expiresAt <= nowEpoch()) return undefined;
  return rec;
}

export type Replay = { kind: "replay"; status: number; body: unknown } | { kind: "mismatch" };

/** Misma carga → respuesta almacenada; carga distinta → conflicto. */
export function resolveExisting(rec: IdempotencyRecord, hash: string): Replay {
  if (rec.payloadHash !== hash) return { kind: "mismatch" };
  return { kind: "replay", status: rec.responseStatus, body: rec.responseBody };
}

// createDonationFn — POST /v1/donations (HU-05, CA-05.1..5, T04–T07).
// Reserva de clave + ConditionCheck del proyecto + donación en un único TransactWriteItems.
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { CreateDonationBody, IdempotencyKey } from "@aqp/shared";
import { record } from "../audit/record.js";
import { authorize } from "../authz/policy.js";
import { getPrincipal } from "../authz/principal.js";
import { ddb, tables } from "../shared/dynamo.js";
import type { ApiEvent, RequestCtx } from "../shared/http.js";
import {
  badRequest,
  conflict,
  createHandler,
  header,
  isTransactionCanceled,
  json,
  notFound,
  parseJsonBody,
} from "../shared/http.js";
import { newId, nowIso } from "../shared/ids.js";
import {
  expiresAtFrom,
  findActive,
  idempotencyPk,
  nowEpoch,
  payloadHash,
  resolveExisting,
} from "./idempotency.js";
import { type DonationItem, toDonation } from "./model.js";

async function replayOrConflict(pk: string, hash: string) {
  const existing = await findActive(pk);
  if (!existing) throw conflict("Solicitud concurrente con la misma clave; reintente");
  const r = resolveExisting(existing, hash);
  if (r.kind === "mismatch") throw conflict("La Idempotency-Key ya se usó con otra carga");
  return json(r.status, r.body);
}

async function createDonation(event: ApiEvent, ctx: RequestCtx) {
  const principal = getPrincipal(event);
  await authorize(ctx, principal, "donations:create");

  const keyParse = IdempotencyKey.safeParse(header(event, "Idempotency-Key"));
  if (!keyParse.success) throw badRequest("Cabecera Idempotency-Key (UUID) requerida");
  const body = CreateDonationBody.parse(parseJsonBody(event));

  // donorSub SIEMPRE del claim verificado (CA-05.3).
  const pk = idempotencyPk(principal.sub, keyParse.data);
  const hash = payloadHash(body);

  const existing = await findActive(pk);
  if (existing) {
    const r = resolveExisting(existing, hash);
    if (r.kind === "mismatch") throw conflict("La Idempotency-Key ya se usó con otra carga");
    return json(r.status, r.body);
  }

  const project = await ddb.send(
    new GetCommand({
      TableName: tables.projects,
      Key: { projectId: body.projectId },
      ProjectionExpression: "projectId, #s",
      ExpressionAttributeNames: { "#s": "status" },
    }),
  );
  if (!project.Item) throw notFound();
  if (project.Item.status !== "PUBLICADO") throw conflict("El proyecto no acepta donaciones");

  const now = nowIso();
  const epoch = nowEpoch();
  const donation: DonationItem = {
    donationId: newId(),
    projectId: body.projectId,
    donorSub: principal.sub,
    amountCents: body.amountCents,
    currency: "PEN",
    status: "PENDIENTE_SIMULACION",
    createdAt: now,
    updatedAt: now,
  };
  const responseBody = toDonation(donation);

  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tables.idempotency,
              Item: {
                pk,
                payloadHash: hash,
                donationId: donation.donationId,
                responseStatus: 201,
                responseBody,
                expiresAt: expiresAtFrom(epoch),
              },
              ConditionExpression: "attribute_not_exists(pk) OR expiresAt <= :now",
              ExpressionAttributeValues: { ":now": epoch },
            },
          },
          {
            ConditionCheck: {
              TableName: tables.projects,
              Key: { projectId: body.projectId },
              ConditionExpression: "#s = :pub",
              ExpressionAttributeNames: { "#s": "status" },
              ExpressionAttributeValues: { ":pub": "PUBLICADO" },
            },
          },
          {
            Put: {
              TableName: tables.donations,
              Item: donation,
              ConditionExpression: "attribute_not_exists(donationId)",
            },
          },
        ],
      }),
    );
  } catch (err) {
    if (isTransactionCanceled(err)) {
      const reasons = err.CancellationReasons ?? [];
      // Otra solicitud con la misma clave ganó la carrera: se resuelve como repetición.
      if (reasons[0]?.Code === "ConditionalCheckFailed") return replayOrConflict(pk, hash);
      throw conflict("El proyecto no acepta donaciones");
    }
    throw err;
  }

  await record({
    eventType: "DONATION_CREATED",
    requestId: ctx.requestId,
    sub: principal.sub,
    action: "POST /v1/donations",
    resourceRef: `donation:${donation.donationId}`,
    outcome: "SUCCESS",
  });
  return json(201, responseBody);
}

export const handler = createHandler({ "POST /v1/donations": createDonation });

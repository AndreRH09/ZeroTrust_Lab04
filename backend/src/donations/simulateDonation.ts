// simulateDonationFn — POST /v1/donations/{donationId}/simulate (HU-06, CA-06.1..3, T08).
// Solo se despliega en el stage `academic` (Condition IsAcademic en SAM).
// La transición y el acumulado se escriben en un TransactWriteItems condicionado (CA-NF04.2).
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { SimulateBody } from "@aqp/shared";
import { record } from "../audit/record.js";
import { authorize } from "../authz/policy.js";
import { getPrincipal } from "../authz/principal.js";
import { ddb, tables } from "../shared/dynamo.js";
import type { ApiEvent, RequestCtx } from "../shared/http.js";
import {
  conflict,
  createHandler,
  isTransactionCanceled,
  json,
  notFound,
  parseJsonBody,
} from "../shared/http.js";
import { isUuid, nowIso } from "../shared/ids.js";
import { type DonationItem, toDonation } from "./model.js";

async function simulate(event: ApiEvent, ctx: RequestCtx) {
  const principal = getPrincipal(event);
  await authorize(ctx, principal, "donations:simulate"); // rol (403)

  const donationId = event.pathParameters?.donationId;
  if (!isUuid(donationId)) throw notFound();
  const { outcome } = SimulateBody.parse(parseJsonBody(event));

  const out = await ddb.send(
    new GetCommand({ TableName: tables.donations, Key: { donationId }, ConsistentRead: true }),
  );
  const donation = out.Item as DonationItem | undefined;
  if (!donation) throw notFound();
  // Propietario (BOLA): ajena → 404 idéntico a inexistente + AUTHZ_DENIED.
  await authorize(ctx, principal, "donations:simulate", {
    donorSub: donation.donorSub,
    ref: `donation:${donationId}`,
  });
  if (donation.status !== "PENDIENTE_SIMULACION") {
    throw conflict("La donación ya está en un estado terminal");
  }

  const newStatus = outcome === "CONFIRM" ? "CONFIRMADA_SIMULADA" : "RECHAZADA_SIMULADA";
  const now = nowIso();
  const transactItems: NonNullable<
    ConstructorParameters<typeof TransactWriteCommand>[0]["TransactItems"]
  > = [
    {
      Update: {
        TableName: tables.donations,
        Key: { donationId },
        UpdateExpression: "SET #s = :new, updatedAt = :now",
        ConditionExpression: "#s = :pending AND donorSub = :sub",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":new": newStatus,
          ":now": now,
          ":pending": "PENDIENTE_SIMULACION",
          ":sub": principal.sub,
        },
      },
    },
  ];
  // Solo una confirmación suma al acumulado; un rechazo no toca el proyecto (CA-06.3).
  if (outcome === "CONFIRM") {
    transactItems.push({
      Update: {
        TableName: tables.projects,
        Key: { projectId: donation.projectId },
        UpdateExpression: "ADD confirmedAmountCents :amount SET updatedAt = :now",
        ConditionExpression: "attribute_exists(projectId)",
        ExpressionAttributeValues: { ":amount": donation.amountCents, ":now": now },
      },
    });
  }

  try {
    await ddb.send(new TransactWriteCommand({ TransactItems: transactItems }));
  } catch (err) {
    // Solicitudes concurrentes: solo la primera transición pasa la condición (CA-06.2).
    if (isTransactionCanceled(err)) throw conflict("La donación ya está en un estado terminal");
    throw err;
  }

  await record({
    eventType: outcome === "CONFIRM" ? "DONATION_CONFIRMED" : "DONATION_REJECTED",
    requestId: ctx.requestId,
    sub: principal.sub,
    action: "POST /v1/donations/{donationId}/simulate",
    resourceRef: `donation:${donationId}`,
    outcome: "SUCCESS",
  });
  return json(200, toDonation({ ...donation, status: newStatus, updatedAt: now }));
}

export const handler = createHandler({ "POST /v1/donations/{donationId}/simulate": simulate });

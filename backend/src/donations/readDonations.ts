// readDonationsFn — historial propio y donación por id (HU-07, CA-07.1, CA-07.2, CA-04.2, T09, T12).
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { authorize } from "../authz/policy.js";
import { getPrincipal } from "../authz/principal.js";
import { DONATIONS_BY_DONOR, ddb, tables } from "../shared/dynamo.js";
import type { ApiEvent, RequestCtx } from "../shared/http.js";
import { createHandler, json, notFound } from "../shared/http.js";
import { isUuid } from "../shared/ids.js";
import { type DonationItem, toDonation } from "./model.js";

async function listMine(event: ApiEvent, ctx: RequestCtx) {
  const principal = getPrincipal(event);
  await authorize(ctx, principal, "donations:readOwn");
  // La partición es el sub del token: no hay forma de pedir el historial de otro.
  const out = await ddb.send(
    new QueryCommand({
      TableName: tables.donations,
      IndexName: DONATIONS_BY_DONOR,
      KeyConditionExpression: "donorSub = :sub",
      ExpressionAttributeValues: { ":sub": principal.sub },
      ScanIndexForward: false,
      Limit: 100,
    }),
  );
  const items = ((out.Items ?? []) as DonationItem[])
    .filter((d) => d.donorSub === principal.sub)
    .map(toDonation);
  return json(200, { items });
}

async function getById(event: ApiEvent, ctx: RequestCtx) {
  const principal = getPrincipal(event);
  await authorize(ctx, principal, "donations:readById"); // rol: GESTOR/AUDITOR → 403
  const donationId = event.pathParameters?.donationId;
  if (!isUuid(donationId)) throw notFound();
  const out = await ddb.send(
    new GetCommand({ TableName: tables.donations, Key: { donationId }, ConsistentRead: true }),
  );
  const donation = out.Item as DonationItem | undefined;
  if (!donation) throw notFound();
  await authorize(ctx, principal, "donations:readById", {
    donorSub: donation.donorSub,
    ref: `donation:${donationId}`,
  });
  return json(200, toDonation(donation));
}

export const handler = createHandler({
  "GET /v1/donations/me": listMine,
  "GET /v1/donations/{donationId}": getById,
});

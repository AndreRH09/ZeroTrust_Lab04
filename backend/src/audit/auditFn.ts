// auditFn — GET /v1/audit (HU-10, extensión; CA-10.1, CA-10.2). Solo AUDITOR.
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { AuditQuery, type AuditEvent } from "@aqp/shared";
import { authorize } from "../authz/policy.js";
import { getPrincipal } from "../authz/principal.js";
import { ddb, tables } from "../shared/dynamo.js";
import type { ApiEvent, RequestCtx } from "../shared/http.js";
import { badRequest, createHandler, json } from "../shared/http.js";

async function listAudit(event: ApiEvent, ctx: RequestCtx) {
  const principal = getPrincipal(event);
  await authorize(ctx, principal, "audit:read");
  const q = AuditQuery.parse(event.queryStringParameters ?? {});
  const from = q.from ?? "1970-01-01T00:00:00.000Z";
  const to = q.to ?? new Date().toISOString();
  if (from > to) throw badRequest("'from' debe ser anterior a 'to'");

  const out = await ddb.send(
    new QueryCommand({
      TableName: tables.audit,
      KeyConditionExpression: "eventType = :t AND sk BETWEEN :from AND :to",
      ExpressionAttributeValues: { ":t": q.eventType, ":from": from, ":to": `${to}￿` },
      ScanIndexForward: false,
      Limit: 100,
    }),
  );
  const items: AuditEvent[] = (out.Items ?? []).map((i) => ({
    eventId: i.eventId,
    eventType: i.eventType,
    timestamp: i.timestamp,
    requestId: i.requestId,
    actorRef: i.actorRef,
    action: i.action,
    resourceRef: i.resourceRef,
    outcome: i.outcome,
  }));
  return json(200, { items });
}

export const handler = createHandler({ "GET /v1/audit": listAudit });

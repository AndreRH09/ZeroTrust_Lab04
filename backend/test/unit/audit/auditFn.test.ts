// @trace HU-10, CA-10.1, CA-10.2
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { beforeEach, describe, expect, it } from "vitest";
import { handler } from "../../../src/audit/auditFn.js";
import { AUDITOR, DONOR_A, GESTOR, makeEvent, parse } from "../../helpers.js";

const ddbMock = mockClient(DynamoDBDocumentClient);
beforeEach(() => {
  ddbMock.reset();
  ddbMock.on(PutCommand).resolves({});
});

const ev = (sub: string, groups: string[], query?: Record<string, string>) =>
  makeEvent({ routeKey: "GET /v1/audit", sub, groups, query });

describe("GET /v1/audit", () => {
  it("AUDITOR filtra por tipo y rango de fechas", async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        {
          eventId: "e1",
          eventType: "AUTHZ_DENIED",
          sk: "x",
          timestamp: "2026-11-05T00:00:00.000Z",
          requestId: "r",
          actorRef: "abc",
          action: "a",
          resourceRef: "project:1",
          outcome: "DENIED",
        },
      ],
    });
    const r = await handler(
      ev(AUDITOR, ["AUDITOR"], {
        eventType: "AUTHZ_DENIED",
        from: "2026-11-01T00:00:00Z",
        to: "2026-11-10T00:00:00Z",
      }),
    );
    expect(r.statusCode).toBe(200);
    const q = ddbMock.commandCalls(QueryCommand)[0]!.args[0].input;
    expect(q.KeyConditionExpression).toBe("eventType = :t AND sk BETWEEN :from AND :to");
    const item = parse(r).items[0];
    expect(Object.keys(item).sort()).toEqual([
      "action",
      "actorRef",
      "eventId",
      "eventType",
      "outcome",
      "requestId",
      "resourceRef",
      "timestamp",
    ]);
  });

  it.each([
    [DONOR_A, ["DONANTE"]],
    [GESTOR, ["GESTOR"]],
  ])("no AUDITOR → 403", async (sub, groups) => {
    expect((await handler(ev(sub, groups, { eventType: "AUTHZ_DENIED" }))).statusCode).toBe(403);
  });

  it("eventType obligatorio y fechas ISO", async () => {
    expect((await handler(ev(AUDITOR, ["AUDITOR"]))).statusCode).toBe(400);
    expect(
      (await handler(ev(AUDITOR, ["AUDITOR"], { eventType: "AUTHZ_DENIED", from: "ayer" })))
        .statusCode,
    ).toBe(400);
  });
});

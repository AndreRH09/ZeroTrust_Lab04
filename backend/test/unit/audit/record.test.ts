// @trace HU-08, HU-10, CA-08.3, CA-10.2
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { AuditEventType } from "@aqp/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { actorRefFor, buildAuditItem, record } from "../../../src/audit/record.js";
import { DONOR_A, DONOR_B } from "../../helpers.js";

const ddbMock = mockClient(DynamoDBDocumentClient);
beforeEach(() => ddbMock.reset());

describe("actorRef seudonimizado (CA-10.2)", () => {
  it("es estable, distinto del sub y distinto entre usuarios", () => {
    expect(actorRefFor(DONOR_A)).toBe(actorRefFor(DONOR_A));
    expect(actorRefFor(DONOR_A)).not.toBe(DONOR_A);
    expect(actorRefFor(DONOR_A)).not.toBe(actorRefFor(DONOR_B));
  });
});

describe("buildAuditItem", () => {
  const item = buildAuditItem({
    eventType: "DONATION_CREATED",
    requestId: "req-1",
    sub: DONOR_A,
    action: "POST /v1/donations",
    resourceRef: "donation:abc",
    outcome: "SUCCESS",
  });

  it("sk = timestamp#eventId", () => {
    expect(item.sk).toBe(`${item.timestamp}#${item.eventId}`);
  });

  it("no contiene sub, tokens, importes ni claves", () => {
    const s = JSON.stringify(item);
    expect(s).not.toContain(DONOR_A);
    expect(Object.keys(item)).not.toEqual(
      expect.arrayContaining(["amountCents", "token", "idempotencyKey", "sub"]),
    );
  });

  it("solo admite los tipos de evento definidos", () => {
    expect(AuditEventType.options).toEqual([
      "PROJECT_CREATED",
      "PROJECT_UPDATED",
      "PROJECT_PUBLISHED",
      "DONATION_CREATED",
      "DONATION_CONFIRMED",
      "DONATION_REJECTED",
      "AUTHZ_DENIED",
    ]);
  });
});

describe("record", () => {
  it("escribe en la tabla AuditEvents", async () => {
    ddbMock.on(PutCommand).resolves({});
    await record({
      eventType: "PROJECT_CREATED",
      requestId: "r",
      sub: DONOR_A,
      action: "a",
      resourceRef: "project:x",
      outcome: "SUCCESS",
    });
    expect(ddbMock.commandCalls(PutCommand)[0]!.args[0].input.TableName).toBe("AuditEvents");
  });

  it("un fallo de escritura no propaga la excepción", async () => {
    ddbMock.on(PutCommand).rejects(new Error("boom"));
    await expect(
      record({
        eventType: "PROJECT_CREATED",
        requestId: "r",
        sub: DONOR_A,
        action: "a",
        resourceRef: "x",
        outcome: "SUCCESS",
      }),
    ).resolves.toBeUndefined();
  });
});

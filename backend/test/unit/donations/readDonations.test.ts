// @trace HU-07, HU-04, CA-07.1, CA-07.2, CA-04.2, T09, T12
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { beforeEach, describe, expect, it } from "vitest";
import { handler } from "../../../src/donations/readDonations.js";
import {
  DONATION_ID,
  DONOR_A,
  DONOR_B,
  GESTOR,
  makeEvent,
  parse,
  PROJECT_ID,
} from "../../helpers.js";

const ddbMock = mockClient(DynamoDBDocumentClient);
beforeEach(() => {
  ddbMock.reset();
  ddbMock.on(PutCommand).resolves({});
});

const donation = {
  donationId: DONATION_ID,
  projectId: PROJECT_ID,
  donorSub: DONOR_A,
  amountCents: 2500,
  currency: "PEN",
  status: "PENDIENTE_SIMULACION",
  createdAt: "2026-11-05T00:00:00.000Z",
  updatedAt: "2026-11-05T00:00:00.000Z",
};

describe("GET /v1/donations/me (CA-07.1)", () => {
  it("consulta el GSI donorSub-createdAt solo con el sub del token", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [donation] });
    const r = await handler(
      makeEvent({
        routeKey: "GET /v1/donations/me",
        sub: DONOR_A,
        groups: ["DONANTE"],
        query: { donorSub: DONOR_B },
      }),
    );
    expect(r.statusCode).toBe(200);
    const q = ddbMock.commandCalls(QueryCommand)[0]!.args[0].input;
    expect(q.IndexName).toBe("donorSub-createdAt");
    expect(q.ExpressionAttributeValues).toEqual({ ":sub": DONOR_A });
    expect(parse(r).items[0]).toMatchObject({
      donationId: DONATION_ID,
      amountCents: 2500,
      status: "PENDIENTE_SIMULACION",
    });
    expect(r.body).not.toContain("donorSub");
  });

  it("T12 CA-04.2 GESTOR → 403 sin consultar datos", async () => {
    const r = await handler(
      makeEvent({ routeKey: "GET /v1/donations/me", sub: GESTOR, groups: ["GESTOR"] }),
    );
    expect(r.statusCode).toBe(403);
    expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(0);
  });
});

describe("GET /v1/donations/{donationId} (CA-07.2)", () => {
  const ev = (sub: string, groups: string[], id = DONATION_ID) =>
    makeEvent({
      routeKey: "GET /v1/donations/{donationId}",
      sub,
      groups,
      pathParameters: { donationId: id },
    });

  it("propia → 200", async () => {
    ddbMock.on(GetCommand).resolves({ Item: donation });
    expect((await handler(ev(DONOR_A, ["DONANTE"]))).statusCode).toBe(200);
  });

  it("T09 ajena → 404 idéntico a inexistente + AUTHZ_DENIED", async () => {
    ddbMock.on(GetCommand).resolvesOnce({ Item: donation }).resolvesOnce({});
    const ajena = await handler(ev(DONOR_B, ["DONANTE"]));
    const inexistente = await handler(ev(DONOR_B, ["DONANTE"]));
    expect(ajena.statusCode).toBe(404);
    expect(inexistente.statusCode).toBe(404);
    expect(parse(ajena).message).toBe(parse(inexistente).message);
    expect(ajena.body).not.toMatch(/2500|PENDIENTE/);
    const audit = ddbMock.commandCalls(PutCommand).map((c) => c.args[0].input.Item?.eventType);
    expect(audit).toEqual(["AUTHZ_DENIED"]);
  });

  it("T12 GESTOR → 403 sin leer la donación", async () => {
    const r = await handler(ev(GESTOR, ["GESTOR"]));
    expect(r.statusCode).toBe(403);
    expect(ddbMock.commandCalls(GetCommand)).toHaveLength(0);
  });

  it("id no UUID → 404", async () => {
    expect((await handler(ev(DONOR_A, ["DONANTE"], "../../etc"))).statusCode).toBe(404);
  });
});

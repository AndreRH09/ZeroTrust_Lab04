// @trace HU-06, RNF-HU-04, CA-06.1, CA-06.2, CA-06.3, CA-NF04.1, CA-NF04.2, T08
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { beforeEach, describe, expect, it } from "vitest";
import { handler } from "../../../src/donations/simulateDonation.js";
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
const pending = {
  donationId: DONATION_ID,
  projectId: PROJECT_ID,
  donorSub: DONOR_A,
  amountCents: 2500,
  currency: "PEN",
  status: "PENDIENTE_SIMULACION",
  createdAt: "2026-11-05T00:00:00.000Z",
  updatedAt: "2026-11-05T00:00:00.000Z",
};

beforeEach(() => {
  ddbMock.reset();
  ddbMock.on(PutCommand).resolves({});
  ddbMock.on(GetCommand).resolves({ Item: pending });
  ddbMock.on(TransactWriteCommand).resolves({});
});

const ev = (outcome: string, sub = DONOR_A, groups = ["DONANTE"]) =>
  makeEvent({
    routeKey: "POST /v1/donations/{donationId}/simulate",
    sub,
    groups,
    body: { outcome },
    pathParameters: { donationId: DONATION_ID },
  });
const auditTypes = () =>
  ddbMock.commandCalls(PutCommand).map((c) => c.args[0].input.Item?.eventType);

describe("POST /v1/donations/{id}/simulate", () => {
  it("CONFIRM → CONFIRMADA_SIMULADA y ADD al acumulado en la misma transacción", async () => {
    const r = await handler(ev("CONFIRM"));
    expect(r.statusCode).toBe(200);
    expect(parse(r).status).toBe("CONFIRMADA_SIMULADA");
    const items = ddbMock.commandCalls(TransactWriteCommand)[0]!.args[0].input.TransactItems!;
    expect(items).toHaveLength(2);
    expect(items[0]!.Update!.ConditionExpression).toBe("#s = :pending AND donorSub = :sub");
    expect(items[0]!.Update!.ExpressionAttributeValues![":sub"]).toBe(DONOR_A);
    expect(items[1]!.Update!.TableName).toBe("Projects");
    expect(items[1]!.Update!.UpdateExpression).toContain("ADD confirmedAmountCents :amount");
    expect(items[1]!.Update!.ExpressionAttributeValues![":amount"]).toBe(2500);
    expect(auditTypes()).toEqual(["DONATION_CONFIRMED"]);
  });

  it("CA-06.3 REJECT → RECHAZADA_SIMULADA sin tocar el proyecto", async () => {
    const r = await handler(ev("REJECT"));
    expect(parse(r).status).toBe("RECHAZADA_SIMULADA");
    const items = ddbMock.commandCalls(TransactWriteCommand)[0]!.args[0].input.TransactItems!;
    expect(items).toHaveLength(1);
    expect(items[0]!.Update!.TableName).toBe("Donations");
    expect(auditTypes()).toEqual(["DONATION_REJECTED"]);
  });

  it("CA-06.2 estado terminal → 409 sin transacción", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { ...pending, status: "CONFIRMADA_SIMULADA" } });
    expect((await handler(ev("CONFIRM"))).statusCode).toBe(409);
    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });

  it("T08 concurrencia: si otra solicitud ganó, la condición falla → 409 (un solo incremento)", async () => {
    ddbMock
      .on(TransactWriteCommand)
      .resolvesOnce({})
      .rejects(
        Object.assign(new Error("tx"), {
          name: "TransactionCanceledException",
          CancellationReasons: [{ Code: "ConditionalCheckFailed" }],
        }),
      );
    const results = await Promise.all(Array.from({ length: 10 }, () => handler(ev("CONFIRM"))));
    const codes = results.map((r) => r.statusCode);
    expect(codes.filter((c) => c === 200)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(9);
    expect(auditTypes().filter((t) => t === "DONATION_CONFIRMED")).toHaveLength(1);
  });

  it("CA-07.2 donación ajena → 404 + AUTHZ_DENIED", async () => {
    const r = await handler(ev("CONFIRM", DONOR_B));
    expect(r.statusCode).toBe(404);
    expect(auditTypes()).toEqual(["AUTHZ_DENIED"]);
    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });

  it("GESTOR → 403", async () => {
    expect((await handler(ev("CONFIRM", GESTOR, ["GESTOR"]))).statusCode).toBe(403);
  });

  it("outcome inválido → 400", async () => {
    expect((await handler(ev("PAGAR"))).statusCode).toBe(400);
  });

  it("inexistente → 404", async () => {
    ddbMock.on(GetCommand).resolves({});
    expect((await handler(ev("CONFIRM"))).statusCode).toBe(404);
  });
});

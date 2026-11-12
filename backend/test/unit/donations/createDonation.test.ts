// @trace HU-05, RNF-HU-04, CA-05.1, CA-05.2, CA-05.3, CA-05.4, CA-05.5, T04, T05, T06, T07
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { beforeEach, describe, expect, it } from "vitest";
import { handler } from "../../../src/donations/createDonation.js";
import { idempotencyPk, payloadHash } from "../../../src/donations/idempotency.js";
import { DONOR_A, DONOR_B, GESTOR, IDEM_KEY, makeEvent, parse, PROJECT_ID } from "../../helpers.js";

const ddbMock = mockClient(DynamoDBDocumentClient);

const body = { projectId: PROJECT_ID, amountCents: 2500 };
const ev = (o: { sub?: string; groups?: string[]; body?: unknown; key?: string | null } = {}) =>
  makeEvent({
    routeKey: "POST /v1/donations",
    sub: o.sub ?? DONOR_A,
    groups: o.groups ?? ["DONANTE"],
    body: o.body ?? body,
    headers: o.key === null ? {} : { "idempotency-key": o.key ?? IDEM_KEY },
  });

function projectStatus(status: string | null) {
  ddbMock
    .on(GetCommand, { TableName: "Projects" })
    .resolves(status ? { Item: { projectId: PROJECT_ID, status } } : {});
}

beforeEach(() => {
  ddbMock.reset();
  ddbMock.on(GetCommand, { TableName: "Idempotency" }).resolves({});
  ddbMock.on(TransactWriteCommand).resolves({});
  ddbMock.on(PutCommand).resolves({});
  projectStatus("PUBLICADO");
});

describe("POST /v1/donations", () => {
  it("T05 CA-05.1 válida → 201 PENDIENTE_SIMULACION en un único TransactWriteItems", async () => {
    const r = await handler(ev());
    expect(r.statusCode).toBe(201);
    expect(parse(r)).toMatchObject({
      projectId: PROJECT_ID,
      amountCents: 2500,
      currency: "PEN",
      status: "PENDIENTE_SIMULACION",
    });
    const tx = ddbMock.commandCalls(TransactWriteCommand);
    expect(tx).toHaveLength(1);
    const items = tx[0]!.args[0].input.TransactItems!;
    expect(items[0]!.Put!.TableName).toBe("Idempotency");
    expect(items[0]!.Put!.ConditionExpression).toContain("attribute_not_exists(pk)");
    expect(items[1]!.ConditionCheck!.TableName).toBe("Projects");
    expect(items[2]!.Put!.TableName).toBe("Donations");
    const audit = ddbMock.commandCalls(PutCommand).map((c) => c.args[0].input.Item?.eventType);
    expect(audit).toContain("DONATION_CREATED");
  });

  it("CA-05.3 donorSub = claim aunque el body traiga otro (strict → 400)", async () => {
    const r = await handler(ev({ body: { ...body, donorSub: DONOR_B } }));
    expect(r.statusCode).toBe(400);
    const ok = await handler(ev());
    expect(ok.statusCode).toBe(201);
    const donation =
      ddbMock.commandCalls(TransactWriteCommand)[0]!.args[0].input.TransactItems![2]!.Put!.Item!;
    expect(donation.donorSub).toBe(DONOR_A);
    expect(parse(ok)).not.toHaveProperty("donorSub");
  });

  it.each([0, 100001, 1.5, "100", -100, null])(
    "T04 CA-05.2 amountCents=%s → 400 sin escribir",
    async (amountCents) => {
      const r = await handler(ev({ body: { projectId: PROJECT_ID, amountCents } }));
      expect(r.statusCode).toBe(400);
      expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
    },
  );

  it("CA-05.5 campos de pago → 400", async () => {
    const r = await handler(ev({ body: { ...body, cardNumber: "4111111111111111", cvv: "123" } }));
    expect(r.statusCode).toBe(400);
  });

  it("sin Idempotency-Key o no UUID → 400", async () => {
    expect((await handler(ev({ key: null }))).statusCode).toBe(400);
    expect((await handler(ev({ key: "abc" }))).statusCode).toBe(400);
  });

  it("proyecto inexistente → 404; no PUBLICADO → 409", async () => {
    projectStatus(null);
    expect((await handler(ev())).statusCode).toBe(404);
    projectStatus("BORRADOR");
    expect((await handler(ev())).statusCode).toBe(409);
    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });

  it("CA-04.1 GESTOR no puede donar → 403", async () => {
    const r = await handler(ev({ sub: GESTOR, groups: ["GESTOR"] }));
    expect(r.statusCode).toBe(403);
  });

  it("T02 sin token → 401", async () => {
    const r = await handler(
      makeEvent({ routeKey: "POST /v1/donations", body, headers: { "idempotency-key": IDEM_KEY } }),
    );
    expect(r.statusCode).toBe(401);
  });

  it("proyecto despublicado entre lectura y transacción → 409", async () => {
    ddbMock.on(TransactWriteCommand).rejects(
      Object.assign(new Error("tx"), {
        name: "TransactionCanceledException",
        CancellationReasons: [
          { Code: "None" },
          { Code: "ConditionalCheckFailed" },
          { Code: "None" },
        ],
      }),
    );
    expect((await handler(ev())).statusCode).toBe(409);
  });
});

describe("Idempotencia (CA-05.4)", () => {
  const stored = (hash: string, expiresAt = Math.floor(Date.now() / 1000) + 3600) => ({
    Item: {
      pk: idempotencyPk(DONOR_A, IDEM_KEY),
      payloadHash: hash,
      donationId: "d1",
      responseStatus: 201,
      responseBody: { donationId: "d1", status: "PENDIENTE_SIMULACION" },
      expiresAt,
    },
  });

  it("T06 misma clave y carga → misma respuesta, 0 escrituras nuevas", async () => {
    ddbMock.on(GetCommand, { TableName: "Idempotency" }).resolves(stored(payloadHash(body)));
    const r = await handler(ev());
    expect(r.statusCode).toBe(201);
    expect(parse(r).donationId).toBe("d1");
    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });

  it("T07 misma clave con otra carga → 409", async () => {
    ddbMock.on(GetCommand, { TableName: "Idempotency" }).resolves(stored(payloadHash(body)));
    const r = await handler(ev({ body: { ...body, amountCents: 9900 } }));
    expect(r.statusCode).toBe(409);
    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(0);
  });

  it("registro expirado se ignora y crea una nueva donación", async () => {
    ddbMock.on(GetCommand, { TableName: "Idempotency" }).resolves(stored("otro", 10));
    expect((await handler(ev())).statusCode).toBe(201);
    expect(ddbMock.commandCalls(TransactWriteCommand)).toHaveLength(1);
  });

  it("la clave se aísla por donante (pk incluye el sub)", () => {
    expect(idempotencyPk(DONOR_A, IDEM_KEY)).not.toBe(idempotencyPk(DONOR_B, IDEM_KEY));
    const get = async () => {
      await handler(ev({ sub: DONOR_B }));
      return ddbMock
        .commandCalls(GetCommand)
        .find((c) => c.args[0].input.TableName === "Idempotency")!.args[0].input.Key;
    };
    return expect(get()).resolves.toEqual({ pk: `${DONOR_B}#createDonation#${IDEM_KEY}` });
  });

  it("carrera con la misma clave: TransactionCanceled en la reserva → relee y devuelve la respuesta almacenada", async () => {
    ddbMock
      .on(GetCommand, { TableName: "Idempotency" })
      .resolvesOnce({})
      .resolves(stored(payloadHash(body)));
    ddbMock.on(TransactWriteCommand).rejects(
      Object.assign(new Error("tx"), {
        name: "TransactionCanceledException",
        CancellationReasons: [
          { Code: "ConditionalCheckFailed" },
          { Code: "None" },
          { Code: "None" },
        ],
      }),
    );
    const r = await handler(ev());
    expect(r.statusCode).toBe(201);
    expect(parse(r).donationId).toBe("d1");
  });

  it("payloadHash es SHA-256 canónico e independiente del orden", () => {
    expect(payloadHash({ amountCents: 2500, projectId: PROJECT_ID })).toBe(payloadHash(body));
    expect(payloadHash(body)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("expiresAt = ahora + 86400", async () => {
    const before = Math.floor(Date.now() / 1000);
    await handler(ev());
    const put =
      ddbMock.commandCalls(TransactWriteCommand)[0]!.args[0].input.TransactItems![0]!.Put!.Item!;
    expect(put.expiresAt).toBeGreaterThanOrEqual(before + 86400);
    expect(put.expiresAt).toBeLessThanOrEqual(before + 86401);
  });
});

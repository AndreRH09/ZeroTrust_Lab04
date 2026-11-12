// @trace HU-08, HU-04, CA-08.1, CA-08.2, CA-08.3, CA-04.1, T03
import { mockClient } from "aws-sdk-client-mock";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { beforeEach, describe, expect, it } from "vitest";
import { handler } from "../../../src/projects/manageProjects.js";
import { DONOR_A, GESTOR, makeEvent, parse, PROJECT_ID } from "../../helpers.js";

const ddbMock = mockClient(DynamoDBDocumentClient);
beforeEach(() => {
  ddbMock.reset();
  ddbMock.on(PutCommand).resolves({});
});

const ccf = () => Object.assign(new Error("cond"), { name: "ConditionalCheckFailedException" });
const valid = {
  title: "Biblioteca rural",
  description: "Libros para escuelas de Arequipa",
  goalAmountCents: 500000,
};
const draft = {
  projectId: PROJECT_ID,
  ...valid,
  confirmedAmountCents: 0,
  currency: "PEN",
  status: "BORRADOR",
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};
const auditTypes = () =>
  ddbMock
    .commandCalls(PutCommand)
    .map((c) => c.args[0].input)
    .filter((i) => i.TableName === "AuditEvents")
    .map((i) => i.Item?.eventType);

describe("POST /v1/projects", () => {
  const ev = (sub: string, groups: string[], body: unknown = valid) =>
    makeEvent({ routeKey: "POST /v1/projects", sub, groups, body });

  it("CA-08.1 GESTOR crea en BORRADOR + PROJECT_CREATED", async () => {
    const r = await handler(ev(GESTOR, ["GESTOR"]));
    expect(r.statusCode).toBe(201);
    expect(parse(r)).toMatchObject({
      status: "BORRADOR",
      confirmedAmountCents: 0,
      currency: "PEN",
    });
    expect(auditTypes()).toEqual(["PROJECT_CREATED"]);
  });

  it.each([0, -5, 1.5])("objetivo %s → 400", async (g) => {
    const r = await handler(ev(GESTOR, ["GESTOR"], { ...valid, goalAmountCents: g }));
    expect(r.statusCode).toBe(400);
  });

  it.each([
    ["DONANTE", ["DONANTE"]],
    ["AUDITOR", ["AUDITOR"]],
    ["sin grupo", []],
  ])("T03 %s → 403 + AUTHZ_DENIED, sin escribir proyecto", async (_n, groups) => {
    const r = await handler(ev(DONOR_A, groups as string[]));
    expect(r.statusCode).toBe(403);
    expect(auditTypes()).toEqual(["AUTHZ_DENIED"]);
    expect(
      ddbMock.commandCalls(PutCommand).some((c) => c.args[0].input.TableName === "Projects"),
    ).toBe(false);
  });

  it("403 aunque el body sea inválido (autoriza antes de validar)", async () => {
    const r = await handler(ev(DONOR_A, ["DONANTE"], { nada: true }));
    expect(r.statusCode).toBe(403);
  });

  it("sin token → 401", async () => {
    const r = await handler(makeEvent({ routeKey: "POST /v1/projects", body: valid }));
    expect(r.statusCode).toBe(401);
  });
});

describe("PATCH /v1/projects/{projectId}", () => {
  const ev = (body: unknown) =>
    makeEvent({
      routeKey: "PATCH /v1/projects/{projectId}",
      sub: GESTOR,
      groups: ["GESTOR"],
      body,
      pathParameters: { projectId: PROJECT_ID },
    });

  it("edita BORRADOR → 200 con condición status = BORRADOR", async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { ...draft, title: "Nuevo título" } });
    const r = await handler(ev({ title: "Nuevo título" }));
    expect(r.statusCode).toBe(200);
    const u = ddbMock.commandCalls(UpdateCommand)[0]!.args[0].input;
    expect(u.ConditionExpression).toContain("#s = :draft");
    expect(auditTypes()).toEqual(["PROJECT_UPDATED"]);
  });

  it("editar PUBLICADO → 409", async () => {
    ddbMock.on(UpdateCommand).rejects(ccf());
    ddbMock.on(GetCommand).resolves({ Item: { ...draft, status: "PUBLICADO" } });
    expect((await handler(ev({ title: "Otro título" }))).statusCode).toBe(409);
  });

  it("inexistente → 404", async () => {
    ddbMock.on(UpdateCommand).rejects(ccf());
    ddbMock.on(GetCommand).resolves({});
    expect((await handler(ev({ title: "Otro título" }))).statusCode).toBe(404);
  });

  it("body vacío o con status → 400", async () => {
    expect((await handler(ev({}))).statusCode).toBe(400);
    expect((await handler(ev({ status: "PUBLICADO" }))).statusCode).toBe(400);
  });
});

describe("PATCH /v1/projects/{projectId}/publish (CA-08.2)", () => {
  const ev = (sub = GESTOR, groups = ["GESTOR"]) =>
    makeEvent({
      routeKey: "PATCH /v1/projects/{projectId}/publish",
      sub,
      groups,
      pathParameters: { projectId: PROJECT_ID },
    });

  it("publica BORRADOR → 200 + PROJECT_PUBLISHED", async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { ...draft, status: "PUBLICADO" } });
    const r = await handler(ev());
    expect(r.statusCode).toBe(200);
    expect(parse(r).status).toBe("PUBLICADO");
    expect(auditTypes()).toEqual(["PROJECT_PUBLISHED"]);
  });

  it("republicar → 409", async () => {
    ddbMock.on(UpdateCommand).rejects(ccf());
    ddbMock.on(GetCommand).resolves({ Item: { ...draft, status: "PUBLICADO" } });
    expect((await handler(ev())).statusCode).toBe(409);
  });

  it("T03 DONANTE publica → 403", async () => {
    expect((await handler(ev(DONOR_A, ["DONANTE"]))).statusCode).toBe(403);
    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(0);
  });
});

describe("GET /v1/manage/projects", () => {
  it("GESTOR ve BORRADOR y PUBLICADO", async () => {
    ddbMock
      .on(QueryCommand, { ExpressionAttributeValues: { ":s": "BORRADOR" } })
      .resolves({ Items: [draft] })
      .on(QueryCommand, { ExpressionAttributeValues: { ":s": "PUBLICADO" } })
      .resolves({
        Items: [
          { ...draft, projectId: "p2", status: "PUBLICADO", createdAt: "2026-11-02T00:00:00.000Z" },
        ],
      });
    const r = await handler(
      makeEvent({ routeKey: "GET /v1/manage/projects", sub: GESTOR, groups: ["GESTOR"] }),
    );
    expect(r.statusCode).toBe(200);
    expect(parse(r).items.map((p: { status: string }) => p.status)).toEqual([
      "PUBLICADO",
      "BORRADOR",
    ]);
  });

  it("DONANTE → 403", async () => {
    const r = await handler(
      makeEvent({ routeKey: "GET /v1/manage/projects", sub: DONOR_A, groups: ["DONANTE"] }),
    );
    expect(r.statusCode).toBe(403);
  });
});

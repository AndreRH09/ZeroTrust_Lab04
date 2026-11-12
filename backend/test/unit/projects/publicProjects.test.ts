// @trace HU-01, HU-02, HU-09, CA-01.1, CA-01.2, CA-01.3, CA-02.1, CA-02.2, CA-09.1, CA-09.2, T01
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { beforeEach, describe, expect, it } from "vitest";
import { handler } from "../../../src/projects/publicProjects.js";
import { makeEvent, parse, PROJECT_ID } from "../../helpers.js";

const ddbMock = mockClient(DynamoDBDocumentClient);
beforeEach(() => ddbMock.reset());

const published = {
  projectId: PROJECT_ID,
  title: "Comedor popular",
  description: "Alimentación para 50 familias",
  goalAmountCents: 100000,
  confirmedAmountCents: 25000,
  currency: "PEN",
  status: "PUBLICADO",
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
  createdByRef: "abc123",
};

describe("GET /v1/projects (T01)", () => {
  it("consulta el GSI status-createdAt con status = PUBLICADO", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [published] });
    const r = await handler(makeEvent({ routeKey: "GET /v1/projects" }));
    expect(r.statusCode).toBe(200);
    const q = ddbMock.commandCalls(QueryCommand)[0]!.args[0].input;
    expect(q.IndexName).toBe("status-createdAt");
    expect(q.ExpressionAttributeValues).toEqual({ ":s": "PUBLICADO" });
    const body = parse(r);
    expect(body.items[0]).toMatchObject({
      title: "Comedor popular",
      goalAmountCents: 100000,
      confirmedAmountCents: 25000,
      currency: "PEN",
    });
  });

  it("CA-01.2 nunca devuelve BORRADOR ni createdByRef", async () => {
    ddbMock
      .on(QueryCommand)
      .resolves({ Items: [published, { ...published, projectId: "x", status: "BORRADOR" }] });
    const body = parse(await handler(makeEvent({ routeKey: "GET /v1/projects" })));
    expect(body.items).toHaveLength(1);
    expect(body.items.every((p: { status: string }) => p.status === "PUBLICADO")).toBe(true);
    expect(JSON.stringify(body)).not.toContain("createdByRef");
  });

  it("CA-01.3 sin proyectos → 200 { items: [] }", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const r = await handler(makeEvent({ routeKey: "GET /v1/projects" }));
    expect(r.statusCode).toBe(200);
    expect(parse(r)).toEqual({ items: [] });
  });
});

describe("GET /v1/projects/{projectId} (HU-02)", () => {
  const ev = (projectId: string) =>
    makeEvent({ routeKey: "GET /v1/projects/{projectId}", pathParameters: { projectId } });

  it("CA-02.1 PUBLICADO → 200 sin datos de donantes", async () => {
    ddbMock.on(GetCommand).resolves({ Item: published });
    const r = await handler(ev(PROJECT_ID));
    expect(r.statusCode).toBe(200);
    const body = parse(r);
    expect(body).toMatchObject({
      projectId: PROJECT_ID,
      status: "PUBLICADO",
      description: published.description,
    });
    expect(body).not.toHaveProperty("createdByRef");
  });

  it("CA-02.2 BORRADOR, inexistente y no-UUID → 404 con el mismo cuerpo", async () => {
    ddbMock
      .on(GetCommand)
      .resolvesOnce({ Item: { ...published, status: "BORRADOR" } })
      .resolvesOnce({});
    const a = await handler(ev(PROJECT_ID));
    const b = await handler(ev(PROJECT_ID));
    const c = await handler(ev("no-es-uuid"));
    for (const r of [a, b, c]) expect(r.statusCode).toBe(404);
    expect(parse(a).message).toBe(parse(b).message);
    expect(a.body).not.toContain("BORRADOR");
  });
});

describe("GET /v1/projects/{projectId}/stats (HU-09)", () => {
  const ev = makeEvent({
    routeKey: "GET /v1/projects/{projectId}/stats",
    pathParameters: { projectId: PROJECT_ID },
  });

  it("CA-09.1 devuelve solo acumulado confirmado y progreso entero", async () => {
    ddbMock.on(GetCommand).resolves({ Item: published });
    const body = parse(await handler(ev));
    expect(body).toEqual({
      projectId: PROJECT_ID,
      goalAmountCents: 100000,
      confirmedAmountCents: 25000,
      currency: "PEN",
      progressPercent: 25,
    });
  });

  it("progreso puede superar 100", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { ...published, confirmedAmountCents: 150000 } });
    expect(parse(await handler(ev)).progressPercent).toBe(150);
  });

  it("CA-09.2 no expone donorSub ni registros individuales", async () => {
    ddbMock.on(GetCommand).resolves({ Item: published });
    const s = (await handler(ev)).body!;
    expect(s).not.toMatch(/donorSub|donations|items/);
  });

  it("BORRADOR → 404", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { ...published, status: "BORRADOR" } });
    expect((await handler(ev)).statusCode).toBe(404);
  });
});

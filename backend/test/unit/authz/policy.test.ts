// @trace HU-04, HU-07, HU-08, HU-10, CA-04.1, CA-04.2, CA-07.2, CA-10.1, T03, T09, T12
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { beforeEach, describe, expect, it } from "vitest";
import { type Action, authorize, decideEmbedded } from "../../../src/authz/policy.js";
import type { Group, Principal } from "../../../src/authz/principal.js";
import { DONOR_A, DONOR_B } from "../../helpers.js";

const ddbMock = mockClient(DynamoDBDocumentClient);
beforeEach(() => ddbMock.reset());

const who = (groups: Group[], sub = DONOR_A): Principal => ({ sub, groups, scopes: [] });

type Row = [Action, Record<"VISITANTE" | "DONANTE" | "GESTOR" | "AUDITOR" | "MULTI", boolean>];
const matrix: Row[] = [
  [
    "projects:create",
    { VISITANTE: false, DONANTE: false, GESTOR: true, AUDITOR: false, MULTI: true },
  ],
  [
    "projects:update",
    { VISITANTE: false, DONANTE: false, GESTOR: true, AUDITOR: false, MULTI: true },
  ],
  [
    "projects:publish",
    { VISITANTE: false, DONANTE: false, GESTOR: true, AUDITOR: false, MULTI: true },
  ],
  [
    "projects:listManage",
    { VISITANTE: false, DONANTE: false, GESTOR: true, AUDITOR: false, MULTI: true },
  ],
  [
    "donations:create",
    { VISITANTE: false, DONANTE: true, GESTOR: false, AUDITOR: false, MULTI: true },
  ],
  [
    "donations:simulate",
    { VISITANTE: false, DONANTE: true, GESTOR: false, AUDITOR: false, MULTI: true },
  ],
  [
    "donations:readOwn",
    { VISITANTE: false, DONANTE: true, GESTOR: false, AUDITOR: false, MULTI: true },
  ],
  [
    "donations:readById",
    { VISITANTE: false, DONANTE: true, GESTOR: false, AUDITOR: false, MULTI: true },
  ],
  ["audit:read", { VISITANTE: false, DONANTE: false, GESTOR: false, AUDITOR: true, MULTI: false }],
];
const roles: Record<string, Group[]> = {
  VISITANTE: [],
  DONANTE: ["DONANTE"],
  GESTOR: ["GESTOR"],
  AUDITOR: ["AUDITOR"],
  MULTI: ["DONANTE", "GESTOR"],
};

describe("matriz acción × rol (T03, T12)", () => {
  for (const [action, expected] of matrix) {
    for (const [role, allowed] of Object.entries(expected)) {
      it(`${role} ${allowed ? "puede" : "NO puede"} ${action}`, () => {
        const d = decideEmbedded(who(roles[role]!), action);
        expect(d.allow).toBe(allowed);
        if (!allowed) expect(d).toEqual({ allow: false, reason: "FORBIDDEN" });
      });
    }
  }
});

describe("ownership (T09, CA-07.2)", () => {
  it("donación ajena → NOT_FOUND (no revela existencia)", () => {
    const d = decideEmbedded(who(["DONANTE"], DONOR_B), "donations:readById", {
      donorSub: DONOR_A,
    });
    expect(d).toEqual({ allow: false, reason: "NOT_FOUND" });
  });
  it("donación propia → permitido", () => {
    expect(
      decideEmbedded(who(["DONANTE"]), "donations:simulate", { donorSub: DONOR_A }).allow,
    ).toBe(true);
  });
  it("rol se evalúa antes que propietario: GESTOR sobre donación ajena → FORBIDDEN (T12)", () => {
    const d = decideEmbedded(who(["GESTOR"], DONOR_B), "donations:readById", { donorSub: DONOR_A });
    expect(d).toEqual({ allow: false, reason: "FORBIDDEN" });
  });
});

describe("authorize registra AUTHZ_DENIED", () => {
  const ctx = { requestId: "req-1", routeKey: "POST /v1/projects" };

  it("CA-04.1 DONANTE crea proyecto → 403 + evento", async () => {
    ddbMock.on(PutCommand).resolves({});
    await expect(authorize(ctx, who(["DONANTE"]), "projects:create")).rejects.toMatchObject({
      status: 403,
    });
    const put = ddbMock.commandCalls(PutCommand)[0]!.args[0].input;
    expect(put.Item).toMatchObject({ eventType: "AUTHZ_DENIED", outcome: "DENIED" });
    expect(JSON.stringify(put.Item)).not.toContain(DONOR_A);
  });

  it("propietario distinto → 404 + evento", async () => {
    ddbMock.on(PutCommand).resolves({});
    await expect(
      authorize(ctx, who(["DONANTE"], DONOR_B), "donations:readById", {
        donorSub: DONOR_A,
        ref: "donation:x",
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(1);
  });

  it("permitido → no audita denegación", async () => {
    await authorize(ctx, who(["GESTOR"]), "projects:create");
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
  });
});

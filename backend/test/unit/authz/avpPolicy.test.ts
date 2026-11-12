// @trace HU-12, CA-12.1, CA-12.2, T03, T09, T12
// Reutiliza la matriz embebida contra el adaptador AVP; el cliente simula la evaluación de las
// políticas Cedar de policies/*.cedar y debe producir decisiones idénticas.
import { mockClient } from "aws-sdk-client-mock";
import {
  IsAuthorizedCommand,
  type IsAuthorizedCommandInput,
  VerifiedPermissionsClient,
} from "@aws-sdk/client-verifiedpermissions";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decideWithAvp } from "../../../src/authz/avpPolicy.js";
import {
  type Action,
  decideEmbedded,
  OWNERSHIP_ACTIONS,
  ROLE_MATRIX,
} from "../../../src/authz/policy.js";
import type { Group, Principal } from "../../../src/authz/principal.js";
import { DONOR_A, DONOR_B } from "../../helpers.js";

const avpMock = mockClient(VerifiedPermissionsClient);

/** Evaluador de las políticas Cedar del repositorio (permit por grupo + forbid por propietario). */
function cedarEval(input: IsAuthorizedCommandInput): "ALLOW" | "DENY" {
  const action = input.action!.actionId as Action;
  const entities = input.entities!.entityList!;
  const user = entities.find((e) => e.identifier!.entityType === "Aqp::User")!;
  const groups = (user.parents ?? []).map((p) => p.entityId);
  const permitted = ROLE_MATRIX[action].some((g) => groups.includes(g));
  if (!permitted) return "DENY";
  if (input.resource!.entityType === "Aqp::Donation" && OWNERSHIP_ACTIONS.has(action)) {
    const res = entities.find((e) => e.identifier!.entityType === "Aqp::Donation")!;
    if (res.attributes!.donorSub!.string !== user.attributes!.sub!.string) return "DENY";
  }
  return "ALLOW";
}

beforeAll(() => {
  process.env.AVP_POLICY_STORE_ID = "ps-test";
  avpMock.on(IsAuthorizedCommand).callsFake((input) => ({ decision: cedarEval(input) }));
});
afterAll(() => {
  delete process.env.AVP_POLICY_STORE_ID;
});

const roles: Group[][] = [[], ["DONANTE"], ["GESTOR"], ["AUDITOR"], ["DONANTE", "GESTOR"]];
const actions = Object.keys(ROLE_MATRIX) as Action[];

describe("AVP produce las mismas decisiones que el motor embebido (CA-12.2)", () => {
  for (const groups of roles) {
    for (const action of actions) {
      for (const owner of [DONOR_A, DONOR_B]) {
        const p: Principal = { sub: DONOR_A, groups, scopes: [] };
        const resource = OWNERSHIP_ACTIONS.has(action) ? { donorSub: owner } : undefined;
        it(`[${groups.join(",") || "sin grupo"}] ${action} owner=${owner === DONOR_A ? "propio" : "ajeno"}`, async () => {
          expect(await decideWithAvp(p, action, resource)).toEqual(
            decideEmbedded(p, action, resource),
          );
        });
      }
    }
  }

  it("envía principal, acción y grupos como padres", async () => {
    avpMock.resetHistory();
    await decideWithAvp({ sub: DONOR_A, groups: ["GESTOR"], scopes: [] }, "projects:create");
    const input = avpMock.commandCalls(IsAuthorizedCommand)[0]!.args[0].input;
    expect(input.policyStoreId).toBe("ps-test");
    expect(input.action).toEqual({ actionType: "Aqp::Action", actionId: "projects:create" });
    expect(input.entities!.entityList![0]!.parents).toEqual([
      { entityType: "Aqp::Group", entityId: "GESTOR" },
    ]);
  });
});

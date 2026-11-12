// Policy Engine externo: Amazon Verified Permissions + Cedar (HU-12, CA-12.1).
// Dos evaluaciones para conservar la semántica 403/404 del motor embebido:
//   1) acción sobre Aqp::Application::"api"  → denegado = FORBIDDEN (rol)
//   2) acción sobre Aqp::Donation (si aplica) → denegado = NOT_FOUND (propietario)
import {
  IsAuthorizedCommand,
  VerifiedPermissionsClient,
  type EntityItem,
} from "@aws-sdk/client-verifiedpermissions";
import type { Action, Decision, OwnedResource } from "./policy.js";
import type { Principal } from "./principal.js";

let client: VerifiedPermissionsClient | undefined;
export function avpClient(): VerifiedPermissionsClient {
  client ??= new VerifiedPermissionsClient({});
  return client;
}

const NS = "Aqp";

function principalEntity(p: Principal): EntityItem {
  return {
    identifier: { entityType: `${NS}::User`, entityId: p.sub },
    attributes: { sub: { string: p.sub } },
    parents: p.groups.map((g) => ({ entityType: `${NS}::Group`, entityId: g })),
  };
}

async function isAllowed(
  principal: Principal,
  action: Action,
  resource: { entityType: string; entityId: string },
  extraEntities: EntityItem[] = [],
): Promise<boolean> {
  const policyStoreId = process.env.AVP_POLICY_STORE_ID;
  if (!policyStoreId) throw new Error("AVP_POLICY_STORE_ID no definido");
  const out = await avpClient().send(
    new IsAuthorizedCommand({
      policyStoreId,
      principal: { entityType: `${NS}::User`, entityId: principal.sub },
      action: { actionType: `${NS}::Action`, actionId: action },
      resource,
      entities: { entityList: [principalEntity(principal), ...extraEntities] },
    }),
  );
  return out.decision === "ALLOW";
}

export async function decideWithAvp(
  principal: Principal,
  action: Action,
  resource?: OwnedResource,
): Promise<Decision> {
  const app = { entityType: `${NS}::Application`, entityId: "api" };
  if (!(await isAllowed(principal, action, app))) return { allow: false, reason: "FORBIDDEN" };
  if (resource) {
    const donation = { entityType: `${NS}::Donation`, entityId: "target" };
    const ok = await isAllowed(principal, action, donation, [
      { identifier: donation, attributes: { donorSub: { string: resource.donorSub } } },
    ]);
    if (!ok) return { allow: false, reason: "NOT_FOUND" };
  }
  return { allow: true };
}

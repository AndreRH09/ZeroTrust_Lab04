// Policy Engine (PE) embebido: RBAC por cognito:groups + ownership por sub (AD-08, CA-04.1..3,
// CA-07.2). `decide` es el punto de reemplazo por Amazon Verified Permissions (HU-12).
import { record } from "../audit/record.js";
import type { RequestCtx } from "../shared/http.js";
import { forbidden, notFound } from "../shared/http.js";
import { decideWithAvp } from "./avpPolicy.js";
import type { Group, Principal } from "./principal.js";

export type Action =
  | "projects:create"
  | "projects:update"
  | "projects:publish"
  | "projects:listManage"
  | "donations:create"
  | "donations:simulate"
  | "donations:readOwn"
  | "donations:readById"
  | "audit:read";

/** Recurso persistido sobre el que se evalúa la propiedad (BOLA). */
export interface OwnedResource {
  donorSub: string;
}

export type Decision = { allow: true } | { allow: false; reason: "FORBIDDEN" | "NOT_FOUND" };

export const ROLE_MATRIX: Record<Action, readonly Group[]> = {
  "projects:create": ["GESTOR"],
  "projects:update": ["GESTOR"],
  "projects:publish": ["GESTOR"],
  "projects:listManage": ["GESTOR"],
  "donations:create": ["DONANTE"],
  "donations:simulate": ["DONANTE"],
  "donations:readOwn": ["DONANTE"],
  "donations:readById": ["DONANTE"],
  "audit:read": ["AUDITOR"],
};

export const OWNERSHIP_ACTIONS: ReadonlySet<Action> = new Set([
  "donations:simulate",
  "donations:readById",
]);

/** Decisión pura (sin efectos): primero rol (403), luego propietario (404, sin revelar existencia). */
export function decideEmbedded(
  principal: Principal,
  action: Action,
  resource?: OwnedResource,
): Decision {
  const allowed = ROLE_MATRIX[action];
  if (!principal.groups.some((g) => allowed.includes(g))) {
    return { allow: false, reason: "FORBIDDEN" };
  }
  if (OWNERSHIP_ACTIONS.has(action) && resource && resource.donorSub !== principal.sub) {
    return { allow: false, reason: "NOT_FOUND" };
  }
  return { allow: true };
}

export async function decide(
  principal: Principal,
  action: Action,
  resource?: OwnedResource,
): Promise<Decision> {
  if (process.env.AUTHZ_ENGINE === "avp") return decideWithAvp(principal, action, resource);
  return decideEmbedded(principal, action, resource);
}

/**
 * Autoriza o lanza 403/404. Toda denegación registra AUTHZ_DENIED (research R-08).
 */
export async function authorize(
  ctx: RequestCtx,
  principal: Principal,
  action: Action,
  resource?: OwnedResource & { ref: string },
): Promise<void> {
  const decision = await decide(principal, action, resource);
  if (decision.allow) return;
  await record({
    eventType: "AUTHZ_DENIED",
    requestId: ctx.requestId,
    sub: principal.sub,
    action,
    resourceRef: resource?.ref ?? ctx.routeKey,
    outcome: "DENIED",
  });
  throw decision.reason === "NOT_FOUND" ? notFound() : forbidden();
}

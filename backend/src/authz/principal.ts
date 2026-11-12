// Deriva el principal SOLO de los claims verificados por el JWT authorizer (CA-04.3, CA-NF02.2).
// Cualquier sub/groups/role que llegue en body, query o headers se ignora.
import type { ApiEvent } from "../shared/http.js";
import { unauthorized } from "../shared/http.js";

export type Group = "DONANTE" | "GESTOR" | "AUDITOR";
const KNOWN_GROUPS: readonly Group[] = ["DONANTE", "GESTOR", "AUDITOR"];

export interface Principal {
  sub: string;
  groups: Group[];
  scopes: string[];
}

/**
 * API Gateway HTTP API serializa los arrays de claims como "[A B]".
 * También se acepta array real por compatibilidad.
 */
export function parseGroups(raw: unknown): Group[] {
  let values: string[] = [];
  if (Array.isArray(raw)) values = raw.map(String);
  else if (typeof raw === "string") {
    values = raw
      .replace(/^\[|\]$/g, "")
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return KNOWN_GROUPS.filter((g) => values.includes(g));
}

export function getPrincipal(event: ApiEvent): Principal {
  const jwt = event.requestContext?.authorizer?.jwt;
  const claims = jwt?.claims;
  const sub = claims?.sub;
  if (!claims || typeof sub !== "string" || sub.length === 0) throw unauthorized();
  // Defensa en profundidad: solo access tokens (un ID token ya es rechazado por scopes en el PEP).
  if (claims.token_use !== undefined && claims.token_use !== "access") throw unauthorized();
  const scopes = jwt?.scopes ?? (typeof claims.scope === "string" ? claims.scope.split(" ") : []);
  return { sub, groups: parseGroups(claims["cognito:groups"]), scopes };
}

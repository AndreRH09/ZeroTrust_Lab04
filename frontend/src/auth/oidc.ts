// Cliente OIDC: Authorization Code + PKCE con Cognito (CA-03.1, research R-04).
// - Tokens SOLO en memoria (InMemoryWebStorage) → nunca en localStorage/sessionStorage (CA-NF11.1).
// - El stateStore usa sessionStorage únicamente para state + code_verifier durante la redirección
//   (deben sobrevivir al viaje a managed login); oidc-client-ts lo borra al volver. No son tokens.
// - Logout: revoca el refresh token (/oauth2/revoke), limpia memoria y cierra la sesión de
//   managed login (/logout) (CA-03.3).
import { InMemoryWebStorage, UserManager, WebStorageStateStore } from "oidc-client-ts";
import { config } from "../config";

export function createUserManager(origin = window.location.origin): UserManager {
  return new UserManager({
    authority: config.authority,
    client_id: config.clientId,
    redirect_uri: `${origin}/callback`,
    post_logout_redirect_uri: `${origin}/`,
    response_type: "code",
    scope: config.scopes.join(" "),
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
    stateStore: new WebStorageStateStore({ store: window.sessionStorage, prefix: "oidc.pkce." }),
    automaticSilentRenew: true,
    revokeTokenTypes: ["refresh_token"],
    revokeTokensOnSignout: true,
    loadUserInfo: false,
    metadataSeed: {
      revocation_endpoint: `${config.cognitoDomain}/oauth2/revoke`,
      end_session_endpoint: `${config.cognitoDomain}/logout`,
    },
  });
}

/** Cierra sesión: revoca refresh token, borra tokens de memoria y sale de managed login. */
export async function logout(um: UserManager, origin = window.location.origin): Promise<string> {
  try {
    await um.revokeTokens(["refresh_token"]);
  } finally {
    await um.removeUser();
  }
  const params = new URLSearchParams({ client_id: config.clientId, logout_uri: `${origin}/` });
  return `${config.cognitoDomain}/logout?${params.toString()}`;
}

/** Lee los grupos del access token SOLO para adaptar la interfaz; el backend decide (CA-04.3). */
export function groupsFromAccessToken(accessToken: string | undefined): string[] {
  if (!accessToken) return [];
  try {
    const payload = accessToken.split(".")[1] ?? "";
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const groups = (JSON.parse(json) as Record<string, unknown>)["cognito:groups"];
    return Array.isArray(groups) ? groups.map(String) : [];
  } catch {
    return [];
  }
}

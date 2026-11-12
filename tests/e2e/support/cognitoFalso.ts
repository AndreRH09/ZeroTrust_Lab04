// Cognito falso (managed login + OAuth2) para E2E. Verifica PKCE de verdad:
// SHA-256(code_verifier) en base64url debe coincidir con el code_challenge del /authorize.
import { createHash, randomUUID } from "node:crypto";
import type { Page, Route } from "@playwright/test";
import { type BackendFalso, USUARIOS, type UsuarioPrueba } from "./backendFalso";
import { CLIENT_ID, COGNITO_AUTHORITY, COGNITO_DOMAIN } from "./entorno";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, authorization",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const jwt = (payload: Record<string, unknown>) =>
  `${b64url(JSON.stringify({ alg: "RS256", kid: "e2e", typ: "JWT" }))}.${b64url(JSON.stringify(payload))}.${b64url("firma-e2e")}`;

interface Autorizacion {
  usuario: UsuarioPrueba;
  codeChallenge: string;
  redirectUri: string;
  nonce: string | null;
}

export class CognitoFalso {
  /** Usuario que "inicia sesión" en el próximo /authorize (managed login simulado). */
  siguienteUsuario: UsuarioPrueba = USUARIOS.donante;
  /** Si es true, el endpoint /token responde invalid_grant (p. ej. PKCE inválido). */
  rechazarToken = false;
  readonly authorize: URL[] = [];
  readonly intercambios: { pkceValido: boolean; grantType: string }[] = [];
  readonly revocaciones: string[] = [];
  readonly logouts: URL[] = [];
  readonly emitidos: { access: string; id: string; refresh: string }[] = [];
  private readonly codigos = new Map<string, Autorizacion>();

  constructor(private readonly backend: BackendFalso) {}

  async instalar(page: Page) {
    await page.route(`${COGNITO_AUTHORITY}/.well-known/**`, (r) => this.metadata(r));
    await page.route(`${COGNITO_DOMAIN}/**`, (r) => this.atender(r));
  }

  private metadata(route: Route) {
    const url = route.request().url();
    const body = url.endsWith("jwks.json")
      ? { keys: [] }
      : {
          issuer: COGNITO_AUTHORITY,
          authorization_endpoint: `${COGNITO_DOMAIN}/oauth2/authorize`,
          token_endpoint: `${COGNITO_DOMAIN}/oauth2/token`,
          userinfo_endpoint: `${COGNITO_DOMAIN}/oauth2/userInfo`,
          revocation_endpoint: `${COGNITO_DOMAIN}/oauth2/revoke`,
          end_session_endpoint: `${COGNITO_DOMAIN}/logout`,
          jwks_uri: `${COGNITO_AUTHORITY}/.well-known/jwks.json`,
          response_types_supported: ["code", "token"],
          code_challenge_methods_supported: ["S256"],
          subject_types_supported: ["public"],
          id_token_signing_alg_values_supported: ["RS256"],
        };
    return route.fulfill({
      status: 200,
      headers: { ...CORS, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  private async atender(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });

    if (url.pathname === "/oauth2/authorize") {
      this.authorize.push(url);
      const p = url.searchParams;
      const redirectUri = p.get("redirect_uri") ?? "";
      const valido =
        p.get("response_type") === "code" &&
        p.get("client_id") === CLIENT_ID &&
        p.get("code_challenge_method") === "S256" &&
        Boolean(p.get("code_challenge"));
      if (!valido) return route.fulfill({ status: 400, body: "invalid_request" });
      const code = randomUUID();
      this.codigos.set(code, {
        usuario: this.siguienteUsuario,
        codeChallenge: p.get("code_challenge")!,
        redirectUri,
        nonce: p.get("nonce"),
      });
      const destino = new URL(redirectUri);
      destino.searchParams.set("code", code);
      destino.searchParams.set("state", p.get("state") ?? "");
      return route.fulfill({ status: 302, headers: { location: destino.toString() } });
    }

    if (url.pathname === "/oauth2/token" && req.method() === "POST") {
      const form = new URLSearchParams(req.postData() ?? "");
      const grantType = form.get("grant_type") ?? "";
      const auth = this.codigos.get(form.get("code") ?? "");
      const verifier = form.get("code_verifier") ?? "";
      const pkceValido =
        Boolean(auth) &&
        b64url(createHash("sha256").update(verifier).digest()) === auth!.codeChallenge;
      this.intercambios.push({ pkceValido, grantType });
      if (
        this.rechazarToken ||
        grantType !== "authorization_code" ||
        !auth ||
        !pkceValido ||
        form.get("redirect_uri") !== auth.redirectUri
      ) {
        return route.fulfill({
          status: 400,
          headers: { ...CORS, "content-type": "application/json" },
          body: JSON.stringify({ error: "invalid_grant" }),
        });
      }
      this.codigos.delete(form.get("code")!);
      return route.fulfill({
        status: 200,
        headers: { ...CORS, "content-type": "application/json" },
        body: JSON.stringify(this.emitir(auth)),
      });
    }

    if (url.pathname === "/oauth2/revoke" && req.method() === "POST") {
      this.revocaciones.push(new URLSearchParams(req.postData() ?? "").get("token") ?? "");
      return route.fulfill({ status: 200, headers: CORS, body: "" });
    }

    if (url.pathname === "/logout") {
      this.logouts.push(url);
      return route.fulfill({
        status: 302,
        headers: { location: url.searchParams.get("logout_uri") ?? "/" },
      });
    }

    return route.fulfill({ status: 404, headers: CORS, body: "" });
  }

  private emitir(auth: Autorizacion) {
    const ahora = Math.floor(Date.now() / 1000);
    const comunes = {
      sub: auth.usuario.sub,
      iss: COGNITO_AUTHORITY,
      iat: ahora,
      exp: ahora + 900,
      "cognito:groups": auth.usuario.grupos,
    };
    const access = jwt({
      ...comunes,
      token_use: "access",
      client_id: CLIENT_ID,
      scope:
        "openid email api/projects.write api/donations.write api/donations.read api/audit.read",
      jti: randomUUID(),
    });
    const id = jwt({
      ...comunes,
      token_use: "id",
      aud: CLIENT_ID,
      email: auth.usuario.email,
      ...(auth.nonce ? { nonce: auth.nonce } : {}),
    });
    const refresh = `refresh-${randomUUID()}`;
    this.backend.tokens.set(access, auth.usuario);
    this.emitidos.push({ access, id, refresh });
    return {
      access_token: access,
      id_token: id,
      refresh_token: refresh,
      token_type: "Bearer",
      expires_in: 900,
    };
  }
}

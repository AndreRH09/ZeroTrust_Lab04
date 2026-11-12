#!/usr/bin/env node
// Obtiene tokens del app client de la SPA mediante Authorization Code + PKCE para las pruebas de
// API (Bruno, T08, T11, T13). Abre la URL que imprime, inicia sesión con un usuario de prueba y el
// script recibe el código en http://localhost:5173/callback (callback registrada en Cognito).
// Los tokens se imprimen como `export VAR=...` en la terminal: NO los guardes en el repositorio.
//
// Uso: COGNITO_DOMAIN=https://<prefijo>.auth.us-east-2.amazoncognito.com CLIENT_ID=<SpaClientId> \
//      node scripts/get-tokens.mjs DONOR   # prefijo de las variables: DONOR, DONOR_B, GESTOR...
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";

const domain = (process.env.COGNITO_DOMAIN ?? "").replace(/\/+$/, "");
const clientId = process.env.CLIENT_ID ?? "";
const prefix = (process.argv[2] ?? "DONOR").toUpperCase();
if (!domain || !clientId) {
  console.error("Define COGNITO_DOMAIN y CLIENT_ID (salidas CognitoDomainUrl y SpaClientId).");
  process.exit(1);
}

const redirectUri = "http://localhost:5173/callback";
const b64url = (buf) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const verifier = b64url(randomBytes(32));
const challenge = b64url(createHash("sha256").update(verifier).digest());
const state = b64url(randomBytes(16));
const scope =
  "openid email api/projects.write api/donations.write api/donations.read api/audit.read";

const authorize = new URL(`${domain}/oauth2/authorize`);
authorize.search = new URLSearchParams({
  response_type: "code",
  client_id: clientId,
  redirect_uri: redirectUri,
  scope,
  state,
  code_challenge: challenge,
  code_challenge_method: "S256",
}).toString();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost:5173");
  if (url.pathname !== "/callback") return res.writeHead(404).end();
  if (url.searchParams.get("state") !== state) return res.writeHead(400).end("state inválido");
  const code = url.searchParams.get("code");
  const tokenRes = await fetch(`${domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code: code ?? "",
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  });
  const tokens = await tokenRes.json();
  res
    .writeHead(200, { "Content-Type": "text/plain; charset=utf-8" })
    .end("Listo. Puedes cerrar esta pestaña.");
  server.close();
  if (!tokenRes.ok) {
    console.error("Error al canjear el código:", tokens.error);
    process.exit(1);
  }
  console.log(`export ${prefix}_TOKEN='${tokens.access_token}'`);
  console.log(`export ${prefix}_ID_TOKEN='${tokens.id_token}'`);
  console.log(`export ${prefix}_REFRESH_TOKEN='${tokens.refresh_token}'`);
});

server.listen(5173, "127.0.0.1", () => {
  console.error("Abre en el navegador e inicia sesión con el usuario de prueba:\n");
  console.error(authorize.toString() + "\n");
});

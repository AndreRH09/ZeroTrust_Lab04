// Entorno E2E: hosts ficticios (.test es un TLD reservado, nunca resuelve) que Playwright
// intercepta. La CSP se lee de infra/template.yaml para probar exactamente la de CloudFront.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const PUERTO = 4173;
export const API_URL = "https://api.e2e.test";
export const COGNITO_AUTHORITY = "https://cognito-idp.e2e.test/us-east-2_E2E";
export const COGNITO_DOMAIN = "https://auth.e2e.test";
export const CLIENT_ID = "e2e-spa-client";

/** Variables VITE_* con las que se construye el bundle E2E (valores públicos, no secretos). */
export const E2E_ENV = {
  VITE_API_URL: API_URL,
  VITE_COGNITO_AUTHORITY: COGNITO_AUTHORITY,
  VITE_COGNITO_CLIENT_ID: CLIENT_ID,
  VITE_COGNITO_DOMAIN: COGNITO_DOMAIN,
};

/** CSP de la ResponseHeadersPolicy de CloudFront con los hosts sustituidos por los de E2E. */
export function cspProduccion(): string {
  const template = readFileSync(
    fileURLToPath(new URL("../../../infra/template.yaml", import.meta.url)),
    "utf8",
  );
  const bloque =
    /ContentSecurityPolicy: !Sub >-\r?\n((?:[ \t]+\S.*\r?\n)+?)[ \t]+\w+:\s*\r?\n/.exec(template);
  if (!bloque?.[1]) throw new Error("No se encontró la CSP en infra/template.yaml");
  return bloque[1]
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ")
    .replaceAll("https://${Api}.execute-api.${AWS::Region}.amazonaws.com", API_URL)
    .replaceAll("https://cognito-idp.${AWS::Region}.amazonaws.com", "https://cognito-idp.e2e.test")
    .replaceAll(
      "https://${CognitoDomainPrefix}.auth.${AWS::Region}.amazoncognito.com",
      COGNITO_DOMAIN,
    );
}

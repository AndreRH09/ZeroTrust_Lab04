// Configuración pública del frontend (salidas de la pila). No contiene secretos (CA-NF01.2).
const env = import.meta.env;

const trim = (v: string | undefined) => (v ?? "").replace(/\/+$/, "");

export const config = {
  apiUrl: trim(env.VITE_API_URL),
  authority: trim(env.VITE_COGNITO_AUTHORITY),
  clientId: env.VITE_COGNITO_CLIENT_ID ?? "",
  cognitoDomain: trim(env.VITE_COGNITO_DOMAIN),
  scopes: [
    "openid",
    "email",
    "api/projects.write",
    "api/donations.write",
    "api/donations.read",
    "api/audit.read",
  ],
};

export const isConfigured = (): boolean =>
  Boolean(config.apiUrl && config.authority && config.clientId && config.cognitoDomain);

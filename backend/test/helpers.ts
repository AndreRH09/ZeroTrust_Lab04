import type { ApiEvent } from "../src/shared/http.js";

export const DONOR_A = "11111111-aaaa-4aaa-8aaa-111111111111";
export const DONOR_B = "22222222-bbbb-4bbb-8bbb-222222222222";
export const GESTOR = "33333333-cccc-4ccc-8ccc-333333333333";
export const AUDITOR = "44444444-dddd-4ddd-8ddd-444444444444";

export const PROJECT_ID = "7f1c2b8e-4a3d-4c1e-9b2a-1d2e3f4a5b6c";
export const DONATION_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
export const IDEM_KEY = "0b5e1f7a-3c2d-4e6f-9a8b-7c6d5e4f3a2b";

interface EventOpts {
  routeKey: string;
  sub?: string;
  groups?: string | string[];
  tokenUse?: string;
  body?: unknown;
  headers?: Record<string, string>;
  pathParameters?: Record<string, string>;
  query?: Record<string, string>;
}

/** Evento HTTP API v2 tal como lo entrega el JWT authorizer (claims ya verificados). */
export function makeEvent(o: EventOpts): ApiEvent {
  const claims: Record<string, string | number | boolean | string[]> = {};
  if (o.sub) {
    claims.sub = o.sub;
    claims.token_use = o.tokenUse ?? "access";
    claims.client_id = "spa-client";
    if (o.groups !== undefined) {
      claims["cognito:groups"] = Array.isArray(o.groups) ? `[${o.groups.join(" ")}]` : o.groups;
    }
  }
  return {
    version: "2.0",
    routeKey: o.routeKey,
    rawPath: "/",
    rawQueryString: "",
    headers: o.headers ?? {},
    queryStringParameters: o.query,
    pathParameters: o.pathParameters,
    body:
      o.body === undefined
        ? undefined
        : typeof o.body === "string"
          ? o.body
          : JSON.stringify(o.body),
    isBase64Encoded: false,
    requestContext: {
      accountId: "000000000000",
      apiId: "api",
      domainName: "example.com",
      domainPrefix: "example",
      http: {
        method: "GET",
        path: "/",
        protocol: "HTTP/1.1",
        sourceIp: "127.0.0.1",
        userAgent: "vitest",
      },
      requestId: "req-test-1",
      routeKey: o.routeKey,
      stage: "academic",
      time: "",
      timeEpoch: 0,
      authorizer: o.sub
        ? {
            principalId: "",
            integrationLatency: 0,
            jwt: { claims, scopes: ["api/donations.write"] },
          }
        : (undefined as never),
    },
  } as ApiEvent;
}

export function parse(result: { body?: string }) {
  return JSON.parse(result.body ?? "{}");
}

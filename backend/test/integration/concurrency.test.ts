// @trace HU-06, RNF-HU-04, CA-06.2, CA-NF04.1, CA-NF04.2, T08
// Prueba de integración contra el stage `academic` desplegado (npm run test:concurrency -w backend).
// Requiere API_URL, DONOR_TOKEN (access token de un DONANTE) y PROJECT_ID (proyecto PUBLICADO).
// Sin esas variables la prueba se omite (no corre en CI).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

const { API_URL, DONOR_TOKEN, PROJECT_ID } = process.env;
const enabled = Boolean(API_URL && DONOR_TOKEN && PROJECT_ID);

async function call(
  method: string,
  path: string,
  body?: unknown,
  extra: Record<string, string> = {},
) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${DONOR_TOKEN}`,
      "Content-Type": "application/json",
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

describe.skipIf(!enabled)("T08 · 10 confirmaciones concurrentes de la misma donación", () => {
  it("exactamente 1×200, 9×409 y un único incremento del acumulado", async () => {
    const before = await call("GET", `/v1/projects/${PROJECT_ID}/stats`);
    expect(before.status).toBe(200);

    const amountCents = 1234;
    const created = await call(
      "POST",
      "/v1/donations",
      { projectId: PROJECT_ID, amountCents },
      {
        "Idempotency-Key": randomUUID(),
      },
    );
    expect(created.status).toBe(201);
    const id = created.body.donationId as string;

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        call("POST", `/v1/donations/${id}/simulate`, { outcome: "CONFIRM" }),
      ),
    );
    const codes = results.map((r) => r.status).sort();
    console.log("Códigos:", codes.join(", "));
    expect(codes.filter((c) => c === 200)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(9);

    const after = await call("GET", `/v1/projects/${PROJECT_ID}/stats`);
    // Otras pruebas podrían confirmar en paralelo; en una ejecución aislada la diferencia es exacta.
    expect(after.body.confirmedAmountCents - before.body.confirmedAmountCents).toBe(amountCents);
  }, 30_000);
});

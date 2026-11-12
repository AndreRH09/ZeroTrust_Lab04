// @trace RNF-HU-01, RNF-HU-07, CA-NF01.2, CA-NF07.1
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createHandler, errorResult, HttpError, json } from "../../../src/shared/http.js";
import { formatLog, log, redact } from "../../../src/shared/logger.js";
import { makeEvent } from "../../helpers.js";

afterEach(() => {
  vi.restoreAllMocks();
  process.env.LOG_SILENT = "1";
});

describe("errores uniformes", () => {
  it("HttpError → { code, message, requestId } sin stack", () => {
    const r = errorResult(new HttpError(403, "FORBIDDEN", "Operación no permitida"), "req-9");
    expect(r.statusCode).toBe(403);
    const body = JSON.parse(r.body!);
    expect(body).toEqual({
      code: "FORBIDDEN",
      message: "Operación no permitida",
      requestId: "req-9",
    });
    expect(r.body).not.toContain("stack");
  });

  it("ZodError → 400 VALIDATION_ERROR sin valores enviados", () => {
    const res = z.object({ amountCents: z.number().int() }).safeParse({ amountCents: 1.5 });
    const r = errorResult(res.error, "req-1");
    expect(r.statusCode).toBe(400);
    expect(JSON.parse(r.body!).code).toBe("VALIDATION_ERROR");
    expect(r.body).not.toContain("1.5");
  });

  it("TransactionCanceledException → 409", () => {
    const err = Object.assign(new Error("x"), { name: "TransactionCanceledException" });
    expect(errorResult(err, "r").statusCode).toBe(409);
  });

  it("error desconocido → 500 genérico sin mensaje interno", () => {
    const r = errorResult(new Error("Table arn:aws:dynamodb:... secret"), "r");
    expect(r.statusCode).toBe(500);
    expect(r.body).not.toContain("arn:aws");
  });

  it("ruta desconocida → 404", async () => {
    const h = createHandler({});
    const r = await h(makeEvent({ routeKey: "GET /nada" }));
    expect(r.statusCode).toBe(404);
  });

  it("json añade cabeceras no-store y nosniff", () => {
    expect(json(200, {}).headers).toMatchObject({
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
  });
});

describe("logger JSON (CA-NF07.1, CA-NF01.2)", () => {
  it("incluye requestId, action, outcome, statusCode y durationMs", () => {
    const line = JSON.parse(
      formatLog({
        requestId: "r1",
        action: "GET /v1/projects",
        outcome: "SUCCESS",
        statusCode: 200,
        durationMs: 12,
      }),
    );
    expect(line).toMatchObject({
      requestId: "r1",
      action: "GET /v1/projects",
      outcome: "SUCCESS",
      statusCode: 200,
      durationMs: 12,
    });
  });

  it("redacta authorization, tokens, sub e idempotencyKey", () => {
    const r = redact({
      authorization: "Bearer abc",
      accessToken: "abc",
      sub: "1234",
      idempotencyKey: "k",
      nested: { refresh_token: "x", ok: 1 },
    }) as Record<string, unknown>;
    expect(JSON.stringify(r)).not.toMatch(/abc|1234|"k"|"x"/);
    expect((r.nested as Record<string, unknown>).ok).toBe(1);
  });

  it("el handler emite una línea JSON por solicitud", async () => {
    process.env.LOG_SILENT = "0";
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const h = createHandler({ "GET /x": async () => json(200, { ok: true }) });
    await h(makeEvent({ routeKey: "GET /x", headers: { authorization: "Bearer secreto" } }));
    const line = JSON.parse(String(spy.mock.calls[0]![0]));
    expect(line).toMatchObject({
      requestId: "req-test-1",
      action: "GET /x",
      statusCode: 200,
      outcome: "SUCCESS",
    });
    expect(typeof line.durationMs).toBe("number");
    expect(String(spy.mock.calls[0]![0])).not.toContain("secreto");
  });

  it("log no escribe nada si LOG_SILENT=1", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    log({ requestId: "r", action: "a", outcome: "SUCCESS" });
    expect(spy).not.toHaveBeenCalled();
  });
});

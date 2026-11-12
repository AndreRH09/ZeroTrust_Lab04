// @trace HU-03, HU-04, CA-03.2, CA-04.3
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config", () => ({
  config: { apiUrl: "https://api.example.com/academic" },
  isConfigured: () => true,
}));
const { api, ApiError, userMessage } = await import("../src/services/api");

afterEach(() => vi.restoreAllMocks());

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("cliente API", () => {
  it("envía Bearer, Idempotency-Key y solo { projectId, amountCents }", async () => {
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue(ok({ donationId: "d1" }, 201));
    await api.createDonation("tok", { projectId: "p1", amountCents: 2500 }, "key-1");
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.example.com/academic/v1/donations");
    const headers = init!.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
    expect(headers["Idempotency-Key"]).toBe("key-1");
    expect(JSON.parse(init!.body as string)).toEqual({ projectId: "p1", amountCents: 2500 });
    expect(init!.credentials).toBe("omit");
  });

  it("rutas públicas no envían Authorization", async () => {
    const fetchSpy = vi.spyOn(window, "fetch").mockResolvedValue(ok({ items: [] }));
    await api.listProjects();
    expect(
      (fetchSpy.mock.calls[0]![1]!.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
  });

  it("errores → ApiError con status y code; mensajes genéricos para 403/404", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue(
      ok({ code: "FORBIDDEN", message: "x", requestId: "r" }, 403),
    );
    const err = await api.listManage("tok").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as InstanceType<typeof ApiError>).status).toBe(403);
    expect(userMessage(err)).toBe("No encontramos el recurso o no tienes acceso a él.");
  });

  it("429 y 401 tienen mensajes específicos", () => {
    expect(userMessage(new ApiError(429, "X", ""))).toMatch(/Reintenta/);
    expect(userMessage(new ApiError(401, "UNAUTHORIZED", ""))).toMatch(/Inicia sesión/);
  });

  it("fallo de red → ApiError status 0 con mensaje de conexión (regresión hallada en E2E)", async () => {
    vi.spyOn(window, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const err = await api.listProjects().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as InstanceType<typeof ApiError>).status).toBe(0);
    expect(userMessage(err)).toBe("No pudimos conectar con el servicio. Inténtalo de nuevo.");
  });

  it("500 nunca muestra el mensaje interno del servidor", () => {
    const err = new ApiError(500, "INTERNAL_ERROR", "arn:aws:dynamodb:us-east-2:1:table/X");
    expect(userMessage(err)).toBe("Ocurrió un error inesperado. Inténtalo más tarde.");
  });
});

// @trace HU-04, HU-07, RNF-HU-02, CA-04.1, CA-04.2, CA-04.3, CA-07.2, CA-NF02.2, T03, T09, T12
// Ocultar opciones no es el control: abrir la ruta directamente choca con la denegación del servidor.
// Aquí el "servidor" es el backend falso; la denegación real se prueba con Vitest (authz) y en AWS.
import { DONACIONES, PROYECTOS, USUARIOS } from "./support/backendFalso";
import { expect, test } from "./support/fixtures";

const SIN_ACCESO = "No encontramos el recurso o no tienes acceso a él.";

test.describe("Autorización vista desde la SPA", () => {
  test("CP-E2E-AZN-001 un DONANTE que abre /manage recibe 403 y no ve proyectos en borrador", async ({
    page,
    backend,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.donante, "/manage");
    await expect(page.getByRole("alert")).toContainText(SIN_ACCESO);
    await expect(page.getByText("Ollas comunes en Alto Selva Alegre")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Nuevo proyecto" })).toHaveCount(0);
    expect(backend.llamadas("GET", /^\/v1\/manage\/projects$/)[0]!.status).toBe(403);
    expect(backend.auditoria.at(-1)).toMatchObject({
      eventType: "AUTHZ_DENIED",
      outcome: "DENIED",
    });
  });

  test("CP-E2E-AZN-002 un GESTOR que abre /donations recibe 403 (no ve historiales de donantes)", async ({
    page,
    backend,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.gestor, "/donations");
    await expect(page.getByRole("alert")).toContainText(SIN_ACCESO);
    expect(backend.llamadas("GET", /^\/v1\/donations\/me$/)[0]!.status).toBe(403);
  });

  test("CP-E2E-AZN-003 un AUDITOR que abre /manage recibe 403", async ({
    page,
    backend,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.auditor, "/manage");
    await expect(page.getByRole("alert")).toContainText(SIN_ACCESO);
    expect(backend.llamadas("GET", /^\/v1\/manage\/projects$/)[0]!.status).toBe(403);
  });

  test("CP-E2E-AZN-004 una donación ajena da el mismo mensaje que una inexistente (404, sin filtrar datos)", async ({
    page,
    backend,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.donante, `/donations/${DONACIONES.ajena}`);
    await expect(page.getByRole("alert")).toContainText(SIN_ACCESO);
    await expect(page.getByText("S/ 30.00")).toHaveCount(0);
    expect(backend.llamadas("GET", /^\/v1\/donations\/d0+-/)[0]!.status).toBe(404);
  });

  test("CP-E2E-AZN-005 la SPA nunca envía sub, grupos ni rol al API (los toma el servidor del token)", async ({
    page,
    backend,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.donante, `/projects/${PROYECTOS.comedor}/donate`);
    await page.getByLabel("Monto en soles (PEN)").fill("15");
    await page.getByRole("button", { name: "Registrar intención" }).click();
    await page.getByRole("button", { name: "Confirmar simulación" }).click();
    await expect(page.getByText("¡Gracias por tu apoyo!")).toBeVisible();
    expect(backend.solicitudes.length).toBeGreaterThan(3);
    for (const s of backend.solicitudes) {
      const { authorization: _token, ...cabeceras } = s.headers;
      const enviado = JSON.stringify({ body: s.body, query: s.query, cabeceras });
      expect(enviado).not.toMatch(
        /sub-donante|donorSub|cognito:groups|"(groups|role|sub)"|DONANTE/,
      );
    }
  });
});

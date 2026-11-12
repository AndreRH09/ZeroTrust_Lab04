// @trace HU-05, HU-06, HU-07, HU-09, RNF-HU-10, CA-05.1, CA-05.2, CA-05.3, CA-05.4, CA-05.5, CA-06.1, CA-06.2, CA-06.3, CA-06.4, CA-07.1, CA-09.1, CA-NF10.2, T04, T05, T06
// Flujo del donante: monto → intención → simulación → historial, con validaciones e idempotencia.
import { DONACIONES, PROYECTOS, USUARIOS } from "./support/backendFalso";
import { expect, test } from "./support/fixtures";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const monto = (page: import("@playwright/test").Page) => page.getByLabel("Monto en soles (PEN)");
const registrar = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: "Registrar intención" });

test.describe("Donación simulada (donante)", () => {
  test("CP-E2E-DON-001 flujo completo: monto sugerido, intención, confirmación, total e historial @movil", async ({
    page,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.donante, `/projects/${PROYECTOS.utiles}`);
    await page.getByRole("link", { name: "Donar (simulado)" }).click();
    await page.getByRole("button", { name: "S/ 50", exact: true }).click();
    await expect(page.getByRole("button", { name: "S/ 50", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(monto(page)).toHaveValue("50");
    await expect(page.getByText(/Registrarás una intención de S\/ 50\.00/)).toBeVisible();
    await registrar(page).click();

    await expect(page).toHaveURL(/\/donations\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Tu intención está registrada")).toBeVisible();
    await expect(page.getByText("Pendiente de simulación")).toBeVisible();
    await expect(
      page.getByText("Simulación académica: no se ha realizado ningún cobro"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirmar simulación" }).click();

    await expect(page.getByText("¡Gracias por tu apoyo!")).toBeVisible();
    await expect(page.getByText("Confirmada (simulada)")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Total confirmado del proyecto" }).getByText("S/ 9,800.00"),
    ).toBeVisible();

    await page.getByRole("link", { name: "Ver mi historial" }).click();
    const primera = page
      .getByRole("list", { name: "Historial de donaciones simuladas" })
      .getByRole("listitem")
      .first();
    await expect(primera).toContainText("Útiles escolares para Characato");
    await expect(primera).toContainText("S/ 50.00");
    await expect(primera).toContainText("Confirmada (simulada)");
  });

  test("CP-E2E-DON-002 rechazar la simulación no suma al total del proyecto", async ({
    page,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.donante, `/donations/${DONACIONES.pendiente}`);
    await page.getByRole("button", { name: "Rechazar simulación" }).click();
    await expect(page.getByText("La simulación fue rechazada")).toBeVisible();
    await expect(page.getByText("Rechazada (simulada)")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Total confirmado del proyecto" }).getByText("S/ 4,800.00"),
    ).toBeVisible();
  });

  for (const valor of ["0", "0.99", "1000.01", "10.555", "abc"]) {
    test(`CP-E2E-DON-003 monto inválido '${valor}' muestra error accesible y no llama al API`, async ({
      page,
      backend,
      iniciarSesion,
    }) => {
      await iniciarSesion(USUARIOS.donante, `/projects/${PROYECTOS.utiles}/donate`);
      await monto(page).fill(valor);
      await registrar(page).click();
      await expect(page.getByRole("alert")).toBeVisible();
      await expect(monto(page)).toHaveAttribute("aria-invalid", "true");
      expect(backend.llamadas("POST", /^\/v1\/donations$/)).toHaveLength(0);
    });
  }

  for (const [valor, centimos] of [
    ["1", 100],
    ["1000", 100_000],
  ] as const) {
    test(`CP-E2E-DON-004 límite válido S/ ${valor} se registra como ${centimos} céntimos`, async ({
      page,
      backend,
      iniciarSesion,
    }) => {
      await iniciarSesion(USUARIOS.donante, `/projects/${PROYECTOS.utiles}/donate`);
      await monto(page).fill(valor);
      await registrar(page).click();
      await expect(page.getByText("Tu intención está registrada")).toBeVisible();
      expect(backend.llamadas("POST", /^\/v1\/donations$/)[0]!.body).toEqual({
        projectId: PROYECTOS.utiles,
        amountCents: centimos,
      });
    });
  }

  test("CP-E2E-DON-005 la solicitud lleva Bearer e Idempotency-Key UUID y solo projectId + amountCents", async ({
    page,
    backend,
    cognito,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.donante, `/projects/${PROYECTOS.utiles}/donate`);
    await monto(page).fill("25.50");
    await registrar(page).click();
    await expect(page.getByText("Tu intención está registrada")).toBeVisible();
    const [post] = backend.llamadas("POST", /^\/v1\/donations$/);
    expect(post!.headers.authorization).toBe(`Bearer ${cognito.emitidos[0]!.access}`);
    expect(post!.headers["idempotency-key"]).toMatch(UUID);
    expect(post!.body).toEqual({ projectId: PROYECTOS.utiles, amountCents: 2550 });
  });

  test("CP-E2E-DON-006 tras un fallo de red, reintentar reutiliza la Idempotency-Key y crea una sola donación", async ({
    page,
    backend,
    iniciarSesion,
  }) => {
    backend.fallar("POST", /^\/v1\/donations$/, "red", 1);
    const antes = backend.donaciones.length;
    await iniciarSesion(USUARIOS.donante, `/projects/${PROYECTOS.utiles}/donate`);
    await monto(page).fill("30");
    await registrar(page).click();
    await expect(page.getByRole("alert")).toContainText("No pudimos conectar con el servicio");
    await registrar(page).click();
    await expect(page.getByText("Tu intención está registrada")).toBeVisible();
    const posts = backend.llamadas("POST", /^\/v1\/donations$/);
    expect(posts).toHaveLength(2);
    expect(posts[0]!.headers["idempotency-key"]).toBe(posts[1]!.headers["idempotency-key"]);
    expect(backend.donaciones.length - antes).toBe(1);
  });

  test("CP-E2E-DON-007 cambiar el monto tras un fallo genera una Idempotency-Key nueva", async ({
    page,
    backend,
    iniciarSesion,
  }) => {
    backend.fallar("POST", /^\/v1\/donations$/, "red", 1);
    await iniciarSesion(USUARIOS.donante, `/projects/${PROYECTOS.utiles}/donate`);
    await monto(page).fill("30");
    await registrar(page).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await monto(page).fill("40");
    await registrar(page).click();
    await expect(page.getByText("Tu intención está registrada")).toBeVisible();
    const posts = backend.llamadas("POST", /^\/v1\/donations$/);
    expect(posts[0]!.headers["idempotency-key"]).not.toBe(posts[1]!.headers["idempotency-key"]);
  });

  test("CP-E2E-DON-008 el historial lista solo lo propio, del más reciente al más antiguo, con totales @movil", async ({
    page,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.donante, "/donations");
    const items = page
      .getByRole("list", { name: "Historial de donaciones simuladas" })
      .getByRole("listitem");
    await expect(items).toHaveCount(3); // la donación de donante2 no aparece
    await expect(items.nth(0)).toContainText("Comedor popular Cerro Colorado");
    await expect(items.nth(1)).toContainText("Campaña de salud en Yura");
    await expect(items.nth(2)).toContainText("Útiles escolares para Characato");
    await expect(page.getByText("S/ 50.00").first()).toBeVisible(); // confirmado total
    await items.nth(0).getByRole("link").click();
    await expect(page).toHaveURL(`/donations/${DONACIONES.pendiente}`);
  });

  test("CP-E2E-DON-009 una donación en estado terminal no ofrece volver a simular", async ({
    page,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.donante, `/donations/${DONACIONES.confirmada}`);
    await expect(page.getByText("Confirmada (simulada)")).toBeVisible();
    await expect(page.getByRole("button", { name: /simulación/ })).toHaveCount(0);
  });

  test("CP-E2E-DON-010 el formulario solo pide el monto: sin campos de tarjeta, CVV, cuenta ni DNI", async ({
    page,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.donante, `/projects/${PROYECTOS.utiles}/donate`);
    await expect(page.getByRole("main").getByRole("textbox")).toHaveCount(1);
    await expect(page.getByLabel(/tarjeta|cvv|cuenta|dni/i)).toHaveCount(0);
    await expect(
      page.getByText("Simulación académica: registrarás una intención de donación de prueba"),
    ).toBeVisible();
  });
});

// @trace HU-10, CA-10.1, CA-10.2
// Auditor: consulta de eventos con filtros y seudónimos.
import { USUARIOS } from "./support/backendFalso";
import { expect, test } from "./support/fixtures";

test.describe("Auditoría (auditor)", () => {
  test("CP-E2E-AUD-001 muestra los AUTHZ_DENIED con actor seudonimizado y sin datos personales @movil", async ({
    page,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.auditor, "/audit");
    const filas = page.getByRole("table", { name: "Eventos de auditoría" }).locator("tbody tr");
    await expect(filas).toHaveCount(3);
    await expect(filas.first()).toContainText("Denegado");
    const texto = await page.getByRole("table").innerText();
    expect(texto).not.toMatch(/@example\.com|sub-donante|sub-gestor|eyJ/);
    await expect(filas.first().locator("td").nth(4)).toHaveText(/^[0-9a-f]{12}…$/);
  });

  test("CP-E2E-AUD-002 filtrar por tipo y rango envía eventType y fechas ISO 8601", async ({
    page,
    backend,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.auditor, "/audit");
    await page.getByLabel("Tipo de evento").selectOption("DONATION_CREATED");
    await page.getByLabel("Desde").fill("2026-11-01T00:00");
    await page.getByLabel("Hasta").fill("2026-11-30T23:59");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(1);
    await expect(page.getByRole("table")).toContainText("POST /v1/donations");
    const q = new URLSearchParams(backend.llamadas("GET", /^\/v1\/audit$/).at(-1)!.query);
    expect(q.get("eventType")).toBe("DONATION_CREATED");
    expect(q.get("from")).toBe("2026-11-01T05:00:00.000Z"); // Lima (UTC-5) → ISO UTC
    expect(q.get("to")).toMatch(/^2026-12-01T04:59:00\.000Z$/);
  });

  test("CP-E2E-AUD-003 un filtro sin resultados muestra el estado vacío", async ({
    page,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.auditor, "/audit");
    await page.getByLabel("Tipo de evento").selectOption("PROJECT_UPDATED");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page.getByText("Sin eventos para el filtro seleccionado")).toBeVisible();
  });
});

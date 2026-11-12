// @trace HU-01, HU-02, HU-09, RNF-HU-06, CA-01.1, CA-01.2, CA-01.3, CA-02.1, CA-02.2, CA-09.1, CA-09.2, T01
// Visitante sin sesión: catálogo, búsqueda, filtros, detalle y estados de error.
import { PROYECTOS } from "./support/backendFalso";
import { anchoBarra, expect, test } from "./support/fixtures";

test.describe("Catálogo público (visitante)", () => {
  test("CP-E2E-CAT-001 lista solo proyectos publicados con meta, confirmado y porcentaje @movil", async ({
    page,
  }) => {
    await page.goto("/");
    const tarjetas = page.locator("#proyectos li article");
    await expect(tarjetas).toHaveCount(4);
    await expect(page.getByRole("link", { name: "Útiles escolares para Characato" })).toBeVisible();
    await expect(page.getByText("Ollas comunes en Alto Selva Alegre")).toHaveCount(0); // BORRADOR
    const primera = tarjetas.first();
    await expect(primera.getByText("S/ 9,750.00")).toBeVisible();
    await expect(primera.getByText("S/ 15,000.00")).toBeVisible();
    await expect(primera.getByText("65%")).toBeVisible();
    await expect(primera.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "65");
    expect(await anchoBarra(page)).toBeGreaterThan(0);
  });

  test("CP-E2E-CAT-002 la portada muestra indicadores agregados del catálogo", async ({ page }) => {
    await page.goto("/");
    const portada = page.getByRole("region", { name: "Proyectos sociales" });
    await expect(portada.getByText("Proyectos activos")).toBeVisible();
    await expect(portada.locator("dd").nth(0)).toHaveText("4");
    await expect(portada.locator("dd").nth(1)).toHaveText("1 de 4");
    await expect(portada.locator("dd").nth(2)).toHaveText("S/ 24,050.00");
  });

  test("CP-E2E-CAT-003 la búsqueda ignora tildes y mayúsculas; sin coincidencias ofrece limpiar filtros", async ({
    page,
  }) => {
    await page.goto("/");
    const buscar = page.getByRole("searchbox", { name: "Buscar proyecto" });
    await buscar.fill("UTILES");
    await expect(page.locator("#proyectos li article")).toHaveCount(1);
    await expect(page.getByText("1 proyecto", { exact: true })).toBeVisible();
    await buscar.fill("xyz-no-existe");
    await expect(page.getByText("Ningún proyecto coincide con tu búsqueda")).toBeVisible();
    await page.getByRole("button", { name: "Limpiar filtros" }).click();
    await expect(page.locator("#proyectos li article")).toHaveCount(4);
  });

  test("CP-E2E-CAT-004 filtra por categoría y ordena por avance", async ({ page }) => {
    await page.goto("/");
    const filtros = page.getByRole("group", { name: "Filtrar por categoría" });
    await filtros.getByRole("button", { name: "Educación" }).click();
    await expect(filtros.getByRole("button", { name: "Educación" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("#proyectos li article")).toHaveCount(2);
    await filtros.getByRole("button", { name: "Todas" }).click();
    await page.getByLabel("Ordenar por").selectOption("cerca");
    await expect(page.locator("#proyectos li article h2").first()).toHaveText(
      "Campaña de salud en Yura",
    );
    await page.getByLabel("Ordenar por").selectOption("apoyo");
    await expect(page.locator("#proyectos li article h2").first()).toHaveText(
      "Biblioteca comunitaria en Socabaya",
    );
  });

  test("CP-E2E-CAT-005 catálogo vacío muestra un mensaje comprensible", async ({
    page,
    backend,
  }) => {
    backend.proyectos = backend.proyectos.filter((p) => p.status !== "PUBLICADO");
    await page.goto("/");
    await expect(page.getByText("Aún no hay proyectos publicados")).toBeVisible();
  });

  test("CP-E2E-CAT-006 error 500 del API: mensaje genérico sin detalles internos y Reintentar recupera", async ({
    page,
    backend,
  }) => {
    // Falla también el reintento automático de TanStack Query (2 reintentos ante 5xx).
    backend.fallar("GET", /^\/v1\/projects$/, 500, 3);
    await page.goto("/");
    const alerta = page.getByRole("alert");
    await expect(alerta).toContainText("Ocurrió un error inesperado");
    await expect(alerta).not.toContainText("arn:aws");
    await alerta.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.locator("#proyectos li article")).toHaveCount(4);
  });

  test("CP-E2E-CAT-007 el detalle muestra objetivo, lo que falta y el botón para iniciar sesión y donar @movil", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Comedor popular Cerro Colorado" }).click();
    await expect(page).toHaveURL(`/projects/${PROYECTOS.comedor}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Comedor popular Cerro Colorado",
    );
    const panel = page.getByRole("complementary", { name: "Apoya este proyecto" });
    await expect(panel.getByText("S/ 4,800.00")).toBeVisible();
    await expect(panel.getByText("S/ 19,200.00")).toBeVisible(); // falta
    await expect(panel.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "20");
    await expect(panel.getByRole("button", { name: "Inicia sesión para donar" })).toBeEnabled();
    await expect(page.getByText("Raciones diarias de almuerzo")).toBeVisible();
  });

  test("CP-E2E-CAT-008 proyecto en borrador o inexistente responde 'Proyecto no encontrado'", async ({
    page,
  }) => {
    await page.goto(`/projects/${PROYECTOS.borrador}`);
    await expect(page.getByText("Proyecto no encontrado")).toBeVisible();
    await page.goto("/projects/no-existe");
    await expect(page.getByText("Proyecto no encontrado")).toBeVisible();
  });

  test("CP-E2E-CAT-009 una ruta desconocida muestra 'Página no encontrada'", async ({ page }) => {
    await page.goto("/ruta/que/no/existe");
    await expect(page.getByText("Página no encontrada")).toBeVisible();
    await page.getByRole("link", { name: "Ir al catálogo" }).click();
    await expect(page).toHaveURL("/");
  });

  test("CP-E2E-CAT-010 meta alcanzada: barra completa, 100% e insignia", async ({ page }) => {
    await page.goto(`/projects/${PROYECTOS.salud}`);
    const panel = page.getByRole("complementary", { name: "Apoya este proyecto" });
    await expect(panel.getByText("100%")).toBeVisible();
    await expect(panel.getByText("Meta alcanzada")).toBeVisible();
    const barra = panel.getByRole("progressbar");
    const total = await barra.evaluate((e) => e.getBoundingClientRect().width);
    expect(await anchoBarra(page, "Progreso de la campaña")).toBeCloseTo(total, 0);
  });
});

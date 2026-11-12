// @trace RNF-HU-01, RNF-HU-10, RNF-HU-11, CA-NF01.2, CA-NF10.2, CA-NF11.1, CA-NF11.2
// Controles transversales en el navegador: CSP de producción, errores sin detalles, destinos de red.
import { PROYECTOS, USUARIOS } from "./support/backendFalso";
import { API_URL, COGNITO_AUTHORITY, COGNITO_DOMAIN } from "./support/entorno";
import { anchoBarra, expect, irA, test } from "./support/fixtures";

test.describe("Seguridad en el navegador", () => {
  test("CP-E2E-SEG-001 con la CSP de CloudFront las barras se dibujan y un estilo en línea queda bloqueado", async ({
    page,
    violacionesCsp,
  }) => {
    const respuesta = await page.goto("/");
    const csp = respuesta!.headers()["content-security-policy"] ?? "";
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain(API_URL);
    await expect(page.getByRole("progressbar").first()).toBeVisible();
    expect(await anchoBarra(page)).toBeGreaterThan(0);

    // Control del control: un atributo style inyectado debe ser bloqueado y detectado.
    await page.evaluate(() => document.body.setAttribute("style", "outline: 1px solid red"));
    await expect.poll(() => violacionesCsp.length).toBeGreaterThan(0);
    violacionesCsp.length = 0; // la violación fue provocada a propósito
  });

  test("CP-E2E-SEG-002 la SPA solo se conecta a su origen, al API y a Cognito", async ({
    page,
    iniciarSesion,
  }) => {
    const destinos = new Set<string>();
    page.on("request", (r) => destinos.add(new URL(r.url()).origin));
    await iniciarSesion(USUARIOS.donante, `/projects/${PROYECTOS.utiles}`);
    await page.getByRole("link", { name: "Donar (simulado)" }).click();
    await expect(page.getByLabel("Monto en soles (PEN)")).toBeVisible();
    const permitidos = [
      new URL(page.url()).origin,
      API_URL,
      new URL(COGNITO_AUTHORITY).origin,
      COGNITO_DOMAIN,
    ];
    expect([...destinos].filter((d) => !permitidos.includes(d))).toEqual([]);
  });

  test("CP-E2E-SEG-003 un 401 del API (sesión inválida) pide volver a iniciar sesión", async ({
    page,
    backend,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.donante);
    backend.tokens.clear(); // el servidor deja de aceptar el token
    await irA(page, "Mis donaciones");
    await expect(page.getByRole("alert")).toContainText(
      "Tu sesión expiró o no es válida. Inicia sesión nuevamente.",
    );
  });

  test("CP-E2E-SEG-004 un 429 del API muestra un mensaje de reintento sin detalles internos", async ({
    page,
    backend,
  }) => {
    backend.fallar("GET", /^\/v1\/projects$/, 429, 1);
    await page.goto("/");
    await expect(page.getByRole("alert")).toContainText("Demasiadas solicitudes");
    await expect(page.getByRole("alert")).not.toContainText("arn:aws");
  });

  for (const ruta of ["/", `/projects/${PROYECTOS.utiles}`, "/donations", "/ruta-inexistente"]) {
    test(`CP-E2E-SEG-005 aviso de prototipo sin pagos reales y Ley 29733 visibles en ${ruta}`, async ({
      page,
    }) => {
      await page.goto(ruta);
      await expect(
        page.getByText("Prototipo académico — sin pagos reales. Las donaciones son simuladas."),
      ).toBeVisible();
      await expect(page.getByText(/Ley N\.º 29733/)).toBeVisible();
    });
  }
});

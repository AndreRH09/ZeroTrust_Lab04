// Fixtures E2E: cada prueba arranca con un backend y un Cognito falsos nuevos, la CSP real de
// CloudFront aplicada a los documentos y un control de violaciones CSP al terminar.
import { test as base, expect, type Page } from "@playwright/test";
import { BackendFalso, type UsuarioPrueba } from "./backendFalso";
import { CognitoFalso } from "./cognitoFalso";
import { cspProduccion } from "./entorno";

interface Fixtures {
  backend: BackendFalso;
  cognito: CognitoFalso;
  violacionesCsp: string[];
  iniciarSesion: (usuario: UsuarioPrueba, ruta?: string) => Promise<void>;
}

const CSP = cspProduccion();

export const test = base.extend<Fixtures>({
  backend: [
    async ({ page }, use) => {
      const backend = new BackendFalso();
      await backend.instalar(page);
      await use(backend);
    },
    { auto: true },
  ],
  cognito: [
    async ({ page, backend }, use) => {
      const cognito = new CognitoFalso(backend);
      await cognito.instalar(page);
      await use(cognito);
    },
    { auto: true },
  ],
  violacionesCsp: [
    async ({ page, baseURL }, use) => {
      const violaciones: string[] = [];
      page.on("console", (msg) => {
        if (/Content Security Policy/i.test(msg.text())) violaciones.push(msg.text());
      });
      // Igual que la ResponseHeadersPolicy de CloudFront: la CSP va en la respuesta del documento.
      await page.route(`${baseURL}/**`, async (route) => {
        if (route.request().resourceType() !== "document") return route.fallback();
        const respuesta = await route.fetch();
        await route.fulfill({
          response: respuesta,
          headers: { ...respuesta.headers(), "content-security-policy": CSP },
        });
      });
      await use(violaciones);
      expect(violaciones, "La CSP de producción bloqueó recursos o estilos").toEqual([]);
    },
    { auto: true },
  ],
  iniciarSesion: async ({ page, cognito }, use) => {
    await use(async (usuario, ruta = "/") => {
      cognito.siguienteUsuario = usuario;
      await page.goto(ruta);
      await page.getByRole("banner").getByRole("button", { name: "Iniciar sesión" }).click();
      await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
      await expect(page).not.toHaveURL(/\/callback/);
    });
  },
});

export { expect };

/** Navegación interna (sin recargar: los tokens viven solo en memoria). */
export async function irA(page: Page, enlace: string) {
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: enlace })
    .click();
}

/** Lee el ancho dibujado de la barra (rect SVG de relleno) del primer progressbar visible. */
export async function anchoBarra(page: Page, nombre?: string | RegExp) {
  const barra = nombre
    ? page.getByRole("progressbar", { name: nombre })
    : page.getByRole("progressbar").first();
  return barra
    .locator("rect")
    .nth(1)
    .evaluate((r) => (r as SVGRectElement).getBoundingClientRect().width);
}

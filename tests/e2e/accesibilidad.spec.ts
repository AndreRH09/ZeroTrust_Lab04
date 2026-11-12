// @trace RNF-HU-06, CA-NF06.1, CA-NF06.2
// WCAG 2.2 AA automatizado (axe-core), teclado y ausencia de desplazamiento horizontal.
// Corre en escritorio y en móvil 375 px (@movil). No sustituye la revisión manual de T099.
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { DONACIONES, PROYECTOS, USUARIOS, type UsuarioPrueba } from "./support/backendFalso";
import { expect, test } from "./support/fixtures";

const PAGINAS: { nombre: string; ruta: string; usuario?: UsuarioPrueba; listo: string }[] = [
  { nombre: "catálogo", ruta: "/", listo: "Campañas abiertas" },
  { nombre: "detalle", ruta: `/projects/${PROYECTOS.utiles}`, listo: "Sobre el proyecto" },
  {
    nombre: "donar",
    ruta: `/projects/${PROYECTOS.utiles}/donate`,
    usuario: USUARIOS.donante,
    listo: "Montos sugeridos",
  },
  {
    nombre: "resultado",
    ruta: `/donations/${DONACIONES.pendiente}`,
    usuario: USUARIOS.donante,
    listo: "Elige el resultado de la simulación",
  },
  {
    nombre: "historial",
    ruta: "/donations",
    usuario: USUARIOS.donante,
    listo: "Pendientes de simular",
  },
  { nombre: "gestión", ruta: "/manage", usuario: USUARIOS.gestor, listo: "Borradores" },
  { nombre: "auditoría", ruta: "/audit", usuario: USUARIOS.auditor, listo: "Actor (seudónimo)" },
];

async function abrir(
  page: Page,
  p: (typeof PAGINAS)[number],
  iniciarSesion: (u: UsuarioPrueba, r?: string) => Promise<void>,
) {
  if (p.usuario) await iniciarSesion(p.usuario, p.ruta);
  else await page.goto(p.ruta);
  await expect(page.getByText(p.listo).first()).toBeVisible();
}

test.describe("Accesibilidad", () => {
  for (const p of PAGINAS) {
    test(`CP-E2E-ACC-001 sin violaciones WCAG 2.2 A/AA (axe) en ${p.nombre} @movil`, async ({
      page,
      iniciarSesion,
    }) => {
      await abrir(page, p, iniciarSesion);
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const resumen = violations.map(
        (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
      );
      expect(resumen).toEqual([]);
    });

    test(`CP-E2E-ACC-002 sin desplazamiento horizontal en ${p.nombre} @movil`, async ({
      page,
      iniciarSesion,
    }) => {
      await abrir(page, p, iniciarSesion);
      const { scroll, ancho } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        ancho: document.documentElement.clientWidth,
      }));
      expect(scroll).toBeLessThanOrEqual(ancho);
    });
  }

  test("CP-E2E-ACC-003 el enlace 'Saltar al contenido' es lo primero del teclado y mueve el foco al contenido", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const salto = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(salto).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#contenido")).toBeFocused();
  });

  test("CP-E2E-ACC-004 se puede donar solo con teclado (montos sugeridos y envío)", async ({
    page,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.donante, `/projects/${PROYECTOS.utiles}/donate`);
    const cien = page.getByRole("button", { name: "S/ 100", exact: true });
    await cien.focus();
    await page.keyboard.press("Space");
    await expect(cien).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Registrar intención" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Tu intención está registrada")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirmar simulación" })).toBeVisible();
  });
});

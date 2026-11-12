// Genera capturas de todas las pantallas (escritorio 1280 px y móvil 375 px) en capturas/.
// No es una prueba de aceptación: solo corre con E2E_CAPTURAS=1 (npm run e2e:capturas).
// capturas/ está excluida de git: las imágenes no se versionan.
import type { Page } from "@playwright/test";
import {
  DONACIONES,
  PROYECTOS,
  USUARIOS,
  type BackendFalso,
  type UsuarioPrueba,
} from "./support/backendFalso";
import type { CognitoFalso } from "./support/cognitoFalso";
import { expect, test } from "./support/fixtures";

interface Ctx {
  page: Page;
  backend: BackendFalso;
  cognito: CognitoFalso;
  iniciarSesion: (u: UsuarioPrueba, r?: string) => Promise<void>;
}

const PANTALLAS: { nombre: string; preparar: (c: Ctx) => Promise<void> }[] = [
  {
    nombre: "01-catalogo",
    preparar: async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("#proyectos li article")).toHaveCount(4);
    },
  },
  {
    nombre: "02-catalogo-sin-resultados",
    preparar: async ({ page }) => {
      await page.goto("/");
      await page.getByRole("searchbox", { name: "Buscar proyecto" }).fill("xyz");
      await page.getByText("Ningún proyecto coincide").scrollIntoViewIfNeeded();
    },
  },
  {
    nombre: "03-detalle-proyecto",
    preparar: async ({ page }) => {
      await page.goto(`/projects/${PROYECTOS.utiles}`);
      await expect(page.getByText("Sobre el proyecto")).toBeVisible();
    },
  },
  {
    nombre: "04-detalle-meta-alcanzada",
    preparar: async ({ page }) => {
      await page.goto(`/projects/${PROYECTOS.salud}`);
      await expect(page.getByText("Sobre el proyecto")).toBeVisible();
    },
  },
  {
    nombre: "05-inicio-sesion-requerido",
    preparar: async ({ page }) => {
      await page.goto("/donations");
      await expect(page.getByText("Necesitas iniciar sesión")).toBeVisible();
    },
  },
  {
    nombre: "06-donar-monto-sugerido",
    preparar: async ({ page, iniciarSesion }) => {
      await iniciarSesion(USUARIOS.donante, `/projects/${PROYECTOS.utiles}/donate`);
      await page.getByRole("button", { name: "S/ 50", exact: true }).click();
      await expect(page.getByText(/Registrarás una intención/)).toBeVisible();
    },
  },
  {
    nombre: "07-donar-error-validacion",
    preparar: async ({ page, iniciarSesion }) => {
      await iniciarSesion(USUARIOS.donante, `/projects/${PROYECTOS.utiles}/donate`);
      await page.getByLabel("Monto en soles (PEN)").fill("1000.01");
      await page.getByRole("button", { name: "Registrar intención" }).click();
      await expect(page.getByRole("alert")).toBeVisible();
    },
  },
  {
    nombre: "08-resultado-pendiente",
    preparar: async ({ page, iniciarSesion }) => {
      await iniciarSesion(USUARIOS.donante, `/donations/${DONACIONES.pendiente}`);
      await expect(page.getByText("Tu intención está registrada")).toBeVisible();
    },
  },
  {
    nombre: "09-resultado-confirmada",
    preparar: async ({ page, iniciarSesion }) => {
      await iniciarSesion(USUARIOS.donante, `/donations/${DONACIONES.pendiente}`);
      await page.getByRole("button", { name: "Confirmar simulación" }).click();
      await expect(page.getByText("¡Gracias por tu apoyo!")).toBeVisible();
    },
  },
  {
    nombre: "10-resultado-rechazada",
    preparar: async ({ page, iniciarSesion }) => {
      await iniciarSesion(USUARIOS.donante, `/donations/${DONACIONES.rechazada}`);
      await expect(page.getByText("La simulación fue rechazada")).toBeVisible();
    },
  },
  {
    nombre: "11-historial",
    preparar: async ({ page, iniciarSesion }) => {
      await iniciarSesion(USUARIOS.donante, "/donations");
      await expect(page.getByText("Pendientes de simular")).toBeVisible();
    },
  },
  {
    nombre: "12-gestion",
    preparar: async ({ page, iniciarSesion }) => {
      await iniciarSesion(USUARIOS.gestor, "/manage");
      await expect(page.getByText("Borradores").first()).toBeVisible();
    },
  },
  {
    nombre: "13-gestion-nuevo-proyecto",
    preparar: async ({ page, iniciarSesion }) => {
      await iniciarSesion(USUARIOS.gestor, "/manage");
      await page.getByRole("button", { name: "Nuevo proyecto" }).click();
      await page.getByLabel("Título").fill("Taller de computación en Cayma");
      await page.getByRole("button", { name: "Guardar borrador" }).click();
      await expect(page.getByText("Mínimo 10 caracteres")).toBeVisible();
    },
  },
  {
    nombre: "14-gestion-confirmar-publicacion",
    preparar: async ({ page, iniciarSesion }) => {
      await iniciarSesion(USUARIOS.gestor, "/manage");
      await page.getByRole("button", { name: "Publicar" }).first().click();
      await expect(page.getByText(/¿Publicar «/)).toBeVisible();
    },
  },
  {
    nombre: "15-auditoria",
    preparar: async ({ page, iniciarSesion }) => {
      await iniciarSesion(USUARIOS.auditor, "/audit");
      await expect(page.getByRole("table")).toBeVisible();
    },
  },
  {
    nombre: "16-acceso-denegado",
    preparar: async ({ page, iniciarSesion }) => {
      await iniciarSesion(USUARIOS.donante, "/manage");
      await expect(page.getByRole("alert")).toBeVisible();
    },
  },
  {
    nombre: "17-proyecto-no-encontrado",
    preparar: async ({ page }) => {
      await page.goto(`/projects/${PROYECTOS.borrador}`);
      await expect(page.getByText("Proyecto no encontrado")).toBeVisible();
    },
  },
  {
    nombre: "18-pagina-no-encontrada",
    preparar: async ({ page }) => {
      await page.goto("/no-existe");
      await expect(page.getByText("Página no encontrada")).toBeVisible();
    },
  },
  {
    nombre: "19-error-del-servicio",
    preparar: async ({ page, backend }) => {
      backend.fallar("GET", /^\/v1\/projects$/, 500, 3);
      await page.goto("/");
      await expect(page.getByRole("alert")).toBeVisible();
    },
  },
  {
    nombre: "20-inicio-sesion-fallido",
    preparar: async ({ page, cognito }) => {
      cognito.rechazarToken = true;
      await page.goto("/");
      await page.getByRole("banner").getByRole("button", { name: "Iniciar sesión" }).click();
      await expect(page.getByRole("alert")).toBeVisible();
    },
  },
];

for (const p of PANTALLAS) {
  test(`captura ${p.nombre}`, async ({ page, backend, cognito, iniciarSesion }, info) => {
    await p.preparar({ page, backend, cognito, iniciarSesion });
    await page.evaluate(() => document.fonts.ready);
    const carpeta = info.project.name.replace("capturas-", "");
    await page.screenshot({
      path: `capturas/${carpeta}/${p.nombre}.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
}

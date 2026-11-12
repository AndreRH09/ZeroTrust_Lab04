// Pruebas E2E (Playwright) de la SPA.
// - Modo normal: build de producción (vite build + preview) con API y Cognito simulados por
//   intercepción de red (tests/e2e/support). Proyectos: escritorio y móvil 375 px.
// - E2E_CAPTURAS=1: solo genera capturas de todas las pantallas en capturas/ (no se versiona).
// - E2E_PUBLIC_URL=https://…: smoke de solo lectura contra el frontend desplegado.
import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";
import { E2E_ENV, PUERTO } from "./tests/e2e/support/entorno";

const publicUrl = process.env.E2E_PUBLIC_URL;
const capturas = process.env.E2E_CAPTURAS === "1";
const modo = publicUrl ? "produccion" : capturas ? "capturas" : "resultados";

const movil = {
  browserName: "chromium" as const,
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

const projects: PlaywrightTestConfig["projects"] = publicUrl
  ? [
      {
        name: "produccion",
        testMatch: /produccion\.spec\.ts/,
        use: { ...devices["Desktop Chrome"] },
      },
    ]
  : capturas
    ? [
        {
          name: "capturas-escritorio",
          testMatch: /capturas\.spec\.ts/,
          use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
        },
        { name: "capturas-movil", testMatch: /capturas\.spec\.ts/, use: movil },
      ]
    : [
        {
          name: "escritorio",
          testIgnore: /(capturas|produccion)\.spec\.ts/,
          use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
        },
        {
          name: "movil-375",
          testIgnore: /(capturas|produccion)\.spec\.ts/,
          grep: /@movil/,
          use: movil,
        },
      ];

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: `test-results/e2e/${modo}`,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: `test-results/e2e/${modo}.json` }],
    ["html", { outputFolder: `playwright-report/${modo}`, open: "never" }],
  ],
  use: {
    baseURL: publicUrl ?? `http://localhost:${PUERTO}`,
    locale: "es-PE",
    timezoneId: "America/Lima",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects,
  webServer: publicUrl
    ? undefined
    : {
        // Build de producción: así se prueban los mismos bundles que sirve CloudFront.
        command: `npm run build -w frontend -- --outDir dist-e2e --emptyOutDir && npm run preview -w frontend -- --outDir dist-e2e --port ${PUERTO} --strictPort`,
        url: `http://localhost:${PUERTO}`,
        reuseExistingServer: false,
        timeout: 180_000,
        env: E2E_ENV,
      },
});

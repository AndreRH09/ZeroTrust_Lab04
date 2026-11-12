// @trace RNF-HU-01, RNF-HU-11, CA-NF01.1, CA-NF11.2, HU-01, T01
// Smoke de SOLO LECTURA contra el frontend desplegado (E2E_PUBLIC_URL). Usa el test base de
// Playwright: no intercepta red ni reemplaza la CSP real de CloudFront. No inicia sesión.
import { expect, test } from "@playwright/test";

test.describe("Producción (CloudFront, solo lectura)", () => {
  test("CP-E2E-PRD-001 el documento llega por HTTPS con las cabeceras de seguridad", async ({
    page,
  }) => {
    const r = await page.goto("/");
    expect(new URL(page.url()).protocol).toBe("https:");
    const h = r!.headers();
    expect(h["strict-transport-security"]).toMatch(/max-age=\d+/);
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["content-security-policy"]).toContain("style-src 'self'");
  });

  test("CP-E2E-PRD-002 el catálogo carga datos del API real sin errores", async ({ page }) => {
    await page.goto("/");
    await expect(
      page
        .locator("#proyectos li article")
        .first()
        .or(page.getByText("Aún no hay proyectos publicados")),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("CP-E2E-PRD-003 sin violaciones de la CSP real y con las barras de progreso dibujadas", async ({
    page,
  }) => {
    const violaciones: string[] = [];
    page.on("console", (m) => {
      if (/Content Security Policy/i.test(m.text())) violaciones.push(m.text());
    });
    await page.goto("/");
    const barra = page.getByRole("progressbar").first();
    await expect(barra).toBeVisible({ timeout: 15_000 });
    const valor = Number(await barra.getAttribute("aria-valuenow"));
    const relleno = await barra.evaluate((el) => {
      const r = el.querySelector("svg rect:nth-of-type(2)") ?? el.firstElementChild;
      return r ? r.getBoundingClientRect().width : 0;
    });
    if (valor > 0)
      expect(relleno, "la barra con avance > 0 debe tener relleno visible").toBeGreaterThan(0);
    expect(violaciones).toEqual([]);
  });
});

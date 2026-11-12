// @trace HU-08, CA-08.1, CA-08.2
// Gestor: crear, editar y publicar proyectos.
import { USUARIOS } from "./support/backendFalso";
import { expect, irA, test } from "./support/fixtures";

const tarjeta = (page: import("@playwright/test").Page, titulo: string) =>
  page
    .getByRole("main")
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: titulo }) });

test.describe("Gestión de proyectos (gestor)", () => {
  test("CP-E2E-PRY-001 crear proyecto valida campos y lo guarda como borrador", async ({
    page,
    backend,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.gestor, "/manage");
    await page.getByRole("button", { name: "Nuevo proyecto" }).click();
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page.getByText("Mínimo 3 caracteres")).toBeVisible();
    await expect(page.getByText("Mínimo 10 caracteres")).toBeVisible();
    await expect(page.getByText(/Objetivo entre S\/ 1\.00 y S\/ 1,000,000\.00/)).toBeVisible();
    expect(backend.llamadas("POST", /^\/v1\/projects$/)).toHaveLength(0);

    await page.getByLabel("Título").fill("Taller de computación en Cayma");
    await page
      .getByLabel("Descripción")
      .fill("Capacitación en ofimática para 40 jóvenes del distrito.");
    await page.getByLabel("Objetivo en soles (PEN)").fill("2500");
    await page.getByRole("button", { name: "Guardar borrador" }).click();

    await expect(tarjeta(page, "Taller de computación en Cayma")).toContainText("Borrador");
    expect(backend.llamadas("POST", /^\/v1\/projects$/)[0]!.body).toEqual({
      title: "Taller de computación en Cayma",
      description: "Capacitación en ofimática para 40 jóvenes del distrito.",
      goalAmountCents: 250_000,
    });
  });

  test("CP-E2E-PRY-002 editar un borrador actualiza título y objetivo", async ({
    page,
    backend,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.gestor, "/manage");
    await tarjeta(page, "Ollas comunes en Alto Selva Alegre")
      .getByRole("button", { name: "Editar" })
      .click();
    await expect(page.getByLabel("Objetivo en soles (PEN)")).toHaveValue("6000.00");
    await page.getByLabel("Título").fill("Ollas comunes en ASA");
    await page.getByLabel("Objetivo en soles (PEN)").fill("7000");
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(tarjeta(page, "Ollas comunes en ASA")).toContainText("S/ 7,000.00");
    expect(backend.llamadas("PATCH", /^\/v1\/projects\/[^/]+$/)[0]!.body).toMatchObject({
      title: "Ollas comunes en ASA",
      goalAmountCents: 700_000,
    });
  });

  test("CP-E2E-PRY-003 publicar exige confirmación; cancelar no publica y confirmar lo muestra en el catálogo", async ({
    page,
    backend,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.gestor, "/manage");
    const ollas = tarjeta(page, "Ollas comunes en Alto Selva Alegre");
    await ollas.getByRole("button", { name: "Publicar" }).click();
    await expect(ollas.getByText("¿Publicar «Ollas comunes en Alto Selva Alegre»?")).toBeVisible();
    await ollas.getByRole("button", { name: "Cancelar" }).click();
    expect(backend.llamadas("PATCH", /\/publish$/)).toHaveLength(0);

    await ollas.getByRole("button", { name: "Publicar" }).click();
    await ollas.getByRole("button", { name: "Sí, publicar" }).click();
    await expect(tarjeta(page, "Ollas comunes en Alto Selva Alegre")).toContainText("Publicado");
    await irA(page, "Proyectos");
    await expect(
      page.getByRole("link", { name: "Ollas comunes en Alto Selva Alegre" }),
    ).toBeVisible();
  });

  test("CP-E2E-PRY-004 los borradores aparecen primero y un publicado no ofrece editar ni publicar @movil", async ({
    page,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.gestor, "/manage");
    const tarjetas = page.getByRole("main").locator("ul > li");
    await expect(tarjetas.first()).toContainText("Borrador");
    const publicado = tarjeta(page, "Campaña de salud en Yura");
    await expect(publicado).toContainText("Publicado");
    await expect(publicado.getByRole("button")).toHaveCount(0);
  });
});

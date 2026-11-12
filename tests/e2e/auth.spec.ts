// @trace HU-03, HU-04, RNF-HU-11, CA-03.1, CA-03.3, CA-04.3, CA-NF11.1
// Autenticación con Authorization Code + PKCE contra un Cognito simulado; tokens solo en memoria.
import { PROYECTOS, USUARIOS } from "./support/backendFalso";
import { CLIENT_ID } from "./support/entorno";
import { expect, test } from "./support/fixtures";

test.describe("Autenticación (OIDC + PKCE)", () => {
  test("CP-E2E-AUT-001 inicia sesión con Authorization Code + PKCE S256 y los scopes de la API", async ({
    page,
    cognito,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.donante);
    const p = cognito.authorize[0]!.searchParams;
    expect(p.get("response_type")).toBe("code");
    expect(p.get("client_id")).toBe(CLIENT_ID);
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(p.get("state")).toBeTruthy();
    expect(p.get("redirect_uri")).toBe(new URL("/callback", page.url()).toString());
    expect(p.get("scope")?.split(" ")).toEqual(
      expect.arrayContaining(["openid", "api/donations.write", "api/donations.read"]),
    );
    expect(cognito.intercambios).toEqual([{ pkceValido: true, grantType: "authorization_code" }]);
  });

  test("CP-E2E-AUT-002 tras iniciar sesión no hay tokens en localStorage ni sessionStorage", async ({
    page,
    cognito,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.donante);
    const almacenado = await page.evaluate(
      () => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }),
    );
    const { access, id, refresh } = cognito.emitidos[0]!;
    for (const secreto of [access, id, refresh]) expect(almacenado).not.toContain(secreto);
    expect(almacenado).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
  });

  test("CP-E2E-AUT-003 recargar la página descarta la sesión (tokens solo en memoria)", async ({
    page,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.donante);
    await page.reload();
    await expect(
      page.getByRole("banner").getByRole("button", { name: "Iniciar sesión" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Mis donaciones" })).toHaveCount(0);
  });

  test("CP-E2E-AUT-004 una ruta protegida pide iniciar sesión y, al volver, abre la ruta pedida", async ({
    page,
    cognito,
  }) => {
    await page.goto("/donations");
    await expect(page.getByText("Necesitas iniciar sesión para continuar")).toBeVisible();
    cognito.siguienteUsuario = USUARIOS.donante;
    await page.getByRole("main").getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL("/donations");
    await expect(page.getByRole("heading", { name: "Mis donaciones simuladas" })).toBeVisible();
  });

  test("CP-E2E-AUT-005 'Inicia sesión para donar' vuelve directamente al formulario de donación", async ({
    page,
    cognito,
  }) => {
    await page.goto(`/projects/${PROYECTOS.utiles}`);
    cognito.siguienteUsuario = USUARIOS.donante;
    await page.getByRole("button", { name: "Inicia sesión para donar" }).click();
    await expect(page).toHaveURL(`/projects/${PROYECTOS.utiles}/donate`);
    await expect(page.getByLabel("Monto en soles (PEN)")).toBeVisible();
  });

  test("CP-E2E-AUT-006 cerrar sesión revoca el refresh token y pasa por /logout de Cognito", async ({
    page,
    cognito,
    iniciarSesion,
  }) => {
    await iniciarSesion(USUARIOS.donante);
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(
      page.getByRole("banner").getByRole("button", { name: "Iniciar sesión" }),
    ).toBeVisible();
    expect(cognito.revocaciones).toEqual([cognito.emitidos[0]!.refresh]);
    const salida = cognito.logouts[0]!;
    expect(salida.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(salida.searchParams.get("logout_uri")).toBe(new URL("/", page.url()).toString());
  });

  for (const [rol, visible, ocultos] of [
    ["donante", "Mis donaciones", ["Gestionar", "Auditoría"]],
    ["gestor", "Gestionar", ["Mis donaciones", "Auditoría"]],
    ["auditor", "Auditoría", ["Mis donaciones", "Gestionar"]],
  ] as const) {
    test(`CP-E2E-AUT-007 el menú se adapta al grupo (${rol}) solo como ayuda de UX`, async ({
      page,
      iniciarSesion,
    }) => {
      await iniciarSesion(USUARIOS[rol]);
      const nav = page.getByRole("navigation", { name: "Principal" });
      await expect(nav.getByRole("link", { name: visible })).toBeVisible();
      for (const o of ocultos) await expect(nav.getByRole("link", { name: o })).toHaveCount(0);
    });
  }

  test("CP-E2E-AUT-008 si Cognito rechaza el canje del código no se obtiene sesión", async ({
    page,
    cognito,
  }) => {
    cognito.rechazarToken = true;
    await page.goto("/");
    await page.getByRole("banner").getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByRole("alert")).toContainText("No se pudo completar el inicio de sesión");
    await expect(page.getByRole("button", { name: "Cerrar sesión" })).toHaveCount(0);
    expect(cognito.emitidos).toHaveLength(0);
  });
});

// @trace HU-03, RNF-HU-11, CA-03.1, CA-03.3, CA-NF11.1
import { InMemoryWebStorage, User } from "oidc-client-ts";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../src/config", () => ({
  config: {
    apiUrl: "https://api.example.com/academic",
    authority: "https://cognito-idp.us-east-2.amazonaws.com/us-east-2_test",
    clientId: "client123",
    cognitoDomain: "https://demo.auth.us-east-2.amazoncognito.com",
    scopes: ["openid", "email", "api/donations.write"],
  },
  isConfigured: () => true,
}));

const { createUserManager, groupsFromAccessToken, logout } = await import("../src/auth/oidc");

const b64url = (o: unknown) =>
  btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const fakeJwt = (payload: unknown) => `${b64url({ alg: "RS256" })}.${b64url(payload)}.firma`;

function fakeUser(): User {
  return new User({
    access_token: fakeJwt({ sub: "u1", "cognito:groups": ["DONANTE"], token_use: "access" }),
    id_token: fakeJwt({ sub: "u1", token_use: "id" }),
    refresh_token: "refresh-secreto",
    token_type: "Bearer",
    scope: "openid api/donations.write",
    profile: { sub: "u1", iss: "x", aud: "client123", exp: 0, iat: 0 },
    expires_at: Math.floor(Date.now() / 1000) + 900,
  });
}

describe("UserManager (CA-03.1, CA-NF11.1)", () => {
  const um = createUserManager("https://app.example.com");

  it("usa Authorization Code (PKCE) y scopes de la API", () => {
    expect(um.settings.response_type).toBe("code");
    expect(um.settings.redirect_uri).toBe("https://app.example.com/callback");
    expect(um.settings.scope).toContain("api/donations.write");
  });

  it("guarda el usuario en memoria (InMemoryWebStorage)", () => {
    const store = (um.settings.userStore as unknown as { _store: unknown })._store;
    expect(store).toBeInstanceOf(InMemoryWebStorage);
  });

  it("tras iniciar sesión no hay tokens en localStorage ni sessionStorage", async () => {
    await um.storeUser(fakeUser());
    const dump =
      JSON.stringify({ ...window.localStorage }) + JSON.stringify({ ...window.sessionStorage });
    expect(dump).not.toMatch(/refresh-secreto|access_token|id_token/);
    expect((await um.getUser())?.refresh_token).toBe("refresh-secreto");
  });
});

describe("logout (CA-03.3)", () => {
  beforeAll(() => {
    vi.spyOn(window, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
  });

  it("revoca el refresh token, limpia memoria y devuelve la URL de /logout de Cognito", async () => {
    const um = createUserManager("https://app.example.com");
    await um.storeUser(fakeUser());
    const revoke = vi.spyOn(um, "revokeTokens").mockResolvedValue();
    const url = await logout(um, "https://app.example.com");
    expect(revoke).toHaveBeenCalledWith(["refresh_token"]);
    expect(await um.getUser()).toBeNull();
    expect(url).toBe(
      "https://demo.auth.us-east-2.amazoncognito.com/logout?client_id=client123&logout_uri=https%3A%2F%2Fapp.example.com%2F",
    );
  });

  it("limpia memoria aunque la revocación falle", async () => {
    const um = createUserManager("https://app.example.com");
    await um.storeUser(fakeUser());
    vi.spyOn(um, "revokeTokens").mockRejectedValue(new Error("red"));
    await expect(logout(um)).rejects.toThrow();
    expect(await um.getUser()).toBeNull();
  });
});

describe("groupsFromAccessToken (solo UX)", () => {
  it("lee cognito:groups del access token", () => {
    expect(groupsFromAccessToken(fakeJwt({ "cognito:groups": ["GESTOR"] }))).toEqual(["GESTOR"]);
  });
  it("token inválido o ausente → []", () => {
    expect(groupsFromAccessToken("basura")).toEqual([]);
    expect(groupsFromAccessToken(undefined)).toEqual([]);
  });
});

// @trace HU-03, CA-03.1, CA-NF02.2
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RequireAuth } from "../src/components/RequireAuth";
import { fakeAuth, renderAt } from "./utils";

const protegido = (
  <RequireAuth>
    <p>contenido privado</p>
  </RequireAuth>
);

describe("RequireAuth (guard de UX, no control de acceso)", () => {
  it("con sesión muestra el contenido", () => {
    renderAt("/donations", "/donations", protegido);
    expect(screen.getByText("contenido privado")).toBeInTheDocument();
  });

  it("sin sesión pide iniciar sesión y conserva la ruta pedida como returnTo", async () => {
    const login = vi.fn(async () => {});
    renderAt(
      "/donations",
      "/donations",
      protegido,
      fakeAuth({ isAuthenticated: false, groups: [], login }),
    );
    expect(screen.queryByText("contenido privado")).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(login).toHaveBeenCalledWith("/donations");
  });

  it("sin configuración de Cognito lo indica en vez de mostrar el botón", () => {
    renderAt(
      "/donations",
      "/donations",
      protegido,
      fakeAuth({ isAuthenticated: false, configured: false }),
    );
    expect(screen.getByText(/La autenticación no está configurada/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

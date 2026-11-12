// @trace RNF-HU-10, RNF-HU-06, HU-04, CA-NF10.2, CA-NF06.2
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Layout } from "../src/components/Layout";
import { fakeAuth, renderAt } from "./utils";

describe("Layout", () => {
  it("CA-NF10.2 informa que es prototipo académico sin pagos reales y cita la Ley 29733", () => {
    renderAt("/", "/", <Layout />);
    expect(screen.getByText(/Prototipo académico — sin pagos reales/)).toBeInTheDocument();
    expect(screen.getByText(/Ley N\.º 29733/)).toBeInTheDocument();
  });

  it("CA-NF06.2 ofrece enlace para saltar al contenido", () => {
    renderAt("/", "/", <Layout />);
    expect(screen.getByRole("link", { name: "Saltar al contenido" })).toHaveAttribute(
      "href",
      "#contenido",
    );
  });

  it("muestra opciones según el grupo solo como ayuda de UX", () => {
    renderAt("/", "/", <Layout />, fakeAuth({ groups: ["GESTOR"] }));
    expect(screen.getByRole("link", { name: "Gestionar" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Mis donaciones" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Auditoría" })).toBeNull();
  });

  it("sin sesión muestra el botón de inicio de sesión", () => {
    renderAt("/", "/", <Layout />, fakeAuth({ isAuthenticated: false, groups: [] }));
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
  });
});

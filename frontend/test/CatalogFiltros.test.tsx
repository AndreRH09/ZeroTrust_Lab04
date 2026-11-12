// @trace HU-01, HU-09, CA-01.1, CA-09.1
import type { ProjectPublic } from "@aqp/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Catalog } from "../src/pages/Catalog";
import { api } from "../src/services/api";
import { renderAt } from "./utils";

const p = (id: string, title: string, confirmed: number, goal = 100000): ProjectPublic => ({
  projectId: id,
  title,
  description: "Descripción del proyecto",
  goalAmountCents: goal,
  confirmedAmountCents: confirmed,
  currency: "PEN",
  status: "PUBLICADO",
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "listProjects").mockResolvedValue({
    items: [
      p("a", "Útiles escolares", 20000),
      p("b", "Comedor popular", 90000),
      p("c", "Campaña de salud", 100000),
    ],
  });
});

const titulos = () =>
  within(document.querySelector("#proyectos ul")! as HTMLElement)
    .getAllByRole("heading", { level: 2 })
    .map((h) => h.textContent);

describe("Catálogo: búsqueda, filtros, orden e indicadores", () => {
  it("indicadores de portada: activos, metas alcanzadas y total confirmado", async () => {
    renderAt("/", "/", <Catalog />);
    await screen.findByText("Útiles escolares");
    expect(screen.getByText("1 de 3")).toBeInTheDocument();
    expect(screen.getByText("S/ 2,100.00")).toBeInTheDocument();
  });

  it("buscar ignora tildes y mayúsculas", async () => {
    renderAt("/", "/", <Catalog />);
    const user = userEvent.setup();
    await user.type(await screen.findByRole("searchbox", { name: "Buscar proyecto" }), "UTILES");
    expect(titulos()).toEqual(["Útiles escolares"]);
  });

  it("filtrar por categoría marca el botón con aria-pressed", async () => {
    renderAt("/", "/", <Catalog />);
    const user = userEvent.setup();
    const salud = await screen.findByRole("button", { name: "Salud comunitaria" });
    await user.click(salud);
    expect(salud).toHaveAttribute("aria-pressed", "true");
    expect(titulos()).toEqual(["Campaña de salud"]);
  });

  it("ordenar por 'más cerca de la meta' y 'necesitan más apoyo'", async () => {
    renderAt("/", "/", <Catalog />);
    const user = userEvent.setup();
    const orden = await screen.findByLabelText("Ordenar por");
    await user.selectOptions(orden, "cerca");
    expect(titulos()).toEqual(["Campaña de salud", "Comedor popular", "Útiles escolares"]);
    await user.selectOptions(orden, "apoyo");
    expect(titulos()).toEqual(["Útiles escolares", "Comedor popular", "Campaña de salud"]);
  });

  it("sin coincidencias muestra estado vacío y 'Limpiar filtros' restaura", async () => {
    renderAt("/", "/", <Catalog />);
    const user = userEvent.setup();
    await user.type(await screen.findByRole("searchbox", { name: "Buscar proyecto" }), "zzz");
    expect(screen.getByText("Ningún proyecto coincide con tu búsqueda")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(titulos()).toHaveLength(3);
  });

  it("meta alcanzada muestra la insignia en la tarjeta", async () => {
    renderAt("/", "/", <Catalog />);
    expect(await screen.findByText("Meta alcanzada")).toBeInTheDocument();
  });
});

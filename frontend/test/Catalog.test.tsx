// @trace HU-01, RNF-HU-06, CA-01.1, CA-01.3, CA-NF06.2, T01
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Catalog } from "../src/pages/Catalog";
import { api, ApiError } from "../src/services/api";
import { renderAt } from "./utils";

beforeEach(() => vi.restoreAllMocks());

describe("Catálogo", () => {
  it("CA-01.1 muestra nombre, finalidad, meta y confirmado en PEN", async () => {
    vi.spyOn(api, "listProjects").mockResolvedValue({
      items: [
        {
          projectId: "p1",
          title: "Comedor popular",
          description: "Alimentación para 50 familias",
          goalAmountCents: 100000,
          confirmedAmountCents: 2500,
          currency: "PEN",
          status: "PUBLICADO",
        },
      ],
    });
    renderAt("/", "/", <Catalog />);
    expect(await screen.findByRole("link", { name: "Comedor popular" })).toBeInTheDocument();
    expect(screen.getByText("Alimentación para 50 familias")).toBeInTheDocument();
    expect(screen.getByText("S/ 1,000.00", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
  });

  it("CA-01.3 estado vacío comprensible", async () => {
    vi.spyOn(api, "listProjects").mockResolvedValue({ items: [] });
    renderAt("/", "/", <Catalog />);
    expect(await screen.findByText("Aún no hay proyectos publicados")).toBeInTheDocument();
  });

  it("error de red sin detalles técnicos", async () => {
    vi.spyOn(api, "listProjects").mockRejectedValue(
      new ApiError(500, "INTERNAL_ERROR", "Table arn:aws:dynamodb"),
    );
    renderAt("/", "/", <Catalog />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Ocurrió un error inesperado");
    expect(alert).not.toHaveTextContent("arn:aws");
  });
});

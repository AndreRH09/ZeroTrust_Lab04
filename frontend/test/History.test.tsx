// @trace HU-07, CA-07.1
import type { Donation } from "@aqp/shared";
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { History } from "../src/pages/History";
import { api } from "../src/services/api";
import { renderAt } from "./utils";

const d = (id: string, status: Donation["status"], amountCents: number, dia: number): Donation => ({
  donationId: id,
  projectId: "p1",
  amountCents,
  currency: "PEN",
  status,
  createdAt: `2026-11-0${dia}T15:00:00.000Z`,
  updatedAt: `2026-11-0${dia}T15:00:00.000Z`,
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "listProjects").mockResolvedValue({
    items: [
      {
        projectId: "p1",
        title: "Comedor popular",
        description: "x".repeat(10),
        goalAmountCents: 100000,
        confirmedAmountCents: 0,
        currency: "PEN",
        status: "PUBLICADO",
      },
    ],
  });
});

describe("Historial propio (CA-07.1)", () => {
  it("ordena del más reciente al más antiguo y muestra título, estado e importe", async () => {
    vi.spyOn(api, "myDonations").mockResolvedValue({
      items: [d("a", "CONFIRMADA_SIMULADA", 5000, 1), d("b", "PENDIENTE_SIMULACION", 2000, 3)],
    });
    renderAt("/donations", "/donations", <History />);
    const lista = await screen.findByRole("list", { name: "Historial de donaciones simuladas" });
    const items = within(lista).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Pendiente de simulación");
    expect(items[0]).toHaveTextContent("S/ 20.00");
    expect(items[1]).toHaveTextContent("Comedor popular");
    expect(within(items[0]!).getByRole("link")).toHaveAttribute("href", "/donations/b");
  });

  it("los indicadores suman solo lo confirmado y cuentan pendientes", async () => {
    vi.spyOn(api, "myDonations").mockResolvedValue({
      items: [
        d("a", "CONFIRMADA_SIMULADA", 5000, 1),
        d("b", "RECHAZADA_SIMULADA", 9000, 2),
        d("c", "PENDIENTE_SIMULACION", 2000, 3),
      ],
    });
    renderAt("/donations", "/donations", <History />);
    expect(await screen.findByText("Ábrelas para confirmar o rechazar")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getAllByText("S/ 50.00").length).toBeGreaterThan(0);
  });

  it("sin donaciones invita a explorar proyectos", async () => {
    vi.spyOn(api, "myDonations").mockResolvedValue({ items: [] });
    renderAt("/donations", "/donations", <History />);
    expect(await screen.findByText("Todavía no registraste donaciones")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explora los proyectos" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("si el título no está en el catálogo muestra el id del proyecto", async () => {
    vi.spyOn(api, "listProjects").mockResolvedValue({ items: [] });
    vi.spyOn(api, "myDonations").mockResolvedValue({
      items: [d("a", "CONFIRMADA_SIMULADA", 100, 1)],
    });
    renderAt("/donations", "/donations", <History />);
    expect(await screen.findByText("p1")).toBeInTheDocument();
  });
});

// @trace HU-02, HU-09, CA-02.1, CA-02.2, CA-09.1, CA-09.2
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectDetail } from "../src/pages/ProjectDetail";
import { api, ApiError } from "../src/services/api";
import { fakeAuth, renderAt } from "./utils";

const P = {
  projectId: "p1",
  title: "Comedor popular",
  description: "Alimentación para 50 familias",
  goalAmountCents: 100000,
  confirmedAmountCents: 25000,
  currency: "PEN" as const,
  status: "PUBLICADO" as const,
};
const stats = (confirmed: number) => ({
  projectId: "p1",
  goalAmountCents: 100000,
  confirmedAmountCents: confirmed,
  currency: "PEN" as const,
  progressPercent: Math.floor(confirmed / 1000),
});
const renderDetail = (auth = fakeAuth()) =>
  renderAt("/projects/p1", "/projects/:projectId", <ProjectDetail />, auth);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "getProject").mockResolvedValue(P);
  vi.spyOn(api, "getStats").mockResolvedValue(stats(25000));
});

describe("Detalle de proyecto", () => {
  it("CA-09.1 muestra objetivo, lo que falta y usa el acumulado de /stats", async () => {
    vi.spyOn(api, "getStats").mockResolvedValue(stats(40000));
    renderDetail();
    expect(await screen.findByText("S/ 600.00")).toBeInTheDocument(); // falta 1000 − 400
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
  });

  it("meta superada → 'Meta alcanzada' en lugar de un monto negativo", async () => {
    vi.spyOn(api, "getStats").mockResolvedValue(stats(120000));
    renderDetail();
    expect(await screen.findByText("Meta alcanzada")).toBeInTheDocument();
  });

  it("con sesión ofrece 'Donar (simulado)'; sin sesión 'Inicia sesión para donar'", async () => {
    const { unmount } = renderDetail();
    expect(await screen.findByRole("link", { name: /Donar \(simulado\)/ })).toHaveAttribute(
      "href",
      "/projects/p1/donate",
    );
    unmount();
    renderDetail(fakeAuth({ isAuthenticated: false, groups: [] }));
    expect(await screen.findByRole("button", { name: "Inicia sesión para donar" })).toBeEnabled();
  });

  it("CA-02.2 404 → 'Proyecto no encontrado' sin detalles", async () => {
    vi.spyOn(api, "getProject").mockRejectedValue(new ApiError(404, "NOT_FOUND", "x"));
    renderDetail();
    expect(await screen.findByText("Proyecto no encontrado")).toBeInTheDocument();
  });

  it("CA-09.2 no muestra datos de donantes, solo totales agregados", async () => {
    renderDetail();
    await screen.findByText("Sobre el proyecto");
    expect(screen.queryByText(/donorSub|@/)).toBeNull();
  });
});

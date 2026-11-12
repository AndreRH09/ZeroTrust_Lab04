// @trace HU-05, CA-05.1, CA-05.2
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Donate } from "../src/pages/Donate";
import { api } from "../src/services/api";
import { renderAt } from "./utils";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "getProject").mockResolvedValue({
    projectId: "p1",
    title: "Biblioteca rural",
    description: "Libros para escuelas",
    goalAmountCents: 500000,
    confirmedAmountCents: 0,
    currency: "PEN",
    status: "PUBLICADO",
  });
});
const renderDonate = () =>
  renderAt("/projects/p1/donate", "/projects/:projectId/donate", <Donate />);

describe("Montos sugeridos y resumen", () => {
  it("elegir un monto sugerido llena el campo y marca aria-pressed", async () => {
    renderDonate();
    const user = userEvent.setup();
    const cincuenta = await screen.findByRole("button", { name: "S/ 50" });
    await user.click(cincuenta);
    expect(screen.getByLabelText("Monto en soles (PEN)")).toHaveValue("50");
    expect(cincuenta).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "S/ 20" })).toHaveAttribute("aria-pressed", "false");
  });

  it("escribir un monto que coincide con un sugerido también lo marca", async () => {
    renderDonate();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Monto en soles (PEN)"), "100.00");
    expect(screen.getByRole("button", { name: "S/ 100" })).toHaveAttribute("aria-pressed", "true");
  });

  it("el resumen aparece solo con un monto válido", async () => {
    renderDonate();
    const user = userEvent.setup();
    const campo = await screen.findByLabelText("Monto en soles (PEN)");
    expect(
      screen.getByText("Elige un monto sugerido o escribe otro para ver el resumen."),
    ).toBeInTheDocument();
    await user.type(campo, "25,5");
    expect(screen.getByText("S/ 25.50")).toBeInTheDocument();
    await user.clear(campo);
    await user.type(campo, "5000");
    expect(
      screen.getByText("Elige un monto sugerido o escribe otro para ver el resumen."),
    ).toBeInTheDocument();
  });

  it("los montos sugeridos están dentro del rango permitido (S/ 1 – S/ 1,000)", async () => {
    renderDonate();
    const grupo = await screen.findByRole("group", { name: "Montos sugeridos" });
    const valores = [...grupo.querySelectorAll("button")].map((b) =>
      Number(b.textContent?.replace(/\D/g, "")),
    );
    expect(valores).toEqual([20, 50, 100, 200]);
    expect(valores.every((v) => v >= 1 && v <= 1000)).toBe(true);
  });
});

// @trace HU-06, CA-06.4, CA-06.1
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Donation } from "@aqp/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Result } from "../src/pages/Result";
import { api } from "../src/services/api";
import { renderAt } from "./utils";

const pending: Donation = {
  donationId: "d1",
  projectId: "p1",
  amountCents: 2500,
  currency: "PEN",
  status: "PENDIENTE_SIMULACION",
  createdAt: "2026-11-05T00:00:00.000Z",
  updatedAt: "2026-11-05T00:00:00.000Z",
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "getDonation").mockResolvedValue(pending);
  vi.spyOn(api, "getStats").mockResolvedValue({
    projectId: "p1",
    goalAmountCents: 100000,
    confirmedAmountCents: 0,
    currency: "PEN",
    progressPercent: 0,
  });
});

const renderResult = () => renderAt("/donations/d1", "/donations/:donationId", <Result />);

describe("Resultado de la simulación (CA-06.4)", () => {
  it.each([
    ["Confirmar simulación", "CONFIRM", "CONFIRMADA_SIMULADA", "Confirmada (simulada)"],
    ["Rechazar simulación", "REJECT", "RECHAZADA_SIMULADA", "Rechazada (simulada)"],
  ] as const)(
    "tras %s muestra el aviso literal y el nuevo estado",
    async (button, outcome, status, label) => {
      const simulate = vi.spyOn(api, "simulate").mockResolvedValue({ ...pending, status });
      renderResult();
      const user = userEvent.setup();
      await user.click(await screen.findByRole("button", { name: button }));
      expect(simulate).toHaveBeenCalledWith("token-de-prueba", "d1", outcome);
      expect(await screen.findByText(label)).toBeInTheDocument();
      expect(
        screen.getByText("Simulación académica: no se ha realizado ningún cobro"),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: button })).toBeNull();
    },
  );

  it("donación terminal no ofrece volver a simular", async () => {
    vi.spyOn(api, "getDonation").mockResolvedValue({ ...pending, status: "CONFIRMADA_SIMULADA" });
    renderResult();
    expect(await screen.findByText("Confirmada (simulada)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /simulación/ })).toBeNull();
  });
});

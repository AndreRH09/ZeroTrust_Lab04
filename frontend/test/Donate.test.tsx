// @trace HU-05, RNF-HU-06, CA-05.1, CA-05.2, CA-05.5, CA-NF06.2, T04
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Donate } from "../src/pages/Donate";
import { api } from "../src/services/api";
import { renderAt } from "./utils";

const PROJECT = {
  projectId: "7f1c2b8e-4a3d-4c1e-9b2a-1d2e3f4a5b6c",
  title: "Biblioteca rural",
  description: "Libros para escuelas",
  goalAmountCents: 500000,
  confirmedAmountCents: 0,
  currency: "PEN" as const,
  status: "PUBLICADO" as const,
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "getProject").mockResolvedValue(PROJECT);
});

const renderDonate = () =>
  renderAt(`/projects/${PROJECT.projectId}/donate`, "/projects/:projectId/donate", <Donate />);

describe("Formulario de donación", () => {
  it("CA-05.5 no existen campos de tarjeta, CVV, cuenta ni DNI", async () => {
    renderDonate();
    await screen.findByLabelText("Monto en soles (PEN)");
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByLabelText(/tarjeta|cvv|cuenta|dni/i)).toBeNull();
  });

  it.each(["10.555", "0", "1000.01", "abc"])(
    "T04 '%s' muestra error accesible y no envía",
    async (value) => {
      const create = vi.spyOn(api, "createDonation");
      renderDonate();
      const user = userEvent.setup();
      await user.type(await screen.findByLabelText("Monto en soles (PEN)"), value);
      await user.click(screen.getByRole("button", { name: "Registrar intención" }));
      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(screen.getByLabelText("Monto en soles (PEN)")).toHaveAttribute("aria-invalid", "true");
      expect(create).not.toHaveBeenCalled();
    },
  );

  it("CA-05.1 '25' envía amountCents 2500 con Idempotency-Key UUID", async () => {
    const create = vi.spyOn(api, "createDonation").mockResolvedValue({
      donationId: "d1",
      projectId: PROJECT.projectId,
      amountCents: 2500,
      currency: "PEN",
      status: "PENDIENTE_SIMULACION",
      createdAt: "2026-11-05T00:00:00.000Z",
      updatedAt: "2026-11-05T00:00:00.000Z",
    });
    renderDonate();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Monto en soles (PEN)"), "25");
    await user.click(screen.getByRole("button", { name: "Registrar intención" }));
    await screen.findByText("otra-ruta");
    expect(create).toHaveBeenCalledWith(
      "token-de-prueba",
      { projectId: PROJECT.projectId, amountCents: 2500 },
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
  });

  it("reintentar el mismo envío reutiliza la misma Idempotency-Key", async () => {
    const create = vi
      .spyOn(api, "createDonation")
      .mockRejectedValueOnce(new Error("red"))
      .mockRejectedValueOnce(new Error("red"));
    renderDonate();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Monto en soles (PEN)"), "30");
    await user.click(screen.getByRole("button", { name: "Registrar intención" }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Registrar intención" }));
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(create.mock.calls[0]![2]).toBe(create.mock.calls[1]![2]);
  });
});

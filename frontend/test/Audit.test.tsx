// @trace HU-10, CA-10.1, CA-10.2
import type { AuditEvent } from "@aqp/shared";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Audit } from "../src/pages/Audit";
import { api } from "../src/services/api";
import { fakeAuth, renderAt } from "./utils";

const evento = (outcome: AuditEvent["outcome"]): AuditEvent => ({
  eventId: `e-${outcome}`,
  eventType: "AUTHZ_DENIED",
  timestamp: "2026-11-09T15:00:00.000Z",
  requestId: "req-1",
  actorRef: "a3f9c0ffee0123456789abcdef",
  action: "POST /v1/projects",
  resourceRef: "project/*",
  outcome,
});
const renderAudit = () =>
  renderAt("/audit", "/audit", <Audit />, fakeAuth({ groups: ["AUDITOR"] }));

beforeEach(() => vi.restoreAllMocks());

describe("Auditoría (HU-10)", () => {
  it("CA-10.1 consulta AUTHZ_DENIED por defecto y traduce el resultado", async () => {
    const list = vi.spyOn(api, "listAudit").mockResolvedValue({
      items: [evento("DENIED"), evento("SUCCESS"), evento("CONFLICT")],
    });
    renderAudit();
    expect(await screen.findByText("Denegado")).toBeInTheDocument();
    expect(screen.getByText("Éxito")).toBeInTheDocument();
    expect(screen.getByText("Conflicto")).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith("token-de-prueba", {
      eventType: "AUTHZ_DENIED",
      from: undefined,
      to: undefined,
    });
  });

  it("CA-10.2 el actor se muestra truncado (seudónimo, 12 caracteres)", async () => {
    vi.spyOn(api, "listAudit").mockResolvedValue({ items: [evento("DENIED")] });
    renderAudit();
    expect(await screen.findByText("a3f9c0ffee01…")).toBeInTheDocument();
    expect(screen.queryByText("a3f9c0ffee0123456789abcdef")).toBeNull();
  });

  it("CA-10.1 filtrar envía el tipo elegido y las fechas en ISO 8601", async () => {
    const list = vi.spyOn(api, "listAudit").mockResolvedValue({ items: [] });
    renderAudit();
    const user = userEvent.setup();
    await screen.findByText("Sin eventos para el filtro seleccionado");
    await user.selectOptions(screen.getByLabelText("Tipo de evento"), "DONATION_CREATED");
    await user.type(screen.getByLabelText("Desde"), "2026-11-01T00:00");
    await user.click(screen.getByRole("button", { name: "Filtrar" }));
    await vi.waitFor(() =>
      expect(list).toHaveBeenLastCalledWith("token-de-prueba", {
        eventType: "DONATION_CREATED",
        from: new Date("2026-11-01T00:00").toISOString(),
        to: undefined,
      }),
    );
  });

  it("la tabla desplazable es enfocable con teclado (WCAG 2.1.1)", async () => {
    vi.spyOn(api, "listAudit").mockResolvedValue({ items: [evento("DENIED")] });
    renderAudit();
    const region = await screen.findByRole("region", { name: "Tabla de eventos (desplazable)" });
    expect(region).toHaveAttribute("tabindex", "0");
  });
});

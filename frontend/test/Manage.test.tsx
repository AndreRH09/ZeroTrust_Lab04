// @trace HU-08, CA-08.1, CA-08.2, CA-NF02.2
import type { ProjectManaged } from "@aqp/shared";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Manage } from "../src/pages/Manage";
import { api, ApiError } from "../src/services/api";
import { fakeAuth, renderAt } from "./utils";

const proyecto = (id: string, title: string, status: ProjectManaged["status"]): ProjectManaged => ({
  projectId: id,
  title,
  description: "Descripción suficientemente larga",
  goalAmountCents: 600000,
  confirmedAmountCents: 0,
  currency: "PEN",
  status,
  createdAt: "2026-11-05T00:00:00.000Z",
  updatedAt: "2026-11-05T00:00:00.000Z",
});
const GESTOR = fakeAuth({ groups: ["GESTOR"] });
const renderManage = () => renderAt("/manage", "/manage", <Manage />, GESTOR);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "listManage").mockResolvedValue({
    items: [
      proyecto("p1", "Campaña publicada", "PUBLICADO"),
      proyecto("p2", "Ollas comunes", "BORRADOR"),
    ],
  });
});

describe("Gestión de proyectos", () => {
  it("lista borradores primero y un publicado no tiene acciones", async () => {
    renderManage();
    const items = await screen.findAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Ollas comunes");
    expect(within(items[1]!).queryAllByRole("button")).toHaveLength(0);
  });

  it("CA-08.1 valida título, descripción y objetivo antes de llamar al API", async () => {
    const create = vi.spyOn(api, "createProject");
    renderManage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Nuevo proyecto" }));
    await user.type(screen.getByLabelText("Objetivo en soles (PEN)"), "0");
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));
    expect(await screen.findByText("Mínimo 3 caracteres")).toBeInTheDocument();
    expect(screen.getByText("Mínimo 10 caracteres")).toBeInTheDocument();
    expect(screen.getByText(/Objetivo entre/)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("CA-08.1 crea con objetivo en céntimos enteros", async () => {
    const create = vi
      .spyOn(api, "createProject")
      .mockResolvedValue(proyecto("p3", "Nuevo", "BORRADOR"));
    renderManage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Nuevo proyecto" }));
    await user.type(screen.getByLabelText("Título"), "Taller de lectura");
    await user.type(screen.getByLabelText("Descripción"), "Talleres para 30 niños del distrito");
    await user.type(screen.getByLabelText("Objetivo en soles (PEN)"), "1234.5");
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await vi.waitFor(() =>
      expect(create).toHaveBeenCalledWith("token-de-prueba", {
        title: "Taller de lectura",
        description: "Talleres para 30 niños del distrito",
        goalAmountCents: 123450,
      }),
    );
  });

  it("el contador de caracteres sigue lo escrito", async () => {
    renderManage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Nuevo proyecto" }));
    await user.type(screen.getByLabelText("Título"), "Hola");
    expect(screen.getByText("4/120")).toBeInTheDocument();
  });

  it("CA-08.2 publicar pide confirmación; cancelar no llama al API y confirmar sí", async () => {
    const publish = vi
      .spyOn(api, "publishProject")
      .mockResolvedValue(proyecto("p2", "Ollas comunes", "PUBLICADO"));
    renderManage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Publicar" }));
    expect(screen.getByText("¿Publicar «Ollas comunes»?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(publish).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Publicar" }));
    await user.click(screen.getByRole("button", { name: "Sí, publicar" }));
    await vi.waitFor(() => expect(publish).toHaveBeenCalledWith("token-de-prueba", "p2"));
  });

  it("CA-NF02.2 si el servidor responde 403 no se ofrecen acciones de gestor", async () => {
    vi.spyOn(api, "listManage").mockRejectedValue(new ApiError(403, "FORBIDDEN", "x"));
    renderAt("/manage", "/manage", <Manage />, fakeAuth({ groups: ["DONANTE"] }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No encontramos el recurso o no tienes acceso a él.",
    );
    expect(screen.queryByRole("button", { name: "Nuevo proyecto" })).toBeNull();
  });
});

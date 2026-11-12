// @trace HU-01, CA-01.1
import { describe, expect, it } from "vitest";
import { categoryOf } from "../src/lib/category";

const p = (title: string, description = "") => ({ title, description });

describe("categoryOf (solo presentación)", () => {
  it.each([
    ["Útiles escolares para Characato", "educacion"],
    ["utiles escolares sin tilde", "educacion"],
    ["Biblioteca comunitaria", "educacion"],
    ["Comedor popular Cerro Colorado", "alimentacion"],
    ["Ollas comunes", "alimentacion"],
    ["Raciones de almuerzo", "alimentacion"],
    ["Campaña de salud en Yura", "salud"],
    ["Vacunación de adultos mayores", "salud"],
    ["Arborización del parque", "otro"],
  ])("'%s' → %s", (title, cat) => {
    expect(categoryOf(p(title))).toBe(cat);
  });

  it("también usa la descripción", () => {
    expect(categoryOf(p("Proyecto Esperanza", "Despistaje de anemia infantil"))).toBe("salud");
  });

  it("si hay varias coincidencias gana la primera regla (educación)", () => {
    expect(categoryOf(p("Desayuno escolar", "Alimentación en la escuela"))).toBe("educacion");
  });
});

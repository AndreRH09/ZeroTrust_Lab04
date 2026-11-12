// @trace HU-09, RNF-HU-11, CA-09.1, CA-NF11.2
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "../src/components/ProgressBar";

const barra = (confirmed: number, goal: number) =>
  render(<ProgressBar confirmedCents={confirmed} goalCents={goal} label="Progreso" />);

describe("ProgressBar (CA-09.1)", () => {
  it.each([
    [0, 100000, "0", "0%"],
    [2500, 100000, "2", "2%"],
    [65000, 100000, "65", "65%"],
    [100000, 100000, "100", "100%"],
  ])("confirmado %i de %i → aria-valuenow %s y texto %s", (c, g, now, txt) => {
    barra(c, g);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", now);
    expect(screen.getByText(txt)).toBeInTheDocument();
  });

  it("supera la meta: el texto muestra el porcentaje real y la barra se limita al 100%", () => {
    const { container } = barra(150000, 100000);
    expect(screen.getByText("150%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(container.querySelectorAll("rect")[1]).toHaveAttribute("width", "100%");
  });

  it("dibuja el relleno con el atributo SVG width y sin estilos en línea (CSP style-src 'self')", () => {
    const { container } = barra(65000, 100000);
    expect(container.querySelectorAll("rect")[1]).toHaveAttribute("width", "65%");
    expect(container.innerHTML).not.toContain("style=");
  });

  it("sin avance no dibuja relleno", () => {
    const { container } = barra(0, 100000);
    expect(container.querySelectorAll("rect")).toHaveLength(1);
  });

  it("meta 0 no divide por cero", () => {
    barra(500, 0);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("aria-valuetext describe el avance en soles", () => {
    barra(2500, 100000);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      "2% de la meta: S/ 25.00 de S/ 1,000.00",
    );
  });
});

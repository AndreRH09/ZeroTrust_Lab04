// @trace HU-09, CA-09.1, CA-05.2
import { describe, expect, it } from "vitest";
import { formatPEN, parsePENToCents } from "../src/lib/money";

describe("formatPEN", () => {
  it("formatea céntimos enteros en PEN", () => {
    expect(formatPEN(2500)).toBe("S/ 25.00");
    expect(formatPEN(100000)).toBe("S/ 1,000.00");
    expect(formatPEN(5)).toBe("S/ 0.05");
    expect(formatPEN(0)).toBe("S/ 0.00");
  });
  it("rechaza importes no enteros", () => {
    expect(() => formatPEN(1.5)).toThrow();
  });
});

describe("parsePENToCents (sin float)", () => {
  it.each([
    ["25", 2500],
    ["25.5", 2550],
    ["25,50", 2550],
    ["0.10", 10],
    [" 1000.00 ", 100000],
  ])("%s → %s", (input, cents) => {
    expect(parsePENToCents(input)).toBe(cents);
  });
  it.each(["10.555", "-5", "abc", "", "1e3", "12.3.4"])("%s → null", (input) => {
    expect(parsePENToCents(input)).toBeNull();
  });
  it("evita errores de coma flotante (0.29 → 29)", () => {
    expect(parsePENToCents("0.29")).toBe(29);
    expect(parsePENToCents("1.15")).toBe(115);
  });
});

// Dinero en céntimos enteros (principio II, CA-09.1). Sin float: la conversión es por cadena.

/** 2500 → "S/ 25.00"; 100000 → "S/ 1,000.00". */
export function formatPEN(cents: number): string {
  if (!Number.isInteger(cents)) throw new Error("El importe debe estar en céntimos enteros");
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const soles = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cts = (abs % 100).toString().padStart(2, "0");
  return `${sign}S/ ${soles}.${cts}`;
}

/** "25" → 2500, "25.5" → 2550, "10.555" → null. Acepta coma o punto decimal. */
export function parsePENToCents(input: string): number | null {
  const s = input.trim().replace(",", ".");
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const soles = Number(m[1]);
  const cts = Number((m[2] ?? "").padEnd(2, "0"));
  return soles * 100 + cts;
}

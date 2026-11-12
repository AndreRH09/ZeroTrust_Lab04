// Logger JSON estructurado (CA-NF07.1) con redacción de secretos (CA-NF01.2).
// Escribe una línea JSON por evento en stdout para que CloudWatch Logs Insights la parsee.

const SENSITIVE_KEY =
  /authorization|token|cookie|^sub$|donorsub|idempotencykey|idempotency-key|password|secret|email/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY.test(k) ? "[REDACTED]" : redact(v, depth + 1);
  }
  return out;
}

export interface LogEntry {
  level?: "INFO" | "WARN" | "ERROR";
  requestId: string;
  action: string;
  outcome: string;
  statusCode?: number;
  durationMs?: number;
  [key: string]: unknown;
}

export function log(entry: LogEntry): void {
  const line = JSON.stringify(
    redact({ level: "INFO", timestamp: new Date().toISOString(), ...entry }),
  );
  if (process.env.LOG_SILENT === "1") return;
  process.stdout.write(line + "\n");
}

/** Igual que `log` pero devuelve la línea; usado en pruebas. */
export function formatLog(entry: LogEntry): string {
  return JSON.stringify(redact({ level: "INFO", ...entry }));
}

// Respuestas HTTP y manejo uniforme de errores { code, message, requestId } (design.md §4).
// Nunca se devuelve stack ni detalle interno (CA-NF01.2).
import { randomUUID } from "node:crypto";
import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { ZodError } from "zod";
import type { ErrorCode } from "@aqp/shared";
import { log } from "./logger.js";

export type ApiEvent = APIGatewayProxyEventV2WithJWTAuthorizer;
export type ApiResult = APIGatewayProxyStructuredResultV2;

export interface RequestCtx {
  requestId: string;
  routeKey: string;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (m = "Solicitud inválida") => new HttpError(400, "VALIDATION_ERROR", m);
export const unauthorized = () => new HttpError(401, "UNAUTHORIZED", "No autenticado");
export const forbidden = () => new HttpError(403, "FORBIDDEN", "Operación no permitida");
export const notFound = () => new HttpError(404, "NOT_FOUND", "Recurso no encontrado");
export const conflict = (m = "Conflicto con el estado actual del recurso") =>
  new HttpError(409, "CONFLICT", m);

const BASE_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

export function json(statusCode: number, body: unknown): ApiResult {
  return { statusCode, headers: BASE_HEADERS, body: JSON.stringify(body) };
}

export function errorResult(err: unknown, requestId: string): ApiResult {
  if (err instanceof HttpError) {
    return json(err.status, { code: err.code, message: err.message, requestId });
  }
  if (err instanceof ZodError) {
    // Solo rutas y mensajes de validación, nunca los valores enviados.
    const message = err.issues
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .slice(0, 5)
      .join("; ");
    return json(400, { code: "VALIDATION_ERROR", message, requestId });
  }
  if (isTransactionCanceled(err) || isConditionalCheckFailed(err)) {
    return json(409, {
      code: "CONFLICT",
      message: "Conflicto con el estado actual del recurso",
      requestId,
    });
  }
  return json(500, { code: "INTERNAL_ERROR", message: "Error interno", requestId });
}

export function isTransactionCanceled(err: unknown): err is Error & {
  CancellationReasons?: { Code?: string }[];
} {
  return err instanceof Error && err.name === "TransactionCanceledException";
}

export function isConditionalCheckFailed(err: unknown): boolean {
  return err instanceof Error && err.name === "ConditionalCheckFailedException";
}

/** Lee y parsea el body JSON; cuerpo ausente o JSON inválido → 400. */
export function parseJsonBody(event: ApiEvent): unknown {
  if (!event.body) throw badRequest("Cuerpo JSON requerido");
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    throw badRequest("JSON inválido");
  }
}

export function header(event: ApiEvent, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(event.headers ?? {})) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

type RouteFn = (event: ApiEvent, ctx: RequestCtx) => Promise<ApiResult>;

/**
 * Envuelve un router de rutas: correlaciona por requestId, mide duración, registra un log JSON
 * por solicitud (CA-NF07.1) y traduce errores a respuestas uniformes.
 */
export function createHandler(routes: Record<string, RouteFn>) {
  return async (event: ApiEvent): Promise<ApiResult> => {
    const started = Date.now();
    const requestId = event.requestContext?.requestId ?? randomUUID();
    const routeKey = event.routeKey ?? "UNKNOWN";
    const ctx: RequestCtx = { requestId, routeKey };
    let result: ApiResult;
    let errorName: string | undefined;
    try {
      const route = routes[routeKey];
      if (!route) throw notFound();
      result = await route(event, ctx);
    } catch (err) {
      result = errorResult(err, requestId);
      if (!(err instanceof HttpError) && !(err instanceof ZodError)) {
        errorName = err instanceof Error ? err.name : "UnknownError";
      }
    }
    const statusCode = result.statusCode ?? 200;
    log({
      level: statusCode >= 500 ? "ERROR" : statusCode >= 400 ? "WARN" : "INFO",
      requestId,
      action: routeKey,
      outcome:
        statusCode < 400
          ? "SUCCESS"
          : statusCode === 401 || statusCode === 403
            ? "DENIED"
            : statusCode === 409
              ? "CONFLICT"
              : statusCode < 500
                ? "REJECTED"
                : "ERROR",
      statusCode,
      durationMs: Date.now() - started,
      ...(errorName ? { errorName } : {}),
    });
    return result;
  };
}

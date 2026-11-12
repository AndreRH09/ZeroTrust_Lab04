// Cliente del API: Bearer access token, Idempotency-Key y mapeo de errores (CA-03.2, FR-029).
// Nunca envía sub, grupos ni roles: el backend los toma del token verificado (CA-04.3).
import type {
  AuditEvent,
  AuditEventType,
  CreateProjectBody,
  Donation,
  ProjectManaged,
  ProjectPublic,
  ProjectStats,
  UpdateProjectBody,
} from "@aqp/shared";
import { config } from "../config";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Mensaje para el usuario, sin detalles técnicos (CA-01.3, CA-NF06.2). */
export function userMessage(err: unknown): string {
  if (!(err instanceof ApiError) || err.status === 0)
    return "No pudimos conectar con el servicio. Inténtalo de nuevo.";
  switch (err.status) {
    case 400:
      return err.message || "Revisa los datos enviados.";
    case 401:
      return "Tu sesión expiró o no es válida. Inicia sesión nuevamente.";
    case 403:
    case 404:
      return "No encontramos el recurso o no tienes acceso a él.";
    case 409:
      return err.message || "La operación entra en conflicto con el estado actual.";
    case 429:
      return "Demasiadas solicitudes. Reintenta en unos segundos.";
    default:
      return "Ocurrió un error inesperado. Inténtalo más tarde.";
  }
}

interface RequestOpts {
  method?: "GET" | "POST" | "PATCH";
  token?: string | null;
  body?: unknown;
  idempotencyKey?: string;
}

export async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`${config.apiUrl}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      credentials: "omit",
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Error de red");
  }
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) {
    const e = (data ?? {}) as { code?: string; message?: string; requestId?: string };
    throw new ApiError(
      res.status,
      e.code ?? "HTTP_ERROR",
      e.message ?? res.statusText,
      e.requestId,
    );
  }
  return data as T;
}

type Token = string | null;

export const api = {
  listProjects: () => request<{ items: ProjectPublic[] }>("/v1/projects"),
  getProject: (id: string) => request<ProjectPublic>(`/v1/projects/${encodeURIComponent(id)}`),
  getStats: (id: string) => request<ProjectStats>(`/v1/projects/${encodeURIComponent(id)}/stats`),

  listManage: (token: Token) =>
    request<{ items: ProjectManaged[] }>("/v1/manage/projects", { token }),
  createProject: (token: Token, body: CreateProjectBody) =>
    request<ProjectManaged>("/v1/projects", { method: "POST", token, body }),
  updateProject: (token: Token, id: string, body: UpdateProjectBody) =>
    request<ProjectManaged>(`/v1/projects/${encodeURIComponent(id)}`, {
      method: "PATCH",
      token,
      body,
    }),
  publishProject: (token: Token, id: string) =>
    request<ProjectManaged>(`/v1/projects/${encodeURIComponent(id)}/publish`, {
      method: "PATCH",
      token,
    }),

  createDonation: (
    token: Token,
    body: { projectId: string; amountCents: number },
    idempotencyKey: string,
  ) => request<Donation>("/v1/donations", { method: "POST", token, body, idempotencyKey }),
  simulate: (token: Token, id: string, outcome: "CONFIRM" | "REJECT") =>
    request<Donation>(`/v1/donations/${encodeURIComponent(id)}/simulate`, {
      method: "POST",
      token,
      body: { outcome },
    }),
  myDonations: (token: Token) => request<{ items: Donation[] }>("/v1/donations/me", { token }),
  getDonation: (token: Token, id: string) =>
    request<Donation>(`/v1/donations/${encodeURIComponent(id)}`, { token }),

  listAudit: (token: Token, q: { eventType: AuditEventType; from?: string; to?: string }) => {
    const params = new URLSearchParams({ eventType: q.eventType });
    if (q.from) params.set("from", q.from);
    if (q.to) params.set("to", q.to);
    return request<{ items: AuditEvent[] }>(`/v1/audit?${params.toString()}`, { token });
  },
};

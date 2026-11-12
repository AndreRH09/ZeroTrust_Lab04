// Backend falso en memoria que implementa el contrato del API (docs/api.yaml) con las mismas
// reglas que las Lambdas: rol desde el token, propietario → 404, idempotencia, estados terminales.
// Sirve para probar la SPA de punta a punta sin AWS; el backend real se prueba con Vitest y en AWS.
import { createHash, randomUUID } from "node:crypto";
import type { Page, Route } from "@playwright/test";
import type { AuditEvent, AuditEventType, Donation, ProjectManaged } from "@aqp/shared";
import { API_URL } from "./entorno";

export type Rol = "DONANTE" | "GESTOR" | "AUDITOR";
export interface UsuarioPrueba {
  sub: string;
  email: string;
  grupos: Rol[];
}

export const USUARIOS = {
  donante: { sub: "sub-donante-1", email: "donante1@example.com", grupos: ["DONANTE"] },
  donante2: { sub: "sub-donante-2", email: "donante2@example.com", grupos: ["DONANTE"] },
  gestor: { sub: "sub-gestor-1", email: "gestor1@example.com", grupos: ["GESTOR"] },
  auditor: { sub: "sub-auditor-1", email: "auditor1@example.com", grupos: ["AUDITOR"] },
} satisfies Record<string, UsuarioPrueba>;

export const PROYECTOS = {
  utiles: "7f1c2b8e-4a3d-4c1e-9b2a-000000000001",
  comedor: "7f1c2b8e-4a3d-4c1e-9b2a-000000000002",
  salud: "7f1c2b8e-4a3d-4c1e-9b2a-000000000003",
  biblioteca: "7f1c2b8e-4a3d-4c1e-9b2a-000000000004",
  borrador: "7f1c2b8e-4a3d-4c1e-9b2a-000000000005",
};

export const DONACIONES = {
  confirmada: "d0000000-0000-4000-8000-000000000001",
  rechazada: "d0000000-0000-4000-8000-000000000002",
  pendiente: "d0000000-0000-4000-8000-000000000003",
  ajena: "d0000000-0000-4000-8000-000000000004",
};

type DonacionInterna = Donation & { donorSub: string };
interface Respuesta {
  status: number;
  body?: unknown;
}
export interface SolicitudRegistrada {
  method: string;
  path: string;
  query: string;
  headers: Record<string, string>;
  body: unknown;
  status: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, idempotency-key, accept",
  "access-control-allow-methods": "GET, POST, PATCH, OPTIONS",
};
const EVENTOS: AuditEventType[] = [
  "PROJECT_CREATED",
  "PROJECT_UPDATED",
  "PROJECT_PUBLISHED",
  "DONATION_CREATED",
  "DONATION_CONFIRMED",
  "DONATION_REJECTED",
  "AUTHZ_DENIED",
];

const err = (status: number, code: string, message: string): Respuesta => ({
  status,
  body: { code, message, requestId: randomUUID() },
});
const unauthorized = () => err(401, "UNAUTHORIZED", "No autenticado");
const forbidden = () => err(403, "FORBIDDEN", "Operación no permitida");
const notFound = () => err(404, "NOT_FOUND", "Recurso no encontrado");
const badRequest = (m = "Solicitud inválida") => err(400, "VALIDATION_ERROR", m);
const conflict = (m: string) => err(409, "CONFLICT", m);

const fecha = (dia: number, hora = 15) =>
  new Date(Date.UTC(2026, 10, dia, hora, 0, 0)).toISOString();
const seudonimo = (sub: string) => createHash("sha256").update(`e2e#${sub}`).digest("hex");

function proyecto(
  projectId: string,
  title: string,
  description: string,
  goal: number,
  confirmed: number,
  status: ProjectManaged["status"],
  dia: number,
): ProjectManaged {
  return {
    projectId,
    title,
    description,
    goalAmountCents: goal,
    confirmedAmountCents: confirmed,
    currency: "PEN",
    status,
    createdAt: fecha(dia),
    updatedAt: fecha(dia),
  };
}

export class BackendFalso {
  proyectos: ProjectManaged[] = [
    proyecto(
      PROYECTOS.utiles,
      "Útiles escolares para Characato",
      "Kits escolares para 120 niños de primaria en zonas rurales de Arequipa. Cada kit incluye cuadernos, lápices, colores y una mochila resistente para todo el año escolar.",
      1_500_000,
      975_000,
      "PUBLICADO",
      1,
    ),
    proyecto(
      PROYECTOS.comedor,
      "Comedor popular Cerro Colorado",
      "Raciones diarias de almuerzo para 80 familias durante tres meses.",
      2_400_000,
      480_000,
      "PUBLICADO",
      2,
    ),
    proyecto(
      PROYECTOS.salud,
      "Campaña de salud en Yura",
      "Jornada de despistaje de anemia y vacunación para adultos mayores.",
      800_000,
      800_000,
      "PUBLICADO",
      3,
    ),
    proyecto(
      PROYECTOS.biblioteca,
      "Biblioteca comunitaria en Socabaya",
      "Implementar una biblioteca con 500 libros y talleres de lectura para niños y jóvenes.",
      1_200_000,
      150_000,
      "PUBLICADO",
      4,
    ),
    proyecto(
      PROYECTOS.borrador,
      "Ollas comunes en Alto Selva Alegre",
      "Equipamiento de cocina para cuatro ollas comunes del distrito.",
      600_000,
      0,
      "BORRADOR",
      5,
    ),
  ];

  donaciones: DonacionInterna[] = [
    this.donacion(DONACIONES.confirmada, PROYECTOS.utiles, 5_000, "CONFIRMADA_SIMULADA", 6),
    this.donacion(DONACIONES.rechazada, PROYECTOS.salud, 2_000, "RECHAZADA_SIMULADA", 7),
    this.donacion(DONACIONES.pendiente, PROYECTOS.comedor, 10_000, "PENDIENTE_SIMULACION", 8),
    {
      ...this.donacion(DONACIONES.ajena, PROYECTOS.utiles, 3_000, "PENDIENTE_SIMULACION", 8),
      donorSub: USUARIOS.donante2.sub,
    },
  ];

  auditoria: AuditEvent[] = [
    ["AUTHZ_DENIED", "POST /v1/projects", `project/${PROYECTOS.utiles}`, "DENIED", 9, 10],
    [
      "AUTHZ_DENIED",
      "GET /v1/donations/{donationId}",
      `donation/${DONACIONES.ajena}`,
      "DENIED",
      9,
      12,
    ],
    ["AUTHZ_DENIED", "GET /v1/audit", "audit/*", "DENIED", 10, 9],
    [
      "DONATION_CREATED",
      "POST /v1/donations",
      `donation/${DONACIONES.pendiente}`,
      "SUCCESS",
      8,
      15,
    ],
    [
      "PROJECT_PUBLISHED",
      "PATCH /v1/projects/{projectId}/publish",
      `project/${PROYECTOS.biblioteca}`,
      "SUCCESS",
      4,
      16,
    ],
  ].map(([eventType, action, resourceRef, outcome, dia, hora], i) => ({
    eventId: `e0000000-0000-4000-8000-00000000000${i + 1}`,
    eventType: eventType as AuditEventType,
    timestamp: fecha(dia as number, hora as number),
    requestId: `req-e2e-${i + 1}`,
    actorRef: seudonimo(`actor-${i}`),
    action: action as string,
    resourceRef: resourceRef as string,
    outcome: outcome as AuditEvent["outcome"],
  }));

  /** access token → usuario (los emite CognitoFalso). */
  readonly tokens = new Map<string, UsuarioPrueba>();
  readonly solicitudes: SolicitudRegistrada[] = [];
  private readonly idempotencia = new Map<string, { hash: string; res: Respuesta }>();
  private readonly fallos: { metodo: string; ruta: RegExp; tipo: "red" | number; veces: number }[] =
    [];

  private donacion(
    donationId: string,
    projectId: string,
    amountCents: number,
    status: Donation["status"],
    dia: number,
  ): DonacionInterna {
    return {
      donationId,
      projectId,
      amountCents,
      currency: "PEN",
      status,
      createdAt: fecha(dia),
      updatedAt: fecha(dia),
      donorSub: USUARIOS.donante.sub,
    };
  }

  /** Hace fallar las próximas `veces` solicitudes que coincidan (error de red o código HTTP). */
  fallar(metodo: string, ruta: RegExp, tipo: "red" | number, veces = 1) {
    this.fallos.push({ metodo, ruta, tipo, veces });
  }

  llamadas(metodo: string, ruta: RegExp) {
    return this.solicitudes.filter((s) => s.method === metodo && ruta.test(s.path));
  }

  async instalar(page: Page) {
    await page.route(`${API_URL}/**`, (route) => this.atender(route));
  }

  private async atender(route: Route) {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    const fallo = this.fallos.find(
      (f) => f.veces > 0 && f.metodo === req.method() && f.ruta.test(url.pathname),
    );
    let body: unknown;
    try {
      body = req.postDataJSON();
    } catch {
      body = req.postData();
    }
    const registrar = (status: number) =>
      this.solicitudes.push({
        method: req.method(),
        path: url.pathname,
        query: url.search,
        headers: req.headers(),
        body,
        status,
      });

    if (fallo) {
      fallo.veces -= 1;
      if (fallo.tipo === "red") {
        registrar(0);
        return route.abort("failed");
      }
      registrar(fallo.tipo);
      // Mensaje interno deliberado: la UI no debe mostrarlo (CA-01.3, CA-NF06.2).
      return route.fulfill({
        status: fallo.tipo,
        headers: { ...CORS, "content-type": "application/json" },
        body: JSON.stringify({
          code: "INTERNAL_ERROR",
          message: "arn:aws:dynamodb:us-east-2:123456789012:table/Projects ValidationException",
        }),
      });
    }

    const res = this.procesar(req.method(), url, req.headers(), body);
    registrar(res.status);
    return route.fulfill({
      status: res.status,
      headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" },
      body: res.body === undefined ? "" : JSON.stringify(res.body),
    });
  }

  private usuario(headers: Record<string, string>): UsuarioPrueba | undefined {
    const m = /^Bearer (.+)$/.exec(headers.authorization ?? "");
    return m?.[1] ? this.tokens.get(m[1]) : undefined;
  }

  private auditar(
    type: AuditEventType,
    action: string,
    resourceRef: string,
    actor: string,
    ok: boolean,
  ) {
    this.auditoria.push({
      eventId: randomUUID(),
      eventType: type,
      timestamp: new Date().toISOString(),
      requestId: randomUUID(),
      actorRef: seudonimo(actor),
      action,
      resourceRef,
      outcome: ok ? "SUCCESS" : "DENIED",
    });
  }

  /** PEP/PDP simplificado: el rol se decide en "servidor" (CA-04.3). */
  private exigir(u: UsuarioPrueba | undefined, rol: Rol, action: string, recurso: string) {
    if (!u) return unauthorized();
    if (!u.grupos.includes(rol)) {
      this.auditar("AUTHZ_DENIED", action, recurso, u.sub, false);
      return forbidden();
    }
    return null;
  }

  private publico(p: ProjectManaged) {
    const { projectId, title, description, goalAmountCents, confirmedAmountCents, currency } = p;
    return {
      projectId,
      title,
      description,
      goalAmountCents,
      confirmedAmountCents,
      currency,
      status: "PUBLICADO",
    };
  }

  private validarProyecto(body: unknown, parcial: boolean): Respuesta | Record<string, unknown> {
    if (!body || typeof body !== "object") return badRequest();
    const b = body as Record<string, unknown>;
    const permitidos = ["title", "description", "goalAmountCents"];
    if (Object.keys(b).some((k) => !permitidos.includes(k))) return badRequest();
    if (parcial && Object.keys(b).length === 0) return badRequest();
    const t = typeof b.title === "string" ? b.title.trim() : undefined;
    const d = typeof b.description === "string" ? b.description.trim() : undefined;
    const g = b.goalAmountCents;
    if ((!parcial || "title" in b) && (!t || t.length < 3 || t.length > 120)) return badRequest();
    if ((!parcial || "description" in b) && (!d || d.length < 10 || d.length > 2000))
      return badRequest();
    if (
      (!parcial || "goalAmountCents" in b) &&
      (typeof g !== "number" || !Number.isInteger(g) || g < 100 || g > 100_000_000)
    )
      return badRequest();
    return {
      ...(t ? { title: t } : {}),
      ...(d ? { description: d } : {}),
      ...(g ? { goalAmountCents: g } : {}),
    };
  }

  private procesar(
    method: string,
    url: URL,
    headers: Record<string, string>,
    body: unknown,
  ): Respuesta {
    const path = url.pathname;
    const u = this.usuario(headers);
    const ruta = (re: RegExp) => re.exec(path);
    let m: RegExpExecArray | null;

    // ── Rutas públicas (HU-01, HU-02, HU-09) ───────────────────────────────────────────
    if (method === "GET" && path === "/v1/projects") {
      return {
        status: 200,
        body: {
          items: this.proyectos.filter((p) => p.status === "PUBLICADO").map((p) => this.publico(p)),
        },
      };
    }
    if (method === "GET" && (m = ruta(/^\/v1\/projects\/([^/]+)(\/stats)?$/))) {
      const p = this.proyectos.find((x) => x.projectId === m![1] && x.status === "PUBLICADO");
      if (!p) return notFound();
      if (!m[2]) return { status: 200, body: this.publico(p) };
      return {
        status: 200,
        body: {
          projectId: p.projectId,
          goalAmountCents: p.goalAmountCents,
          confirmedAmountCents: p.confirmedAmountCents,
          currency: "PEN",
          progressPercent: Math.floor((p.confirmedAmountCents * 100) / p.goalAmountCents),
        },
      };
    }

    // ── Gestión (HU-08) ─────────────────────────────────────────────────────────────────
    if (method === "GET" && path === "/v1/manage/projects") {
      return (
        this.exigir(u, "GESTOR", "GET /v1/manage/projects", "project/*") ?? {
          status: 200,
          body: { items: this.proyectos },
        }
      );
    }
    if (method === "POST" && path === "/v1/projects") {
      const denegado = this.exigir(u, "GESTOR", "POST /v1/projects", "project/*");
      if (denegado) return denegado;
      const v = this.validarProyecto(body, false);
      if ("status" in v) return v as Respuesta;
      const ahora = new Date().toISOString();
      const p: ProjectManaged = {
        projectId: randomUUID(),
        title: v.title as string,
        description: v.description as string,
        goalAmountCents: v.goalAmountCents as number,
        confirmedAmountCents: 0,
        currency: "PEN",
        status: "BORRADOR",
        createdAt: ahora,
        updatedAt: ahora,
      };
      this.proyectos.push(p);
      this.auditar("PROJECT_CREATED", "POST /v1/projects", `project/${p.projectId}`, u!.sub, true);
      return { status: 201, body: p };
    }
    if (method === "PATCH" && (m = ruta(/^\/v1\/projects\/([^/]+)(\/publish)?$/))) {
      const denegado = this.exigir(u, "GESTOR", `PATCH ${path}`, `project/${m[1]}`);
      if (denegado) return denegado;
      const p = this.proyectos.find((x) => x.projectId === m![1]);
      if (!p) return notFound();
      if (p.status !== "BORRADOR")
        return conflict("Solo se pueden modificar proyectos en BORRADOR");
      if (m[2]) {
        p.status = "PUBLICADO";
        this.auditar(
          "PROJECT_PUBLISHED",
          "PATCH /v1/projects/{projectId}/publish",
          `project/${p.projectId}`,
          u!.sub,
          true,
        );
      } else {
        const v = this.validarProyecto(body, true);
        if ("status" in v) return v as Respuesta;
        Object.assign(p, v);
        this.auditar(
          "PROJECT_UPDATED",
          "PATCH /v1/projects/{projectId}",
          `project/${p.projectId}`,
          u!.sub,
          true,
        );
      }
      p.updatedAt = new Date().toISOString();
      return { status: 200, body: p };
    }

    // ── Donaciones (HU-05, HU-06, HU-07) ────────────────────────────────────────────────
    if (method === "POST" && path === "/v1/donations") {
      const denegado = this.exigir(u, "DONANTE", "POST /v1/donations", "donation/*");
      if (denegado) return denegado;
      const key = headers["idempotency-key"] ?? "";
      if (!UUID.test(key)) return badRequest("Falta Idempotency-Key (UUID)");
      const b = (body ?? {}) as Record<string, unknown>;
      const keys = Object.keys(b).sort().join(",");
      if (keys !== "amountCents,projectId") return badRequest();
      const amount = b.amountCents;
      if (
        typeof amount !== "number" ||
        !Number.isInteger(amount) ||
        amount < 100 ||
        amount > 100_000
      )
        return badRequest("El monto debe estar entre S/ 1.00 y S/ 1,000.00");
      const hash = createHash("sha256")
        .update(JSON.stringify({ projectId: b.projectId, amountCents: amount }))
        .digest("hex");
      const pk = `${u!.sub}#createDonation#${key}`;
      const previa = this.idempotencia.get(pk);
      if (previa)
        return previa.hash === hash
          ? previa.res
          : conflict("La Idempotency-Key ya se usó con otra carga");
      const p = this.proyectos.find((x) => x.projectId === b.projectId);
      if (!p) return notFound();
      if (p.status !== "PUBLICADO") return conflict("El proyecto no acepta donaciones");
      const ahora = new Date().toISOString();
      const d: DonacionInterna = {
        donationId: randomUUID(),
        projectId: p.projectId,
        amountCents: amount,
        currency: "PEN",
        status: "PENDIENTE_SIMULACION",
        createdAt: ahora,
        updatedAt: ahora,
        donorSub: u!.sub,
      };
      this.donaciones.push(d);
      this.auditar(
        "DONATION_CREATED",
        "POST /v1/donations",
        `donation/${d.donationId}`,
        u!.sub,
        true,
      );
      const res = { status: 201, body: this.sinDonante(d) };
      this.idempotencia.set(pk, { hash, res });
      return res;
    }
    if (method === "GET" && path === "/v1/donations/me") {
      return (
        this.exigir(u, "DONANTE", "GET /v1/donations/me", "donation/*") ?? {
          status: 200,
          body: {
            items: this.donaciones
              .filter((d) => d.donorSub === u!.sub)
              .map((d) => this.sinDonante(d)),
          },
        }
      );
    }
    if (
      (m = ruta(/^\/v1\/donations\/([^/]+)(\/simulate)?$/)) &&
      (method === "GET" || (method === "POST" && m[2]))
    ) {
      const denegado = this.exigir(u, "DONANTE", `${method} ${path}`, `donation/${m[1]}`);
      if (denegado) return denegado;
      const d = this.donaciones.find((x) => x.donationId === m![1]);
      // Ajena o inexistente: el mismo 404 (no revela existencia, T09).
      if (!d || d.donorSub !== u!.sub) {
        if (d)
          this.auditar(
            "AUTHZ_DENIED",
            `${method} ${path}`,
            `donation/${d.donationId}`,
            u!.sub,
            false,
          );
        return notFound();
      }
      if (!m[2]) return { status: 200, body: this.sinDonante(d) };
      const outcome = (body as { outcome?: string } | undefined)?.outcome;
      if (outcome !== "CONFIRM" && outcome !== "REJECT") return badRequest();
      if (d.status !== "PENDIENTE_SIMULACION")
        return conflict("La donación ya está en un estado terminal");
      d.status = outcome === "CONFIRM" ? "CONFIRMADA_SIMULADA" : "RECHAZADA_SIMULADA";
      d.updatedAt = new Date().toISOString();
      if (outcome === "CONFIRM") {
        const p = this.proyectos.find((x) => x.projectId === d.projectId);
        if (p) p.confirmedAmountCents += d.amountCents;
      }
      this.auditar(
        outcome === "CONFIRM" ? "DONATION_CONFIRMED" : "DONATION_REJECTED",
        "POST /v1/donations/{donationId}/simulate",
        `donation/${d.donationId}`,
        u!.sub,
        true,
      );
      return { status: 200, body: this.sinDonante(d) };
    }

    // ── Auditoría (HU-10) ───────────────────────────────────────────────────────────────
    if (method === "GET" && path === "/v1/audit") {
      const denegado = this.exigir(u, "AUDITOR", "GET /v1/audit", "audit/*");
      if (denegado) return denegado;
      const tipo = url.searchParams.get("eventType") as AuditEventType | null;
      if (!tipo || !EVENTOS.includes(tipo)) return badRequest();
      const desde = url.searchParams.get("from");
      const hasta = url.searchParams.get("to");
      const items = this.auditoria
        .filter((e) => e.eventType === tipo)
        .filter((e) => (!desde || e.timestamp >= desde) && (!hasta || e.timestamp <= hasta))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return { status: 200, body: { items } };
    }

    return notFound();
  }

  private sinDonante(d: DonacionInterna): Donation {
    const { donorSub: _omit, ...publica } = d;
    return publica;
  }
}

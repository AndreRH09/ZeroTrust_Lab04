import type { AuditEventType, AuditOutcome, DonationStatus, ProjectStatus } from "@aqp/shared";
import type { BadgeTone } from "../components/States";

export const STATUS_LABEL: Record<DonationStatus, string> = {
  PENDIENTE_SIMULACION: "Pendiente de simulación",
  CONFIRMADA_SIMULADA: "Confirmada (simulada)",
  RECHAZADA_SIMULADA: "Rechazada (simulada)",
};

export const STATUS_TONE: Record<DonationStatus, BadgeTone> = {
  PENDIENTE_SIMULACION: "warning",
  CONFIRMADA_SIMULADA: "success",
  RECHAZADA_SIMULADA: "danger",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  BORRADOR: "Borrador",
  PUBLICADO: "Publicado",
};

export const PROJECT_STATUS_TONE: Record<ProjectStatus, BadgeTone> = {
  BORRADOR: "neutral",
  PUBLICADO: "success",
};

export const AUDIT_EVENT_LABEL: Record<AuditEventType, string> = {
  PROJECT_CREATED: "Proyecto creado",
  PROJECT_UPDATED: "Proyecto actualizado",
  PROJECT_PUBLISHED: "Proyecto publicado",
  DONATION_CREATED: "Donación registrada",
  DONATION_CONFIRMED: "Donación confirmada",
  DONATION_REJECTED: "Donación rechazada",
  AUTHZ_DENIED: "Acceso denegado",
};

export const AUDIT_OUTCOME: Record<AuditOutcome, { label: string; tone: BadgeTone }> = {
  SUCCESS: { label: "Éxito", tone: "success" },
  DENIED: { label: "Denegado", tone: "danger" },
  CONFLICT: { label: "Conflicto", tone: "warning" },
};

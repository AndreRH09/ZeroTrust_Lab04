import type { DonationStatus, ProjectStatus } from "@aqp/shared";

export const STATUS_LABEL: Record<DonationStatus, string> = {
  PENDIENTE_SIMULACION: "Pendiente de simulación",
  CONFIRMADA_SIMULADA: "Confirmada (simulada)",
  RECHAZADA_SIMULADA: "Rechazada (simulada)",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  BORRADOR: "Borrador",
  PUBLICADO: "Publicado",
};

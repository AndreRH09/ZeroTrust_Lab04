import type { ProjectManaged, ProjectPublic, ProjectStats, ProjectStatus } from "@aqp/shared";

export interface ProjectItem {
  projectId: string;
  title: string;
  description: string;
  goalAmountCents: number;
  confirmedAmountCents: number;
  currency: "PEN";
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  createdByRef?: string;
}

/** Vista pública: sin createdByRef ni datos de donantes (CA-02.1, CA-09.2). */
export function toPublic(p: ProjectItem): ProjectPublic {
  return {
    projectId: p.projectId,
    title: p.title,
    description: p.description,
    goalAmountCents: p.goalAmountCents,
    confirmedAmountCents: p.confirmedAmountCents ?? 0,
    currency: "PEN",
    status: "PUBLICADO",
  };
}

export function toManaged(p: ProjectItem): ProjectManaged {
  return {
    projectId: p.projectId,
    title: p.title,
    description: p.description,
    goalAmountCents: p.goalAmountCents,
    confirmedAmountCents: p.confirmedAmountCents ?? 0,
    currency: "PEN",
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** Progreso entero (puede superar 100). Aritmética entera, sin float en importes. */
export function toStats(p: ProjectItem): ProjectStats {
  const confirmed = p.confirmedAmountCents ?? 0;
  return {
    projectId: p.projectId,
    goalAmountCents: p.goalAmountCents,
    confirmedAmountCents: confirmed,
    currency: "PEN",
    progressPercent: Math.floor((confirmed * 100) / p.goalAmountCents),
  };
}

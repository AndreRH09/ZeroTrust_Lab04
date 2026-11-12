// Esquemas de proyecto (data-model.md · CA-08.1).
import { z } from "zod";

export const MIN_GOAL_CENTS = 100;
export const MAX_GOAL_CENTS = 100_000_000; // S/ 1,000,000

const Title = z.string().trim().min(3).max(120);
const Description = z.string().trim().min(10).max(2000);
const GoalAmountCents = z.number().int().min(MIN_GOAL_CENTS).max(MAX_GOAL_CENTS);

export const CreateProjectBody = z
  .object({
    title: Title,
    description: Description,
    goalAmountCents: GoalAmountCents,
  })
  .strict();
export type CreateProjectBody = z.infer<typeof CreateProjectBody>;

export const UpdateProjectBody = z
  .object({
    title: Title.optional(),
    description: Description.optional(),
    goalAmountCents: GoalAmountCents.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "Debe enviar al menos un campo" });
export type UpdateProjectBody = z.infer<typeof UpdateProjectBody>;

export const ProjectStatus = z.enum(["BORRADOR", "PUBLICADO"]);
export type ProjectStatus = z.infer<typeof ProjectStatus>;

export interface ProjectPublic {
  projectId: string;
  title: string;
  description: string;
  goalAmountCents: number;
  confirmedAmountCents: number;
  currency: "PEN";
  status: "PUBLICADO";
}

export interface ProjectManaged extends Omit<ProjectPublic, "status"> {
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectStats {
  projectId: string;
  goalAmountCents: number;
  confirmedAmountCents: number;
  currency: "PEN";
  progressPercent: number;
}

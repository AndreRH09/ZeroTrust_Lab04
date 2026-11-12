// HU-08 Gestionar proyectos (CA-08.1, CA-08.2). La UI no es el control de acceso: el backend
// responde 403 a quien no sea GESTOR aunque llame directamente al API.
import { zodResolver } from "@hookform/resolvers/zod";
import { MAX_GOAL_CENTS, MIN_GOAL_CENTS, type ProjectManaged } from "@aqp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "../auth/useAuth";
import {
  btnPrimary,
  btnSecondary,
  Empty,
  ErrorMessage,
  input,
  Loading,
} from "../components/States";
import { formatPEN, parsePENToCents } from "../lib/money";
import { api } from "../services/api";
import { PROJECT_STATUS_LABEL } from "./statusLabels";

const ProjectForm = z.object({
  title: z.string().trim().min(3, "Mínimo 3 caracteres").max(120, "Máximo 120 caracteres"),
  description: z
    .string()
    .trim()
    .min(10, "Mínimo 10 caracteres")
    .max(2000, "Máximo 2000 caracteres"),
  goal: z.string().superRefine((v, ctx) => {
    const c = parsePENToCents(v);
    if (c === null || c < MIN_GOAL_CENTS || c > MAX_GOAL_CENTS) {
      ctx.addIssue({
        code: "custom",
        message: `Objetivo entre ${formatPEN(MIN_GOAL_CENTS)} y ${formatPEN(MAX_GOAL_CENTS)}.`,
      });
    }
  }),
});
type ProjectForm = z.infer<typeof ProjectForm>;

function ProjectEditor({ initial, onDone }: { initial?: ProjectManaged; onDone: () => void }) {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectForm>({
    resolver: zodResolver(ProjectForm),
    defaultValues: initial
      ? {
          title: initial.title,
          description: initial.description,
          goal: (initial.goalAmountCents / 100).toFixed(2),
        }
      : { title: "", description: "", goal: "" },
  });
  const save = useMutation({
    mutationFn: (v: ProjectForm) => {
      const body = {
        title: v.title,
        description: v.description,
        goalAmountCents: parsePENToCents(v.goal)!,
      };
      return initial
        ? api.updateProject(accessToken(), initial.projectId, body)
        : api.createProject(accessToken(), body);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["manage"] });
      onDone();
    },
  });
  const prefix = initial ? `edit-${initial.projectId}` : "new";

  return (
    <form
      noValidate
      onSubmit={handleSubmit((v) => save.mutate(v))}
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <h2 className="font-semibold">{initial ? "Editar borrador" : "Nuevo proyecto (borrador)"}</h2>
      {(["title", "description", "goal"] as const).map((field) => {
        const label = {
          title: "Título",
          description: "Descripción",
          goal: "Objetivo en soles (PEN)",
        }[field];
        const id = `${prefix}-${field}`;
        const err = errors[field];
        return (
          <div key={field}>
            <label htmlFor={id} className="block text-sm font-medium">
              {label}
            </label>
            {field === "description" ? (
              <textarea
                id={id}
                rows={4}
                className={input}
                aria-invalid={err ? "true" : "false"}
                aria-describedby={err ? `${id}-err` : undefined}
                {...register(field)}
              />
            ) : (
              <input
                id={id}
                className={input}
                inputMode={field === "goal" ? "decimal" : undefined}
                aria-invalid={err ? "true" : "false"}
                aria-describedby={err ? `${id}-err` : undefined}
                {...register(field)}
              />
            )}
            {err && (
              <p id={`${id}-err`} role="alert" className="mt-1 text-sm text-red-700">
                {err.message}
              </p>
            )}
          </div>
        );
      })}
      {save.error && <ErrorMessage error={save.error} />}
      <div className="flex gap-3">
        <button type="submit" className={btnPrimary} disabled={save.isPending}>
          {save.isPending ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" className={btnSecondary} onClick={onDone}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function Manage() {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ProjectManaged | "new" | null>(null);
  const list = useQuery({ queryKey: ["manage"], queryFn: () => api.listManage(accessToken()) });
  const publish = useMutation({
    mutationFn: (id: string) => api.publishProject(accessToken(), id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["manage"] });
      await qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return (
    <section aria-labelledby="titulo-gestion" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="titulo-gestion" className="text-2xl font-bold">
          Gestión de proyectos
        </h1>
        {editing === null && (
          <button type="button" className={btnPrimary} onClick={() => setEditing("new")}>
            Nuevo proyecto
          </button>
        )}
      </div>

      {editing !== null && (
        <ProjectEditor
          initial={editing === "new" ? undefined : editing}
          onDone={() => setEditing(null)}
        />
      )}
      {publish.error && <ErrorMessage error={publish.error} />}

      {list.isPending ? (
        <Loading />
      ) : list.error ? (
        <ErrorMessage error={list.error} />
      ) : list.data.items.length === 0 ? (
        <Empty title="No hay proyectos registrados" />
      ) : (
        <ul className="space-y-3">
          {list.data.items.map((p) => (
            <li key={p.projectId} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{p.title}</h2>
                  <p className="text-sm text-slate-600">
                    {PROJECT_STATUS_LABEL[p.status]} · Meta {formatPEN(p.goalAmountCents)} ·
                    Confirmado {formatPEN(p.confirmedAmountCents)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={p.status !== "BORRADOR"}
                    title={p.status !== "BORRADOR" ? "Solo se editan borradores" : undefined}
                    onClick={() => setEditing(p)}
                  >
                    Editar
                  </button>
                  {p.status === "BORRADOR" && (
                    <button
                      type="button"
                      className={btnPrimary}
                      disabled={publish.isPending}
                      onClick={() => {
                        if (window.confirm(`¿Publicar «${p.title}»? Ya no podrá editarse.`))
                          publish.mutate(p.projectId);
                      }}
                    >
                      Publicar
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

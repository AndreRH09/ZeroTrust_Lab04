// HU-08 Gestionar proyectos (CA-08.1, CA-08.2). La UI no es el control de acceso: el backend
// responde 403 a quien no sea GESTOR aunque llame directamente al API.
import { zodResolver } from "@hookform/resolvers/zod";
import { MAX_GOAL_CENTS, MIN_GOAL_CENTS, type ProjectManaged } from "@aqp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "../auth/useAuth";
import { AlertIcon, ListIcon, PencilIcon, PlusIcon, SendIcon } from "../components/Icons";
import { ProgressBar } from "../components/ProgressBar";
import { ProjectCover } from "../components/ProjectVisuals";
import {
  Badge,
  btnPrimary,
  btnSecondary,
  card,
  Empty,
  ErrorMessage,
  input,
  labelCls,
  Loading,
  Notice,
  PageHeader,
  Stat,
} from "../components/States";
import { categoryOf } from "../lib/category";
import { formatPEN, parsePENToCents } from "../lib/money";
import { api } from "../services/api";
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE } from "./statusLabels";

const LIMITS = { title: 120, description: 2000 } as const;

const ProjectForm = z.object({
  title: z.string().trim().min(3, "Mínimo 3 caracteres").max(LIMITS.title, "Máximo 120 caracteres"),
  description: z
    .string()
    .trim()
    .min(10, "Mínimo 10 caracteres")
    .max(LIMITS.description, "Máximo 2000 caracteres"),
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

const FIELD = {
  title: { label: "Título", help: "Nombre corto y claro de la campaña." },
  description: {
    label: "Descripción",
    help: "Explica la finalidad, a quiénes beneficia y en qué se usará lo recaudado.",
  },
  goal: { label: "Objetivo en soles (PEN)", help: "Monto total que busca la campaña." },
} as const;

function ProjectEditor({ initial, onDone }: { initial?: ProjectManaged; onDone: () => void }) {
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    watch,
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
  const values = watch();

  return (
    <form
      noValidate
      onSubmit={handleSubmit((v) => save.mutate(v))}
      className={`${card} space-y-5 p-6`}
      aria-labelledby={`${prefix}-heading`}
    >
      <div>
        <h2 id={`${prefix}-heading`} className="text-lg font-bold">
          {initial ? "Editar borrador" : "Nuevo proyecto (borrador)"}
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Los borradores no son visibles para el público hasta que los publiques.
        </p>
      </div>
      {(["title", "description", "goal"] as const).map((field) => {
        const id = `${prefix}-${field}`;
        const err = errors[field];
        const describedBy = [`${id}-help`, err ? `${id}-err` : null].filter(Boolean).join(" ");
        const limit = field === "goal" ? null : LIMITS[field];
        return (
          <div key={field}>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={id} className={labelCls}>
                {FIELD[field].label}
              </label>
              {limit && (
                <span className="text-xs text-stone-500 tabular-nums">
                  {(values[field] ?? "").length}/{limit}
                </span>
              )}
            </div>
            {field === "description" ? (
              <textarea
                id={id}
                rows={5}
                className={input}
                aria-invalid={err ? "true" : "false"}
                aria-describedby={describedBy}
                {...register(field)}
              />
            ) : (
              <div className="relative">
                {field === "goal" && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-0 flex items-center pt-1.5 pl-3.5 font-semibold text-stone-500"
                  >
                    S/
                  </span>
                )}
                <input
                  id={id}
                  className={`${input} ${field === "goal" ? "pl-10 tabular-nums" : ""}`}
                  inputMode={field === "goal" ? "decimal" : undefined}
                  aria-invalid={err ? "true" : "false"}
                  aria-describedby={describedBy}
                  {...register(field)}
                />
              </div>
            )}
            <p id={`${id}-help`} className="mt-1.5 text-xs text-stone-500">
              {FIELD[field].help}
            </p>
            {err && (
              <p id={`${id}-err`} role="alert" className="mt-1 text-sm font-medium text-red-700">
                {err.message}
              </p>
            )}
          </div>
        );
      })}
      {save.error && <ErrorMessage error={save.error} />}
      <div className="flex flex-wrap gap-3 border-t border-sand-200 pt-5">
        <button type="submit" className={btnPrimary} disabled={save.isPending}>
          {save.isPending ? "Guardando…" : "Guardar borrador"}
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
  const [confirming, setConfirming] = useState<string | null>(null);
  const list = useQuery({ queryKey: ["manage"], queryFn: () => api.listManage(accessToken()) });
  const publish = useMutation({
    mutationFn: (id: string) => api.publishProject(accessToken(), id),
    onSuccess: async () => {
      setConfirming(null);
      await qc.invalidateQueries({ queryKey: ["manage"] });
      await qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  // Borradores primero: son los que requieren acción del gestor.
  const items = [...(list.data?.items ?? [])].sort(
    (a, b) => Number(b.status === "BORRADOR") - Number(a.status === "BORRADOR"),
  );
  const drafts = items.filter((p) => p.status === "BORRADOR").length;
  const published = items.length - drafts;
  const confirmed = items.reduce((s, p) => s + p.confirmedAmountCents, 0);

  return (
    <section aria-labelledby="titulo-gestion" className="space-y-8">
      <PageHeader
        id="titulo-gestion"
        eyebrow="Panel del gestor"
        title="Gestión de proyectos"
        description="Crea borradores y publícalos cuando estén listos. Un proyecto publicado ya no se puede editar."
        actions={
          // Solo si el servidor autorizó el listado: con 403 no se ofrecen acciones de gestor.
          editing === null &&
          list.isSuccess && (
            <button type="button" className={btnPrimary} onClick={() => setEditing("new")}>
              <PlusIcon className="size-4" />
              Nuevo proyecto
            </button>
          )
        }
      />

      {list.isSuccess && items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Borradores" value={drafts} icon={<PencilIcon className="size-4" />} />
          <Stat label="Publicados" value={published} icon={<SendIcon className="size-4" />} />
          <Stat label="Confirmado (simulado)" value={formatPEN(confirmed)} />
        </div>
      )}

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
      ) : items.length === 0 ? (
        <Empty title="No hay proyectos registrados" icon={<ListIcon className="size-6" />}>
          Crea el primero con «Nuevo proyecto».
        </Empty>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((p) => (
            <li key={p.projectId} className={`${card} flex flex-col overflow-hidden`}>
              <ProjectCover category={categoryOf(p)} size="sm" />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-bold text-stone-900">{p.title}</h2>
                  <Badge tone={PROJECT_STATUS_TONE[p.status]}>
                    {PROJECT_STATUS_LABEL[p.status]}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-stone-600">{p.description}</p>
                <div className="mt-4 flex-1">
                  <ProgressBar
                    confirmedCents={p.confirmedAmountCents}
                    goalCents={p.goalAmountCents}
                    label={`Progreso de ${p.title}`}
                  />
                </div>

                {p.status === "BORRADOR" &&
                  (confirming === p.projectId ? (
                    <div className="mt-5">
                      <Notice icon={<AlertIcon className="size-5" />}>
                        <p className="font-semibold">¿Publicar «{p.title}»?</p>
                        <p>Será visible para todos y ya no podrá editarse.</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={btnPrimary}
                            disabled={publish.isPending}
                            onClick={() => publish.mutate(p.projectId)}
                          >
                            {publish.isPending ? "Publicando…" : "Sí, publicar"}
                          </button>
                          <button
                            type="button"
                            className={btnSecondary}
                            onClick={() => setConfirming(null)}
                          >
                            Cancelar
                          </button>
                        </div>
                      </Notice>
                    </div>
                  ) : (
                    <div className="mt-5 flex flex-wrap gap-2 border-t border-sand-200 pt-4">
                      <button type="button" className={btnSecondary} onClick={() => setEditing(p)}>
                        <PencilIcon className="size-4" />
                        Editar
                      </button>
                      <button
                        type="button"
                        className={btnPrimary}
                        onClick={() => setConfirming(p.projectId)}
                      >
                        <SendIcon className="size-4" />
                        Publicar
                      </button>
                    </div>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

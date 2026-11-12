// HU-02 Consultar detalle (CA-02.1, CA-02.2) + HU-09 indicadores (CA-09.1, CA-09.2).
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { useAuth } from "../auth/useAuth";
import { ProgressBar } from "../components/ProgressBar";
import { btnPrimary, Empty, ErrorMessage, Loading } from "../components/States";
import { formatPEN } from "../lib/money";
import { api, ApiError } from "../services/api";

export function ProjectDetail() {
  const { projectId = "" } = useParams();
  const { isAuthenticated, login, configured } = useAuth();
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.getProject(projectId),
  });
  const stats = useQuery({
    queryKey: ["stats", projectId],
    queryFn: () => api.getStats(projectId),
    enabled: project.isSuccess,
  });

  if (project.isPending) return <Loading label="Cargando proyecto…" />;
  if (project.error) {
    if (project.error instanceof ApiError && project.error.status === 404) {
      return (
        <Empty title="Proyecto no encontrado">
          <Link to="/" className="underline">
            Volver al catálogo
          </Link>
        </Empty>
      );
    }
    return <ErrorMessage error={project.error} />;
  }

  const p = project.data;
  const confirmed = stats.data?.confirmedAmountCents ?? p.confirmedAmountCents;

  return (
    <article
      aria-labelledby="titulo-proyecto"
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <p className="text-xs uppercase tracking-wide text-slate-500">
        Proyecto <span className="font-mono">{p.projectId}</span> · {p.status}
      </p>
      <h1 id="titulo-proyecto" className="mt-1 text-2xl font-bold">
        {p.title}
      </h1>
      <p className="mt-3 whitespace-pre-line text-slate-700">{p.description}</p>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Objetivo</dt>
          <dd className="font-semibold">{formatPEN(p.goalAmountCents)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Acumulado confirmado (simulado)</dt>
          <dd className="font-semibold">{formatPEN(confirmed)}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <ProgressBar
          confirmedCents={confirmed}
          goalCents={p.goalAmountCents}
          label="Progreso de la campaña"
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {isAuthenticated ? (
          <Link to={`/projects/${p.projectId}/donate`} className={btnPrimary}>
            Donar (simulado)
          </Link>
        ) : (
          <button
            type="button"
            className={btnPrimary}
            disabled={!configured}
            onClick={() => void login(`/projects/${p.projectId}/donate`)}
          >
            Inicia sesión para donar
          </button>
        )}
        <Link to="/" className="self-center text-sm underline">
          Volver al catálogo
        </Link>
      </div>
    </article>
  );
}

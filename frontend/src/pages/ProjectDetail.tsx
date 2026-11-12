// HU-02 Consultar detalle (CA-02.1, CA-02.2) + HU-09 indicadores (CA-09.1, CA-09.2).
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { useAuth } from "../auth/useAuth";
import { ArrowLeftIcon, ArrowRightIcon, EyeIcon, SearchIcon } from "../components/Icons";
import { ProgressBar } from "../components/ProgressBar";
import { CategoryTag, ProjectCover } from "../components/ProjectVisuals";
import { Badge, btnDonate, card, Empty, ErrorMessage, link, Loading } from "../components/States";
import { TrustList } from "../components/Trust";
import { categoryOf } from "../lib/category";
import { formatPEN } from "../lib/money";
import { api, ApiError } from "../services/api";
import { PROJECT_STATUS_LABEL } from "./statusLabels";

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
        <Empty title="Proyecto no encontrado" icon={<SearchIcon className="size-6" />}>
          <Link to="/" className={link}>
            Volver al catálogo
          </Link>
        </Empty>
      );
    }
    return <ErrorMessage error={project.error} />;
  }

  const p = project.data;
  const confirmed = stats.data?.confirmedAmountCents ?? p.confirmedAmountCents;
  const remaining = Math.max(p.goalAmountCents - confirmed, 0);
  const category = categoryOf(p);

  return (
    <article aria-labelledby="titulo-proyecto">
      <nav aria-label="Ruta de navegación" className="mb-6 text-sm">
        <ol className="flex flex-wrap items-center gap-2 text-stone-500">
          <li>
            <Link to="/" className="inline-flex items-center gap-1 hover:text-brand-800">
              <ArrowLeftIcon className="size-4" />
              Proyectos
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="truncate font-medium text-stone-800">
            {p.title}
          </li>
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <header className="lg:col-start-1">
          <div className="overflow-hidden rounded-3xl">
            <ProjectCover category={category} size="lg">
              <div className="absolute top-4 left-4">
                <CategoryTag category={category} />
              </div>
            </ProjectCover>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-stone-500">
            <Badge tone="success">{PROJECT_STATUS_LABEL[p.status]}</Badge>
            <span>
              Proyecto <span className="font-mono text-xs">{p.projectId}</span>
            </span>
          </div>
          <h1
            id="titulo-proyecto"
            className="mt-2 text-3xl font-extrabold tracking-tight text-balance text-stone-900 sm:text-4xl"
          >
            {p.title}
          </h1>
        </header>

        {/* Progreso, meta y botón juntos: el bloque de decisión (lg: fijo a la derecha). */}
        <aside
          aria-label="Apoya este proyecto"
          className="lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          <div className={`${card} space-y-5 p-6 lg:sticky lg:top-28`}>
            <ProgressBar
              confirmedCents={confirmed}
              goalCents={p.goalAmountCents}
              label="Progreso de la campaña"
              size="lg"
            />
            <dl className="grid grid-cols-2 gap-3 border-t border-sand-200 pt-4 text-sm">
              <div>
                <dt className="text-stone-500">Objetivo</dt>
                <dd className="font-semibold text-stone-900 tabular-nums">
                  {formatPEN(p.goalAmountCents)}
                </dd>
              </div>
              <div>
                <dt className="text-stone-500">Falta</dt>
                <dd className="font-semibold text-stone-900 tabular-nums">
                  {remaining === 0 ? "Meta alcanzada" : formatPEN(remaining)}
                </dd>
              </div>
            </dl>

            {isAuthenticated ? (
              <Link to={`/projects/${p.projectId}/donate`} className={`${btnDonate} w-full`}>
                Donar (simulado)
                <ArrowRightIcon className="size-4" />
              </Link>
            ) : (
              <button
                type="button"
                className={`${btnDonate} w-full`}
                disabled={!configured}
                onClick={() => void login(`/projects/${p.projectId}/donate`)}
              >
                Inicia sesión para donar
              </button>
            )}
            <p className="text-center text-xs text-stone-500">
              Simulación académica · no se realiza ningún cobro
            </p>

            <div className="border-t border-sand-200 pt-4">
              <TrustList />
            </div>
          </div>
        </aside>

        <div className="space-y-8 lg:col-start-1">
          <section aria-labelledby="titulo-sobre">
            <h2 id="titulo-sobre" className="text-xl font-bold tracking-tight">
              Sobre el proyecto
            </h2>
            <p className="mt-3 text-lg leading-relaxed whitespace-pre-line text-stone-700">
              {p.description}
            </p>
          </section>

          <section
            aria-labelledby="titulo-transparencia"
            className="rounded-2xl border border-brand-100 bg-brand-50 p-5"
          >
            <h2
              id="titulo-transparencia"
              className="flex items-center gap-2 font-bold text-brand-950"
            >
              <EyeIcon className="size-5 text-brand-700" />
              Transparencia de los totales
            </h2>
            <p className="mt-2 text-sm text-brand-900">
              El acumulado suma solo intenciones confirmadas en la simulación y se actualiza al
              instante. Se publican totales agregados: nunca la identidad ni el historial de quienes
              donan.
            </p>
          </section>

          <Link to="/" className={`${link} inline-flex items-center gap-1 text-sm`}>
            <ArrowLeftIcon className="size-4" />
            Volver al catálogo
          </Link>
        </div>
      </div>
    </article>
  );
}

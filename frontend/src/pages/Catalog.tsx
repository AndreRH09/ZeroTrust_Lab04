// HU-01 Listar proyectos (CA-01.1, CA-01.3) + HU-09 indicadores (CA-09.1).
import type { ProjectPublic } from "@aqp/shared";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  HeartIcon,
  ListIcon,
  SearchIcon,
  TargetIcon,
} from "../components/Icons";
import { ProgressBar } from "../components/ProgressBar";
import { CategoryTag, ProjectCover } from "../components/ProjectVisuals";
import { card, Empty, ErrorMessage, input } from "../components/States";
import { TRUST_POINTS } from "../components/Trust";
import { type Category, CATEGORY_LABEL, categoryOf } from "../lib/category";
import { formatPEN } from "../lib/money";
import { api } from "../services/api";

type Sort = "destacados" | "cerca" | "apoyo";

const pctOf = (p: ProjectPublic) =>
  p.goalAmountCents > 0 ? p.confirmedAmountCents / p.goalAmountCents : 0;
const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function ProjectCard({ p }: { p: ProjectPublic }) {
  const category = categoryOf(p);
  const reached = pctOf(p) >= 1;
  return (
    <article
      className={`${card} group relative flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md`}
    >
      <ProjectCover category={category}>
        <div className="absolute top-3 left-3">
          <CategoryTag category={category} />
        </div>
        {reached && (
          <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
            <CheckCircleIcon className="size-3.5" />
            Meta alcanzada
          </div>
        )}
      </ProjectCover>
      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-lg leading-snug font-bold tracking-tight text-stone-900">
          <Link
            to={`/projects/${p.projectId}`}
            className="rounded after:absolute after:inset-0 group-hover:text-brand-800"
          >
            {p.title}
          </Link>
        </h2>
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-stone-600">{p.description}</p>
        <div className="mt-5">
          <ProgressBar
            confirmedCents={p.confirmedAmountCents}
            goalCents={p.goalAmountCents}
            label={`Progreso de ${p.title}`}
          />
        </div>
        <span
          aria-hidden="true"
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-coral-700"
        >
          Ver proyecto y donar
          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </article>
  );
}

function SkeletonGrid() {
  return (
    <div>
      <p role="status" aria-live="polite" className="sr-only">
        Cargando proyectos…
      </p>
      <ul aria-hidden="true" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className={`${card} overflow-hidden`}>
            <div className="h-36 animate-pulse bg-sand-100" />
            <div className="space-y-3 p-5">
              <div className="h-5 w-3/4 animate-pulse rounded bg-sand-200" />
              <div className="h-4 w-full animate-pulse rounded bg-sand-100" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-sand-100" />
              <div className="h-2.5 w-full animate-pulse rounded-full bg-sand-200" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HeroStat({
  label,
  value,
  className = "",
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 ${className}`}>
      <dt className="text-sm text-brand-100">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tracking-tight text-white tabular-nums">{value}</dd>
    </div>
  );
}

export function Catalog() {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: api.listProjects,
  });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "todas">("todas");
  const [sort, setSort] = useState<Sort>("destacados");

  const items = useMemo(() => data?.items ?? [], [data]);
  const categories = useMemo(() => [...new Set(items.map((p) => categoryOf(p)))].sort(), [items]);
  const visible = useMemo(() => {
    const q = normalize(query.trim());
    const filtered = items.filter(
      (p) =>
        (category === "todas" || categoryOf(p) === category) &&
        (!q || normalize(`${p.title} ${p.description}`).includes(q)),
    );
    if (sort === "cerca") return [...filtered].sort((a, b) => pctOf(b) - pctOf(a));
    if (sort === "apoyo") return [...filtered].sort((a, b) => pctOf(a) - pctOf(b));
    return filtered;
  }, [items, query, category, sort]);

  const totalConfirmed = items.reduce((s, p) => s + p.confirmedAmountCents, 0);
  const reachedCount = items.filter((p) => pctOf(p) >= 1).length;

  return (
    <div className="space-y-16">
      {/* Portada: un solo punto focal (explorar proyectos) y prueba social agregada. */}
      <section
        aria-labelledby="titulo-catalogo"
        className="relative overflow-hidden rounded-3xl bg-brand-900 px-6 py-10 sm:px-10 sm:py-14"
      >
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 400 400"
          className="absolute -top-24 -right-24 size-96 text-brand-700/40"
        >
          <circle cx="200" cy="200" r="160" fill="none" stroke="currentColor" strokeWidth="40" />
          <circle cx="200" cy="200" r="80" fill="none" stroke="currentColor" strokeWidth="24" />
        </svg>
        <div className="relative grid gap-10">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-brand-100 ring-1 ring-white/15">
              <HeartIcon className="size-4 text-coral-300" />
              Fundación AQP-SOLIDARIA
            </p>
            <h1
              id="titulo-catalogo"
              className="mt-4 text-4xl font-extrabold tracking-tight text-balance text-white sm:text-5xl"
            >
              Proyectos sociales
            </h1>
            <p className="mt-4 max-w-xl text-lg text-brand-100">
              Elige una causa de educación, alimentación o salud comunitaria.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#proyectos"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-coral-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-coral-700 [--focus-ring:var(--color-amber-300)]"
              >
                Explorar proyectos
                <ArrowRightIcon className="size-4" />
              </a>
              <a
                href="#como-funciona"
                className="inline-flex min-h-11 items-center rounded-xl px-5 py-2 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/10 [--focus-ring:var(--color-amber-300)]"
              >
                Cómo funciona
              </a>
            </div>
          </div>
          <dl className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
            <HeroStat label="Proyectos activos" value={isPending ? "—" : items.length} />
            <HeroStat
              label="Metas alcanzadas"
              value={isPending ? "—" : `${reachedCount} de ${items.length}`}
            />
            <HeroStat
              label="Confirmado (simulado)"
              value={isPending ? "—" : formatPEN(totalConfirmed)}
              className="col-span-2 sm:col-span-1"
            />
          </dl>
        </div>
      </section>

      <section id="proyectos" aria-labelledby="titulo-lista" className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="titulo-lista" className="text-2xl font-bold tracking-tight">
              Campañas abiertas
            </h2>
            <p className="mt-1 text-stone-600">
              Los totales reflejan solo donaciones confirmadas (simuladas).
            </p>
          </div>
        </div>

        {items.length > 0 && (
          <div className={`${card} flex flex-col gap-4 p-4 lg:flex-row lg:items-end`}>
            <div className="flex-1">
              <label htmlFor="buscar" className="sr-only">
                Buscar proyecto
              </label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-stone-400" />
                <input
                  id="buscar"
                  type="search"
                  placeholder="Buscar por nombre o descripción"
                  className={`${input} mt-0 pl-11`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div role="group" aria-label="Filtrar por categoría" className="flex flex-wrap gap-2">
              {(["todas", ...categories] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                  className={`min-h-11 rounded-xl px-3.5 text-sm font-semibold ring-1 transition-colors ring-inset ${
                    category === c
                      ? "bg-brand-700 text-white ring-brand-700"
                      : "bg-white text-stone-700 ring-sand-300 hover:bg-sand-100"
                  }`}
                >
                  {c === "todas" ? "Todas" : CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
            <div className="lg:w-56">
              <label htmlFor="orden" className="text-xs font-semibold text-stone-600">
                Ordenar por
              </label>
              <select
                id="orden"
                className={`${input} mt-1`}
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
              >
                <option value="destacados">Destacados</option>
                <option value="cerca">Más cerca de la meta</option>
                <option value="apoyo">Necesitan más apoyo</option>
              </select>
            </div>
          </div>
        )}

        {isPending ? (
          <SkeletonGrid />
        ) : error ? (
          <ErrorMessage
            error={error}
            action={
              <button
                type="button"
                className="font-semibold underline underline-offset-4"
                onClick={() => void refetch()}
              >
                Reintentar
              </button>
            }
          />
        ) : items.length === 0 ? (
          <Empty title="Aún no hay proyectos publicados" icon={<ListIcon className="size-6" />}>
            Vuelve pronto: la fundación publicará nuevas campañas.
          </Empty>
        ) : visible.length === 0 ? (
          <Empty
            title="Ningún proyecto coincide con tu búsqueda"
            icon={<SearchIcon className="size-6" />}
          >
            <button
              type="button"
              className="font-semibold text-brand-700 underline underline-offset-4"
              onClick={() => {
                setQuery("");
                setCategory("todas");
              }}
            >
              Limpiar filtros
            </button>
          </Empty>
        ) : (
          <>
            <p aria-live="polite" className="text-sm text-stone-500">
              {visible.length === 1 ? "1 proyecto" : `${visible.length} proyectos`}
            </p>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((p) => (
                <li key={p.projectId}>
                  <ProjectCard p={p} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section id="como-funciona" aria-labelledby="titulo-como" className="space-y-6">
        <div className="max-w-2xl">
          <h2 id="titulo-como" className="text-2xl font-bold tracking-tight">
            Cómo funciona
          </h2>
          <p className="mt-1 text-stone-600">
            Tres pasos, sin datos de pago. Todo el flujo es una simulación académica.
          </p>
        </div>
        <ol className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: <SearchIcon className="size-5" />,
              title: "Elige un proyecto",
              text: "Revisa la meta, el avance confirmado y la finalidad de cada campaña.",
            },
            {
              icon: <TargetIcon className="size-5" />,
              title: "Registra tu intención",
              text: "Inicia sesión e indica el monto. Una clave de idempotencia evita duplicados.",
            },
            {
              icon: <CheckCircleIcon className="size-5" />,
              title: "Simula el resultado",
              text: "Confirma o rechaza la simulación y sigue el avance en tu historial.",
            },
          ].map((s, i) => (
            <li key={s.title} className={`${card} p-5`}>
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-coral-50 text-coral-700">
                  {s.icon}
                </span>
                <span className="text-sm font-semibold text-stone-500">Paso {i + 1}</span>
              </div>
              <h3 className="mt-3 font-bold text-stone-900">{s.title}</h3>
              <p className="mt-1 text-sm text-stone-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="titulo-seguridad"
        className="rounded-3xl border border-brand-100 bg-brand-50 px-6 py-10 sm:px-10"
      >
        <div className="max-w-2xl">
          <h2 id="titulo-seguridad" className="text-2xl font-bold tracking-tight text-brand-950">
            Tu confianza, verificada en cada paso
          </h2>
          <p className="mt-1 text-brand-900">
            Aplicamos un modelo Zero Trust (NIST SP 800-207): ninguna solicitud se considera
            confiable por su origen.
          </p>
        </div>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_POINTS.map((t) => (
            <li key={t.title} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-brand-100">
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand-700 text-white">
                {t.icon}
              </span>
              <h3 className="mt-3 font-bold text-stone-900">{t.title}</h3>
              <p className="mt-1 text-sm text-stone-600">{t.text}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

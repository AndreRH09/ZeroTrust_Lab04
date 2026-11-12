// HU-01 Listar proyectos (CA-01.1, CA-01.3) + HU-09 indicadores (CA-09.1).
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Empty, ErrorMessage, Loading } from "../components/States";
import { ProgressBar } from "../components/ProgressBar";
import { formatPEN } from "../lib/money";
import { api } from "../services/api";

export function Catalog() {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: api.listProjects,
  });

  return (
    <section aria-labelledby="titulo-catalogo">
      <h1 id="titulo-catalogo" className="text-2xl font-bold">
        Proyectos sociales
      </h1>
      <p className="mt-1 text-slate-600">
        Elige una causa de educación, alimentación o salud comunitaria.
      </p>

      <div className="mt-6">
        {isPending ? (
          <Loading label="Cargando proyectos…" />
        ) : error ? (
          <ErrorMessage
            error={error}
            action={
              <button type="button" className="underline" onClick={() => void refetch()}>
                Reintentar
              </button>
            }
          />
        ) : data.items.length === 0 ? (
          <Empty title="Aún no hay proyectos publicados">
            Vuelve pronto: la fundación publicará nuevas campañas.
          </Empty>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {data.items.map((p) => (
              <li
                key={p.projectId}
                className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <h2 className="text-lg font-semibold">
                  <Link to={`/projects/${p.projectId}`} className="hover:underline">
                    {p.title}
                  </Link>
                </h2>
                <p className="mt-1 line-clamp-3 flex-1 text-sm text-slate-700">{p.description}</p>
                <p className="mt-3 text-sm">
                  Meta: <span className="font-semibold">{formatPEN(p.goalAmountCents)}</span>
                </p>
                <div className="mt-2">
                  <ProgressBar
                    confirmedCents={p.confirmedAmountCents}
                    goalCents={p.goalAmountCents}
                    label={`Progreso de ${p.title}`}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

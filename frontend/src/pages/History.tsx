// HU-07 Ver historial propio (CA-07.1). El backend filtra por el sub del token.
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useAuth } from "../auth/useAuth";
import { ArrowRightIcon, CheckCircleIcon, ClockIcon, HeartIcon } from "../components/Icons";
import {
  Badge,
  btnDonate,
  card,
  Empty,
  ErrorMessage,
  Loading,
  PageHeader,
  Stat,
} from "../components/States";
import { formatPEN } from "../lib/money";
import { api } from "../services/api";
import { STATUS_LABEL, STATUS_TONE } from "./statusLabels";

export function History() {
  const { accessToken } = useAuth();
  const donations = useQuery({
    queryKey: ["myDonations"],
    queryFn: () => api.myDonations(accessToken()),
  });
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.listProjects });
  const titleOf = (id: string) => projects.data?.items.find((p) => p.projectId === id)?.title ?? id;

  const items = [...(donations.data?.items ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const confirmed = items
    .filter((d) => d.status === "CONFIRMADA_SIMULADA")
    .reduce((s, d) => s + d.amountCents, 0);
  const pendingCount = items.filter((d) => d.status === "PENDIENTE_SIMULACION").length;

  return (
    <section aria-labelledby="titulo-historial" className="space-y-8">
      <PageHeader
        id="titulo-historial"
        eyebrow="Tu cuenta"
        title="Mis donaciones simuladas"
        description="Solo tú puedes ver este historial: el servidor lo filtra con tu identidad verificada."
      />

      {donations.isPending ? (
        <Loading />
      ) : donations.error ? (
        <ErrorMessage error={donations.error} />
      ) : items.length === 0 ? (
        <Empty title="Todavía no registraste donaciones" icon={<HeartIcon className="size-6" />}>
          <Link to="/" className={`${btnDonate} mt-4`}>
            Explora los proyectos
          </Link>
        </Empty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Intenciones registradas"
              value={items.length}
              icon={<HeartIcon className="size-4" />}
            />
            <Stat
              label="Confirmado (simulado)"
              value={formatPEN(confirmed)}
              icon={<CheckCircleIcon className="size-4" />}
            />
            <Stat
              label="Pendientes de simular"
              value={pendingCount}
              icon={<ClockIcon className="size-4" />}
              hint={pendingCount > 0 ? "Ábrelas para confirmar o rechazar" : undefined}
            />
          </div>

          <ul
            aria-label="Historial de donaciones simuladas"
            className={`${card} divide-y divide-sand-200`}
          >
            {items.map((d) => (
              <li key={d.donationId}>
                <Link
                  to={`/donations/${d.donationId}`}
                  className="group flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-sand-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-stone-900 group-hover:text-brand-800">
                      {titleOf(d.projectId)}
                    </p>
                    <p className="text-sm text-stone-500">
                      {new Date(d.createdAt).toLocaleDateString("es-PE", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                  <p className="w-28 text-right font-bold text-stone-900 tabular-nums">
                    {formatPEN(d.amountCents)}
                  </p>
                  <ArrowRightIcon className="hidden size-4 text-stone-400 group-hover:text-brand-700 sm:block" />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

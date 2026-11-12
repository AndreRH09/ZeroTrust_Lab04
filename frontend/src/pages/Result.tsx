// HU-06 Simular confirmación (CA-06.1, CA-06.4) y detalle de donación propia (CA-07.2).
import type { DonationStatus } from "@aqp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../auth/useAuth";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  ListIcon,
  XCircleIcon,
} from "../components/Icons";
import { ProgressBar } from "../components/ProgressBar";
import {
  Badge,
  btnDanger,
  btnPrimary,
  btnSecondary,
  card,
  ErrorMessage,
  Loading,
  Notice,
} from "../components/States";
import { DonationSteps } from "../components/Trust";
import { formatPEN } from "../lib/money";
import { api } from "../services/api";
import { STATUS_LABEL, STATUS_TONE } from "./statusLabels";

export const SIMULATION_NOTICE = "Simulación académica: no se ha realizado ningún cobro";

const HERO: Record<DonationStatus, { icon: ReactNode; title: string; text: string; ring: string }> =
  {
    PENDIENTE_SIMULACION: {
      icon: <ClockIcon className="size-8" />,
      title: "Tu intención está registrada",
      text: "Falta un paso: elige el resultado de la simulación.",
      ring: "bg-amber-50 text-amber-700 ring-amber-200",
    },
    CONFIRMADA_SIMULADA: {
      icon: <CheckCircleIcon className="size-8" />,
      title: "¡Gracias por tu apoyo!",
      text: "La simulación quedó confirmada y ya suma al total del proyecto.",
      ring: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    },
    RECHAZADA_SIMULADA: {
      icon: <XCircleIcon className="size-8" />,
      title: "La simulación fue rechazada",
      text: "No suma al total del proyecto. Puedes registrar una nueva intención cuando quieras.",
      ring: "bg-red-50 text-red-700 ring-red-200",
    },
  };

export function Result() {
  const { donationId = "" } = useParams();
  const { accessToken } = useAuth();
  const qc = useQueryClient();

  const donation = useQuery({
    queryKey: ["donation", donationId],
    queryFn: () => api.getDonation(accessToken(), donationId),
  });
  const projectId = donation.data?.projectId;
  const stats = useQuery({
    queryKey: ["stats", projectId],
    queryFn: () => api.getStats(projectId!),
    enabled: Boolean(projectId),
  });

  const simulate = useMutation({
    mutationFn: (outcome: "CONFIRM" | "REJECT") => api.simulate(accessToken(), donationId, outcome),
    onSuccess: async (d) => {
      qc.setQueryData(["donation", donationId], d);
      await qc.invalidateQueries({ queryKey: ["stats", d.projectId] });
      await qc.invalidateQueries({ queryKey: ["projects"] });
      await qc.invalidateQueries({ queryKey: ["myDonations"] });
    },
  });

  if (donation.isPending) return <Loading label="Cargando donación…" />;
  if (donation.error) return <ErrorMessage error={donation.error} />;

  const d = donation.data;
  const pending = d.status === "PENDIENTE_SIMULACION";
  const hero = HERO[d.status];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <DonationSteps current={pending ? 3 : 4} />

      <section aria-labelledby="titulo-resultado" className={`${card} overflow-hidden`}>
        <div className="flex flex-col items-center px-6 pt-8 pb-6 text-center sm:px-10">
          <span
            className={`flex size-16 items-center justify-center rounded-full ring-8 ${hero.ring}`}
          >
            {hero.icon}
          </span>
          <h1 id="titulo-resultado" className="mt-5 text-sm font-semibold text-stone-500">
            Intención de donación
          </h1>
          <p className="mt-1 text-2xl font-bold tracking-tight text-balance text-stone-900">
            {hero.title}
          </p>
          <p className="mt-2 text-stone-600">{hero.text}</p>
          <p className="mt-5 text-4xl font-extrabold tracking-tight text-stone-900 tabular-nums">
            {formatPEN(d.amountCents)}
          </p>
        </div>

        <div className="px-6 sm:px-10">
          <p
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-sm font-semibold text-amber-900"
          >
            {SIMULATION_NOTICE}
          </p>
        </div>

        <dl className="mx-6 my-6 divide-y divide-sand-200 rounded-xl border border-sand-200 text-sm sm:mx-10">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-stone-500">Estado</dt>
            <dd>
              <Badge tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-stone-500">Fecha</dt>
            <dd className="text-stone-900">{new Date(d.createdAt).toLocaleString("es-PE")}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <dt className="text-stone-500">Referencia</dt>
            <dd className="truncate font-mono text-xs text-stone-700">{d.donationId}</dd>
          </div>
        </dl>

        {pending && (
          <div className="border-t border-sand-200 bg-sand-50 px-6 py-6 sm:px-10">
            <h2 className="font-bold text-stone-900">Elige el resultado de la simulación</h2>
            <p className="mt-1 text-sm text-stone-600">
              En un sistema real este paso lo resolvería la pasarela de pago. Aquí lo decides tú,
              solo en el entorno académico.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className={btnPrimary}
                disabled={simulate.isPending}
                onClick={() => simulate.mutate("CONFIRM")}
              >
                <CheckCircleIcon className="size-4" />
                Confirmar simulación
              </button>
              <button
                type="button"
                className={btnDanger}
                disabled={simulate.isPending}
                onClick={() => simulate.mutate("REJECT")}
              >
                <XCircleIcon className="size-4" />
                Rechazar simulación
              </button>
            </div>
            {simulate.error && (
              <div className="mt-4">
                <ErrorMessage error={simulate.error} />
              </div>
            )}
          </div>
        )}
      </section>

      {stats.data && (
        <section aria-labelledby="titulo-total" className={`${card} p-6`}>
          <h2 id="titulo-total" className="mb-4 font-bold text-stone-900">
            Total confirmado del proyecto
          </h2>
          <ProgressBar
            confirmedCents={stats.data.confirmedAmountCents}
            goalCents={stats.data.goalAmountCents}
            label="Progreso del proyecto"
          />
          <Link
            to={`/projects/${stats.data.projectId}`}
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-900"
          >
            Ver el proyecto
            <ArrowRightIcon className="size-4" />
          </Link>
        </section>
      )}

      {!pending && (
        <Notice tone="brand">
          Puedes revisar esta y tus demás intenciones en tu historial en cualquier momento.
        </Notice>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/donations" className={btnSecondary}>
          <ListIcon className="size-4" />
          Ver mi historial
        </Link>
        <Link to="/" className={btnSecondary}>
          Volver al catálogo
        </Link>
      </div>
    </div>
  );
}

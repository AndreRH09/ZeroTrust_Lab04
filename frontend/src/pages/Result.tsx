// HU-06 Simular confirmación (CA-06.1, CA-06.4) y detalle de donación propia (CA-07.2).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { useAuth } from "../auth/useAuth";
import { ProgressBar } from "../components/ProgressBar";
import { btnDanger, btnPrimary, ErrorMessage, Loading } from "../components/States";
import { formatPEN } from "../lib/money";
import { api } from "../services/api";
import { STATUS_LABEL } from "./statusLabels";

export const SIMULATION_NOTICE = "Simulación académica: no se ha realizado ningún cobro";

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

  return (
    <section
      aria-labelledby="titulo-resultado"
      className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h1 id="titulo-resultado" className="text-xl font-bold">
        Intención de donación
      </h1>

      <p
        role="status"
        className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 font-semibold text-amber-900"
      >
        {SIMULATION_NOTICE}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <dt className="text-slate-500">Importe</dt>
        <dd className="font-semibold">{formatPEN(d.amountCents)}</dd>
        <dt className="text-slate-500">Estado</dt>
        <dd className="font-semibold">{STATUS_LABEL[d.status]}</dd>
        <dt className="text-slate-500">Fecha</dt>
        <dd>{new Date(d.createdAt).toLocaleString("es-PE")}</dd>
      </dl>

      {pending && (
        <div className="mt-5">
          <p className="text-sm text-slate-700">Elige el resultado de la simulación:</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <button
              type="button"
              className={btnPrimary}
              disabled={simulate.isPending}
              onClick={() => simulate.mutate("CONFIRM")}
            >
              Confirmar simulación
            </button>
            <button
              type="button"
              className={btnDanger}
              disabled={simulate.isPending}
              onClick={() => simulate.mutate("REJECT")}
            >
              Rechazar simulación
            </button>
          </div>
        </div>
      )}
      {simulate.error && (
        <div className="mt-3">
          <ErrorMessage error={simulate.error} />
        </div>
      )}

      {stats.data && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold">Total confirmado del proyecto</h2>
          <div className="mt-1">
            <ProgressBar
              confirmedCents={stats.data.confirmedAmountCents}
              goalCents={stats.data.goalAmountCents}
              label="Progreso del proyecto"
            />
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-4 text-sm">
        <Link to="/donations" className="underline">
          Ver mi historial
        </Link>
        <Link to="/" className="underline">
          Volver al catálogo
        </Link>
      </div>
    </section>
  );
}

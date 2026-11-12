// HU-07 Ver historial propio (CA-07.1). El backend filtra por el sub del token.
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useAuth } from "../auth/useAuth";
import { Empty, ErrorMessage, Loading } from "../components/States";
import { formatPEN } from "../lib/money";
import { api } from "../services/api";
import { STATUS_LABEL } from "./statusLabels";

export function History() {
  const { accessToken } = useAuth();
  const donations = useQuery({
    queryKey: ["myDonations"],
    queryFn: () => api.myDonations(accessToken()),
  });
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.listProjects });
  const titleOf = (id: string) => projects.data?.items.find((p) => p.projectId === id)?.title ?? id;

  return (
    <section aria-labelledby="titulo-historial">
      <h1 id="titulo-historial" className="text-2xl font-bold">
        Mis donaciones simuladas
      </h1>
      <div className="mt-4">
        {donations.isPending ? (
          <Loading />
        ) : donations.error ? (
          <ErrorMessage error={donations.error} />
        ) : donations.data.items.length === 0 ? (
          <Empty title="Todavía no registraste donaciones">
            <Link to="/" className="underline">
              Explora los proyectos
            </Link>
          </Empty>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Historial de donaciones simuladas</caption>
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    Fecha
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Proyecto
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Importe
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {donations.data.items.map((d) => (
                  <tr key={d.donationId} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      {new Date(d.createdAt).toLocaleDateString("es-PE")}
                    </td>
                    <td className="px-3 py-2">
                      <Link to={`/donations/${d.donationId}`} className="underline">
                        {titleOf(d.projectId)}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-medium">{formatPEN(d.amountCents)}</td>
                    <td className="px-3 py-2">{STATUS_LABEL[d.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

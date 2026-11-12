// HU-10 Consultar auditoría (extensión, CA-10.1, CA-10.2).
import { AuditEventType } from "@aqp/shared";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { btnPrimary, Empty, ErrorMessage, input, Loading } from "../components/States";
import { api } from "../services/api";

const toIso = (local: string) => (local ? new Date(local).toISOString() : undefined);

export function Audit() {
  const { accessToken } = useAuth();
  const [form, setForm] = useState({
    eventType: "AUTHZ_DENIED" as AuditEventType,
    from: "",
    to: "",
  });
  const [filter, setFilter] = useState(form);
  const events = useQuery({
    queryKey: ["audit", filter],
    queryFn: () =>
      api.listAudit(accessToken(), {
        eventType: filter.eventType,
        from: toIso(filter.from),
        to: toIso(filter.to),
      }),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFilter(form);
  };

  return (
    <section aria-labelledby="titulo-auditoria" className="space-y-4">
      <h1 id="titulo-auditoria" className="text-2xl font-bold">
        Eventos de auditoría
      </h1>
      <form
        onSubmit={onSubmit}
        className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-4"
      >
        <div>
          <label htmlFor="eventType" className="block text-sm font-medium">
            Tipo
          </label>
          <select
            id="eventType"
            className={input}
            value={form.eventType}
            onChange={(e) => setForm({ ...form, eventType: e.target.value as AuditEventType })}
          >
            {AuditEventType.options.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from" className="block text-sm font-medium">
            Desde
          </label>
          <input
            id="from"
            type="datetime-local"
            className={input}
            value={form.from}
            onChange={(e) => setForm({ ...form, from: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="to" className="block text-sm font-medium">
            Hasta
          </label>
          <input
            id="to"
            type="datetime-local"
            className={input}
            value={form.to}
            onChange={(e) => setForm({ ...form, to: e.target.value })}
          />
        </div>
        <div className="flex items-end">
          <button type="submit" className={btnPrimary}>
            Filtrar
          </button>
        </div>
      </form>

      {events.isPending ? (
        <Loading />
      ) : events.error ? (
        <ErrorMessage error={events.error} />
      ) : events.data.items.length === 0 ? (
        <Empty title="Sin eventos para el filtro seleccionado" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Eventos de auditoría</caption>
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Fecha
                </th>
                <th scope="col" className="px-3 py-2">
                  Acción
                </th>
                <th scope="col" className="px-3 py-2">
                  Recurso
                </th>
                <th scope="col" className="px-3 py-2">
                  Resultado
                </th>
                <th scope="col" className="px-3 py-2">
                  Actor (seudónimo)
                </th>
                <th scope="col" className="px-3 py-2">
                  requestId
                </th>
              </tr>
            </thead>
            <tbody>
              {events.data.items.map((ev) => (
                <tr key={ev.eventId} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(ev.timestamp).toLocaleString("es-PE")}
                  </td>
                  <td className="px-3 py-2">{ev.action}</td>
                  <td className="px-3 py-2 font-mono text-xs">{ev.resourceRef}</td>
                  <td className="px-3 py-2">{ev.outcome}</td>
                  <td className="px-3 py-2 font-mono text-xs">{ev.actorRef.slice(0, 12)}…</td>
                  <td className="px-3 py-2 font-mono text-xs">{ev.requestId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

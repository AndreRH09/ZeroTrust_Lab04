// HU-10 Consultar auditoría (extensión, CA-10.1, CA-10.2).
import { AuditEventType } from "@aqp/shared";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { EyeIcon, SearchIcon } from "../components/Icons";
import {
  Badge,
  btnPrimary,
  card,
  Empty,
  ErrorMessage,
  input,
  labelCls,
  Loading,
  PageHeader,
} from "../components/States";
import { api } from "../services/api";
import { AUDIT_EVENT_LABEL, AUDIT_OUTCOME } from "./statusLabels";

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
    <section aria-labelledby="titulo-auditoria" className="space-y-8">
      <PageHeader
        id="titulo-auditoria"
        eyebrow="Panel del auditor"
        title="Eventos de auditoría"
        description="Los actores aparecen con seudónimo; nunca se muestran tokens, correos ni identificadores reales."
      />

      <form
        onSubmit={onSubmit}
        aria-label="Filtros de auditoría"
        className={`${card} grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto]`}
      >
        <div>
          <label htmlFor="eventType" className={labelCls}>
            Tipo de evento
          </label>
          <select
            id="eventType"
            className={input}
            value={form.eventType}
            onChange={(e) => setForm({ ...form, eventType: e.target.value as AuditEventType })}
          >
            {AuditEventType.options.map((t) => (
              <option key={t} value={t}>
                {AUDIT_EVENT_LABEL[t]} ({t})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from" className={labelCls}>
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
          <label htmlFor="to" className={labelCls}>
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
          <button type="submit" className={`${btnPrimary} w-full`}>
            <SearchIcon className="size-4" />
            Filtrar
          </button>
        </div>
      </form>

      {events.isPending ? (
        <Loading />
      ) : events.error ? (
        <ErrorMessage error={events.error} />
      ) : events.data.items.length === 0 ? (
        <Empty
          title="Sin eventos para el filtro seleccionado"
          icon={<EyeIcon className="size-6" />}
        >
          Prueba con otro tipo de evento o amplía el rango de fechas.
        </Empty>
      ) : (
        <div className="space-y-3">
          <p aria-live="polite" className="text-sm text-stone-500">
            {events.data.items.length} evento(s) · {AUDIT_EVENT_LABEL[filter.eventType]}
          </p>
          {/* Enfocable: en pantallas angostas la tabla se desplaza y debe poder hacerse con teclado (WCAG 2.1.1). */}
          <div
            className={`${card} overflow-x-auto`}
            role="region"
            aria-label="Tabla de eventos (desplazable)"
            tabIndex={0}
          >
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Eventos de auditoría</caption>
              <thead className="border-b border-sand-200 bg-sand-50 text-xs font-semibold tracking-wide text-stone-600 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Fecha
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Acción
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Recurso
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Resultado
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Actor (seudónimo)
                  </th>
                  <th scope="col" className="px-4 py-3">
                    requestId
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sand-100">
                {events.data.items.map((ev) => (
                  <tr key={ev.eventId} className="align-top hover:bg-sand-50">
                    <td className="px-4 py-3 whitespace-nowrap text-stone-700">
                      {new Date(ev.timestamp).toLocaleString("es-PE")}
                    </td>
                    <td className="px-4 py-3 font-medium text-stone-900">{ev.action}</td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-700">{ev.resourceRef}</td>
                    <td className="px-4 py-3">
                      <Badge tone={AUDIT_OUTCOME[ev.outcome].tone}>
                        {AUDIT_OUTCOME[ev.outcome].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-700">
                      {ev.actorRef.slice(0, 12)}…
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-500">{ev.requestId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

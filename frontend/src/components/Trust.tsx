// Señales de confianza y pasos del flujo de donación. Cada afirmación corresponde a un control
// implementado (design.md §3, threat-model.md), no a un texto de marketing.
import type { ReactNode } from "react";
import { CheckIcon, EyeIcon, KeyIcon, LockIcon, ShieldIcon } from "./Icons";

export const TRUST_POINTS: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <LockIcon className="size-5" />,
    title: "Sin datos de pago",
    text: "Nunca pedimos tarjeta, CVV, cuenta bancaria ni DNI. Solo registras el monto.",
  },
  {
    icon: <KeyIcon className="size-5" />,
    title: "Identidad verificada",
    text: "Inicio de sesión con Amazon Cognito y PKCE; gestores y auditores usan MFA obligatorio.",
  },
  {
    icon: <ShieldIcon className="size-5" />,
    title: "Cada solicitud se verifica",
    text: "El servidor valida tu token y tus permisos en cada operación, sin confiar en la red.",
  },
  {
    icon: <EyeIcon className="size-5" />,
    title: "Trazabilidad",
    text: "Las acciones relevantes quedan auditadas con seudónimos, sin exponer tu identidad.",
  },
];

/** Lista compacta para paneles laterales. */
export function TrustList({ items = TRUST_POINTS.slice(0, 3) }: { items?: typeof TRUST_POINTS }) {
  return (
    <ul className="space-y-2.5 text-sm text-stone-700">
      {items.map((t) => (
        <li key={t.title} className="flex gap-2.5">
          <span className="mt-0.5 text-brand-600">{t.icon}</span>
          <span>
            <span className="font-semibold text-stone-900">{t.title}.</span> {t.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

const STEPS = ["Elige el monto", "Registra la intención", "Simula el resultado"] as const;

/** Indicador de pasos del flujo de donación (1–3; 4 = flujo completado). */
export function DonationSteps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <nav aria-label="Pasos de la donación">
      <ol className="hidden items-center gap-3 text-sm font-medium sm:flex">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          return (
            <li
              key={label}
              className="flex min-w-0 flex-1 items-center gap-2"
              aria-current={active ? "step" : undefined}
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  done
                    ? "bg-brand-700 text-white"
                    : active
                      ? "bg-coral-600 text-white"
                      : "bg-sand-200 text-stone-600"
                }`}
              >
                {done ? <CheckIcon className="size-4" /> : n}
              </span>
              <span className={`truncate ${active ? "text-stone-900" : "text-stone-500"}`}>
                {label}
              </span>
              {n < STEPS.length && <span aria-hidden="true" className="h-px flex-1 bg-sand-300" />}
            </li>
          );
        })}
      </ol>

      {/* Móvil: barra segmentada + texto completo (las etiquetas no caben en 375 px). */}
      <div className="sm:hidden">
        <div aria-hidden="true" className="flex gap-1.5">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={`h-1.5 flex-1 rounded-full ${
                i + 1 < current
                  ? "bg-brand-700"
                  : i + 1 === current
                    ? "bg-coral-600"
                    : "bg-sand-200"
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-sm font-medium text-stone-700">
          {current > STEPS.length
            ? "Flujo completado"
            : `Paso ${current} de ${STEPS.length} · ${STEPS[current - 1]}`}
        </p>
      </div>
    </nav>
  );
}

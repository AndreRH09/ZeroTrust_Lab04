import type { ReactNode } from "react";
import { userMessage } from "../services/api";
import { AlertIcon, InfoIcon } from "./Icons";

export function Spinner({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={`${className} animate-spin text-brand-600`}
    >
      <circle cx="12" cy="12" r="9" fill="none" strokeWidth="3" className="stroke-sand-200" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        className="stroke-current"
      />
    </svg>
  );
}

export function Loading({ label = "Cargando…" }: { label?: string }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-3 py-12 text-stone-600"
    >
      <Spinner />
      {label}
    </p>
  );
}

export function ErrorMessage({ error, action }: { error: unknown; action?: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
    >
      <AlertIcon className="mt-0.5 size-5 shrink-0" />
      <div>
        <p>{userMessage(error)}</p>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}

export function Empty({
  title,
  children,
  icon,
}: {
  title: string;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-sand-300 bg-white px-6 py-12 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        {icon ?? <InfoIcon className="size-6" />}
      </div>
      <p className="mt-4 font-semibold text-stone-900">{title}</p>
      {children ? <div className="mt-2 text-sm text-stone-600">{children}</div> : null}
    </div>
  );
}

/** Aviso destacado (simulación, privacidad). No usa role="alert": no es un error. */
export function Notice({
  children,
  tone = "amber",
  icon,
}: {
  children: ReactNode;
  tone?: "amber" | "brand";
  icon?: ReactNode;
}) {
  const tones = {
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    brand: "border-brand-100 bg-brand-50 text-brand-900",
  };
  return (
    <div className={`flex gap-3 rounded-xl border p-3.5 text-sm ${tones[tone]}`}>
      <span className="mt-0.5 shrink-0">{icon ?? <InfoIcon className="size-5" />}</span>
      <div>{children}</div>
    </div>
  );
}

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger";

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  const tones: Record<BadgeTone, string> = {
    neutral: "bg-stone-100 text-stone-700 ring-stone-200",
    brand: "bg-brand-50 text-brand-800 ring-brand-200",
    success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    warning: "bg-amber-50 text-amber-900 ring-amber-200",
    danger: "bg-red-50 text-red-800 ring-red-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Tarjeta de indicador (KPI) para cabeceras de página. */
export function Stat({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-sand-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-stone-600">
        {icon ? <span className="text-brand-600">{icon}</span> : null}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-stone-900 tabular-nums">
        {value}
      </div>
      {hint ? <p className="mt-0.5 text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}

export function PageHeader({
  id,
  title,
  description,
  actions,
  eyebrow,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">{eyebrow}</p>
        ) : null}
        <h1 id={id} className="mt-1 text-3xl font-bold tracking-tight text-balance text-stone-900">
          {title}
        </h1>
        {description ? <p className="mt-2 text-stone-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export const card = "rounded-2xl border border-sand-200 bg-white shadow-sm";

export const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
export const btnPrimary = `${btn} bg-brand-700 text-white shadow-sm hover:bg-brand-800`;
/** Acción de donar: el único botón coral de cada pantalla (punto focal). */
export const btnDonate = `${btn} bg-coral-600 text-white shadow-sm hover:bg-coral-700`;
export const btnSecondary = `${btn} border border-sand-300 bg-white text-stone-800 hover:bg-sand-100`;
export const btnDanger = `${btn} border border-red-300 bg-white text-red-700 hover:bg-red-50`;
export const btnGhost = `${btn} text-stone-700 hover:bg-sand-100`;
export const link =
  "font-medium text-brand-700 underline decoration-brand-300 underline-offset-4 hover:decoration-brand-700";
export const input =
  "mt-1.5 block w-full rounded-xl border border-sand-300 bg-white px-3.5 py-2.5 text-base text-stone-900 shadow-sm placeholder:text-stone-400 focus:border-brand-600 aria-[invalid=true]:border-red-600 aria-[invalid=true]:bg-red-50/40";
export const labelCls = "block text-sm font-semibold text-stone-800";

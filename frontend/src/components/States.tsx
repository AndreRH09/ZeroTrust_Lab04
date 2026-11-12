import type { ReactNode } from "react";
import { userMessage } from "../services/api";

export function Loading({ label = "Cargando…" }: { label?: string }) {
  return (
    <p role="status" aria-live="polite" className="py-8 text-center text-slate-600">
      {label}
    </p>
  );
}

export function ErrorMessage({ error, action }: { error: unknown; action?: ReactNode }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
      <p>{userMessage(error)}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {children ? <div className="mt-2 text-sm text-slate-600">{children}</div> : null}
    </div>
  );
}

export const btn =
  "inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
export const btnPrimary = `${btn} bg-teal-700 text-white hover:bg-teal-800`;
export const btnSecondary = `${btn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-100`;
export const btnDanger = `${btn} bg-red-700 text-white hover:bg-red-800`;
export const input =
  "mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base shadow-sm focus:border-teal-600 aria-[invalid=true]:border-red-600";

import { formatPEN } from "../lib/money";

/** Barra de progreso accesible; el porcentaje puede superar 100 (CA-09.1). */
export function ProgressBar({
  confirmedCents,
  goalCents,
  label,
}: {
  confirmedCents: number;
  goalCents: number;
  label: string;
}) {
  const pct = goalCents > 0 ? Math.floor((confirmedCents * 100) / goalCents) : 0;
  const width = Math.min(pct, 100);
  return (
    <div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={width}
        aria-valuetext={`${pct}% de la meta: ${formatPEN(confirmedCents)} de ${formatPEN(goalCents)}`}
        className="h-3 w-full overflow-hidden rounded-full bg-slate-200"
      >
        <div className="h-full rounded-full bg-teal-600" style={{ width: `${width}%` }} />
      </div>
      <p className="mt-1 text-sm text-slate-700">
        <span className="font-semibold">{formatPEN(confirmedCents)}</span> confirmado (simulado) de{" "}
        {formatPEN(goalCents)} · {pct}%
      </p>
    </div>
  );
}

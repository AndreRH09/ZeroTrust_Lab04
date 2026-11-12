import { formatPEN } from "../lib/money";

/**
 * Barra de progreso accesible; el porcentaje puede superar 100 (CA-09.1).
 * Se dibuja con SVG (atributo `width`), no con `style`: la CSP `style-src 'self'` de CloudFront
 * bloquea los estilos en línea y la barra quedaría vacía en producción (CA-NF11.2).
 */
export function ProgressBar({
  confirmedCents,
  goalCents,
  label,
  size = "md",
}: {
  confirmedCents: number;
  goalCents: number;
  label: string;
  size?: "md" | "lg";
}) {
  const pct = goalCents > 0 ? Math.floor((confirmedCents * 100) / goalCents) : 0;
  const width = Math.min(pct, 100);
  const reached = pct >= 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-stone-600">
          <span
            className={`font-bold tracking-tight text-stone-900 tabular-nums ${size === "lg" ? "text-2xl" : "text-lg"}`}
          >
            {formatPEN(confirmedCents)}
          </span>{" "}
          confirmado (simulado)
        </p>
        <p
          className={`shrink-0 text-sm font-semibold tabular-nums ${reached ? "text-emerald-700" : "text-brand-700"}`}
        >
          {pct}%
        </p>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={width}
        aria-valuetext={`${pct}% de la meta: ${formatPEN(confirmedCents)} de ${formatPEN(goalCents)}`}
        className="mt-2"
      >
        <svg
          aria-hidden="true"
          focusable="false"
          className={`block w-full ${size === "lg" ? "h-3" : "h-2.5"}`}
        >
          <rect width="100%" height="100%" rx="6" className="fill-sand-200" />
          {width > 0 && (
            <rect
              width={`${width}%`}
              height="100%"
              rx="6"
              className={reached ? "fill-emerald-600" : "fill-brand-600"}
            />
          )}
        </svg>
      </div>
      <p className="mt-2 text-sm text-stone-600">
        Meta: <span className="font-semibold text-stone-800">{formatPEN(goalCents)}</span>
      </p>
    </div>
  );
}

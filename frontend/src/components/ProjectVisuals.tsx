// Portada ilustrada por categoría (sin imágenes externas: CSP img-src 'self').
import { type ReactNode, useId } from "react";
import { type Category, CATEGORY_LABEL } from "../lib/category";
import { BookIcon, BowlIcon, HealthIcon, HeartIcon } from "./Icons";

const THEME: Record<Category, { bg: string; dot: string; icon: (c: string) => ReactNode }> = {
  educacion: {
    bg: "from-sky-100 via-brand-50 to-brand-100",
    dot: "fill-sky-300/50",
    icon: (c) => <BookIcon className={c} />,
  },
  alimentacion: {
    bg: "from-amber-100 via-coral-50 to-coral-100",
    dot: "fill-coral-300/40",
    icon: (c) => <BowlIcon className={c} />,
  },
  salud: {
    bg: "from-emerald-100 via-brand-50 to-emerald-50",
    dot: "fill-emerald-300/50",
    icon: (c) => <HealthIcon className={c} />,
  },
  otro: {
    bg: "from-sand-100 via-white to-brand-50",
    dot: "fill-brand-200/60",
    icon: (c) => <HeartIcon className={c} />,
  },
};

export function ProjectCover({
  category,
  size = "md",
  children,
}: {
  category: Category;
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
}) {
  const t = THEME[category];
  const patternId = `dots${useId().replace(/:/g, "")}`;
  const h = { sm: "h-20", md: "h-36", lg: "h-48 sm:h-60" }[size];
  const iconBox = { sm: "size-10", md: "size-14", lg: "size-20" }[size];
  const icon = { sm: "size-5", md: "size-7", lg: "size-10" }[size];
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${t.bg} ${h}`}>
      <svg aria-hidden="true" focusable="false" className="absolute inset-0 size-full">
        <defs>
          <pattern id={patternId} width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.6" className={t.dot} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`flex ${iconBox} items-center justify-center rounded-2xl bg-white/85 text-brand-700 shadow-sm ring-1 ring-white`}
        >
          {t.icon(icon)}
        </div>
      </div>
      {children}
    </div>
  );
}

export function CategoryTag({ category }: { category: Category }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-brand-800 shadow-sm ring-1 ring-brand-100">
      {CATEGORY_LABEL[category]}
    </span>
  );
}

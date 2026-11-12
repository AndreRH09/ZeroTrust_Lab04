import { Link, NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/useAuth";
import { InfoIcon, LogoMark, LogoutIcon, UserIcon } from "./Icons";
import { btnGhost, btnPrimary } from "./States";
import { TRUST_POINTS } from "./Trust";

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
    isActive
      ? "bg-brand-50 text-brand-800"
      : "text-stone-600 hover:bg-sand-100 hover:text-stone-900"
  }`;

const ROLE_LABEL: Record<string, string> = {
  DONANTE: "Donante",
  GESTOR: "Gestor",
  AUDITOR: "Auditor",
};

export function Layout() {
  const { isAuthenticated, groups, login, logout, configured } = useAuth();
  // Ocultar opciones es solo usabilidad; el backend valida rol y propietario (CA-NF02.2).
  const has = (g: string) => groups.includes(g);
  const roles = groups.filter((g) => g in ROLE_LABEL).map((g) => ROLE_LABEL[g]);

  return (
    <div className="flex min-h-screen flex-col bg-sand-50 text-stone-900">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:shadow-lg"
      >
        Saltar al contenido
      </a>

      <div
        role="note"
        className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-sm text-amber-950"
      >
        <InfoIcon className="hidden size-4 shrink-0 sm:block" />
        <span>Prototipo académico — sin pagos reales. Las donaciones son simuladas.</span>
      </div>

      <header className="sticky top-0 z-40 border-b border-sand-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5 rounded-lg">
            <LogoMark />
            <span className="leading-tight">
              <span className="block text-base font-extrabold tracking-tight text-brand-800">
                AQP-SOLIDARIA
              </span>
              <span className="block text-xs text-stone-500">Fundación · Arequipa</span>
            </span>
          </Link>

          <nav
            aria-label="Principal"
            className="order-last -mx-1 flex w-full gap-1 overflow-x-auto px-1 md:order-none md:w-auto md:flex-1"
          >
            <NavLink to="/" end className={linkCls}>
              Proyectos
            </NavLink>
            {isAuthenticated && has("DONANTE") && (
              <NavLink to="/donations" className={linkCls}>
                Mis donaciones
              </NavLink>
            )}
            {isAuthenticated && has("GESTOR") && (
              <NavLink to="/manage" className={linkCls}>
                Gestionar
              </NavLink>
            )}
            {isAuthenticated && has("AUDITOR") && (
              <NavLink to="/audit" className={linkCls}>
                Auditoría
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {isAuthenticated && roles.length > 0 && (
              <span className="hidden items-center gap-1.5 rounded-full bg-sand-100 px-3 py-1.5 text-xs font-semibold text-stone-700 sm:inline-flex">
                <UserIcon className="size-4" />
                <span className="sr-only">Rol: </span>
                {roles.join(" · ")}
              </span>
            )}
            {configured &&
              (isAuthenticated ? (
                <button type="button" className={btnGhost} onClick={() => void logout()}>
                  <LogoutIcon className="size-4" />
                  Cerrar sesión
                </button>
              ) : (
                <button type="button" className={btnPrimary} onClick={() => void login()}>
                  Iniciar sesión
                </button>
              ))}
          </div>
        </div>
      </header>

      <main
        id="contenido"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 focus:outline-none sm:py-10"
      >
        <Outlet />
      </main>

      <footer className="mt-12 bg-brand-950 text-brand-100 [--focus-ring:var(--color-amber-300)]">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              <LogoMark className="size-8" />
              <span className="font-extrabold tracking-tight text-white">AQP-SOLIDARIA</span>
            </div>
            <p className="mt-3 text-sm text-brand-200">
              Proyectos sociales de educación, alimentación y salud comunitaria en Arequipa, con
              transparencia en cada sol registrado.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Seguridad Zero Trust</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-brand-200">
              {TRUST_POINTS.map((t) => (
                <li key={t.title}>{t.title}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Aviso</h2>
            <p className="mt-3 text-sm text-brand-200">
              Fundación AQP-SOLIDARIA (ficticia) · Proyecto académico EPIS-UNSA. Un despliegue real
              exigiría evaluación legal (Ley N.º 29733 de Protección de Datos Personales),
              privacidad y retención.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

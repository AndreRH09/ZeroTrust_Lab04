import { NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/useAuth";
import { btnPrimary, btnSecondary } from "./States";

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `rounded px-2 py-1 text-sm font-medium ${isActive ? "bg-teal-50 text-teal-800" : "text-slate-700 hover:text-teal-800"}`;

export function Layout() {
  const { isAuthenticated, groups, login, logout, configured } = useAuth();
  // Ocultar opciones es solo usabilidad; el backend valida rol y propietario (CA-NF02.2).
  const has = (g: string) => groups.includes(g);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Saltar al contenido
      </a>

      <div role="note" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
        Prototipo académico — sin pagos reales. Las donaciones son simuladas.
      </div>

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <NavLink to="/" className="text-lg font-bold text-teal-800">
            AQP-SOLIDARIA
          </NavLink>
          <nav aria-label="Principal" className="flex flex-wrap items-center gap-1">
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
            {configured &&
              (isAuthenticated ? (
                <button type="button" className={btnSecondary} onClick={() => void logout()}>
                  Cerrar sesión
                </button>
              ) : (
                <button type="button" className={btnPrimary} onClick={() => void login()}>
                  Iniciar sesión
                </button>
              ))}
          </nav>
        </div>
      </header>

      <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-600">
        Fundación AQP-SOLIDARIA (ficticia) · Proyecto académico EPIS-UNSA. Un despliegue real
        exigiría evaluación legal (Ley N.º 29733 de Protección de Datos Personales), privacidad y
        retención.
      </footer>
    </div>
  );
}

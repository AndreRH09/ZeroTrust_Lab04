import type { ReactNode } from "react";
import { useLocation } from "react-router";
import { useAuth } from "../auth/useAuth";
import { LockIcon } from "./Icons";
import { btnPrimary, Empty } from "./States";

/** Guard de UX: pide iniciar sesión. No es un control de acceso (lo es el backend). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, login, configured } = useAuth();
  const location = useLocation();
  if (isAuthenticated) return <>{children}</>;
  return (
    <div className="mx-auto max-w-lg">
      <Empty title="Necesitas iniciar sesión para continuar" icon={<LockIcon className="size-6" />}>
        <p>Tu sesión se verifica en el servidor en cada solicitud.</p>
        {configured ? (
          <button
            type="button"
            className={`${btnPrimary} mt-5`}
            onClick={() => void login(location.pathname)}
          >
            Iniciar sesión
          </button>
        ) : (
          <p className="mt-3">
            La autenticación no está configurada (revisa las variables VITE_*).
          </p>
        )}
      </Empty>
    </div>
  );
}

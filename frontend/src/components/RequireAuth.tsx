import type { ReactNode } from "react";
import { useLocation } from "react-router";
import { useAuth } from "../auth/useAuth";
import { btnPrimary, Empty } from "./States";

/** Guard de UX: pide iniciar sesión. No es un control de acceso (lo es el backend). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, login, configured } = useAuth();
  const location = useLocation();
  if (isAuthenticated) return <>{children}</>;
  return (
    <Empty title="Necesitas iniciar sesión para continuar">
      {configured ? (
        <button
          type="button"
          className={`${btnPrimary} mt-3`}
          onClick={() => void login(location.pathname)}
        >
          Iniciar sesión
        </button>
      ) : (
        <p>La autenticación no está configurada (revisa las variables VITE_*).</p>
      )}
    </Empty>
  );
}

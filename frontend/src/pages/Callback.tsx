// Retorno de managed login: intercambia el código (PKCE) por tokens que quedan en memoria.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth/useAuth";
import { Loading } from "../components/States";

export function Callback() {
  const { userManager } = useAuth();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    if (!userManager || done.current) return;
    done.current = true;
    userManager
      .signinRedirectCallback()
      .then((user) => {
        const state = user.state as { returnTo?: string } | undefined;
        const returnTo = state?.returnTo?.startsWith("/") ? state.returnTo : "/";
        navigate(returnTo === "/callback" ? "/" : returnTo, { replace: true });
      })
      .catch(() => setFailed(true));
  }, [userManager, navigate]);

  if (failed) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
      >
        No se pudo completar el inicio de sesión. Vuelve a intentarlo.
      </div>
    );
  }
  return <Loading label="Completando inicio de sesión…" />;
}

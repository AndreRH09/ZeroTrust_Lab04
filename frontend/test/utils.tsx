import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthContext, type AuthState } from "../src/auth/AuthProvider";

export function fakeAuth(over: Partial<AuthState> = {}): AuthState {
  return {
    user: null,
    isAuthenticated: true,
    groups: ["DONANTE"],
    configured: true,
    userManager: null,
    login: async () => {},
    logout: async () => {},
    accessToken: () => "token-de-prueba",
    ...over,
  };
}

export function renderAt(
  path: string,
  routePath: string,
  element: ReactElement,
  auth: AuthState = fakeAuth(),
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={routePath} element={element} />
            <Route path="*" element={<p>otra-ruta</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

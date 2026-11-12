import type { User, UserManager } from "oidc-client-ts";
import { createContext, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { isConfigured } from "../config";
import { createUserManager, groupsFromAccessToken, logout as doLogout } from "./oidc";

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  /** Solo para mostrar u ocultar opciones; la autorización real ocurre en el backend. */
  groups: string[];
  configured: boolean;
  userManager: UserManager | null;
  login: (returnTo?: string) => Promise<void>;
  logout: () => Promise<void>;
  accessToken: () => string | null;
}

export const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({
  children,
  userManager,
}: {
  children: ReactNode;
  userManager?: UserManager;
}) {
  const configured = isConfigured() || Boolean(userManager);
  const um = useMemo(
    () => userManager ?? (configured ? createUserManager() : null),
    [userManager, configured],
  );
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!um) return;
    const onLoaded = (u: User) => setUser(u);
    const onUnloaded = () => setUser(null);
    um.events.addUserLoaded(onLoaded);
    um.events.addUserUnloaded(onUnloaded);
    um.events.addAccessTokenExpired(onUnloaded);
    um.events.addSilentRenewError(onUnloaded);
    void um.getUser().then((u) => setUser(u && !u.expired ? u : null));
    return () => {
      um.events.removeUserLoaded(onLoaded);
      um.events.removeUserUnloaded(onUnloaded);
      um.events.removeAccessTokenExpired(onUnloaded);
      um.events.removeSilentRenewError(onUnloaded);
    };
  }, [um]);

  const login = useCallback(
    async (returnTo?: string) => {
      if (!um) return;
      await um.signinRedirect({ state: { returnTo: returnTo ?? window.location.pathname } });
    },
    [um],
  );

  const logout = useCallback(async () => {
    if (!um) return;
    const url = await doLogout(um);
    setUser(null);
    window.location.assign(url);
  }, [um]);

  const accessToken = useCallback(() => (user && !user.expired ? user.access_token : null), [user]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isAuthenticated: Boolean(user && !user.expired),
      groups: groupsFromAccessToken(user?.access_token),
      configured,
      userManager: um,
      login,
      logout,
      accessToken,
    }),
    [user, configured, um, login, logout, accessToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

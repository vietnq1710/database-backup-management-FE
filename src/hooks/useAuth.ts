import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { getUserFromToken, logoutWithKeycloak } from "@/lib/keycloak";
import { LOGIN_PATH } from "@/const";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = LOGIN_PATH } =
    options ?? {};

  const navigate = useNavigate();

  // Thông tin user nằm ngay trong claims của access token Keycloak
  const user = useMemo(() => getUserFromToken(), []);

  const logout = useCallback(() => {
    logoutWithKeycloak();
  }, []);

  useEffect(() => {
    if (redirectOnUnauthenticated && !user) {
      const currentPath = window.location.pathname;
      if (currentPath !== redirectPath) {
        navigate(redirectPath);
      }
    }
  }, [redirectOnUnauthenticated, user, navigate, redirectPath]);

  return useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading: false,
      error: null,
      logout,
      refresh: () => undefined,
    }),
    [user, logout],
  );
}

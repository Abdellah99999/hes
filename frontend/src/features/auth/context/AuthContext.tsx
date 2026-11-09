import React, { useState, useEffect, useCallback } from "react";
import {
  customFetch,
  getAccessToken,
  setAccessToken,
} from "../../../lib/api-client";
import { LoginFormData } from "../schemas/auth.schema";
import { AuthContext, User } from "./auth-context.types";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pendingTwoFactor, setPendingTwoFactor] = useState<{
    enrolled: boolean;
    tempToken?: string;
    setupSecret?: string;
    otpauthUrl?: string;
  } | null>(null);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const userProfile = await customFetch<User>("/auth/me");
      setUser(userProfile);
    } catch {
      setUser(null);
      setAccessToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    if (!getAccessToken()) {
      setIsLoading(false);
      return;
    }

    try {
      const result = await customFetch<{
        user: User;
        tokens: { accessToken: string };
      }>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({}),
      });

      setAccessToken(result.tokens.accessToken);
      setUser(result.user);
    } catch {
      setUser(null);
      setAccessToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial session verification
    refreshSession();
  }, [refreshSession]);

  const login = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const result = await customFetch<{
        user: User;
        tokens?: { accessToken: string };
        requires2fa?: boolean;
        twoFactorEnrolled?: boolean;
        tempToken?: string;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      });

      if (result.requires2fa) {
        if (result.twoFactorEnrolled && result.tempToken) {
          setPendingTwoFactor({ enrolled: true, tempToken: result.tempToken });
        } else if (result.tokens?.accessToken) {
          setAccessToken(result.tokens.accessToken);
          const setup = await customFetch<{
            secret: string;
            otpauthUrl: string;
          }>("/auth/2fa/setup", { method: "POST" });
          setPendingTwoFactor({
            enrolled: false,
            setupSecret: setup.secret,
            otpauthUrl: setup.otpauthUrl,
          });
        } else {
          throw new Error(
            "Le parcours 2FA n'a pas fourni de jeton temporaire.",
          );
        }
        return;
      }

      if (!result.tokens?.accessToken) {
        throw new Error("Réponse de connexion invalide.");
      }
      setAccessToken(result.tokens.accessToken);
      setUser(result.user);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyTwoFactor = async (code: string) => {
    if (!pendingTwoFactor) {
      throw new Error("Aucun parcours 2FA en attente.");
    }

    const result = pendingTwoFactor.enrolled
      ? await customFetch<{
          user: User;
          tokens: { accessToken: string };
        }>("/auth/2fa/verify", {
          method: "POST",
          skipAuth: true,
          body: JSON.stringify({ tempToken: pendingTwoFactor.tempToken, code }),
        })
      : await customFetch<{
          user: User;
          tokens: { accessToken: string };
        }>("/auth/2fa/verify-setup", {
          method: "POST",
          body: JSON.stringify({ code }),
        });

    setAccessToken(result.tokens.accessToken);
    setUser(result.user);
    setPendingTwoFactor(null);
  };

  const logout = async () => {
    try {
      await customFetch("/auth/logout", { method: "POST" });
    } catch {
      // Ignore error on logout
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      if (user.role === "SUPER_ADMIN") return true;
      return user.permissions.includes(permission);
    },
    [user],
  );

  const hasAnyPermission = useCallback(
    (permissions: string[]): boolean => {
      if (!user) return false;
      if (user.role === "SUPER_ADMIN") return true;
      return permissions.some((p) => user.permissions.includes(p));
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        pendingTwoFactor,
        verifyTwoFactor,
        logout,
        refreshSession,
        fetchCurrentUser,
        hasPermission,
        hasAnyPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

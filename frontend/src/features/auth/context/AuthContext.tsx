import React, { useState, useEffect, useCallback } from "react";
import { customFetch, setAccessToken } from "../../../lib/api-client";
import { LoginFormData } from "../schemas/auth.schema";
import {
  AuthContext,
  User,
} from "./auth-context.types";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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
        tokens: { accessToken: string };
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      });

      setAccessToken(result.tokens.accessToken);
      setUser(result.user);
    } finally {
      setIsLoading(false);
    }
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

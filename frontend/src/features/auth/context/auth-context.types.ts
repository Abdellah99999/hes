import { createContext } from "react";
import { LoginFormData } from "../schemas/auth.schema";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: string;
  agencyId?: string | null;
  customerId?: string | null;
  isActive: boolean;
  tokenVersion?: number;
  isGlobalScope?: boolean;
  permissions: string[];
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginFormData) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

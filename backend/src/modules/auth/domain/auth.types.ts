export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  agencyId?: string | null;
  customerId?: string | null;
  tokenVersion: number;
  permissions: string[];
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  role: string;
  agencyId?: string | null;
  customerId?: string | null;
  isActive: boolean;
  tokenVersion: number;
  permissions: string[];
  isGlobalScope: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface AuthSession {
  user: AuthenticatedUser;
  tokens: TokenPair;
}

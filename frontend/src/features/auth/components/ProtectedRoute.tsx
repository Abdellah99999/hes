import { useAuth } from "../hooks/useAuth";
import { ShieldAlert, Loader2 } from "lucide-react";

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermissions?: string[];
  fallbackUrl?: string;
  onUnauthorized?: () => void;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermissions = [],
  fallbackUrl = "/login",
}) => {
  const { user, isAuthenticated, isLoading, hasPermission } = useAuth();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm">Vérification de la session en cours...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    if (
      typeof window !== "undefined" &&
      process.env.NODE_ENV !== "test" &&
      window.location.pathname !== fallbackUrl
    ) {
      window.location.href = fallbackUrl;
    }
    return (
      <div
        data-testid="unauthenticated-redirect"
        className="p-8 text-center text-slate-400"
      >
        <p>Redirection vers la page de connexion...</p>
      </div>
    );
  }

  if (requiredPermissions.length > 0) {
    const hasAll = requiredPermissions.every((perm) => hasPermission(perm));
    if (!hasAll) {
      return (
        <div
          data-testid="unauthorized-access"
          className="flex flex-col items-center justify-center p-12 text-center bg-rose-950/20 border border-rose-800/40 rounded-2xl m-6 backdrop-blur-md"
        >
          <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 mb-4">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-semibold text-rose-200 mb-1">
            Accès Refusé (HTTP 403)
          </h3>
          <p className="text-sm text-rose-300/80 max-w-md mb-4">
            Vous ne disposez pas des permissions requises pour accéder à cette
            ressource.
          </p>
          <div className="flex gap-2">
            {requiredPermissions.map((perm) => (
              <span
                key={perm}
                className="px-2.5 py-1 text-xs font-mono bg-rose-900/40 text-rose-300 rounded-md border border-rose-700/50"
              >
                {perm}
              </span>
            ))}
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginFormData } from "../schemas/auth.schema";
import { useAuth } from "../hooks/useAuth";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Truck,
} from "lucide-react";
import { APP_NAME } from "../../../lib/config";

export interface LoginPageProps {
  onSuccess?: () => void;
  onNavigateToForgotPassword?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSuccess,
  onNavigateToForgotPassword,
}) => {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      await login(data);
      onSuccess?.();
    } catch (err) {
      setServerError(
        (err as Error).message ||
          "Identifiants invalides ou service temporairement indisponible.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-8 font-sans">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 sm:p-8 shadow-sm">
        {/* En-tête de marque sobre */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-lg bg-blue-700 flex items-center justify-center text-white mb-3">
            <Truck className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {APP_NAME}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Connexion au portail logistique
          </p>
        </div>

        {/* Message d'erreur serveur */}
        {serverError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-start gap-2.5 text-red-700 dark:text-red-300 text-xs"
          >
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Échec de l'authentification</p>
              <p className="text-xs mt-0.5 opacity-90">{serverError}</p>
            </div>
          </div>
        )}

        {/* Formulaire de connexion */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          {/* Champ Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
            >
              Adresse Email Professionnelle
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="prenom.nom@hes.ma"
                {...register("email")}
                className={`w-full pl-9 pr-3 py-2.5 min-h-[44px] bg-white dark:bg-slate-950 border rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 text-base sm:text-sm focus:outline-none transition-colors ${
                  errors.email
                    ? "border-red-500 focus:border-red-600"
                    : "border-slate-300 dark:border-slate-700 focus:border-blue-700"
                }`}
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400 font-medium">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Champ Mot de passe */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1"
            >
              Mot de Passe
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••••••"
                {...register("password")}
                className={`w-full pl-9 pr-11 py-2.5 min-h-[44px] bg-white dark:bg-slate-950 border rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 text-base sm:text-sm focus:outline-none transition-colors ${
                  errors.password
                    ? "border-red-500 focus:border-red-600"
                    : "border-slate-300 dark:border-slate-700 focus:border-blue-700"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center min-h-[44px] min-w-[44px] justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                aria-label={
                  showPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400 font-medium">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Mémoriser cet appareil & Mot de passe oublié sur la même ligne */}
          <div className="flex items-center justify-between text-xs pt-1">
            <div className="flex items-center gap-2">
              <input
                id="rememberMe"
                type="checkbox"
                {...register("rememberMe")}
                className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
              />
              <label
                htmlFor="rememberMe"
                className="text-slate-600 dark:text-slate-400 select-none cursor-pointer"
              >
                Mémoriser cet appareil
              </label>
            </div>
            <button
              type="button"
              onClick={onNavigateToForgotPassword}
              className="text-blue-700 dark:text-blue-400 hover:underline font-medium"
            >
              Mot de passe oublié ?
            </button>
          </div>

          {/* Bouton de soumission pleine largeur ≥ 44px */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-[44px] h-11 px-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors text-sm mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Connexion en cours...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Se connecter en toute sécurité</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;

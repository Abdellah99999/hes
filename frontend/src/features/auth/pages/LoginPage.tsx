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
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 px-4 py-12 relative overflow-hidden font-sans">
      {/* Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800/80 rounded-2xl p-8 backdrop-blur-xl shadow-2xl relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25 mb-4">
            <Truck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            {APP_NAME}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Connexion sécurisée au réseau national de transport
          </p>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-3 text-rose-300 text-sm"
          >
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Échec de l'authentification</p>
              <p className="text-xs text-rose-300/80 mt-0.5">{serverError}</p>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {/* Email Field */}
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2"
            >
              Adresse Email Professionnelle
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="prenom.nom@hes-logistics.com"
                {...register("email")}
                className={`w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 transition-all ${
                  errors.email
                    ? "border-rose-500/70 focus:ring-rose-500/30"
                    : "border-slate-800 focus:border-blue-500 focus:ring-blue-500/20"
                }`}
              />
            </div>
            {errors.email && (
              <p className="mt-1.5 text-xs text-rose-400 font-medium">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-300 uppercase tracking-wider"
              >
                Mot de Passe
              </label>
              <button
                type="button"
                onClick={onNavigateToForgotPassword}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Mot de passe oublié ?
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••••••"
                {...register("password")}
                className={`w-full pl-10 pr-11 py-2.5 bg-slate-950/60 border rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 transition-all ${
                  errors.password
                    ? "border-rose-500/70 focus:ring-rose-500/30"
                    : "border-slate-800 focus:border-blue-500 focus:ring-blue-500/20"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
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
              <p className="mt-1.5 text-xs text-rose-400 font-medium">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Remember Me */}
          <div className="flex items-center gap-2">
            <input
              id="rememberMe"
              type="checkbox"
              {...register("rememberMe")}
              className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-blue-500/30 focus:ring-offset-slate-900"
            />
            <label
              htmlFor="rememberMe"
              className="text-xs text-slate-400 select-none cursor-pointer"
            >
              Mémoriser cet appareil de confiance
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all duration-200"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authentification en cours...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Se connecter en toute sécurité</span>
              </>
            )}
          </button>
        </form>

        {/* Security Badge */}
        <div className="mt-8 pt-6 border-t border-slate-800/60 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Chiffrement Argon2id & JWT Stateless avec Rotation</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  resetPasswordSchema,
  ResetPasswordFormData,
} from "../schemas/auth.schema";
import { customFetch } from "../../../lib/api-client";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
} from "lucide-react";

export interface ResetPasswordPageProps {
  token: string;
  onNavigateToLogin: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  token,
  onNavigateToLogin,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      await customFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token,
          newPassword: data.password,
        }),
      });
      setIsSuccess(true);
    } catch (err) {
      setServerError(
        (err as Error).message ||
          "Token de réinitialisation invalide ou expiré.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 px-4 py-12 relative overflow-hidden font-sans">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800/80 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20 mb-4">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Nouveau mot de passe
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Définissez un nouveau mot de passe fort pour votre compte.
          </p>
        </div>

        {isSuccess ? (
          <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-center space-y-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <div>
              <h3 className="font-semibold text-emerald-200">
                Mot de passe mis à jour !
              </h3>
              <p className="text-xs text-emerald-300/80 mt-1">
                Toutes vos anciennes sessions ont été révoquées par sécurité.
                Vous pouvez maintenant vous reconnecter.
              </p>
            </div>
            <button
              onClick={onNavigateToLogin}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-xl transition-colors shadow-lg shadow-emerald-600/20"
            >
              Se connecter maintenant
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {serverError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-center gap-2 text-rose-300 text-xs"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2"
              >
                Nouveau mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  {...register("password")}
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:border-teal-500 focus:ring-teal-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
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

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2"
              >
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  {...register("confirmPassword")}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:border-teal-500 focus:ring-teal-500/20"
                />
              </div>
              {errors.confirmPassword && (
                <p className="mt-1.5 text-xs text-rose-400 font-medium">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium rounded-xl shadow-lg shadow-teal-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Mise à jour en cours...</span>
                </>
              ) : (
                <span>Confirmer le nouveau mot de passe</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;

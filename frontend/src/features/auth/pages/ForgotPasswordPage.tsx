import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  forgotPasswordSchema,
  ForgotPasswordFormData,
} from "../schemas/auth.schema";
import { customFetch } from "../../../lib/api-client";
import {
  Mail,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
} from "lucide-react";

export interface ForgotPasswordPageProps {
  onNavigateToLogin: () => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({
  onNavigateToLogin,
}) => {
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      await customFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: data.email }),
      });
      setIsSuccess(true);
    } catch (err) {
      setServerError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 px-4 py-12 relative overflow-hidden font-sans">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800/80 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
        <button
          type="button"
          onClick={onNavigateToLogin}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à la connexion</span>
        </button>

        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 mb-4">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Mot de passe oublié
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Entrez votre email pour recevoir les instructions de
            réinitialisation.
          </p>
        </div>

        {isSuccess ? (
          <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-center space-y-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h3 className="font-semibold text-emerald-200">Demande traitée</h3>
            <p className="text-xs text-emerald-300/80 leading-relaxed">
              Si l'adresse correspond à un compte actif, un lien de
              réinitialisation sécurisé vous a été envoyé par email. Ce lien est
              valide pendant 60 minutes.
            </p>
            <button
              onClick={onNavigateToLogin}
              className="mt-2 text-xs font-medium text-emerald-400 underline hover:text-emerald-300"
            >
              Retourner à l'écran de connexion
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
                htmlFor="email"
                className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2"
              >
                Email professionnel
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  placeholder="nom@hes-logistics.com"
                  {...register("email")}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:border-amber-500 focus:ring-amber-500/20"
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs text-rose-400 font-medium">
                  {errors.email.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-medium rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Envoi des instructions...</span>
                </>
              ) : (
                <span>Envoyer le lien de réinitialisation</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;

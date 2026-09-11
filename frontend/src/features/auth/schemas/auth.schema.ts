import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({ required_error: "L'adresse email est requise" })
    .min(1, "L'adresse email est requise")
    .email("Format d'adresse email invalide"),
  password: z
    .string({ required_error: "Le mot de passe est requis" })
    .min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  rememberMe: z.boolean(),
});

export type LoginInput = z.input<typeof loginSchema>;
export type LoginFormData = z.output<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: "L'adresse email est requise" })
    .min(1, "L'adresse email est requise")
    .email("Format d'adresse email invalide"),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z
      .string({ required_error: "Le nouveau mot de passe est requis" })
      .min(8, "Le mot de passe doit contenir au moins 8 caractères")
      .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule")
      .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre")
      .regex(
        /[^a-zA-Z0-9]/,
        "Le mot de passe doit contenir au moins un caractère spécial",
      ),
    confirmPassword: z
      .string({ required_error: "Veuillez confirmer le mot de passe" })
      .min(1, "Veuillez confirmer le mot de passe"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

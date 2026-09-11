import { z } from "zod";

export const agencySchema = z.object({
  code: z
    .string()
    .min(2, "Le code doit comporter au moins 2 caractères")
    .max(10, "Le code ne doit pas dépasser 10 caractères")
    .regex(/^[A-Z0-9_-]+$/, "Le code doit être composé de majuscules, chiffres ou tirets"),
  name: z.string().min(2, "Le nom de l'agence est requis"),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email("Format d'email invalide").optional().or(z.literal("")),
  city: z.string().min(2, "La ville est requise"),
  address: z.string().optional().or(z.literal("")),
  isActive: z.boolean(),
});

export type AgencyFormData = z.infer<typeof agencySchema>;

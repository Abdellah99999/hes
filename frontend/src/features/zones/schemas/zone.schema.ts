import { z } from "zod";

export const zoneSchema = z.object({
  agencyId: z.string().optional().or(z.literal("")),
  code: z
    .string()
    .min(2, "Le code zone doit comporter au moins 2 caractères")
    .max(20, "Le code zone ne doit pas dépasser 20 caractères")
    .regex(/^[A-Z0-9_-]+$/, "Le code doit être composé de majuscules, chiffres ou tirets"),
  name: z.string().min(2, "Le nom de la zone est requis"),
  description: z.string().optional().or(z.literal("")),
  postalCodes: z.string().optional().or(z.literal("")),
  isActive: z.boolean(),
});

export type ZoneFormData = z.infer<typeof zoneSchema>;

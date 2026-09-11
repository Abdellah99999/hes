import { z } from "zod";

export const customerSchema = z.object({
  agencyId: z.string().optional().or(z.literal("")),
  customerTypeId: z.string().min(1, "Veuillez sélectionner un type de client valide"),
  code: z
    .string()
    .min(3, "Le code client doit comporter au moins 3 caractères")
    .max(30, "Le code ne peut dépasser 30 caractères")
    .regex(/^[A-Z0-9_-]+$/, "Lettres majuscules, chiffres et tirets uniquement (ex: CLI-AGA-001)"),
  legalName: z.string().min(2, "La raison sociale est requise"),
  tradeName: z.string().optional().or(z.literal("")),
  ice: z
    .string()
    .regex(/^[0-9]{15}$/, "L'ICE marocain doit contenir exactement 15 chiffres")
    .optional()
    .or(z.literal("")),
  taxId: z.string().optional().or(z.literal("")),
  email: z.string().email("Format d'email invalide").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "SUSPENDED", "PROSPECT"]),
  notes: z.string().optional().or(z.literal("")),
  initialManagerUserId: z.string().optional().or(z.literal("")),
  initialManagerReason: z.string().optional().or(z.literal("")),
});

export const assignManagerSchema = z.object({
  userId: z.string().min(1, "Veuillez sélectionner un collaborateur valide"),
  assignmentReason: z.string().min(3, "Le motif du changement de gestionnaire est requis"),
});

export const customerContactSchema = z.object({
  customerId: z.string().min(1),
  firstName: z.string().min(2, "Le prénom est requis"),
  lastName: z.string().min(2, "Le nom est requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  mobile: z.string().optional().or(z.literal("")),
  roleTitle: z.string().optional().or(z.literal("")),
  isPrimary: z.boolean(),
});

export type CustomerFormData = z.infer<typeof customerSchema>;
export type AssignManagerFormData = z.infer<typeof assignManagerSchema>;
export type CustomerContactFormData = z.infer<typeof customerContactSchema>;

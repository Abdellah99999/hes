import { z } from "zod";

export const addressSchema = z.object({
  agencyId: z.string().optional().or(z.literal("")),
  customerId: z.string().optional().or(z.literal("")),
  zoneId: z.string().optional().or(z.literal("")),
  type: z.enum(["BILLING", "DELIVERY", "HEADQUARTERS", "WAREHOUSE", "OTHER"]),
  title: z.string().min(2, "Le libellé de l'adresse est requis"),
  street: z.string().min(3, "La rue / adresse est requise"),
  additionalInfo: z.string().optional().or(z.literal("")),
  city: z.string().min(2, "La ville est requise"),
  postalCode: z.string().optional().or(z.literal("")),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  isDefault: z.boolean(),
});

export type AddressFormData = z.infer<typeof addressSchema>;

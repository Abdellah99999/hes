import { z } from "zod";

export const ServiceTypeEnum = z.enum(["STANDARD", "EXPRESS", "SAME_DAY"]);
export type ServiceType = z.infer<typeof ServiceTypeEnum>;

export const PaymentMethodEnum = z.enum([
  "PREPAID_CASH",
  "PREPAID_ACCOUNT",
  "CASH_ON_DELIVERY_COD",
]);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

export const ParcelStatusEnum = z.enum([
  "REGISTERED",
  "PICKED_UP",
  "IN_TRANSIT",
  "AT_HUB",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_FAILED",
  "RETURNED",
  "LOST",
  "DAMAGED",
  "CANCELLED",
]);
export type ParcelStatus = z.infer<typeof ParcelStatusEnum>;

export const ShipmentStatusEnum = z.enum([
  "DRAFT",
  "REGISTERED",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "PARTIALLY_DELIVERED",
  "RETURNED",
  "CANCELLED",
  "EXCEPTION",
]);
export type ShipmentStatus = z.infer<typeof ShipmentStatusEnum>;

// Item schema within a parcel
export const parcelItemSchema = z.object({
  description: z
    .string()
    .min(1, "La description de l'article est requise")
    .max(255),
  quantity: z
    .number({ invalid_type_error: "La quantité doit être un nombre entier" })
    .int("La quantité doit être un entier")
    .min(1, "La quantité minimale est 1")
    .optional(),
  declaredValue: z
    .number({ invalid_type_error: "La valeur déclarée doit être un nombre" })
    .min(0, "La valeur déclarée ne peut pas être négative")
    .optional(),
  hsCode: z.string().max(20).optional(),
});
export type ParcelItemFormData = z.infer<typeof parcelItemSchema>;

// Helper preprocessor for optional numbers
const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    if (typeof val === "number" && Number.isNaN(val)) return undefined;
    const n = Number(val);
    return Number.isNaN(n) ? undefined : n;
  }, schema.optional());

// Individual parcel schema
export const parcelSchema = z.object({
  parcelTypeId: z
    .string()
    .min(1, "Veuillez sélectionner un type/gabarit de colis"),
  weightKg: z.preprocess(
    (val) => (val === "" || val === null || (typeof val === "number" && Number.isNaN(val)) ? 0 : Number(val)),
    z
      .number({ invalid_type_error: "Le poids doit être un nombre valide" })
      .positive("Le poids réel doit être strictement supérieur à 0 kg")
      .max(1000, "Le poids maximal par colis est de 1000 kg"),
  ),
  lengthCm: optionalNumber(z.number().positive("La longueur doit être positive")),
  widthCm: optionalNumber(z.number().positive("La largeur doit être positive")),
  heightCm: optionalNumber(z.number().positive("La hauteur doit être positive")),
  notes: z.string().max(500).optional().nullable(),
  items: z.array(parcelItemSchema).optional(),
});
export type ParcelFormData = z.infer<typeof parcelSchema>;

// Step 1 : Expéditeur & Destinataire
export const step1Schema = z.object({
  senderCustomerId: z
    .string()
    .min(1, "Veuillez sélectionner un client expéditeur"),
  senderAddressId: z.string().optional().nullable(),
  destinationAgencyId: z
    .string()
    .min(1, "Veuillez sélectionner l'agence de destination"),
  recipientName: z
    .string()
    .min(2, "Le nom du destinataire doit comporter au moins 2 caractères")
    .max(100),
  recipientPhone: z
    .string()
    .min(6, "Le numéro de téléphone du destinataire est requis")
    .max(25),
  recipientEmail: z
    .string()
    .email("Format d'email invalide")
    .optional()
    .or(z.literal("")),
  recipientAddress: z
    .string()
    .min(3, "L'adresse de livraison est requise")
    .max(255),
  recipientCity: z
    .string()
    .min(2, "La ville de destination est requise")
    .max(100),
  recipientZoneId: z.string().optional().nullable(),
});
export type Step1FormData = z.infer<typeof step1Schema>;

// Step 2 : Multi-colis
export const step2Schema = z.object({
  parcels: z
    .array(parcelSchema)
    .min(1, "Une expédition doit contenir au moins un colis physique"),
});
export type Step2FormData = z.infer<typeof step2Schema>;

// Step 3 : Service, Facturation & Paiement
export const step3Schema = z.object({
  serviceType: ServiceTypeEnum.default("STANDARD"),
  paymentMethod: PaymentMethodEnum.default("PREPAID_CASH"),
  shippingFee: z.preprocess(
    (val) => (val === "" || val === null || (typeof val === "number" && Number.isNaN(val)) ? 0 : Number(val)),
    z
      .number({ invalid_type_error: "Les frais doivent être un montant valide" })
      .min(0, "Les frais de transport doivent être positifs ou nuls"),
  ),
  declaredValue: optionalNumber(
    z.number().min(0, "La valeur déclarée ne peut pas être négative"),
  ),
  codAmount: optionalNumber(
    z.number().min(0, "Le montant COD ne peut pas être négatif"),
  ),
  notes: z.string().max(1000).optional().nullable(),
});
export type Step3FormData = z.infer<typeof step3Schema>;

// Full creation schema
export const createShipmentSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema);

export type CreateShipmentFormData = z.infer<typeof createShipmentSchema>;

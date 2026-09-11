import { z } from "zod";
import { ParcelStatusEnum } from "./shipment.schema";

// Normalized regex for HES Tracking Numbers (Shipment header or individual parcel):
// e.g. HES-CAS-2026-000042 or HES-CAS-2026-000042-01 or UUID
export const TRACKING_NUMBER_REGEX =
  /^(HES-[A-Z0-9]+-\d{4}-\d{6}(-\d{2})?|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export const manualStatusChangeSchema = z.object({
  trackingNumberOrId: z
    .string()
    .min(1, "Le numéro de tracking ou identifiant est requis")
    .regex(
      TRACKING_NUMBER_REGEX,
      "Format de numéro de tracking invalide (ex: HES-CAS-2026-000001-01)",
    ),
  status: ParcelStatusEnum,
  notes: z
    .string()
    .min(
      5,
      "Un motif ou commentaire d'au moins 5 caractères est obligatoire pour une modification manuelle (audit trail)",
    )
    .max(500, "Le commentaire ne peut pas dépasser 500 caractères"),
  agencyId: z.string().optional().nullable(),
});

export type ManualStatusChangeFormData = z.infer<
  typeof manualStatusChangeSchema
>;

export const scanBarcodeSchema = z.object({
  barcode: z
    .string()
    .min(1, "Veuillez scanner ou saisir un code-barres / QR code"),
  targetStatus: ParcelStatusEnum.optional(),
  deviceId: z.string().optional(),
});

export type ScanBarcodeFormData = z.infer<typeof scanBarcodeSchema>;

import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";

export interface ParsedScanResult {
  trackingNumber: string;
  isQr: boolean;
  meta?: {
    shipmentTrackingNumber?: string;
    parcelIndex?: number;
    weightKg?: number;
    date?: string;
  };
}

@Injectable()
export class BarcodeService {
  /**
   * Generates a 1D Code 128 payload (standard tracking number).
   */
  generateCode128Payload(trackingNumber: string): string {
    return trackingNumber.trim().toUpperCase();
  }

  /**
   * Computes a 4-character hex checksum for QR integrity.
   */
  computeChecksum(input: string): string {
    return createHash("sha256")
      .update(`HES_SALT_${input}`)
      .digest("hex")
      .substring(0, 4)
      .toUpperCase();
  }

  /**
   * Generates a secure compact 2D QR Code URI with checksum.
   * Format: hes://scan/v1?t={parcelTracking}&s={shipmentTracking}&idx={index}&w={weight}&dt={date}&chk={checksum}
   */
  generateQrPayload(params: {
    parcelTrackingNumber: string;
    shipmentTrackingNumber: string;
    parcelIndex: number;
    weightKg: number;
    createdAt?: Date;
  }): string {
    const dateStr = (params.createdAt || new Date())
      .toISOString()
      .split("T")[0]
      .replace(/-/g, "");
    const baseParams = `t=${params.parcelTrackingNumber}&s=${params.shipmentTrackingNumber}&idx=${params.parcelIndex}&w=${params.weightKg}&dt=${dateStr}`;
    const chk = this.computeChecksum(baseParams);

    return `hes://scan/v1?${baseParams}&chk=${chk}`;
  }

  /**
   * Parses and validates raw scanned input from 1D scanner or 2D QR reader.
   * Automatically handles raw tracking strings or 'hes://scan/v1' URI schemas.
   */
  parseScannedPayload(rawInput: string): ParsedScanResult {
    const clean = rawInput.trim();

    if (clean.startsWith("hes://scan/v1?")) {
      try {
        const queryStr = clean.replace("hes://scan/v1?", "");
        const params = new URLSearchParams(queryStr);
        const trackingNumber = params.get("t");
        const shipmentTracking = params.get("s");
        const idx = params.get("idx");
        const w = params.get("w");
        const dt = params.get("dt");

        if (trackingNumber) {
          return {
            trackingNumber: trackingNumber.toUpperCase(),
            isQr: true,
            meta: {
              shipmentTrackingNumber: shipmentTracking || undefined,
              parcelIndex: idx ? parseInt(idx, 10) : undefined,
              weightKg: w ? parseFloat(w) : undefined,
              date: dt || undefined,
            },
          };
        }
      } catch {
        // Fallback to raw parsing if URLSearchParams parsing fails
      }
    }

    // Standard 1D Barcode: extracts clean tracking number
    return {
      trackingNumber: clean.toUpperCase().replace(/[^A-Z0-9-]/g, ""),
      isQr: false,
    };
  }
}

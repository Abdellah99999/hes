import { Injectable } from "@nestjs/common";
import * as crypto from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

@Injectable()
export class TotpService {
  /**
   * Encodes a Buffer to a Base32 string (RFC 4648)
   */
  base32Encode(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = "";
    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;
      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) {
      output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
  }

  /**
   * Decodes a Base32 string to Buffer
   */
  base32Decode(base32: string): Buffer {
    const clean = base32.toUpperCase().replace(/=+$/, "");
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];
    for (let i = 0; i < clean.length; i++) {
      const idx = BASE32_ALPHABET.indexOf(clean[i]);
      if (idx === -1) continue;
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return Buffer.from(bytes);
  }

  /**
   * Generates a new cryptographically secure 20-byte Base32 secret for TOTP
   */
  generateSecret(
    email: string,
    issuer = "HES-Logistics",
  ): { secret: string; otpauthUrl: string } {
    const randomBytes = crypto.randomBytes(20);
    const secret = this.base32Encode(randomBytes);
    const encodedIssuer = encodeURIComponent(issuer);
    const encodedEmail = encodeURIComponent(email);
    const otpauthUrl = `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;

    return { secret, otpauthUrl };
  }

  /**
   * Generates a 6-digit TOTP code for a given counter/offset
   */
  generateCode(secret: string, offset = 0, stepSec = 30): string {
    const key = this.base32Decode(secret);
    const epochSec = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epochSec / stepSec) + offset;
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter));

    const hmac = crypto.createHmac("sha1", key).update(buffer).digest();
    const dynamicOffset = hmac[hmac.length - 1] & 0x0f;
    const code =
      (((hmac[dynamicOffset] & 0x7f) << 24) |
        ((hmac[dynamicOffset + 1] & 0xff) << 16) |
        ((hmac[dynamicOffset + 2] & 0xff) << 8) |
        (hmac[dynamicOffset + 3] & 0xff)) %
      1_000_000;

    return code.toString().padStart(6, "0");
  }

  /**
   * Verifies a 6-digit TOTP code with standard ±1 time step tolerance (RFC 6238)
   */
  verifyCode(secret: string, code: string, window = 1): boolean {
    if (!secret || !code) return false;
    const trimmedCode = code.trim();
    if (!/^\d{6}$/.test(trimmedCode)) return false;

    for (let offset = -window; offset <= window; offset++) {
      if (this.generateCode(secret, offset) === trimmedCode) {
        return true;
      }
    }
    return false;
  }
}

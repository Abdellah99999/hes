import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";

@Injectable()
export class PasswordService {
  /**
   * Argon2id hashing configuration calibrated according to OWASP / ANSSI guidelines:
   * - memoryCost: 65536 KiB (64 MiB)
   * - timeCost: 3 iterations
   * - parallelism: 4 threads
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
}

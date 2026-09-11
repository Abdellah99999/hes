import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as crypto from "crypto";
import { JwtPayload, TokenPair } from "../domain/auth.types";

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  /**
   * Generates a SHA-256 hash of an opaque token for secure database storage.
   */
  hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Generates a cryptographically strong opaque token (UUIDv4)
   */
  generateOpaqueToken(): string {
    return crypto.randomUUID();
  }

  /**
   * Signs a short-lived Access Token (15 minutes)
   */
  async generateAccessToken(
    payload: Omit<JwtPayload, "iat" | "exp">,
  ): Promise<string> {
    return this.jwtService.signAsync(payload, {
      expiresIn: "15m",
    });
  }

  /**
   * Generates both Access Token and Opaque Refresh Token
   */
  async generateTokenPair(
    payload: Omit<JwtPayload, "iat" | "exp">,
  ): Promise<TokenPair> {
    const rawRefreshToken = this.generateOpaqueToken();
    const accessToken = await this.generateAccessToken(payload);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 900, // 15 minutes in seconds
      tokenType: "Bearer",
    };
  }

  /**
   * Verifies an Access Token JWT
   */
  async verifyAccessToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync<JwtPayload>(token);
  }
}

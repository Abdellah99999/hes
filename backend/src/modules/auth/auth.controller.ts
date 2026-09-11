import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Ip,
  Headers,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from "@nestjs/swagger";
import { Request, Response } from "express";
import { AuthService } from "./services/auth.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ForgotPasswordDto, ResetPasswordDto } from "./dto/forgot-password.dto";
import {
  AuthResponseDto,
  UserDto,
  MessageResponseDto,
} from "./dto/auth-response.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { Public } from "./decorators/public.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import { AuthenticatedUser } from "./domain/auth.types";

@ApiTags("Authentication & RBAC")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Authentification utilisateur avec émission de tokens",
    description:
      "Vérifie les identifiants avec Argon2id, gère le verrouillage progressif de compte et émet un Access Token court (15m) ainsi qu'un Refresh Token opaque.",
  })
  @ApiResponse({
    status: 200,
    description: "Authentification réussie",
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Identifiants invalides ou compte verrouillé/inactif",
  })
  @ApiResponse({
    status: 429,
    description: "Trop de tentatives (Rate limiting)",
  })
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers("user-agent") userAgent: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.login(dto, ip, userAgent);

    // Set secure httpOnly cookie for refresh token as defense-in-depth
    res.cookie("hes_refresh_token", result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return result;
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Rafraîchissement de tokens avec détection de rejeu",
    description:
      "Effectue la rotation du refresh token dans sa famille. Si un token révoqué est réutilisé, toute la famille est invalidée (détection de vol de session).",
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: "Token rafraîchi avec succès",
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Token révoqué, expiré ou réutilisation détectée",
  })
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() req: Request,
    @Ip() ip: string,
    @Headers("user-agent") userAgent: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const refreshToken =
      body.refreshToken || req.cookies?.["hes_refresh_token"];
    const result = await this.authService.refresh(refreshToken, ip, userAgent);

    res.cookie("hes_refresh_token", result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/auth",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Déconnexion et révocation de session",
    description:
      "Invalide le refresh token actif et purge le cookie de rafraîchissement.",
  })
  @ApiResponse({
    status: 200,
    description: "Déconnexion effectuée",
    type: MessageResponseDto,
  })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: Partial<RefreshTokenDto>,
    @Req() req: Request,
    @Ip() ip: string,
    @Headers("user-agent") userAgent: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponseDto> {
    const token = body?.refreshToken || req.cookies?.["hes_refresh_token"];
    const result = await this.authService.logout(user.id, token, ip, userAgent);

    res.clearCookie("hes_refresh_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/v1/auth",
    });

    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Profil utilisateur et permissions effectives",
    description:
      "Retourne les informations du compte connecté et ses permissions effectives calculées (rôle + overrides individuels).",
  })
  @ApiResponse({
    status: 200,
    description: "Profil et permissions",
    type: UserDto,
  })
  async getMe(@CurrentUser() user: AuthenticatedUser): Promise<UserDto> {
    return this.authService.getCurrentUserProfile(user.id);
  }

  @Public()
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Demande de réinitialisation de mot de passe",
    description:
      "Génère un token de réinitialisation à usage unique (1h). Réponse générique pour éviter l'énumération d'adresses email.",
  })
  @ApiResponse({
    status: 200,
    description: "Instructions envoyées",
    type: MessageResponseDto,
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Ip() ip: string,
    @Headers("user-agent") userAgent: string,
  ): Promise<MessageResponseDto> {
    return this.authService.forgotPassword(dto, ip, userAgent);
  }

  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Réinitialisation de mot de passe via token",
    description:
      "Valide le token, met à jour le hash Argon2id et révoque immédiatement toutes les sessions actives de l'utilisateur.",
  })
  @ApiResponse({
    status: 200,
    description: "Mot de passe réinitialisé",
    type: MessageResponseDto,
  })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Ip() ip: string,
    @Headers("user-agent") userAgent: string,
  ): Promise<MessageResponseDto> {
    return this.authService.resetPassword(dto, ip, userAgent);
  }
}

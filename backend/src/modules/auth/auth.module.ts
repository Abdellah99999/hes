import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./services/auth.service";
import { PasswordService } from "./services/password.service";
import { TokenService } from "./services/token.service";
import { AuditService } from "./services/audit.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { PermissionsGuard } from "./guards/permissions.guard";
import { RedisModule } from "../redis/redis.module";

@Global()
@Module({
  imports: [
    RedisModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(
          "security.jwtAccessSecret",
          "hes_jwt_access_secret_super_secure_key_change_in_production",
        ),
        signOptions: {
          expiresIn: "15m",
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    AuditService,
    JwtAuthGuard,
    PermissionsGuard,
  ],
  exports: [
    AuthService,
    PasswordService,
    TokenService,
    AuditService,
    JwtAuthGuard,
    PermissionsGuard,
    JwtModule,
  ],
})
export class AuthModule {}

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  ParseBoolPipe,
  Query,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { CreateUserDto, UpdateUserDto } from "./dto/user-crud.dto";
import { UserDto } from "../auth/dto/auth-response.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";

@ApiTags("User Management")
@ApiBearerAuth("JWT-auth")
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions("users:read")
  @ApiOperation({
    summary: "Liste de tous les utilisateurs (Permissions: users:read)",
  })
  @ApiResponse({ status: 200, type: [UserDto] })
  async getAllUsers(): Promise<UserDto[]> {
    return this.usersService.findAll();
  }

  @Get(":id")
  @RequirePermissions("users:read")
  @ApiOperation({ summary: "Détails d'un utilisateur par ID" })
  @ApiResponse({ status: 200, type: UserDto })
  async getUserById(@Param("id", ParseUUIDPipe) id: string): Promise<UserDto> {
    return this.usersService.findById(id);
  }

  @Post()
  @RequirePermissions("users:manage")
  @ApiOperation({
    summary: "Création d'un nouvel utilisateur (Permissions: users:manage)",
  })
  @ApiResponse({ status: 201, type: UserDto })
  async createUser(@Body() dto: CreateUserDto): Promise<UserDto> {
    return this.usersService.create(dto);
  }

  @Put(":id")
  @RequirePermissions("users:manage")
  @ApiOperation({ summary: "Mise à jour d'un utilisateur" })
  @ApiResponse({ status: 200, type: UserDto })
  async updateUser(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserDto> {
    return this.usersService.update(id, dto);
  }

  @Patch(":id/status")
  @RequirePermissions("users:manage")
  @ApiOperation({
    summary: "Activation / Désactivation d'un utilisateur",
    description:
      "Si désactivé, toutes les sessions actives sont révoquées immédiatement.",
  })
  @ApiResponse({ status: 200, type: UserDto })
  async toggleUserStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("active", ParseBoolPipe) active: boolean,
  ): Promise<UserDto> {
    return this.usersService.toggleActive(id, active);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/domain/auth.types";
import { CreateCustomerContactDto } from "./dto/create-customer-contact.dto";
import { UpdateCustomerContactDto } from "./dto/update-customer-contact.dto";
import { CustomerContactsUseCases } from "./application/customer-contacts.use-cases";

@ApiTags("Customer Contacts")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("customer-contacts")
export class CustomerContactsController {
  constructor(private readonly useCases: CustomerContactsUseCases) {}

  @Post()
  @RequirePermissions("customers:manage")
  @ApiOperation({ summary: "Créer un interlocuteur chez le client" })
  @ApiResponse({ status: 201, description: "Contact créé" })
  @ApiResponse({ status: 403, description: "Accès inter-agences refusé" })
  async create(
    @Body() dto: CreateCustomerContactDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.useCases.create(dto, user);
  }

  @Get("by-customer/:customerId")
  @RequirePermissions("customers:read")
  @ApiOperation({
    summary: "Lister tous les contacts d'un client (isolé par agence)",
  })
  async findByCustomer(
    @Param("customerId") customerId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.useCases.findByCustomerId(customerId, user);
  }

  @Get(":id")
  @RequirePermissions("customers:read")
  @ApiOperation({ summary: "Obtenir les détails d'un contact" })
  @ApiResponse({ status: 403, description: "Accès inter-agences refusé" })
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.useCases.findById(id, user);
  }

  @Patch(":id")
  @RequirePermissions("customers:manage")
  @ApiOperation({ summary: "Modifier un contact client" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateCustomerContactDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.useCases.update(id, dto, user);
  }

  @Delete(":id")
  @RequirePermissions("customers:manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Supprimer un contact (soft-delete)" })
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.useCases.delete(id, user);
  }
}

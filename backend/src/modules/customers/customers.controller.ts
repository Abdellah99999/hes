import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { AssignManagerDto } from "./dto/assign-manager.dto";
import { CustomerQueryDto } from "./dto/customer-query.dto";
import { CreateCustomerUseCase } from "./application/use-cases/create-customer.use-case";
import { UpdateCustomerUseCase } from "./application/use-cases/update-customer.use-case";
import { GetCustomerUseCase } from "./application/use-cases/get-customer.use-case";
import { ListCustomersUseCase } from "./application/use-cases/list-customers.use-case";
import { DeleteCustomerUseCase } from "./application/use-cases/delete-customer.use-case";
import { AssignCustomerManagerUseCase } from "./application/use-cases/assign-customer-manager.use-case";
import { GetCustomerManagerHistoryUseCase } from "./application/use-cases/get-customer-manager-history.use-case";

@ApiTags("Customers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("customers")
export class CustomersController {
  constructor(
    private readonly createCustomerUseCase: CreateCustomerUseCase,
    private readonly updateCustomerUseCase: UpdateCustomerUseCase,
    private readonly getCustomerUseCase: GetCustomerUseCase,
    private readonly listCustomersUseCase: ListCustomersUseCase,
    private readonly deleteCustomerUseCase: DeleteCustomerUseCase,
    private readonly assignCustomerManagerUseCase: AssignCustomerManagerUseCase,
    private readonly getCustomerManagerHistoryUseCase: GetCustomerManagerHistoryUseCase,
  ) {}

  @Post()
  @RequirePermissions("customers:manage")
  @ApiOperation({ summary: "Créer un nouveau client rattaché à une agence" })
  @ApiResponse({ status: 201, description: "Client créé avec succès" })
  @ApiResponse({ status: 409, description: "Code client déjà existant" })
  async create(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.createCustomerUseCase.execute(dto, user);
  }

  @Get()
  @RequirePermissions("customers:read")
  @ApiOperation({
    summary:
      "Lister les clients avec filtres et pagination (strictement cloisonné par agence)",
  })
  async findAll(
    @Query() query: CustomerQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.listCustomersUseCase.execute(query, user);
  }

  @Get(":id")
  @RequirePermissions("customers:read")
  @ApiOperation({ summary: "Consulter la fiche complète d'un client" })
  @ApiResponse({
    status: 403,
    description: "Tentative d'accès inter-agences non autorisé (audité)",
  })
  @ApiResponse({ status: 404, description: "Client introuvable" })
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.getCustomerUseCase.execute(id, user);
  }

  @Patch(":id")
  @RequirePermissions("customers:manage")
  @ApiOperation({ summary: "Modifier les informations d'un client" })
  @ApiResponse({
    status: 403,
    description: "Modification inter-agences interdite",
  })
  @ApiResponse({ status: 404, description: "Client introuvable" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.updateCustomerUseCase.execute(id, dto, user);
  }

  @Delete(":id")
  @RequirePermissions("customers:manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Suppression soft-delete d'un client" })
  @ApiResponse({
    status: 403,
    description: "Suppression inter-agences interdite",
  })
  @ApiResponse({ status: 404, description: "Client introuvable" })
  async remove(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.deleteCustomerUseCase.execute(id, user);
  }

  @Post(":id/managers")
  @RequirePermissions("customers:manage")
  @ApiOperation({
    summary:
      "Assigner ou changer le collaborateur interne responsable (clôture atomique de l'ancien + historique)",
  })
  @ApiResponse({ status: 201, description: "Responsable assigné" })
  @ApiResponse({ status: 403, description: "Accès inter-agences refusé" })
  async assignManager(
    @Param("id") id: string,
    @Body() dto: AssignManagerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignCustomerManagerUseCase.execute(id, dto, user);
  }

  @Get(":id/managers/history")
  @RequirePermissions("customers:read")
  @ApiOperation({
    summary:
      "Consulter l'historique chronologique complet des responsables internes du client",
  })
  async getManagerHistory(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.getCustomerManagerHistoryUseCase.execute(id, user);
  }
}

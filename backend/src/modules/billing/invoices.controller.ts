import {
  Controller,
  Post,
  Get,
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
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { CreateInvoiceUseCase } from "./application/use-cases/create-invoice.use-case";
import { ListInvoicesUseCase } from "./application/use-cases/list-invoices.use-case";
import { InvoiceStatus } from "@prisma/client";

@ApiTags("Facturation & Prestations (Phase 12a)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("invoices")
export class InvoicesController {
  constructor(
    private readonly createInvoiceUseCase: CreateInvoiceUseCase,
    private readonly listInvoicesUseCase: ListInvoicesUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions("billing:manage")
  @ApiOperation({
    summary:
      "Émettre une nouvelle facture de transport (Rôle Comptable / Superviseur)",
  })
  @ApiResponse({
    status: 201,
    description: "Facture générée avec calculs HT/TVA/TTC certifiés",
  })
  async createInvoice(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.createInvoiceUseCase.execute(dto, user);
  }

  @Get()
  @ApiOperation({
    summary:
      "Lister les factures (cloisonné selon rôle : client ne voit que les siennes)",
  })
  async listInvoices(
    @Query("status") status: InvoiceStatus,
    @Query("customerId") customerId: string,
    @Query("search") search: string,
    @Query("page") page: number,
    @Query("limit") limit: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.listInvoicesUseCase.execute(
      { status, customerId, search, page, limit },
      user,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Consulter le détail d'une facture et ses lignes" })
  async getInvoice(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.listInvoicesUseCase.getById(id, user);
  }
}

import {
  Controller,
  Post,
  Get,
  Body,
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
import { CreateReturnDto } from "./dto/create-return.dto";
import { RecoverReturnDto } from "./dto/recover-return.dto";
import { CreateReturnUseCase } from "./application/use-cases/create-return.use-case";
import { RecoverReturnUseCase } from "./application/use-cases/recover-return.use-case";
import { ListReturnsUseCase } from "./application/use-cases/list-returns.use-case";
import { ReturnStatus } from "@prisma/client";

@ApiTags("Returns & Reverse Logistics (Phase 10)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("returns")
export class ReturnsController {
  constructor(
    private readonly createReturnUseCase: CreateReturnUseCase,
    private readonly recoverReturnUseCase: RecoverReturnUseCase,
    private readonly listReturnsUseCase: ListReturnsUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions("returns:manage")
  @ApiOperation({
    summary: "Créer un dossier de retour manuellement ou suite à réclamation",
  })
  @ApiResponse({
    status: 201,
    description: "Dossier de retour créé avec succès",
  })
  async createReturn(
    @Body() dto: CreateReturnDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.createReturnUseCase.execute(dto, user);
  }

  @Post("recover")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Récupérer un colis retour par scan ou saisie manuelle du numéro BL/Tracking",
  })
  @ApiResponse({
    status: 200,
    description: "Colis de retour récupéré avec succès par le coursier",
  })
  async recoverReturn(
    @Body() dto: RecoverReturnDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.recoverReturnUseCase.execute(dto, user);
  }

  @Get()
  @ApiOperation({
    summary:
      "Lister les dossiers et items de retour (cloisonné selon agence ou livreur)",
  })
  async listReturns(
    @Query("status") status: ReturnStatus,
    @Query("originAgencyId") originAgencyId: string,
    @Query("destinationAgencyId") destinationAgencyId: string,
    @Query("search") search: string,
    @Query("page") page: number,
    @Query("limit") limit: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.listReturnsUseCase.execute(
      { status, originAgencyId, destinationAgencyId, search, page, limit },
      user,
    );
  }
}

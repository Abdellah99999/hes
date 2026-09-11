import {
  Controller,
  Get,
  Post,
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
import { RequestCollectionDto } from "./dto/request-collection.dto";
import { AssignCollectionDto } from "./dto/assign-collection.dto";
import { CompleteCollectionDto } from "./dto/complete-collection.dto";
import { CollectionQueryDto } from "./dto/collection-query.dto";
import { RequestCollectionUseCase } from "./application/use-cases/request-collection.use-case";
import { AssignCollectionUseCase } from "./application/use-cases/assign-collection.use-case";
import { CompleteCollectionUseCase } from "./application/use-cases/complete-collection.use-case";
import { ListCollectionsUseCase } from "./application/use-cases/list-collections.use-case";
import { GetCollectionUseCase } from "./application/use-cases/get-collection.use-case";

@ApiTags("Customer Collections & Enlèvements")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("collections")
export class CollectionsController {
  constructor(
    private readonly requestCollectionUseCase: RequestCollectionUseCase,
    private readonly assignCollectionUseCase: AssignCollectionUseCase,
    private readonly completeCollectionUseCase: CompleteCollectionUseCase,
    private readonly listCollectionsUseCase: ListCollectionsUseCase,
    private readonly getCollectionUseCase: GetCollectionUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      "Créer une demande d'enlèvement / collecte (Portail client ou agence)",
  })
  @ApiResponse({
    status: 201,
    description: "Demande d'enlèvement créée avec succès",
  })
  async requestCollection(
    @Body() dto: RequestCollectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requestCollectionUseCase.execute(dto, user);
  }

  @Get()
  @ApiOperation({
    summary:
      "Lister les collectes avec cloisonnement automatique selon le rôle (Client, Coursier, Dispatch)",
  })
  async listCollections(
    @Query() query: CollectionQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.listCollectionsUseCase.execute(query, user);
  }

  @Get("my-missions")
  @ApiOperation({
    summary:
      "Consulter la feuille de route du coursier connecté pour la journée",
  })
  async getMyMissions(
    @Query() query: CollectionQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Force courier filter on current user
    const courierQuery = { ...query, courierId: user.id };
    return this.listCollectionsUseCase.execute(courierQuery, user);
  }

  @Get(":id")
  @ApiOperation({
    summary:
      "Consulter le détail d'une demande de collecte et son expédition générée",
  })
  async getCollection(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.getCollectionUseCase.execute(id, user);
  }

  @Post(":id/assign")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("collections:manage")
  @ApiOperation({ summary: "Affecter une collecte à un coursier d'agence" })
  async assignCollection(
    @Param("id") id: string,
    @Body() dto: AssignCollectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignCollectionUseCase.execute(id, dto, user);
  }

  @Post(":id/complete")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Clôturer la collecte et générer automatiquement l'expédition et ses colis",
  })
  async completeCollection(
    @Param("id") id: string,
    @Body() dto: CompleteCollectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.completeCollectionUseCase.execute(id, dto, user);
  }
}

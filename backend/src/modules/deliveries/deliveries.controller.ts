import {
  Controller,
  Post,
  Get,
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
import { ConfirmDeliveryDto } from "./dto/confirm-delivery.dto";
import { RecordRefusalDto } from "./dto/record-refusal.dto";
import { RegisterDeferredPodDto } from "./dto/register-deferred-pod.dto";
import { ConfirmDeliveryUseCase } from "./application/use-cases/confirm-delivery.use-case";
import { RecordRefusalUseCase } from "./application/use-cases/record-refusal.use-case";
import { RegisterDeferredPodUseCase } from "./application/use-cases/register-deferred-pod.use-case";
import { RefusalReasonCode } from "@prisma/client";

@ApiTags("Deliveries, POD & Refusals (Phase 9)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("deliveries")
export class DeliveriesController {
  constructor(
    private readonly confirmDeliveryUseCase: ConfirmDeliveryUseCase,
    private readonly recordRefusalUseCase: RecordRefusalUseCase,
    private readonly registerDeferredPodUseCase: RegisterDeferredPodUseCase,
  ) {}

  @Get("refusal-reasons")
  @ApiOperation({
    summary: "Consulter la liste officielle et figée des motifs de refus",
  })
  async getRefusalReasons() {
    return Object.values(RefusalReasonCode).map((code) => ({
      code,
      label: this.formatRefusalLabel(code),
    }));
  }

  @Post(":parcelId/confirm")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Confirmer la livraison d'un colis avec capture obligatoire de preuve (POD)",
  })
  @ApiResponse({
    status: 200,
    description: "Livraison confirmée et POD enregistré",
  })
  async confirmDelivery(
    @Param("parcelId") parcelId: string,
    @Body() dto: ConfirmDeliveryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.confirmDeliveryUseCase.execute(parcelId, dto, user);
  }

  @Post(":parcelId/refuse")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      "Signaler le refus d'un colis (motif référentiel obligatoire, déclenche retour automatique)",
  })
  @ApiResponse({
    status: 200,
    description: "Refus enregistré et statut colis passé à RETURNED",
  })
  async recordRefusal(
    @Param("parcelId") parcelId: string,
    @Body() dto: RecordRefusalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.recordRefusalUseCase.execute(parcelId, dto, user);
  }

  @Post(":parcelId/deferred-pod")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("deliveries:manage")
  @ApiOperation({
    summary:
      "Enregistrer en différé le bon de livraison (BL) papier cacheté par l'agent",
  })
  @ApiResponse({
    status: 200,
    description: "POD différé enregistré par l'agent quai",
  })
  async registerDeferredPod(
    @Param("parcelId") parcelId: string,
    @Body() dto: RegisterDeferredPodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registerDeferredPodUseCase.execute(parcelId, dto, user);
  }

  private formatRefusalLabel(code: RefusalReasonCode): string {
    switch (code) {
      case RefusalReasonCode.DAMAGED_PACKAGE:
        return "Colis détérioré / emballage endommagé";
      case RefusalReasonCode.CONTENT_MISMATCH:
        return "Contenu non conforme à la commande";
      case RefusalReasonCode.COD_AMOUNT_DISPUTED:
        return "Montant COD contesté par le destinataire";
      case RefusalReasonCode.ORDER_CANCELLED:
        return "Commande préalablement annulée par l'acheteur";
      case RefusalReasonCode.REFUSED_WITHOUT_REASON:
        return "Refus pur et simple sans justification";
      case RefusalReasonCode.FRAUD_SUSPECTED:
        return "Suspicion de fraude ou faux destinataire";
      default:
        return code;
    }
  }
}

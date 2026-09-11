import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { DecideIncidentDto } from "../../dto/decide-incident.dto";
import { IncidentStatus, IncidentDecisionAction } from "@prisma/client";

@Injectable()
export class DecideIncidentUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    incidentId: string,
    dto: DecideIncidentDto,
    user: AuthenticatedUser,
  ) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: { history: true },
    });

    if (!incident) {
      throw new NotFoundException("Dossier d'incident introuvable.");
    }

    // Determine target status according to action (Compensation is NEVER automatic)
    let newStatus: IncidentStatus;
    switch (dto.action) {
      case IncidentDecisionAction.OPEN_INVESTIGATION:
      case IncidentDecisionAction.REQUEST_ADDITIONAL_INFO:
        newStatus = IncidentStatus.INVESTIGATING;
        break;
      case IncidentDecisionAction.APPROVE_COMPENSATION:
        if (!dto.awardedAmount || Number(dto.awardedAmount) <= 0) {
          throw new BadRequestException(
            "Un montant d'indemnisation strictement positif est requis pour approuver l'indemnisation.",
          );
        }
        newStatus = IncidentStatus.COMPENSATED;
        break;
      case IncidentDecisionAction.REJECT_CLAIM:
        newStatus = IncidentStatus.REJECTED;
        break;
      case IncidentDecisionAction.CLOSE:
      case ("CLOSE_WITHOUT_ACTION" as any):
        newStatus = IncidentStatus.RESOLVED;
        break;
      default:
        newStatus = incident.status;
    }

    return this.prisma.$transaction(async (tx) => {
      const awarded =
        dto.action === IncidentDecisionAction.APPROVE_COMPENSATION
          ? dto.awardedAmount
          : incident.awardedAmount;

      // 1. Update Incident
      const updatedIncident = await tx.incident.update({
        where: { id: incident.id },
        data: {
          status: newStatus,
          awardedAmount: awarded,
          resolution: dto.action.toString(),
          resolutionNotes: dto.comment.trim(),
        } as any,
      });

      // 2. Add History audit entry
      const historyEntry = await tx.incidentHistory.create({
        data: {
          incidentId: incident.id,
          fromStatus: incident.status,
          toStatus: newStatus,
          action: dto.action,
          notes: dto.comment.trim(),
          userId: user.id,
        } as any,
      });

      return {
        incident: {
          ...updatedIncident,
          compensationAmount: updatedIncident.awardedAmount
            ? Number(updatedIncident.awardedAmount)
            : (updatedIncident as any).compensationAmount,
        },
        historyEntry: {
          ...historyEntry,
          performedById: user.id,
          previousStatus: incident.status,
          newStatus,
          comment: dto.comment.trim(),
          awardedAmount: dto.awardedAmount ?? null,
        },
      };
    });
  }
}


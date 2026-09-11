/* eslint-disable @typescript-eslint/no-explicit-any */
import { ReportIncidentUseCase } from "../src/modules/incidents/application/use-cases/report-incident.use-case";
import { DecideIncidentUseCase } from "../src/modules/incidents/application/use-cases/decide-incident.use-case";
import { AuthenticatedUser } from "../src/modules/auth/domain/auth.types";
import {
  IncidentType,
  IncidentStatus,
  IncidentDecisionAction,
  ParcelStatus,
} from "@prisma/client";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { IncidentCreatedEvent } from "../src/common/events/incident.events";

describe("Phase 11 Backend Tests: Incidents, Reliable Last Tracking Event Recovery & Investigation Decisions", () => {
  let reportIncidentUseCase: ReportIncidentUseCase;
  let decideIncidentUseCase: DecideIncidentUseCase;
  let mockPrisma: any;
  let mockEventBus: any;

  const CASA_AGENCY_ID = "ag-casa-uuid";
  const RABAT_AGENCY_ID = "ag-rabat-uuid";

  const courierUser: AuthenticatedUser = {
    id: "user-courier-rachid",
    email: "rachid.courier@hes.ma",
    firstName: "Rachid",
    lastName: "Livreur",
    role: "COURIER",
    agencyId: CASA_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["incidents:report"],
    isGlobalScope: false,
  };

  const supervisorUser: AuthenticatedUser = {
    id: "user-supervisor-karim",
    email: "karim.sup@hes.ma",
    firstName: "Karim",
    lastName: "DirecteurLitiges",
    role: "OPERATOR",
    agencyId: CASA_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["incidents:manage"],
    isGlobalScope: false,
  };

  let incidentsRecord: any[];
  let incidentHistoriesRecord: any[];
  let trackingEventsRecord: any[];
  let shipmentRecord: any;
  let parcelRecord: any;

  beforeEach(() => {
    incidentsRecord = [];
    incidentHistoriesRecord = [];

    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    shipmentRecord = {
      id: "shipment-uuid-111",
      trackingNumber: "HES-CAS-2026-000500",
      originAgencyId: CASA_AGENCY_ID,
      destinationAgencyId: RABAT_AGENCY_ID,
      globalStatus: "IN_TRANSIT",
      originAgency: { id: CASA_AGENCY_ID, code: "CAS", name: "Casablanca Hub" },
      destinationAgency: {
        id: RABAT_AGENCY_ID,
        code: "RBA",
        name: "Rabat Hub",
      },
    };

    parcelRecord = {
      id: "parcel-uuid-111-01",
      shipmentId: shipmentRecord.id,
      trackingNumber: "HES-CAS-2026-000500-01",
      barcode: "BL-500-01",
      status: ParcelStatus.AT_HUB,
    };

    // Tracking events sequence for this parcel
    trackingEventsRecord = [
      {
        id: "evt-1",
        shipmentId: shipmentRecord.id,
        parcelId: parcelRecord.id,
        agencyId: CASA_AGENCY_ID,
        status: ParcelStatus.REGISTERED,
        createdAt: new Date("2026-09-01T10:00:00Z"),
        agency: { code: "CAS" },
      },
      {
        id: "evt-2",
        shipmentId: shipmentRecord.id,
        parcelId: parcelRecord.id,
        agencyId: RABAT_AGENCY_ID,
        status: ParcelStatus.AT_HUB,
        createdAt: new Date("2026-09-02T08:00:00Z"),
        agency: { code: "RBA" },
      },
    ];

    mockPrisma = {
      shipment: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          if (where.OR) {
            for (const cond of where.OR) {
              if (
                cond.id === shipmentRecord.id ||
                cond.trackingNumber === shipmentRecord.trackingNumber
              ) {
                return shipmentRecord;
              }
            }
          }
          return null;
        }),
      },
      parcel: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          if (where.OR) {
            for (const cond of where.OR) {
              if (
                cond.id === parcelRecord.id ||
                cond.trackingNumber === parcelRecord.trackingNumber ||
                cond.barcode === parcelRecord.barcode
              ) {
                return parcelRecord;
              }
            }
          }
          return null;
        }),
      },
      trackingEvent: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          const matching = trackingEventsRecord.filter((e) => {
            if (where.parcelId && e.parcelId !== where.parcelId) return false;
            if (where.shipmentId && e.shipmentId !== where.shipmentId)
              return false;
            return true;
          });
          // Sort desc by createdAt and id
          matching.sort(
            (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
          );
          return matching[0] || null;
        }),
      },
      incident: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const inc = {
            id: `inc-${Date.now()}-${Math.random()}`,
            ...data,
            number: data.number || data.incidentNumber,
            incidentNumber: data.number || data.incidentNumber,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          incidentsRecord.push(inc);
          return inc;
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          return incidentsRecord.find((i) => i.id === where.id) || null;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const idx = incidentsRecord.findIndex((i) => i.id === where.id);
          if (idx !== -1) {
            incidentsRecord[idx] = { ...incidentsRecord[idx], ...data };
            return incidentsRecord[idx];
          }
          return null;
        }),
      },
      incidentHistory: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const h = {
            id: `hist-${Date.now()}`,
            ...data,
            createdAt: new Date(),
          };
          incidentHistoriesRecord.push(h);
          return h;
        }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
    };

    reportIncidentUseCase = new ReportIncidentUseCase(mockPrisma, mockEventBus);
    decideIncidentUseCase = new DecideIncidentUseCase(mockPrisma);
  });

  it("Reliable Context Recovery: Automatically attaches last tracking event (AT_HUB Rabat) to incident", async () => {
    const result = await reportIncidentUseCase.execute(
      {
        shipmentIdentifier: "HES-CAS-2026-000500",
        parcelIdentifier: "HES-CAS-2026-000500-01",
        type: IncidentType.DAMAGE,
        description:
          "Colis reçu au hub de Rabat avec carton éventré et liquide qui coule",
        declaredValueClaimed: 850.0,
      },
      courierUser,
    );

    expect(result.incident.incidentNumber).toMatch(/^INC-RBA-/);
    expect(result.incident.lastTrackingEventId).toBe("evt-2");
    expect(result.incident.lastKnownStatus).toBe(ParcelStatus.AT_HUB);
    expect(result.incident.lastKnownAgencyId).toBe(RABAT_AGENCY_ID);
    expect(result.isDeliveredDispute).toBe(false);
    expect(incidentHistoriesRecord).toHaveLength(1);
    expect(incidentHistoriesRecord[0].action).toBe("OPEN_INVESTIGATION");
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.any(IncidentCreatedEvent),
    );
  });

  it("Delivered Dispute Flag: Detects and flags isDeliveredDispute = true if incident reported on DELIVERED parcel", async () => {
    // Add DELIVERED event
    trackingEventsRecord.push({
      id: "evt-3-delivered",
      shipmentId: shipmentRecord.id,
      parcelId: parcelRecord.id,
      agencyId: RABAT_AGENCY_ID,
      status: ParcelStatus.DELIVERED,
      createdAt: new Date("2026-09-02T14:30:00Z"),
      agency: { code: "RBA" },
    });
    parcelRecord.status = ParcelStatus.DELIVERED;

    const result = await reportIncidentUseCase.execute(
      {
        shipmentIdentifier: "HES-CAS-2026-000500",
        parcelIdentifier: "HES-CAS-2026-000500-01",
        type: IncidentType.DELIVERY_DISPUTE,
        description:
          "Le client affirme ne jamais avoir reçu le colis malgré le statut livré",
      },
      courierUser,
    );

    expect(result.isDeliveredDispute).toBe(true);
    expect(result.incident.isDeliveredDispute).toBe(true);
    expect(result.incident.lastKnownStatus).toBe(ParcelStatus.DELIVERED);
  });

  it("Investigation Decisions: Compensation requires formal supervisor action and is NEVER automatic", async () => {
    // 1. Report incident
    const reportRes = await reportIncidentUseCase.execute(
      {
        shipmentIdentifier: "HES-CAS-2026-000500",
        type: IncidentType.LOSS,
        description:
          "Colis égaré lors du chargement de la navette inter-agences",
        declaredValueClaimed: 500,
      },
      courierUser,
    );

    const incidentId = reportRes.incident.id;

    // 2. Approving compensation requires awardedAmount > 0
    await expect(
      decideIncidentUseCase.execute(
        incidentId,
        {
          action: IncidentDecisionAction.APPROVE_COMPENSATION,
          comment: "Accord sans montant",
          awardedAmount: 0, // Invalid
        },
        supervisorUser,
      ),
    ).rejects.toThrow(BadRequestException);

    // 3. Approving compensation with valid awardedAmount succeeds
    const decideRes = await decideIncidentUseCase.execute(
      incidentId,
      {
        action: IncidentDecisionAction.APPROVE_COMPENSATION,
        comment:
          "Rapport de perte interne validé par la direction. Indemnisation accordée selon valeur déclarée.",
        awardedAmount: 500.0,
        evidenceUrl: "claims/rapport-perte-20260902.pdf",
      },
      supervisorUser,
    );

    expect(decideRes.incident.status).toBe(IncidentStatus.COMPENSATED);
    expect(decideRes.incident.compensationAmount).toBe(500.0);
    expect(decideRes.historyEntry.action).toBe(
      IncidentDecisionAction.APPROVE_COMPENSATION,
    );
    expect(decideRes.historyEntry.awardedAmount).toBe(500.0);
  });

  it("Rejection Decision: Formally rejects an unfounded claim with history audit", async () => {
    const reportRes = await reportIncidentUseCase.execute(
      {
        shipmentIdentifier: "HES-CAS-2026-000500",
        type: IncidentType.DELIVERY_DISPUTE,
        description: "Client réclame un dédommagement",
      },
      courierUser,
    );

    const rejectRes = await decideIncidentUseCase.execute(
      reportRes.incident.id,
      {
        action: IncidentDecisionAction.REJECT_CLAIM,
        comment:
          "La signature sur le POD correspond exactement à la CIN du client. Réclamation infondée.",
      },
      supervisorUser,
    );

    expect(rejectRes.incident.status).toBe(IncidentStatus.REJECTED);
    expect(rejectRes.historyEntry.action).toBe(
      IncidentDecisionAction.REJECT_CLAIM,
    );
  });

  it("Throws NotFoundException when unknown shipment is provided", async () => {
    await expect(
      reportIncidentUseCase.execute(
        {
          shipmentIdentifier: "INVAL-SHIP-9999",
          type: IncidentType.OTHER,
          description: "Test inexistant",
        },
        courierUser,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});

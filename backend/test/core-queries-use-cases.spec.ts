import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { GetShipmentUseCase } from "../src/modules/shipments/application/use-cases/get-shipment.use-case";
import { ListShipmentsUseCase } from "../src/modules/shipments/application/use-cases/list-shipments.use-case";
import { UpdateParcelStatusUseCase } from "../src/modules/shipments/application/use-cases/update-parcel-status.use-case";
import { IShipmentRepository } from "../src/modules/shipments/domain/shipment.repository.interface";

import { GetTransferUseCase } from "../src/modules/transfers/application/use-cases/get-transfer.use-case";
import { ListTransfersUseCase } from "../src/modules/transfers/application/use-cases/list-transfers.use-case";

import { GetDeliveryRunUseCase } from "../src/modules/runs/application/use-cases/get-delivery-run.use-case";
import { UpsertCourierProfileUseCase } from "../src/modules/runs/application/use-cases/upsert-courier-profile.use-case";

import { AuthenticatedUser } from "../src/modules/auth/domain/auth.types";
import { ParcelStatus } from "@prisma/client";

describe("Core Queries & Management Use Cases (Shipments, Transfers, Runs)", () => {
  const mockAdminUser: AuthenticatedUser = {
    id: "admin-user-id",
    email: "admin@hes.ma",
    firstName: "Admin",
    lastName: "HES",
    role: "ADMIN",
    agencyId: "ag-casa-1",
    isActive: true,
    tokenVersion: 1,
    permissions: ["*"],
    isGlobalScope: true,
  };

  const mockAgentCasa: AuthenticatedUser = {
    id: "agent-casa-id",
    email: "agent.casa@hes.ma",
    firstName: "Agent",
    lastName: "Casa",
    role: "AGENT",
    agencyId: "ag-casa-1",
    isActive: true,
    tokenVersion: 1,
    permissions: ["shipments:read", "transfers:read", "runs:read"],
    isGlobalScope: false,
  };

  const mockCourierUser: AuthenticatedUser = {
    id: "courier-rachid-id",
    email: "courier@hes.ma",
    firstName: "Rachid",
    lastName: "Livreur",
    role: "COURIER",
    agencyId: "ag-casa-1",
    isActive: true,
    tokenVersion: 1,
    permissions: ["runs:read"],
    isGlobalScope: false,
  };

  describe("1. Shipments Use Cases", () => {
    let mockShipmentRepo: jest.Mocked<IShipmentRepository>;

    beforeEach(() => {
      mockShipmentRepo = {
        create: jest.fn(),
        findById: jest.fn(),
        findByTrackingNumber: jest.fn(),
        findAll: jest.fn(),
        updateParcelStatus: jest.fn(),
        softDelete: jest.fn(),
      } as any;
    });

    it("GetShipmentUseCase: should throw NotFoundException if shipment not found by ID", async () => {
      mockShipmentRepo.findById.mockResolvedValue(null);
      const useCase = new GetShipmentUseCase(mockShipmentRepo);

      await expect(
        useCase.execute("missing-id", mockAgentCasa),
      ).rejects.toThrow(NotFoundException);
    });

    it("GetShipmentUseCase: should return shipment if found by ID", async () => {
      const mockShipment = { id: "shp-1", trackingNumber: "HES-1" } as any;
      mockShipmentRepo.findById.mockResolvedValue(mockShipment);
      const useCase = new GetShipmentUseCase(mockShipmentRepo);

      const res = await useCase.execute("shp-1", mockAgentCasa);
      expect(res).toBe(mockShipment);
    });

    it("GetShipmentUseCase: should return shipment if found by tracking number", async () => {
      const mockShipment = {
        id: "shp-1",
        trackingNumber: "HES-TRACK-1",
      } as any;
      mockShipmentRepo.findByTrackingNumber.mockResolvedValue(mockShipment);
      const useCase = new GetShipmentUseCase(mockShipmentRepo);

      const res = await useCase.executeByTracking("HES-TRACK-1", mockAgentCasa);
      expect(res).toBe(mockShipment);
    });

    it("GetShipmentUseCase: should throw NotFoundException if shipment not found by tracking", async () => {
      mockShipmentRepo.findByTrackingNumber.mockResolvedValue(null);
      const useCase = new GetShipmentUseCase(mockShipmentRepo);

      await expect(
        useCase.executeByTracking("INVALID-TRACK", mockAgentCasa),
      ).rejects.toThrow(NotFoundException);
    });

    it("ListShipmentsUseCase: should call repo.findAll with query and user", async () => {
      const paginatedResult: any = {
        data: [{ id: "shp-1" }],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
      mockShipmentRepo.findAll.mockResolvedValue(paginatedResult);
      const useCase = new ListShipmentsUseCase(mockShipmentRepo);

      const res = await useCase.execute({ page: 1, limit: 10 }, mockAgentCasa);
      expect(res).toBe(paginatedResult);
      expect(mockShipmentRepo.findAll).toHaveBeenCalledWith(
        { page: 1, limit: 10 },
        mockAgentCasa,
      );
    });

    it("UpdateParcelStatusUseCase: should delegate to repo.updateParcelStatus", async () => {
      const updatedShipment = { id: "shp-1" } as any;
      mockShipmentRepo.updateParcelStatus.mockResolvedValue(updatedShipment);
      const useCase = new UpdateParcelStatusUseCase(mockShipmentRepo);

      const res = await useCase.execute(
        "parcel-1",
        { status: ParcelStatus.IN_TRANSIT, notes: "Quai" },
        mockAgentCasa,
      );
      expect(res).toBe(updatedShipment);
      expect(mockShipmentRepo.updateParcelStatus).toHaveBeenCalledWith(
        "parcel-1",
        { status: ParcelStatus.IN_TRANSIT, notes: "Quai" },
        mockAgentCasa,
      );
    });
  });

  describe("2. Transfers Use Cases", () => {
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        transfer: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
        },
      };
    });

    it("GetTransferUseCase: should throw NotFoundException if transfer does not exist", async () => {
      mockPrisma.transfer.findFirst.mockResolvedValue(null);
      const useCase = new GetTransferUseCase(mockPrisma);

      await expect(
        useCase.execute("missing-trf", mockAgentCasa),
      ).rejects.toThrow(NotFoundException);
    });

    it("GetTransferUseCase: should throw ForbiddenException if user agency does not match origin or destination", async () => {
      mockPrisma.transfer.findFirst.mockResolvedValue({
        id: "trf-1",
        originAgencyId: "ag-rabat-2",
        destinationAgencyId: "ag-tanger-3",
        items: [],
      });
      const useCase = new GetTransferUseCase(mockPrisma);

      await expect(useCase.execute("trf-1", mockAgentCasa)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("GetTransferUseCase: should return transfer if origin matches user agency", async () => {
      const trf = {
        id: "trf-1",
        originAgencyId: "ag-casa-1",
        destinationAgencyId: "ag-tanger-3",
        originAgency: { id: "ag-casa-1", name: "Casa" },
        destinationAgency: { id: "ag-tanger-3", name: "Tanger" },
        createdByUser: { id: "u-1" },
        receivedByUser: null,
        items: [],
      };
      mockPrisma.transfer.findFirst.mockResolvedValue(trf);
      const useCase = new GetTransferUseCase(mockPrisma);

      const res = await useCase.execute("trf-1", mockAgentCasa);
      expect(res.id).toBe("trf-1");
    });

    it("ListTransfersUseCase: should query transfers with pagination and agency scope", async () => {
      mockPrisma.transfer.findMany.mockResolvedValue([{ id: "trf-1" }]);
      mockPrisma.transfer.count.mockResolvedValue(1);
      const useCase = new ListTransfersUseCase(mockPrisma);

      const res = await useCase.execute({ page: 1, limit: 10 }, mockAgentCasa);
      expect(res.data).toHaveLength(1);
      expect(res.meta.total).toBe(1);
    });
  });

  describe("3. Delivery Runs & Courier Profiles Use Cases", () => {
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        deliveryRun: {
          findFirst: jest.fn(),
        },
        user: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        courierProfile: {
          upsert: jest.fn(),
        },
      };
    });

    it("GetDeliveryRunUseCase: should throw NotFoundException if run does not exist", async () => {
      mockPrisma.deliveryRun.findFirst.mockResolvedValue(null);
      const useCase = new GetDeliveryRunUseCase(mockPrisma);

      await expect(
        useCase.execute("run-missing", mockAgentCasa),
      ).rejects.toThrow(NotFoundException);
    });

    it("GetDeliveryRunUseCase: should forbid courier from viewing another courier's run", async () => {
      mockPrisma.deliveryRun.findFirst.mockResolvedValue({
        id: "run-1",
        agencyId: "ag-casa-1",
        courier: { userId: "other-courier-id" },
        runItems: [],
      });
      const useCase = new GetDeliveryRunUseCase(mockPrisma);

      await expect(useCase.execute("run-1", mockCourierUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("GetDeliveryRunUseCase: should allow courier to view their own run", async () => {
      const mockRun = {
        id: "run-1",
        agencyId: "ag-casa-1",
        courier: { userId: mockCourierUser.id },
        runItems: [],
      };
      mockPrisma.deliveryRun.findFirst.mockResolvedValue(mockRun);
      const useCase = new GetDeliveryRunUseCase(mockPrisma);

      const res = await useCase.execute("run-1", mockCourierUser);
      expect(res.id).toBe("run-1");
    });

    it("UpsertCourierProfileUseCase: should throw NotFoundException if target user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const useCase = new UpsertCourierProfileUseCase(mockPrisma);

      await expect(
        useCase.execute(
          { userId: "u-missing", vehicleType: "MOTO" as any },
          mockAdminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("UpsertCourierProfileUseCase: should throw ForbiddenException if agent tries to manage courier from another agency", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "u-rabat",
        agencyId: "ag-rabat-2",
      });
      const useCase = new UpsertCourierProfileUseCase(mockPrisma);

      await expect(
        useCase.execute(
          { userId: "u-rabat", vehicleType: "MOTO" as any },
          mockAgentCasa,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("UpsertCourierProfileUseCase: should upsert profile for agency courier", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "u-casa-courier",
        agencyId: "ag-casa-1",
      });
      const expectedProfile = {
        id: "cp-1",
        userId: "u-casa-courier",
        agencyId: "ag-casa-1",
        vehicleType: "MOTO",
      };
      mockPrisma.courierProfile.upsert.mockResolvedValue(expectedProfile);
      const useCase = new UpsertCourierProfileUseCase(mockPrisma);

      const res = await useCase.execute(
        {
          userId: "u-casa-courier",
          vehicleType: "MOTO" as any,
          licensePlate: "1234-A-1",
          primaryZoneId: "zone-1",
        },
        mockAgentCasa,
      );

      expect(res).toBe(expectedProfile);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "u-casa-courier" },
        data: { zoneId: "zone-1" },
      });
    });
  });
});

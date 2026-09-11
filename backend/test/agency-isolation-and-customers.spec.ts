/* eslint-disable @typescript-eslint/no-explicit-any */
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../src/prisma/prisma.service";
import { AuditService } from "../src/modules/auth/services/audit.service";
import { PrismaCustomerRepository } from "../src/modules/customers/infrastructure/prisma-customer.repository";
import { AuthenticatedUser } from "../src/modules/auth/domain/auth.types";
import { AuditEventType, CustomerStatus } from "@prisma/client";

describe("Phase 3: Agency Isolation & Customer Management Security Tests", () => {
  let repository: PrismaCustomerRepository;
  let mockPrisma: any;
  let mockAuditService: any;

  const CASA_AGENCY_ID = "agency-casa-uuid-1111";
  const AGADIR_AGENCY_ID = "agency-agadir-uuid-2222";

  const agadirAgentUser: AuthenticatedUser = {
    id: "user-agadir-operator-1",
    email: "operator.agadir@hes.ma",
    firstName: "Hassan",
    lastName: "Agadir",
    role: "OPERATOR",
    agencyId: AGADIR_AGENCY_ID,
    isActive: true,
    tokenVersion: 1,
    permissions: ["customers:read", "customers:manage"],
    isGlobalScope: false,
  };

  const superAdminUser: AuthenticatedUser = {
    id: "user-super-admin-1",
    email: "admin@hes.ma",
    firstName: "Super",
    lastName: "Admin",
    role: "SUPER_ADMIN",
    agencyId: null,
    isActive: true,
    tokenVersion: 1,
    permissions: ["*"],
    isGlobalScope: true,
  };

  const mockCasaCustomer = {
    id: "cust-casa-9999",
    agencyId: CASA_AGENCY_ID,
    customerTypeId: "type-b2b-corp",
    code: "CLI-CAS-001",
    legalName: "Casablanca Global Logistics SARL",
    tradeName: "Casa Global",
    ice: "001234567890123",
    taxId: "87654321",
    email: "contact@casaglobal.ma",
    phone: "+212522001122",
    status: CustomerStatus.ACTIVE,
    notes: "Client grand compte Casablanca",
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    agency: { id: CASA_AGENCY_ID, code: "CAS", name: "Agence Casablanca" },
    customerType: {
      id: "type-b2b-corp",
      code: "B2B_CORP",
      name: "Grand Compte",
    },
    managerAssignments: [],
    contacts: [],
    addresses: [],
  };

  beforeEach(() => {
    mockPrisma = {
      customer: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      customerInternalManager: {
        create: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    mockAuditService = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    repository = new PrismaCustomerRepository(
      mockPrisma as unknown as PrismaService,
      mockAuditService as unknown as AuditService,
    );
  });

  describe("SECURITY: Application Penetration & Agency Bypass Intrusion Test", () => {
    it("should strictly REFUSE (403 Forbidden) and AUDIT an Agadir agent trying to read a Casablanca customer by direct ID", async () => {
      // Setup: Database returns a Casablanca customer
      mockPrisma.customer.findFirst.mockResolvedValue(mockCasaCustomer);

      // Execution & Verification: Agadir agent calls findById with Casa customer ID
      await expect(
        repository.findById("cust-casa-9999", agadirAgentUser),
      ).rejects.toThrow(ForbiddenException);

      // Crucial Security Requirement: The intrusion attempt MUST be audited with complete metadata
      expect(mockAuditService.logEvent).toHaveBeenCalledTimes(1);
      expect(mockAuditService.logEvent).toHaveBeenCalledWith({
        eventType: AuditEventType.SECURITY_VIOLATION_AGENCY_BYPASS_ATTEMPT,
        userId: agadirAgentUser.id,
        identifier: agadirAgentUser.email,
        metadata: {
          action: "CUSTOMER_READ_ATTEMPT",
          targetResourceId: "cust-casa-9999",
          targetAgencyId: CASA_AGENCY_ID,
          userAgencyId: AGADIR_AGENCY_ID,
        },
      });
    });

    it("should strictly REFUSE (403 Forbidden) and AUDIT an Agadir agent trying to mutate (update) a Casablanca customer", async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(mockCasaCustomer);

      await expect(
        repository.update(
          "cust-casa-9999",
          { legalName: "Malicious Tampering Attempt" },
          agadirAgentUser,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockAuditService.logEvent).toHaveBeenCalledWith({
        eventType: AuditEventType.SECURITY_VIOLATION_AGENCY_BYPASS_ATTEMPT,
        userId: agadirAgentUser.id,
        identifier: agadirAgentUser.email,
        metadata: {
          action: "CUSTOMER_WRITE_ATTEMPT",
          targetResourceId: "cust-casa-9999",
          targetAgencyId: CASA_AGENCY_ID,
          userAgencyId: AGADIR_AGENCY_ID,
        },
      });
      expect(mockPrisma.customer.update).not.toHaveBeenCalled();
    });

    it("should strictly REFUSE (403 Forbidden) and AUDIT an Agadir agent trying to delete (soft delete) a Casablanca customer", async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(mockCasaCustomer);

      await expect(
        repository.softDelete("cust-casa-9999", agadirAgentUser),
      ).rejects.toThrow(ForbiddenException);

      expect(mockAuditService.logEvent).toHaveBeenCalledWith({
        eventType: AuditEventType.SECURITY_VIOLATION_AGENCY_BYPASS_ATTEMPT,
        userId: agadirAgentUser.id,
        identifier: agadirAgentUser.email,
        metadata: {
          action: "CUSTOMER_DELETE_ATTEMPT",
          targetResourceId: "cust-casa-9999",
          targetAgencyId: CASA_AGENCY_ID,
          userAgencyId: AGADIR_AGENCY_ID,
        },
      });
      expect(mockPrisma.customer.update).not.toHaveBeenCalled();
    });

    it("should strictly REFUSE (403 Forbidden) and AUDIT an Agadir agent trying to reassign a manager to a Casablanca customer", async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(mockCasaCustomer);

      await expect(
        repository.assignManager(
          "cust-casa-9999",
          "new-manager-uuid",
          "Tentative illégitime",
          agadirAgentUser.id,
          agadirAgentUser,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockAuditService.logEvent).toHaveBeenCalledWith({
        eventType: AuditEventType.SECURITY_VIOLATION_AGENCY_BYPASS_ATTEMPT,
        userId: agadirAgentUser.id,
        identifier: agadirAgentUser.email,
        metadata: {
          action: "CUSTOMER_MANAGER_ASSIGN_ATTEMPT",
          targetResourceId: "cust-casa-9999",
          targetAgencyId: CASA_AGENCY_ID,
          userAgencyId: AGADIR_AGENCY_ID,
        },
      });
    });
  });

  describe("DATA ISOLATION: List queries & Scope enforcement", () => {
    it("should automatically inject agencyId in findAll where clause for non-global agents", async () => {
      mockPrisma.customer.count.mockResolvedValue(1);
      mockPrisma.customer.findMany.mockResolvedValue([]);

      await repository.findAll({ page: 1, limit: 10 }, agadirAgentUser);

      expect(mockPrisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            agencyId: AGADIR_AGENCY_ID, // Agency isolation strictly enforced at repo level!
          }),
        }),
      );
    });

    it("should allow Super Admin to query without agency constraint or with an explicit filter", async () => {
      mockPrisma.customer.count.mockResolvedValue(2);
      mockPrisma.customer.findMany.mockResolvedValue([mockCasaCustomer]);

      await repository.findAll({ page: 1, limit: 20 }, superAdminUser);

      expect(mockPrisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        }),
      );
      // No agencyId should be forced when super admin specifies none
      const calledWhere = mockPrisma.customer.findMany.mock.calls[0][0].where;
      expect(calledWhere.agencyId).toBeUndefined();
    });
  });

  describe("BUSINESS INVARIANT: Single Active Manager at instant T & Historical Timeline", () => {
    it("should atomically close prior active manager and assign new manager with immutable history", async () => {
      const mockAgadirCustomer = {
        ...mockCasaCustomer,
        id: "cust-aga-001",
        agencyId: AGADIR_AGENCY_ID,
      };

      mockPrisma.customer.findFirst.mockResolvedValue(mockAgadirCustomer);
      mockPrisma.customerInternalManager.create.mockResolvedValue({
        id: "assignment-2",
        customerId: "cust-aga-001",
        userId: "user-new-manager",
        agencyId: AGADIR_AGENCY_ID,
        isCurrent: true,
        assignmentReason: "Mutation de portefeuille",
      });

      const result = await repository.assignManager(
        "cust-aga-001",
        "user-new-manager",
        "Mutation de portefeuille",
        agadirAgentUser.id,
        agadirAgentUser,
      );

      // Verification 1: Prior active manager must have been unassigned atomically
      expect(
        mockPrisma.customerInternalManager.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          customerId: "cust-aga-001",
          isCurrent: true,
        },
        data: expect.objectContaining({
          isCurrent: false,
          unassignedAt: expect.any(Date),
        }),
      });

      // Verification 2: New manager must be created as isCurrent: true
      expect(mockPrisma.customerInternalManager.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          customerId: "cust-aga-001",
          userId: "user-new-manager",
          agencyId: AGADIR_AGENCY_ID,
          isCurrent: true,
          assignmentReason: "Mutation de portefeuille",
          assignedByUserId: agadirAgentUser.id,
        }),
        include: expect.any(Object),
      });

      expect(result.id).toBe("assignment-2");
    });

    it("should return the complete chronological manager history for authorized users", async () => {
      const mockAgadirCustomer = {
        ...mockCasaCustomer,
        id: "cust-aga-001",
        agencyId: AGADIR_AGENCY_ID,
      };

      mockPrisma.customer.findFirst.mockResolvedValue(mockAgadirCustomer);
      const mockHistory = [
        {
          id: "assign-2",
          customerId: "cust-aga-001",
          userId: "mgr-2",
          isCurrent: true,
          assignedAt: new Date("2026-03-01"),
          unassignedAt: null,
          assignmentReason: "Remplacement congé",
        },
        {
          id: "assign-1",
          customerId: "cust-aga-001",
          userId: "mgr-1",
          isCurrent: false,
          assignedAt: new Date("2026-01-01"),
          unassignedAt: new Date("2026-03-01"),
          assignmentReason: "Attribution initiale",
        },
      ];

      mockPrisma.customerInternalManager.findMany.mockResolvedValue(
        mockHistory,
      );

      const history = await repository.getManagerHistory(
        "cust-aga-001",
        agadirAgentUser,
      );

      expect(mockPrisma.customerInternalManager.findMany).toHaveBeenCalledWith({
        where: { customerId: "cust-aga-001" },
        orderBy: { assignedAt: "desc" },
        include: expect.any(Object),
      });
      expect(history.length).toBe(2);
      expect(history[0].isCurrent).toBe(true);
      expect(history[1].isCurrent).toBe(false);
    });
  });

  describe("CRUD & SOFT-DELETE INTEGRITY", () => {
    it("should execute soft delete by setting deletedAt and status SUSPENDED", async () => {
      const mockAgadirCustomer = {
        ...mockCasaCustomer,
        id: "cust-aga-001",
        agencyId: AGADIR_AGENCY_ID,
      };

      mockPrisma.customer.findFirst.mockResolvedValue(mockAgadirCustomer);
      mockPrisma.customer.update.mockResolvedValue({
        ...mockAgadirCustomer,
        deletedAt: new Date(),
        status: CustomerStatus.SUSPENDED,
      });

      const deleted = await repository.softDelete(
        "cust-aga-001",
        agadirAgentUser,
      );

      expect(mockPrisma.customer.update).toHaveBeenCalledWith({
        where: { id: "cust-aga-001" },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          status: CustomerStatus.SUSPENDED,
        }),
      });
      expect(deleted.status).toBe(CustomerStatus.SUSPENDED);
    });

    it("should return NotFoundException if target customer does not exist", async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        repository.findById("unknown-id", agadirAgentUser),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

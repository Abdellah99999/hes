import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { CreateCustomerUseCase } from "../src/modules/customers/application/use-cases/create-customer.use-case";
import { GetCustomerUseCase } from "../src/modules/customers/application/use-cases/get-customer.use-case";
import { ListCustomersUseCase } from "../src/modules/customers/application/use-cases/list-customers.use-case";
import { UpdateCustomerUseCase } from "../src/modules/customers/application/use-cases/update-customer.use-case";
import { DeleteCustomerUseCase } from "../src/modules/customers/application/use-cases/delete-customer.use-case";
import { AssignCustomerManagerUseCase } from "../src/modules/customers/application/use-cases/assign-customer-manager.use-case";
import { GetCustomerManagerHistoryUseCase } from "../src/modules/customers/application/use-cases/get-customer-manager-history.use-case";
import { ICustomerRepository } from "../src/modules/customers/domain/customer.repository.interface";

import { GetCollectionUseCase } from "../src/modules/collections/application/use-cases/get-collection.use-case";

import { AuthenticatedUser } from "../src/modules/auth/domain/auth.types";
import { Customer } from "@prisma/client";

describe("Customers & Collections Query Use Cases", () => {
  const mockAdminUser: AuthenticatedUser = {
    id: "admin-id",
    email: "admin@hes.ma",
    firstName: "Admin",
    lastName: "User",
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
    permissions: [
      "customers:read",
      "customers:create",
      "customers:update",
      "customers:delete",
      "collections:read",
    ],
    isGlobalScope: false,
  };

  const mockCustomerUser: AuthenticatedUser = {
    id: "user-cust-1",
    email: "cust@client.ma",
    firstName: "Client",
    lastName: "Test",
    role: "CUSTOMER",
    customerId: "cust-1",
    agencyId: "ag-casa-1",
    isActive: true,
    tokenVersion: 1,
    permissions: ["collections:read"],
    isGlobalScope: false,
  };

  const mockCourierUser: AuthenticatedUser = {
    id: "courier-1",
    email: "courier@hes.ma",
    firstName: "Rachid",
    lastName: "Livreur",
    role: "COURIER",
    agencyId: "ag-casa-1",
    isActive: true,
    tokenVersion: 1,
    permissions: ["collections:read"],
    isGlobalScope: false,
  };

  describe("1. Customers Use Cases", () => {
    let mockRepo: jest.Mocked<ICustomerRepository>;

    beforeEach(() => {
      mockRepo = {
        create: jest.fn(),
        findById: jest.fn(),
        findByCode: jest.fn(),
        findAll: jest.fn(),
        update: jest.fn(),
        softDelete: jest.fn(),
        assignManager: jest.fn(),
        getManagerHistory: jest.fn(),
      } as any;
    });

    it("CreateCustomerUseCase: should throw BadRequestException if target agency cannot be resolved", async () => {
      const userWithoutAgency = {
        ...mockAdminUser,
        isGlobalScope: false,
        agencyId: null as any,
      };
      const useCase = new CreateCustomerUseCase(mockRepo);

      await expect(
        useCase.execute(
          { code: "CUST-001", companyName: "ACME" } as any,
          userWithoutAgency,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("CreateCustomerUseCase: should throw ConflictException if code already exists", async () => {
      mockRepo.findByCode.mockResolvedValue({
        id: "c-1",
        code: "CUST-001",
      } as any);
      const useCase = new CreateCustomerUseCase(mockRepo);

      await expect(
        useCase.execute(
          { code: "CUST-001", companyName: "ACME" } as any,
          mockAgentCasa,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it("CreateCustomerUseCase: should create customer when code is unique", async () => {
      mockRepo.findByCode.mockResolvedValue(null);
      const created = {
        id: "c-1",
        code: "CUST-002",
        companyName: "ACME",
      } as any;
      mockRepo.create.mockResolvedValue(created);
      const useCase = new CreateCustomerUseCase(mockRepo);

      const res = await useCase.execute(
        { code: "CUST-002", companyName: "ACME" } as any,
        mockAgentCasa,
      );
      expect(res).toBe(created);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ code: "CUST-002" }),
        "ag-casa-1",
        mockAgentCasa.id,
      );
    });

    it("GetCustomerUseCase: should throw NotFoundException if missing", async () => {
      mockRepo.findById.mockResolvedValue(null);
      const useCase = new GetCustomerUseCase(mockRepo);

      await expect(
        useCase.execute("missing-id", mockAgentCasa),
      ).rejects.toThrow(NotFoundException);
    });

    it("GetCustomerUseCase: should return customer if found", async () => {
      const customer = { id: "c-1", companyName: "ACME" } as any;
      mockRepo.findById.mockResolvedValue(customer);
      const useCase = new GetCustomerUseCase(mockRepo);

      const res = await useCase.execute("c-1", mockAgentCasa);
      expect(res).toBe(customer);
    });

    it("ListCustomersUseCase: should call repo.findAll", async () => {
      const paginated: any = {
        data: [{ id: "c-1" }],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      };
      mockRepo.findAll.mockResolvedValue(paginated);
      const useCase = new ListCustomersUseCase(mockRepo);

      const res = await useCase.execute({ page: 1, limit: 10 }, mockAgentCasa);
      expect(res).toBe(paginated);
      expect(mockRepo.findAll).toHaveBeenCalledWith(
        { page: 1, limit: 10 },
        mockAgentCasa,
      );
    });

    it("UpdateCustomerUseCase: should call repo.update", async () => {
      const updated = { id: "c-1", companyName: "ACME Corp" } as any;
      mockRepo.update.mockResolvedValue(updated);
      const useCase = new UpdateCustomerUseCase(mockRepo);

      const res = await useCase.execute(
        "c-1",
        { companyName: "ACME Corp" } as any,
        mockAgentCasa,
      );
      expect(res).toBe(updated);
      expect(mockRepo.update).toHaveBeenCalledWith(
        "c-1",
        { companyName: "ACME Corp" },
        mockAgentCasa,
      );
    });

    it("DeleteCustomerUseCase: should call repo.softDelete", async () => {
      const deleted = { id: "c-1", deletedAt: new Date() } as Customer;
      mockRepo.softDelete.mockResolvedValue(deleted);
      const useCase = new DeleteCustomerUseCase(mockRepo);

      const res = await useCase.execute("c-1", mockAgentCasa);
      expect(res).toBe(deleted);
      expect(mockRepo.softDelete).toHaveBeenCalledWith("c-1", mockAgentCasa);
    });

    it("AssignCustomerManagerUseCase: should call repo.assignManager", async () => {
      const assignment = {
        id: "asgn-1",
        customerId: "c-1",
        userId: "u-mgr",
      } as any;
      mockRepo.assignManager.mockResolvedValue(assignment);
      const useCase = new AssignCustomerManagerUseCase(mockRepo);

      const res = await useCase.execute(
        "c-1",
        { userId: "u-mgr", assignmentReason: "Account Manager" } as any,
        mockAgentCasa,
      );
      expect(res).toBe(assignment);
      expect(mockRepo.assignManager).toHaveBeenCalledWith(
        "c-1",
        "u-mgr",
        "Account Manager",
        mockAgentCasa.id,
        mockAgentCasa,
      );
    });

    it("GetCustomerManagerHistoryUseCase: should call repo.getManagerHistory", async () => {
      const history: any[] = [{ id: "h-1", customerId: "c-1" }];
      mockRepo.getManagerHistory.mockResolvedValue(history);
      const useCase = new GetCustomerManagerHistoryUseCase(mockRepo);

      const res = await useCase.execute("c-1", mockAgentCasa);
      expect(res).toBe(history);
      expect(mockRepo.getManagerHistory).toHaveBeenCalledWith(
        "c-1",
        mockAgentCasa,
      );
    });
  });

  describe("2. Collections Query Use Cases", () => {
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        collection: {
          findFirst: jest.fn(),
        },
      };
    });

    it("GetCollectionUseCase: should throw NotFoundException if missing", async () => {
      mockPrisma.collection.findFirst.mockResolvedValue(null);
      const useCase = new GetCollectionUseCase(mockPrisma);

      await expect(
        useCase.execute("missing-col", mockAgentCasa),
      ).rejects.toThrow(NotFoundException);
    });

    it("GetCollectionUseCase: should forbid customer from viewing another customer's collection", async () => {
      mockPrisma.collection.findFirst.mockResolvedValue({
        id: "col-1",
        customerId: "other-cust-id",
        agencyId: "ag-casa-1",
      });
      const useCase = new GetCollectionUseCase(mockPrisma);

      await expect(useCase.execute("col-1", mockCustomerUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("GetCollectionUseCase: should forbid courier from viewing collection assigned to another courier", async () => {
      mockPrisma.collection.findFirst.mockResolvedValue({
        id: "col-1",
        customerId: "cust-1",
        assignedCourierId: "other-courier-id",
        agencyId: "ag-casa-1",
      });
      const useCase = new GetCollectionUseCase(mockPrisma);

      await expect(useCase.execute("col-1", mockCourierUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("GetCollectionUseCase: should forbid agent from viewing collection of another agency", async () => {
      mockPrisma.collection.findFirst.mockResolvedValue({
        id: "col-1",
        customerId: "cust-1",
        agencyId: "ag-rabat-2",
      });
      const useCase = new GetCollectionUseCase(mockPrisma);

      await expect(useCase.execute("col-1", mockAgentCasa)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("GetCollectionUseCase: should return collection if authorized", async () => {
      const mockCollection = {
        id: "col-1",
        customerId: "cust-1",
        agencyId: "ag-casa-1",
        assignedCourierId: mockCourierUser.id,
      };
      mockPrisma.collection.findFirst.mockResolvedValue(mockCollection);
      const useCase = new GetCollectionUseCase(mockPrisma);

      const res = await useCase.execute("col-1", mockCourierUser);
      expect(res.id).toBe("col-1");
    });
  });
});

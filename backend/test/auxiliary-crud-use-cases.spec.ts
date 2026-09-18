import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { CreateAgencyUseCase } from "../src/modules/agencies/application/use-cases/create-agency.use-case";
import { GetAgencyUseCase } from "../src/modules/agencies/application/use-cases/get-agency.use-case";
import { ListAgenciesUseCase } from "../src/modules/agencies/application/use-cases/list-agencies.use-case";
import { UpdateAgencyUseCase } from "../src/modules/agencies/application/use-cases/update-agency.use-case";
import { DeleteAgencyUseCase } from "../src/modules/agencies/application/use-cases/delete-agency.use-case";
import { IAgencyRepository } from "../src/modules/agencies/domain/agency.repository.interface";

import { CreateZoneUseCase } from "../src/modules/zones/application/use-cases/create-zone.use-case";
import { GetZoneUseCase } from "../src/modules/zones/application/use-cases/get-zone.use-case";
import { ListZonesUseCase } from "../src/modules/zones/application/use-cases/list-zones.use-case";
import { UpdateZoneUseCase } from "../src/modules/zones/application/use-cases/update-zone.use-case";
import { DeleteZoneUseCase } from "../src/modules/zones/application/use-cases/delete-zone.use-case";
import { IZoneRepository } from "../src/modules/zones/domain/zone.repository.interface";

import { CustomerTypeUseCases } from "../src/modules/customer-types/application/customer-types.use-cases";
import { ICustomerTypeRepository } from "../src/modules/customer-types/domain/customer-type.repository.interface";

import { AddressesUseCases } from "../src/modules/addresses/application/addresses.use-cases";
import { IAddressRepository } from "../src/modules/addresses/domain/address.repository.interface";

import { CustomerContactsUseCases } from "../src/modules/customer-contacts/application/customer-contacts.use-cases";
import { ICustomerContactRepository } from "../src/modules/customer-contacts/domain/customer-contact.repository.interface";

import { AuthenticatedUser } from "../src/modules/auth/domain/auth.types";
import { Agency, CustomerType, Zone } from "@prisma/client";

describe("Auxiliary CRUD Use Cases (Agencies, Zones, CustomerTypes, Addresses, Contacts)", () => {
  const mockAdminUser: AuthenticatedUser = {
    id: "admin-user-id",
    email: "admin@hes.ma",
    firstName: "Admin",
    lastName: "User",
    role: "ADMIN",
    agencyId: "agency-casa-1",
    isActive: true,
    tokenVersion: 1,
    permissions: ["*"],
    isGlobalScope: true,
  };

  const mockAgencyUser: AuthenticatedUser = {
    id: "agent-user-id",
    email: "agent@hes.ma",
    firstName: "Agent",
    lastName: "User",
    role: "AGENT",
    agencyId: "agency-casa-1",
    isActive: true,
    tokenVersion: 1,
    permissions: ["agencies:read", "zones:read", "zones:create"],
    isGlobalScope: false,
  };

  describe("1. Agencies CRUD Use Cases", () => {
    let mockAgencyRepo: jest.Mocked<IAgencyRepository>;

    beforeEach(() => {
      mockAgencyRepo = {
        create: jest.fn(),
        findById: jest.fn(),
        findByCode: jest.fn(),
        findAll: jest.fn(),
        update: jest.fn(),
        softDelete: jest.fn(),
        countActive: jest.fn(),
      };
    });

    it("CreateAgencyUseCase: should throw ConflictException if code exists", async () => {
      mockAgencyRepo.findByCode.mockResolvedValue({
        id: "ag-1",
        code: "CAS",
      } as Agency);
      const useCase = new CreateAgencyUseCase(mockAgencyRepo);

      await expect(
        useCase.execute({
          name: "Casablanca Hub",
          code: "CAS",
          city: "Casablanca",
          address: "Bd Anfa",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("CreateAgencyUseCase: should create agency if code is unique", async () => {
      mockAgencyRepo.findByCode.mockResolvedValue(null);
      const expectedAgency = {
        id: "ag-new",
        code: "TNG",
        name: "Tangier Hub",
        city: "Tanger",
      } as Agency;
      mockAgencyRepo.create.mockResolvedValue(expectedAgency);

      const useCase = new CreateAgencyUseCase(mockAgencyRepo);
      const result = await useCase.execute({
        name: "Tangier Hub",
        code: "TNG",
        city: "Tanger",
        address: "Zone Franche",
      });

      expect(result).toBe(expectedAgency);
      expect(mockAgencyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ code: "TNG" }),
      );
    });

    it("GetAgencyUseCase: should throw NotFoundException if not found", async () => {
      mockAgencyRepo.findById.mockResolvedValue(null);
      const useCase = new GetAgencyUseCase(mockAgencyRepo);

      await expect(useCase.execute("non-existent-id")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("GetAgencyUseCase: should return agency if found", async () => {
      const agency = { id: "ag-1", name: "Casa Hub" } as Agency;
      mockAgencyRepo.findById.mockResolvedValue(agency);
      const useCase = new GetAgencyUseCase(mockAgencyRepo);

      const result = await useCase.execute("ag-1");
      expect(result).toBe(agency);
    });

    it("ListAgenciesUseCase: should return paginated list from repo", async () => {
      const mockResult: any = {
        data: [{ id: "ag-1" }],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
      mockAgencyRepo.findAll.mockResolvedValue(mockResult);
      const useCase = new ListAgenciesUseCase(mockAgencyRepo);

      const result = await useCase.execute({ page: 1, limit: 10 });
      expect(result).toBe(mockResult);
      expect(mockAgencyRepo.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
      });
    });

    it("UpdateAgencyUseCase: should throw NotFoundException if agency not found", async () => {
      mockAgencyRepo.findById.mockResolvedValue(null);
      const useCase = new UpdateAgencyUseCase(mockAgencyRepo);

      await expect(
        useCase.execute("ag-missing", { name: "New Name" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("UpdateAgencyUseCase: should update when agency exists", async () => {
      const existing = { id: "ag-1", name: "Old Name" } as Agency;
      mockAgencyRepo.findById.mockResolvedValue(existing);
      mockAgencyRepo.update.mockResolvedValue({
        ...existing,
        name: "New Name",
      });
      const useCase = new UpdateAgencyUseCase(mockAgencyRepo);

      const result = await useCase.execute("ag-1", { name: "New Name" });
      expect(result.name).toBe("New Name");
      expect(mockAgencyRepo.update).toHaveBeenCalledWith("ag-1", {
        name: "New Name",
      });
    });

    it("DeleteAgencyUseCase: should throw NotFoundException if agency not found", async () => {
      mockAgencyRepo.findById.mockResolvedValue(null);
      const useCase = new DeleteAgencyUseCase(mockAgencyRepo);

      await expect(useCase.execute("ag-missing")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("DeleteAgencyUseCase: should soft-delete agency when found", async () => {
      const existing = { id: "ag-1", deletedAt: null } as Agency;
      mockAgencyRepo.findById.mockResolvedValue(existing);
      mockAgencyRepo.softDelete.mockResolvedValue({
        ...existing,
        deletedAt: new Date(),
      });
      const useCase = new DeleteAgencyUseCase(mockAgencyRepo);

      const result = await useCase.execute("ag-1");
      expect(result.deletedAt).toBeDefined();
      expect(mockAgencyRepo.softDelete).toHaveBeenCalledWith("ag-1");
    });
  });

  describe("2. Zones CRUD Use Cases", () => {
    let mockZoneRepo: jest.Mocked<IZoneRepository>;

    beforeEach(() => {
      mockZoneRepo = {
        create: jest.fn(),
        findById: jest.fn(),
        findByCodeInAgency: jest.fn(),
        findAll: jest.fn(),
        update: jest.fn(),
        softDelete: jest.fn(),
      };
    });

    it("CreateZoneUseCase: should throw BadRequestException if target agency cannot be resolved", async () => {
      const userWithoutAgency: AuthenticatedUser = {
        ...mockAdminUser,
        isGlobalScope: false,
        agencyId: null as any,
      };
      const useCase = new CreateZoneUseCase(mockZoneRepo);

      await expect(
        useCase.execute({ name: "Zone A", code: "ZA" }, userWithoutAgency),
      ).rejects.toThrow(BadRequestException);
    });

    it("CreateZoneUseCase: should throw ConflictException if zone code exists in agency", async () => {
      mockZoneRepo.findByCodeInAgency.mockResolvedValue({
        id: "z-1",
        code: "ZA",
      } as Zone);
      const useCase = new CreateZoneUseCase(mockZoneRepo);

      await expect(
        useCase.execute({ name: "Zone A", code: "ZA" }, mockAgencyUser),
      ).rejects.toThrow(ConflictException);
    });

    it("CreateZoneUseCase: should create zone with target agency", async () => {
      mockZoneRepo.findByCodeInAgency.mockResolvedValue(null);
      const expectedZone = {
        id: "z-new",
        code: "ZB",
        name: "Zone B",
        agencyId: "agency-casa-1",
      } as Zone;
      mockZoneRepo.create.mockResolvedValue(expectedZone);
      const useCase = new CreateZoneUseCase(mockZoneRepo);

      const result = await useCase.execute(
        { name: "Zone B", code: "ZB" },
        mockAgencyUser,
      );
      expect(result).toBe(expectedZone);
      expect(mockZoneRepo.create).toHaveBeenCalledWith(
        { name: "Zone B", code: "ZB" },
        "agency-casa-1",
      );
    });

    it("CreateZoneUseCase: global scope user can specify agencyId", async () => {
      mockZoneRepo.findByCodeInAgency.mockResolvedValue(null);
      const expectedZone = {
        id: "z-rabat",
        code: "ZR",
        agencyId: "agency-rabat-2",
      } as Zone;
      mockZoneRepo.create.mockResolvedValue(expectedZone);
      const useCase = new CreateZoneUseCase(mockZoneRepo);

      const result = await useCase.execute(
        { name: "Zone Rabat", code: "ZR", agencyId: "agency-rabat-2" },
        mockAdminUser,
      );
      expect(result).toBe(expectedZone);
      expect(mockZoneRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ code: "ZR" }),
        "agency-rabat-2",
      );
    });

    it("GetZoneUseCase: should throw NotFoundException if zone not found", async () => {
      mockZoneRepo.findById.mockResolvedValue(null);
      const useCase = new GetZoneUseCase(mockZoneRepo);

      await expect(useCase.execute("z-missing", mockAgencyUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("GetZoneUseCase: should return zone if found", async () => {
      const zone = { id: "z-1", name: "Zone Centre" } as Zone;
      mockZoneRepo.findById.mockResolvedValue(zone);
      const useCase = new GetZoneUseCase(mockZoneRepo);

      const result = await useCase.execute("z-1", mockAgencyUser);
      expect(result).toBe(zone);
    });

    it("ListZonesUseCase: should call repo.findAll with query and user", async () => {
      const mockResult: any = {
        data: [{ id: "z-1" }],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
      mockZoneRepo.findAll.mockResolvedValue(mockResult);
      const useCase = new ListZonesUseCase(mockZoneRepo);

      const result = await useCase.execute(
        { page: 1, limit: 10 },
        mockAgencyUser,
      );
      expect(result).toBe(mockResult);
      expect(mockZoneRepo.findAll).toHaveBeenCalledWith(
        { page: 1, limit: 10 },
        mockAgencyUser,
      );
    });

    it("UpdateZoneUseCase: should delegate to repo.update", async () => {
      const updated = { id: "z-1", name: "Zone Updated" } as Zone;
      mockZoneRepo.update.mockResolvedValue(updated);
      const useCase = new UpdateZoneUseCase(mockZoneRepo);

      const result = await useCase.execute(
        "z-1",
        { name: "Zone Updated" },
        mockAgencyUser,
      );
      expect(result).toBe(updated);
      expect(mockZoneRepo.update).toHaveBeenCalledWith(
        "z-1",
        { name: "Zone Updated" },
        mockAgencyUser,
      );
    });

    it("DeleteZoneUseCase: should delegate to repo.softDelete", async () => {
      const deleted = { id: "z-1", deletedAt: new Date() } as Zone;
      mockZoneRepo.softDelete.mockResolvedValue(deleted);
      const useCase = new DeleteZoneUseCase(mockZoneRepo);

      const result = await useCase.execute("z-1", mockAgencyUser);
      expect(result).toBe(deleted);
      expect(mockZoneRepo.softDelete).toHaveBeenCalledWith(
        "z-1",
        mockAgencyUser,
      );
    });
  });

  describe("3. CustomerTypes CRUD Use Cases", () => {
    let mockCustomerTypeRepo: jest.Mocked<ICustomerTypeRepository>;
    let useCases: CustomerTypeUseCases;

    beforeEach(() => {
      mockCustomerTypeRepo = {
        create: jest.fn(),
        findById: jest.fn(),
        findByCode: jest.fn(),
        findAll: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      };
      useCases = new CustomerTypeUseCases(mockCustomerTypeRepo);
    });

    it("create: should throw ConflictException if code exists", async () => {
      mockCustomerTypeRepo.findByCode.mockResolvedValue({
        id: "ct-1",
        code: "VIP",
      } as CustomerType);

      await expect(
        useCases.create({ code: "VIP", name: "VIP Customer" }),
      ).rejects.toThrow(ConflictException);
    });

    it("create: should call repo.create if unique", async () => {
      mockCustomerTypeRepo.findByCode.mockResolvedValue(null);
      const created = {
        id: "ct-2",
        code: "PREMIUM",
        name: "Premium",
      } as CustomerType;
      mockCustomerTypeRepo.create.mockResolvedValue(created);

      const result = await useCases.create({
        code: "PREMIUM",
        name: "Premium",
      });
      expect(result).toBe(created);
      expect(mockCustomerTypeRepo.create).toHaveBeenCalledWith({
        code: "PREMIUM",
        name: "Premium",
      });
    });

    it("findAll: should call repo.findAll with query", async () => {
      mockCustomerTypeRepo.findAll.mockResolvedValue([
        { id: "ct-1" } as CustomerType,
      ]);
      const result = await useCases.findAll({});
      expect(result).toHaveLength(1);
      expect(mockCustomerTypeRepo.findAll).toHaveBeenCalledWith({});
    });

    it("findById: should throw NotFoundException if not found", async () => {
      mockCustomerTypeRepo.findById.mockResolvedValue(null);
      await expect(useCases.findById("missing")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("findById: should return customer type if found", async () => {
      const item = { id: "ct-1", name: "Standard" } as CustomerType;
      mockCustomerTypeRepo.findById.mockResolvedValue(item);
      const result = await useCases.findById("ct-1");
      expect(result).toBe(item);
    });

    it("update: should check existence and call repo.update", async () => {
      const existing = { id: "ct-1", name: "Old" } as CustomerType;
      mockCustomerTypeRepo.findById.mockResolvedValue(existing);
      mockCustomerTypeRepo.update.mockResolvedValue({
        ...existing,
        name: "Updated",
      });

      const result = await useCases.update("ct-1", { name: "Updated" });
      expect(result.name).toBe("Updated");
      expect(mockCustomerTypeRepo.update).toHaveBeenCalledWith("ct-1", {
        name: "Updated",
      });
    });

    it("delete: should throw BadRequestException for protected system codes", async () => {
      const protectedTypes = [
        "STANDARD",
        "BUSINESS",
        "VIP",
        "ENTERPRISE",
        "DEFAULT",
      ];
      for (const code of protectedTypes) {
        mockCustomerTypeRepo.findById.mockResolvedValue({
          id: `ct-${code}`,
          code,
        } as CustomerType);

        await expect(useCases.delete(`ct-${code}`)).rejects.toThrow(
          BadRequestException,
        );
      }
    });

    it("delete: should delete custom non-protected customer type", async () => {
      const customType = {
        id: "ct-custom",
        code: "SEASONAL_PARTNER",
      } as CustomerType;
      mockCustomerTypeRepo.findById.mockResolvedValue(customType);
      mockCustomerTypeRepo.delete.mockResolvedValue(customType);

      const result = await useCases.delete("ct-custom");
      expect(result).toBe(customType);
      expect(mockCustomerTypeRepo.delete).toHaveBeenCalledWith("ct-custom");
    });
  });

  describe("4. Addresses Use Cases", () => {
    let mockAddressRepo: jest.Mocked<IAddressRepository>;
    let useCases: AddressesUseCases;

    beforeEach(() => {
      mockAddressRepo = {
        create: jest.fn(),
        findById: jest.fn(),
        findAll: jest.fn(),
        update: jest.fn(),
        softDelete: jest.fn(),
      };
      useCases = new AddressesUseCases(mockAddressRepo);
    });

    it("create: should call repo.create with agencyId and user", async () => {
      const expected: any = { id: "addr-1", title: "Depot", street: "123 Rue Al Qods" };
      mockAddressRepo.create.mockResolvedValue(expected);

      const result = await useCases.create(
        { title: "Depot", customerId: "cust-1", street: "123 Rue Al Qods", city: "Casablanca" } as any,
        mockAgencyUser,
      );
      expect(result).toBe(expected);
      expect(mockAddressRepo.create).toHaveBeenCalledWith(
        { title: "Depot", customerId: "cust-1", street: "123 Rue Al Qods", city: "Casablanca" },
        "agency-casa-1",
        mockAgencyUser,
      );
    });

    it("findAll: should call repo.findAll with query and user", async () => {
      const paginated: any = {
        data: [{ id: "addr-1" }],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
      mockAddressRepo.findAll.mockResolvedValue(paginated);

      const result = await useCases.findAll({ page: 1, limit: 10 }, mockAgencyUser);
      expect(result).toBe(paginated);
      expect(mockAddressRepo.findAll).toHaveBeenCalledWith(
        { page: 1, limit: 10 },
        mockAgencyUser,
      );
    });

    it("findById: should throw NotFoundException if missing", async () => {
      mockAddressRepo.findById.mockResolvedValue(null);
      await expect(useCases.findById("missing", mockAgencyUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("findById: should return address if found", async () => {
      const addr: any = { id: "addr-1", street: "Bd Zerktouni" };
      mockAddressRepo.findById.mockResolvedValue(addr);

      const result = await useCases.findById("addr-1", mockAgencyUser);
      expect(result).toBe(addr);
    });

    it("update: should call repo.update", async () => {
      const updated: any = { id: "addr-1", street: "New Street" };
      mockAddressRepo.update.mockResolvedValue(updated);

      const result = await useCases.update(
        "addr-1",
        { street: "New Street" } as any,
        mockAgencyUser,
      );
      expect(result).toBe(updated);
      expect(mockAddressRepo.update).toHaveBeenCalledWith(
        "addr-1",
        { street: "New Street" },
        mockAgencyUser,
      );
    });

    it("delete: should call repo.softDelete", async () => {
      const deleted: any = { id: "addr-1", deletedAt: new Date() };
      mockAddressRepo.softDelete.mockResolvedValue(deleted);

      const result = await useCases.delete("addr-1", mockAgencyUser);
      expect(result).toBe(deleted);
      expect(mockAddressRepo.softDelete).toHaveBeenCalledWith(
        "addr-1",
        mockAgencyUser,
      );
    });
  });

  describe("5. Customer Contacts Use Cases", () => {
    let mockContactRepo: jest.Mocked<ICustomerContactRepository>;
    let useCases: CustomerContactsUseCases;

    beforeEach(() => {
      mockContactRepo = {
        create: jest.fn(),
        findById: jest.fn(),
        findByCustomerId: jest.fn(),
        update: jest.fn(),
        softDelete: jest.fn(),
      };
      useCases = new CustomerContactsUseCases(mockContactRepo);
    });

    it("create: should call repo.create with agencyId and user", async () => {
      const contact: any = { id: "cc-1", firstName: "Hassan", lastName: "Alami" };
      mockContactRepo.create.mockResolvedValue(contact);

      const result = await useCases.create(
        {
          customerId: "cust-1",
          firstName: "Hassan",
          lastName: "Alami",
          phone: "+212600112233",
        } as any,
        mockAgencyUser,
      );
      expect(result).toBe(contact);
      expect(mockContactRepo.create).toHaveBeenCalledWith(
        {
          customerId: "cust-1",
          firstName: "Hassan",
          lastName: "Alami",
          phone: "+212600112233",
        },
        "agency-casa-1",
        mockAgencyUser,
      );
    });

    it("findByCustomerId: should call repo.findByCustomerId with user", async () => {
      const contacts: any = [{ id: "cc-1", firstName: "Hassan" }];
      mockContactRepo.findByCustomerId.mockResolvedValue(contacts);

      const result = await useCases.findByCustomerId("cust-1", mockAgencyUser);
      expect(result).toHaveLength(1);
      expect(mockContactRepo.findByCustomerId).toHaveBeenCalledWith(
        "cust-1",
        mockAgencyUser,
      );
    });

    it("findById: should throw NotFoundException if contact not found", async () => {
      mockContactRepo.findById.mockResolvedValue(null);
      await expect(useCases.findById("missing", mockAgencyUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("findById: should return contact if found", async () => {
      const contact: any = { id: "cc-1", firstName: "Hassan" };
      mockContactRepo.findById.mockResolvedValue(contact);

      const result = await useCases.findById("cc-1", mockAgencyUser);
      expect(result).toBe(contact);
    });

    it("update: should call repo.update", async () => {
      const updated: any = { id: "cc-1", firstName: "Hassan", lastName: "Updated" };
      mockContactRepo.update.mockResolvedValue(updated);

      const result = await useCases.update(
        "cc-1",
        { firstName: "Hassan", lastName: "Updated" } as any,
        mockAgencyUser,
      );
      expect(result).toBe(updated);
      expect(mockContactRepo.update).toHaveBeenCalledWith(
        "cc-1",
        { firstName: "Hassan", lastName: "Updated" },
        mockAgencyUser,
      );
    });

    it("delete: should call repo.softDelete", async () => {
      const deleted: any = {
        id: "cc-1",
        deletedAt: new Date(),
      };
      mockContactRepo.softDelete.mockResolvedValue(deleted);

      const result = await useCases.delete("cc-1", mockAgencyUser);
      expect(result).toBe(deleted);
      expect(mockContactRepo.softDelete).toHaveBeenCalledWith(
        "cc-1",
        mockAgencyUser,
      );
    });
  });
});

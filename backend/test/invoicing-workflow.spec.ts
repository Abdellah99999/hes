/* eslint-disable @typescript-eslint/no-explicit-any */
import { CreateInvoiceUseCase } from "../src/modules/billing/application/use-cases/create-invoice.use-case";
import { ListInvoicesUseCase } from "../src/modules/billing/application/use-cases/list-invoices.use-case";
import { AuthenticatedUser } from "../src/modules/auth/domain/auth.types";
import { InvoiceStatus } from "@prisma/client";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { InvoiceCreatedEvent } from "../src/common/events/billing.events";

describe("Phase 12a Backend Tests: Invoicing, Strict Math & TVA Half-Even Rounding, Security Scoping", () => {
  let createInvoiceUseCase: CreateInvoiceUseCase;
  let listInvoicesUseCase: ListInvoicesUseCase;
  let mockPrisma: any;
  let mockEventBus: any;

  const accountantUser: AuthenticatedUser = {
    id: "user-accountant-fatima",
    email: "fatima.comptable@hes.ma",
    firstName: "Fatima",
    lastName: "Comptable",
    role: "OPERATOR",
    agencyId: "ag-casa",
    isActive: true,
    tokenVersion: 1,
    permissions: ["billing:manage"],
    isGlobalScope: true,
  };

  const customerUserA: AuthenticatedUser = {
    id: "user-cust-a",
    email: "direction@client-a.ma",
    firstName: "Ali",
    lastName: "ClientA",
    role: "CUSTOMER",
    customerId: "cust-uuid-aaa",
    agencyId: null,
    isActive: true,
    tokenVersion: 1,
    permissions: [],
    isGlobalScope: false,
  };

  const customerRecord = {
    id: "cust-uuid-aaa",
    code: "CLI-A",
    legalName: "Société Marocaine de Distribution SARL",
    ice: "001928374000088",
  };

  let invoicesRecord: any[];

  beforeEach(() => {
    invoicesRecord = [];

    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    mockPrisma = {
      customer: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          if (where.id === customerRecord.id) return customerRecord;
          return null;
        }),
      },
      invoice: {
        create: jest.fn().mockImplementation(async ({ data }) => {
          const inv = {
            id: `inv-${Date.now()}`,
            ...data,
            items: data.items.create.map((it: any, idx: number) => ({
              id: `item-${idx}`,
              ...it,
            })),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          invoicesRecord.push(inv);
          return inv;
        }),
        findMany: jest.fn().mockImplementation(async ({ where }) => {
          return invoicesRecord.filter((inv) => {
            if (where.customerId && inv.customerId !== where.customerId)
              return false;
            return true;
          });
        }),
        count: jest.fn().mockImplementation(async ({ where }) => {
          return invoicesRecord.filter((inv) => {
            if (where.customerId && inv.customerId !== where.customerId)
              return false;
            return true;
          }).length;
        }),
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          return (
            invoicesRecord.find(
              (inv) =>
                inv.id === where.OR?.[0]?.id ||
                inv.number === where.OR?.[1]?.number ||
                inv.invoiceNumber === where.OR?.[2]?.invoiceNumber,
            ) || null
          );
        }),
      },
    };

    createInvoiceUseCase = new CreateInvoiceUseCase(mockPrisma, mockEventBus);
    listInvoicesUseCase = new ListInvoicesUseCase(mockPrisma);
  });

  it("Math Verification: Exact subtotal, 20% TVA and total TTC with 2 decimal half-even rounding", async () => {
    // 3 lines: 2 * 65.25 = 130.50, 1 * 40.10 = 40.10 -> Subtotal = 170.60
    // TVA 20% = 170.60 * 0.20 = 34.12
    // Total TTC = 170.60 + 34.12 = 204.72
    const invoice = await createInvoiceUseCase.execute(
      {
        customerId: "cust-uuid-aaa",
        taxRate: 20.0,
        items: [
          {
            description: "Fret Casablanca -> Rabat (2 colis)",
            quantity: 2,
            unitPrice: 65.25,
          },
          {
            description: "Supplément Livraison Express Samedi",
            quantity: 1,
            unitPrice: 40.1,
          },
        ],
      },
      accountantUser,
    );

    expect(invoice.invoiceNumber).toMatch(/^FACT-/);
    expect(invoice.subtotalAmount).toBe(170.6);
    expect(invoice.taxRate).toBe(20.0);
    expect(invoice.taxAmount).toBe(34.12);
    expect(invoice.totalAmount).toBe(204.72);
    expect(invoice.paidAmount).toBe(0.0);
    expect(invoice.remainingAmount).toBe(204.72);
    expect(invoice.status).toBe(InvoiceStatus.ISSUED);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.any(InvoiceCreatedEvent),
    );
  });

  it("Data Isolation: Customer user can only see their own invoices", async () => {
    // 1. Create invoice for Customer A
    await createInvoiceUseCase.execute(
      {
        customerId: "cust-uuid-aaa",
        items: [
          { description: "Fret Casa -> Tanger", quantity: 1, unitPrice: 100.0 },
        ],
      },
      accountantUser,
    );

    // 2. Query as Customer A -> finds 1 invoice
    const resA = await listInvoicesUseCase.execute({}, customerUserA);
    expect(resA.data).toHaveLength(1);
    expect(resA.data[0].customerId).toBe("cust-uuid-aaa");

    // 3. Query as Customer B -> finds 0 invoices
    const customerUserB: AuthenticatedUser = {
      ...customerUserA,
      id: "user-cust-b",
      customerId: "cust-uuid-bbb",
    };
    const resB = await listInvoicesUseCase.execute({}, customerUserB);
    expect(resB.data).toHaveLength(0);
  });

  it("Throws BadRequestException if invoice has no items", async () => {
    await expect(
      createInvoiceUseCase.execute(
        {
          customerId: "cust-uuid-aaa",
          items: [],
        },
        accountantUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("Throws NotFoundException if customer does not exist", async () => {
    await expect(
      createInvoiceUseCase.execute(
        {
          customerId: "cust-unknown",
          items: [{ description: "Test", quantity: 1, unitPrice: 50 }],
        },
        accountantUser,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});

/* eslint-disable @typescript-eslint/no-explicit-any */
import { ExecutionContext, CallHandler, BadRequestException } from "@nestjs/common";
import { of } from "rxjs";
import {
  IdempotencyInterceptor,
  IDEMPOTENCY_KEY_HEADER,
} from "../src/common/interceptors/idempotency.interceptor";
import { RecordPaymentUseCase } from "../src/modules/billing/application/use-cases/record-payment.use-case";
import { AuthenticatedUser } from "../src/modules/auth/domain/auth.types";
import { InvoiceStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { Reflector } from "@nestjs/core";
import { REQUIRE_IDEMPOTENCY_KEY } from "../src/common/decorators/require-idempotency.decorator";

describe("Payment Idempotency & Mandatory Enforcement", () => {
  let interceptor: IdempotencyInterceptor;
  let reflector: Reflector;

  const mockUser: AuthenticatedUser = {
    id: "user-acc-1",
    email: "accountant@hes.ma",
    firstName: "Karim",
    lastName: "Bennani",
    role: "OPERATOR",
    agencyId: "agency-casa-1",
    isActive: true,
    tokenVersion: 1,
    permissions: ["billing:manage"],
    isGlobalScope: true,
  };

  beforeEach(() => {
    reflector = new Reflector();
    interceptor = new IdempotencyInterceptor(undefined, reflector);
  });

  function createMockExecutionContext(options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    isDecorated?: boolean;
  }): ExecutionContext {
    const {
      method = "POST",
      url = "/api/v1/invoices/inv-uuid-1/payments",
      headers = {},
      isDecorated = true,
    } = options;

    const req: any = {
      method,
      url,
      originalUrl: url,
      headers: { ...headers },
    };

    const res: any = {
      statusCode: 201,
      headers: {},
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
    };

    const handler = () => {};
    const targetClass = class MockController {};

    if (isDecorated) {
      Reflect.defineMetadata(REQUIRE_IDEMPOTENCY_KEY, true, handler);
    }

    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
      getHandler: () => handler,
      getClass: () => targetClass,
    } as unknown as ExecutionContext;
  }

  describe("Mandatory Idempotency-Key Header Enforcement", () => {
    it("should throw 400 Bad Request if Idempotency-Key header is absent on payment endpoint", async () => {
      const context = createMockExecutionContext({
        url: "/api/v1/invoices/inv-uuid-1/payments",
        headers: {},
      });

      const next: CallHandler = {
        handle: jest.fn().mockReturnValue(of({ success: true })),
      };

      await expect(interceptor.intercept(context, next)).rejects.toThrow(
        BadRequestException,
      );
      await expect(interceptor.intercept(context, next)).rejects.toThrow(
        "L'en-tête 'Idempotency-Key' est obligatoire pour enregistrer un paiement.",
      );
      expect(next.handle).not.toHaveBeenCalled();
    });

    it("should throw 400 Bad Request if Idempotency-Key header is empty string or whitespace", async () => {
      const context = createMockExecutionContext({
        url: "/api/v1/invoices/inv-uuid-1/payments",
        headers: {
          "idempotency-key": "   ",
        },
      });

      const next: CallHandler = {
        handle: jest.fn().mockReturnValue(of({ success: true })),
      };

      await expect(interceptor.intercept(context, next)).rejects.toThrow(
        BadRequestException,
      );
      expect(next.handle).not.toHaveBeenCalled();
    });

    it("should allow other endpoints (shipments, scans, deliveries) to proceed WITHOUT Idempotency-Key header", async () => {
      const context = createMockExecutionContext({
        method: "POST",
        url: "/api/v1/shipments",
        headers: {},
        isDecorated: false,
      });

      const next: CallHandler = {
        handle: jest.fn().mockReturnValue(of({ id: "shipment-uuid-99" })),
      };

      const obs = await interceptor.intercept(context, next);
      let result: any;
      obs.subscribe((res) => {
        result = res;
      });

      expect(next.handle).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ id: "shipment-uuid-99" });
    });
  });

  describe("Deduplication & Single Record Guarantee for Duplicate Payments", () => {
    it("should process payment on first call and replay cached response without duplicate execution on second call", async () => {
      const idempotencyKey = "pay-key-unique-7777";
      const paymentResponse = {
        payment: {
          id: "pay-100",
          amount: 500,
          status: "PAID",
        },
        invoice: {
          id: "inv-uuid-1",
          paidAmount: 500,
          status: "PAID",
        },
      };

      const handlerMock = jest.fn().mockReturnValue(of(paymentResponse));
      const next: CallHandler = { handle: handlerMock };

      // 1. First invocation with Idempotency-Key
      const context1 = createMockExecutionContext({
        headers: {
          [IDEMPOTENCY_KEY_HEADER]: idempotencyKey,
        },
      });

      const obs1 = await interceptor.intercept(context1, next);
      let res1: any;
      obs1.subscribe((val) => {
        res1 = val;
      });

      expect(handlerMock).toHaveBeenCalledTimes(1);
      expect(res1).toEqual(paymentResponse);

      // 2. Second invocation with exact same Idempotency-Key
      const context2 = createMockExecutionContext({
        headers: {
          [IDEMPOTENCY_KEY_HEADER]: idempotencyKey,
        },
      });

      const obs2 = await interceptor.intercept(context2, next);
      let res2: any;
      obs2.subscribe((val) => {
        res2 = val;
      });

      // Handler MUST NOT be called a second time
      expect(handlerMock).toHaveBeenCalledTimes(1);
      expect(res2).toEqual(paymentResponse);

      const httpResponse2 = context2.switchToHttp().getResponse<any>();
      expect(httpResponse2.headers["x-idempotent-replayed"]).toBe("true");
      expect(httpResponse2.headers["x-idempotency-key"]).toBe(idempotencyKey);
    });
  });

  describe("RecordPaymentUseCase Business Logic", () => {
    let useCase: RecordPaymentUseCase;
    let mockPrisma: any;
    let mockEventBus: any;

    const sampleInvoice = {
      id: "inv-uuid-1",
      number: "FACT-202609-0010",
      invoiceNumber: "FACT-202609-0010",
      totalAmount: 1000.0,
      paidAmount: 0.0,
      status: InvoiceStatus.ISSUED,
      customerId: "cust-1",
      agencyId: "agency-casa-1",
    };

    beforeEach(() => {
      const paymentsCreated: any[] = [];
      let currentInvoice = { ...sampleInvoice };

      mockEventBus = {
        publish: jest.fn().mockResolvedValue(undefined),
      };

      mockPrisma = {
        invoice: {
          findUnique: jest.fn().mockImplementation(async ({ where }) => {
            if (where.id === currentInvoice.id) return currentInvoice;
            return null;
          }),
        },
        $transaction: jest.fn().mockImplementation(async (callback) => {
          const tx = {
            payment: {
              create: jest.fn().mockImplementation(async ({ data }) => {
                const p = {
                  id: `pay-${Date.now()}`,
                  ...data,
                  createdAt: new Date(),
                };
                paymentsCreated.push(p);
                return p;
              }),
            },
            invoice: {
              update: jest.fn().mockImplementation(async ({ where, data }) => {
                currentInvoice = {
                  ...currentInvoice,
                  ...data,
                };
                return currentInvoice;
              }),
            },
          };
          return callback(tx);
        }),
      };

      useCase = new RecordPaymentUseCase(mockPrisma, mockEventBus);
    });

    it("should record partial payment and update invoice status to PARTIALLY_PAID", async () => {
      const result = await useCase.execute(
        "inv-uuid-1",
        {
          amount: 400.0,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          reference: "VIR-001",
        },
        mockUser,
      );

      expect(result.payment.amount).toBe(400.0);
      expect(result.invoice.paidAmount).toBe(400.0);
      expect(result.invoice.remainingAmount).toBe(600.0);
      expect(result.invoice.status).toBe(InvoiceStatus.PARTIALLY_PAID);
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it("should mark invoice as PAID when cumulative payments reach totalAmount", async () => {
      // First partial payment 600
      await useCase.execute("inv-uuid-1", { amount: 600.0 }, mockUser);
      // Final payment 400
      const finalRes = await useCase.execute(
        "inv-uuid-1",
        { amount: 400.0 },
        mockUser,
      );

      expect(finalRes.invoice.paidAmount).toBe(1000.0);
      expect(finalRes.invoice.remainingAmount).toBe(0.0);
      expect(finalRes.invoice.status).toBe(InvoiceStatus.PAID);
    });
  });
});

import { GetDashboardSummaryUseCase } from "../src/modules/reports/application/use-cases/get-dashboard-summary.use-case";
import { GetReportDataUseCase } from "../src/modules/reports/application/use-cases/get-report-data.use-case";
import { PrismaService } from "../src/prisma/prisma.service";
import { buildShipmentWhere } from "../src/modules/reports/application/report-scope.helper";
import { ExportReportUseCase } from "../src/modules/reports/application/use-cases/export-report.use-case";
import { MAX_EXPORT_ROWS } from "../src/modules/reports/domain/report.types";

describe("Phase 15 Reporting: dashboard consistency and security scope", () => {
  it("should compute dashboard KPIs exactly from a known dataset", async () => {
    const prisma: any = {
      shipment: {
        count: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      collection: { count: jest.fn() },
      incident: { count: jest.fn() },
    };

    prisma.shipment.count
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(78)
      .mockResolvedValueOnce(18)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(45)
      .mockResolvedValueOnce(38)
      .mockResolvedValueOnce(6);

    prisma.shipment.groupBy.mockResolvedValue([
      { globalStatus: "DELIVERED", _count: { id: 78 } },
      { globalStatus: "IN_TRANSIT", _count: { id: 18 } },
      { globalStatus: "OUT_FOR_DELIVERY", _count: { id: 10 } },
      { globalStatus: "REGISTERED", _count: { id: 7 } },
      { globalStatus: "CANCELLED", _count: { id: 5 } },
      { globalStatus: "RETURNED", _count: { id: 2 } },
    ]);
    prisma.shipment.aggregate.mockResolvedValue({
      _sum: { shippingFee: 225000 },
    });
    prisma.collection.count.mockResolvedValueOnce(45).mockResolvedValueOnce(38);
    prisma.incident.count.mockResolvedValue(6);

    const useCase = new GetDashboardSummaryUseCase(prisma);
    const result = await useCase.execute(
      { period: "month", agencyId: "agency-1" },
      {
        id: "user-1",
        email: "ops@hes.ma",
        firstName: "Ops",
        lastName: "Manager",
        role: "AGENCY_MANAGER",
        agencyId: "agency-1",
        customerId: null,
        isActive: true,
        tokenVersion: 1,
        permissions: ["reports:view"],
        isGlobalScope: false,
      },
    );

    expect(result.kpis.totalShipments).toBe(120);
    expect(result.kpis.totalRevenue).toBe(225000);
    expect(result.kpis.deliverySuccessRate).toBe(91.76);
    expect(result.kpis.collectionsTotal).toBe(45);
    expect(result.kpis.collectionsCompleted).toBe(38);
    expect(result.kpis.openIncidents).toBe(6);
  });

  it("should enforce agency scope before aggregation for non-global users", () => {
    const where = buildShipmentWhere(
      {
        id: "user-1",
        email: "ops@hes.ma",
        firstName: "Ops",
        lastName: "Manager",
        role: "AGENCY_MANAGER",
        agencyId: "agency-1",
        customerId: null,
        isActive: true,
        tokenVersion: 1,
        permissions: ["reports:view"],
        isGlobalScope: false,
      },
      { status: "DELIVERED" },
      {
        from: new Date("2026-09-01"),
        to: new Date("2026-09-30"),
        label: "Septembre",
      },
    );

    expect(where).toMatchObject({
      deletedAt: null,
      createdAt: {
        gte: new Date("2026-09-01"),
        lte: new Date("2026-09-30"),
      },
      globalStatus: "DELIVERED",
      OR: [{ originAgencyId: "agency-1" }, { destinationAgencyId: "agency-1" }],
    });
  });

  it("should reject exports above the strict maximum row limit", async () => {
    const getReportData = {
      execute: jest
        .fn()
        .mockResolvedValue({ meta: { total: MAX_EXPORT_ROWS + 1 } }),
    };
    const getDashboardSummary = {
      execute: jest
        .fn()
        .mockResolvedValue({ period: { label: "Mois en cours" } }),
    };

    const useCase = new ExportReportUseCase(
      getReportData as unknown as GetReportDataUseCase,
      getDashboardSummary as unknown as GetDashboardSummaryUseCase,
    );

    await expect(
      useCase.execute(
        {
          type: "SHIPMENTS",
          period: "month",
          format: "excel",
          page: 1,
          limit: 20,
        },
        {
          id: "user-1",
          email: "ops@hes.ma",
          firstName: "Ops",
          lastName: "Manager",
          role: "AGENCY_MANAGER",
          agencyId: "agency-1",
          customerId: null,
          isActive: true,
          tokenVersion: 1,
          permissions: ["reports:view"],
          isGlobalScope: false,
        },
      ),
    ).rejects.toThrow(/Export limité à/);
  });

  it("should generate Excel and PDF exports within the limits", async () => {
    const mockData = [
      {
        id: "ship-1",
        number: "HES-2026-001",
        trackingNumber: "HES-2026-001",
        globalStatus: "DELIVERED",
        recipientName: "Karim Alaoui",
        recipientCity: "Casablanca",
        shippingFee: 150,
        createdAt: new Date("2026-09-02"),
        originAgency: { code: "CAS" },
        senderCustomer: { legalName: "Atlas Commerce" },
      },
    ];

    const getReportData = {
      execute: jest.fn().mockResolvedValue({
        data: mockData,
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      }),
    };
    const getDashboardSummary = {
      execute: jest.fn().mockResolvedValue({
        period: { label: "Mois en cours" },
        kpis: {
          totalShipments: 1,
          delivered: 1,
          inTransit: 0,
          outForDelivery: 0,
          pending: 0,
          cancelled: 0,
          returned: 0,
          collectionsTotal: 0,
          collectionsCompleted: 0,
          openIncidents: 0,
          deliverySuccessRate: 100,
          totalRevenue: 150,
        },
      }),
    };

    const useCase = new ExportReportUseCase(
      getReportData as unknown as GetReportDataUseCase,
      getDashboardSummary as unknown as GetDashboardSummaryUseCase,
    );

    const user = {
      id: "user-1",
      email: "ops@hes.ma",
      firstName: "Ops",
      lastName: "Manager",
      role: "AGENCY_MANAGER",
      agencyId: "agency-1",
      customerId: null,
      isActive: true,
      tokenVersion: 1,
      permissions: ["reports:view"],
      isGlobalScope: false,
    };

    const excelExport = await useCase.execute(
      { type: "SHIPMENTS", period: "month", format: "excel", page: 1, limit: 20 },
      user,
    );
    expect(excelExport.contentType).toBe("text/csv; charset=utf-8");
    expect(excelExport.filename).toMatch(/hes-rapport-shipments-.*\.csv$/);
    expect(excelExport.buffer.toString("utf8")).toContain("HES-2026-001");
    expect(excelExport.buffer.toString("utf8")).toContain("Karim Alaoui");

    const pdfExport = await useCase.execute(
      { type: "SHIPMENTS", period: "month", format: "pdf", page: 1, limit: 20 },
      user,
    );
    expect(pdfExport.contentType).toBe("application/pdf");
    expect(pdfExport.filename).toMatch(/hes-rapport-shipments-.*\.pdf$/);
    expect(pdfExport.buffer.length).toBeGreaterThan(100);
  });

  it("should fetch and paginate report data for shipments, deliveries and revenue", async () => {
    const prisma: any = {
      shipment: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: "ship-1",
            number: "HES-CAS-001",
            trackingNumber: "HES-CAS-001",
            globalStatus: "DELIVERED",
            recipientName: "Mehdi Tazi",
            recipientAddress: "123 Bd Anfa, Casablanca",
            shippingFee: 120,
            createdAt: new Date(),
            originAgency: { code: "CAS", name: "Casablanca" },
            destinationAgency: { code: "RAB", name: "Rabat" },
            senderCustomer: { code: "CLI-01", legalName: "TechCorp" },
            destinationAddress: { city: "Rabat" },
          },
        ]),
      },
      deliveryRunItem: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: "run-item-1",
            status: "COMPLETED",
            deliveredAt: new Date(),
            updatedAt: new Date(),
            parcel: {
              number: "P-01",
              trackingNumber: "P-01",
              shipment: {
                number: "HES-CAS-001",
                trackingNumber: "HES-CAS-001",
                recipientName: "Mehdi Tazi",
                recipientAddress: "Rabat",
                destinationAddress: { city: "Rabat" },
              },
            },
            deliveryRun: {
              number: "RUN-101",
              runDate: new Date(),
              courier: {
                user: { firstName: "Samir", lastName: "Livreur" },
              },
            },
          },
        ]),
      },
      invoice: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: "inv-1",
            number: "FAC-2026-001",
            invoiceNumber: "FAC-2026-001",
            status: "ISSUED",
            issueDate: new Date(),
            totalAmount: 5000,
            paidAmount: 2000,
            customer: { code: "CLI-01", legalName: "TechCorp" },
          },
        ]),
      },
    };

    const useCase = new GetReportDataUseCase(prisma);
    const user = {
      id: "admin-1",
      email: "admin@hes.ma",
      firstName: "Admin",
      lastName: "Super",
      role: "SUPER_ADMIN",
      agencyId: null,
      customerId: null,
      isActive: true,
      tokenVersion: 1,
      permissions: ["reports:view"],
      isGlobalScope: true,
    };

    const shipmentsResult = await useCase.execute(
      { type: "SHIPMENTS", period: "month", page: 1, limit: 10 },
      user,
    );
    expect(shipmentsResult.meta.total).toBe(1);
    expect(shipmentsResult.data[0].recipientCity).toBe("Rabat");

    const deliveriesResult = await useCase.execute(
      { type: "DELIVERIES", period: "month", page: 1, limit: 10 },
      user,
    );
    expect(deliveriesResult.meta.total).toBe(1);
    expect(deliveriesResult.data[0].deliveryRun.runNumber).toBe("RUN-101");

    const revenueResult = await useCase.execute(
      { type: "REVENUE", period: "month", page: 1, limit: 10 },
      user,
    );
    expect(revenueResult.meta.total).toBe(1);
    expect(revenueResult.data[0].remainingAmount).toBe(3000);
  });
});

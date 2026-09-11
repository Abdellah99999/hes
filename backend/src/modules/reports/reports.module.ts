import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { GetDashboardSummaryUseCase } from "./application/use-cases/get-dashboard-summary.use-case";
import { GetReportDataUseCase } from "./application/use-cases/get-report-data.use-case";
import { ExportReportUseCase } from "./application/use-cases/export-report.use-case";

@Module({
  controllers: [ReportsController],
  providers: [
    GetDashboardSummaryUseCase,
    GetReportDataUseCase,
    ExportReportUseCase,
  ],
  exports: [GetDashboardSummaryUseCase],
})
export class ReportsModule {}

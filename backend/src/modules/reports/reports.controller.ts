import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  StreamableFile,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from "@nestjs/swagger";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/domain/auth.types";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import {
  ReportDataQueryDto,
  ReportExportQueryDto,
} from "./dto/report-query.dto";
import { GetDashboardSummaryUseCase } from "./application/use-cases/get-dashboard-summary.use-case";
import { GetReportDataUseCase } from "./application/use-cases/get-report-data.use-case";
import { ExportReportUseCase } from "./application/use-cases/export-report.use-case";

@ApiTags("Dashboard & Rapports (Phase 15)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("reports:view")
@Controller("reports")
export class ReportsController {
  constructor(
    private readonly getDashboardSummary: GetDashboardSummaryUseCase,
    private readonly getReportDataUseCase: GetReportDataUseCase,
    private readonly exportReport: ExportReportUseCase,
  ) {}

  @Get("dashboard")
  @ApiOperation({
    summary:
      "Synthèse dashboard — KPIs agrégés avec filtres temporels et métier",
  })
  @ApiResponse({ status: 200, description: "KPIs et répartition par statut" })
  async getDashboard(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.getDashboardSummary.execute(query, user);
  }

  @Get("data")
  @ApiOperation({ summary: "Données détaillées paginées par type de rapport" })
  async getReportData(
    @Query() query: ReportDataQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.getReportDataUseCase.execute(query, user);
  }

  @Get("export")
  @ApiOperation({
    summary: "Export PDF ou Excel (CSV) — limité à 10 000 lignes",
  })
  async exportReportFile(
    @Query() query: ReportExportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const result = await this.exportReport.execute(query, user);

    res.setHeader("Content-Type", result.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );

    return new StreamableFile(result.buffer);
  }
}

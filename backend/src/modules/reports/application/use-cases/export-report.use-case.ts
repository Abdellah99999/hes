import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { ReportExportQueryDto } from "../../dto/report-query.dto";
import { GetReportDataUseCase } from "./get-report-data.use-case";
import { GetDashboardSummaryUseCase } from "./get-dashboard-summary.use-case";
import { MAX_EXPORT_ROWS } from "../../domain/report.types";
import { generateReportPdf } from "../../generators/report-pdf.generator";
import { generateReportExcel } from "../../generators/report-excel.generator";

@Injectable()
export class ExportReportUseCase {
  constructor(
    private readonly getReportData: GetReportDataUseCase,
    private readonly getDashboardSummary: GetDashboardSummaryUseCase,
    private readonly configService?: ConfigService,
  ) {}

  async execute(query: ReportExportQueryDto, user: AuthenticatedUser) {
    const countResult = await this.getReportData.execute(
      { ...query, page: 1, limit: 1 },
      user,
    );

    if (countResult.meta.total > MAX_EXPORT_ROWS) {
      throw new BadRequestException(
        `Export limité à ${MAX_EXPORT_ROWS} lignes. Résultat: ${countResult.meta.total}. Affinez vos filtres.`,
      );
    }

    const fullResult = await this.getReportData.execute(
      { ...query, page: 1, limit: MAX_EXPORT_ROWS },
      user,
    );

    const summary = await this.getDashboardSummary.execute(query, user);

    const appName =
      this.configService?.get<string>("appName", "HES Logistics Platform") ||
      "HES Logistics Platform";
    const title = `Rapport ${appName} — ${query.type} — ${summary.period.label}`;

    if (query.format === "pdf") {
      const buffer = generateReportPdf(
        title,
        summary,
        fullResult.data,
        query.type,
      );
      return {
        buffer,
        contentType: "application/pdf",
        filename: `hes-rapport-${query.type.toLowerCase()}-${Date.now()}.pdf`,
      };
    }

    const buffer = generateReportExcel(title, fullResult.data, query.type);
    return {
      buffer,
      contentType: "text/csv; charset=utf-8",
      filename: `hes-rapport-${query.type.toLowerCase()}-${Date.now()}.csv`,
    };
  }
}

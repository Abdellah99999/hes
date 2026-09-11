import { Module } from "@nestjs/common";
import { IncidentsController } from "./incidents.controller";
import { ReportIncidentUseCase } from "./application/use-cases/report-incident.use-case";
import { DecideIncidentUseCase } from "./application/use-cases/decide-incident.use-case";
import { ListIncidentsUseCase } from "./application/use-cases/list-incidents.use-case";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { EventBusModule } from "../../common/events/event-bus.module";

@Module({
  imports: [PrismaModule, AuthModule, EventBusModule],
  controllers: [IncidentsController],
  providers: [
    ReportIncidentUseCase,
    DecideIncidentUseCase,
    ListIncidentsUseCase,
  ],
  exports: [ReportIncidentUseCase, DecideIncidentUseCase, ListIncidentsUseCase],
})
export class IncidentsModule {}


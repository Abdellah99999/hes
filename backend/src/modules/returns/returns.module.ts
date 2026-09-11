import { Module } from "@nestjs/common";
import { ReturnsController } from "./returns.controller";
import { CreateReturnUseCase } from "./application/use-cases/create-return.use-case";
import { RecoverReturnUseCase } from "./application/use-cases/recover-return.use-case";
import { ListReturnsUseCase } from "./application/use-cases/list-returns.use-case";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { EventBusModule } from "../../common/events/event-bus.module";

@Module({
  imports: [PrismaModule, AuthModule, EventBusModule],
  controllers: [ReturnsController],
  providers: [CreateReturnUseCase, RecoverReturnUseCase, ListReturnsUseCase],
  exports: [CreateReturnUseCase, RecoverReturnUseCase, ListReturnsUseCase],
})
export class ReturnsModule {}

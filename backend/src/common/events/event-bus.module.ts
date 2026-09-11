import { Module, Global } from "@nestjs/common";
import { EventBusService } from "./event-bus.service";
import { RedisModule } from "../../modules/redis/redis.module";

@Global()
@Module({
  imports: [RedisModule],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventBusModule {}

import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import configuration from "./config/configuration";
import { validateEnv } from "./config/env.validation";
import { CorrelationIdMiddleware } from "./common/middleware/correlation-id.middleware";
import { IdempotencyInterceptor } from "./common/interceptors/idempotency.interceptor";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./modules/redis/redis.module";
import { ThrottlerStorageRedisService } from "./modules/redis/throttler-storage-redis.service";
import { StorageModule } from "./modules/storage/storage.module";
import { HealthModule } from "./modules/health/health.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { AgenciesModule } from "./modules/agencies/agencies.module";
import { ZonesModule } from "./modules/zones/zones.module";
import { CustomerTypesModule } from "./modules/customer-types/customer-types.module";
import { CustomersModule } from "./modules/customers/customers.module";
import { CustomerContactsModule } from "./modules/customer-contacts/customer-contacts.module";
import { AddressesModule } from "./modules/addresses/addresses.module";
import { ShipmentsModule } from "./modules/shipments/shipments.module";
import { TransfersModule } from "./modules/transfers/transfers.module";
import { CollectionsModule } from "./modules/collections/collections.module";
import { RunsModule } from "./modules/runs/runs.module";
import { DeliveriesModule } from "./modules/deliveries/deliveries.module";
import { ReturnsModule } from "./modules/returns/returns.module";
import { IncidentsModule } from "./modules/incidents/incidents.module";
import { BillingModule } from "./modules/billing/billing.module";
import { DocumentsModule } from "./modules/documents/documents.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { EventBusModule } from "./common/events/event-bus.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: [".env.local", ".env"],
    }),
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [ThrottlerStorageRedisService],
      useFactory: (storage: ThrottlerStorageRedisService) => ({
        storage,
        throttlers: [
          {
            name: "short",
            ttl: 1000, // 1 second
            limit: 10, // 10 requests / sec
          },
          {
            name: "medium",
            ttl: 60000, // 1 minute
            limit: 100, // 100 requests / min
          },
        ],
      }),
    }),
    PrismaModule,
    RedisModule,
    StorageModule,
    HealthModule,
    AuthModule,
    UsersModule,
    AgenciesModule,
    ZonesModule,
    CustomerTypesModule,
    CustomersModule,
    CustomerContactsModule,
    AddressesModule,
    ShipmentsModule,
    TransfersModule,
    CollectionsModule,
    RunsModule,
    DeliveriesModule,
    ReturnsModule,
    IncidentsModule,
    BillingModule,
    DocumentsModule,
    NotificationsModule,
    ReportsModule,
    EventBusModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}

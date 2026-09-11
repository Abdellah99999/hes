import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CustomerTypesController } from "./customer-types.controller";
import { CUSTOMER_TYPE_REPOSITORY } from "./domain/customer-type.repository.interface";
import { PrismaCustomerTypeRepository } from "./infrastructure/prisma-customer-type.repository";
import { CustomerTypeUseCases } from "./application/customer-types.use-cases";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CustomerTypesController],
  providers: [
    {
      provide: CUSTOMER_TYPE_REPOSITORY,
      useClass: PrismaCustomerTypeRepository,
    },
    CustomerTypeUseCases,
  ],
  exports: [CUSTOMER_TYPE_REPOSITORY, CustomerTypeUseCases],
})
export class CustomerTypesModule {}

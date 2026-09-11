import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CustomersController } from "./customers.controller";
import { CUSTOMER_REPOSITORY } from "./domain/customer.repository.interface";
import { PrismaCustomerRepository } from "./infrastructure/prisma-customer.repository";
import { CreateCustomerUseCase } from "./application/use-cases/create-customer.use-case";
import { UpdateCustomerUseCase } from "./application/use-cases/update-customer.use-case";
import { GetCustomerUseCase } from "./application/use-cases/get-customer.use-case";
import { ListCustomersUseCase } from "./application/use-cases/list-customers.use-case";
import { DeleteCustomerUseCase } from "./application/use-cases/delete-customer.use-case";
import { AssignCustomerManagerUseCase } from "./application/use-cases/assign-customer-manager.use-case";
import { GetCustomerManagerHistoryUseCase } from "./application/use-cases/get-customer-manager-history.use-case";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CustomersController],
  providers: [
    {
      provide: CUSTOMER_REPOSITORY,
      useClass: PrismaCustomerRepository,
    },
    CreateCustomerUseCase,
    UpdateCustomerUseCase,
    GetCustomerUseCase,
    ListCustomersUseCase,
    DeleteCustomerUseCase,
    AssignCustomerManagerUseCase,
    GetCustomerManagerHistoryUseCase,
  ],
  exports: [CUSTOMER_REPOSITORY, GetCustomerUseCase],
})
export class CustomersModule {}

import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CustomerContactsController } from "./customer-contacts.controller";
import { CUSTOMER_CONTACT_REPOSITORY } from "./domain/customer-contact.repository.interface";
import { PrismaCustomerContactRepository } from "./infrastructure/prisma-customer-contact.repository";
import { CustomerContactsUseCases } from "./application/customer-contacts.use-cases";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CustomerContactsController],
  providers: [
    {
      provide: CUSTOMER_CONTACT_REPOSITORY,
      useClass: PrismaCustomerContactRepository,
    },
    CustomerContactsUseCases,
  ],
  exports: [CUSTOMER_CONTACT_REPOSITORY, CustomerContactsUseCases],
})
export class CustomerContactsModule {}

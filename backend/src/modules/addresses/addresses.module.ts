import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AddressesController } from "./addresses.controller";
import { ADDRESS_REPOSITORY } from "./domain/address.repository.interface";
import { PrismaAddressRepository } from "./infrastructure/prisma-address.repository";
import { AddressesUseCases } from "./application/addresses.use-cases";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AddressesController],
  providers: [
    {
      provide: ADDRESS_REPOSITORY,
      useClass: PrismaAddressRepository,
    },
    AddressesUseCases,
  ],
  exports: [ADDRESS_REPOSITORY, AddressesUseCases],
})
export class AddressesModule {}

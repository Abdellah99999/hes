import { CustomerType } from "@prisma/client";
import { CreateCustomerTypeDto } from "../dto/create-customer-type.dto";
import { UpdateCustomerTypeDto } from "../dto/update-customer-type.dto";
import { CustomerTypeQueryDto } from "../dto/customer-type-query.dto";

export const CUSTOMER_TYPE_REPOSITORY = "CUSTOMER_TYPE_REPOSITORY";

export interface ICustomerTypeRepository {
  create(dto: CreateCustomerTypeDto): Promise<CustomerType>;
  findById(id: string): Promise<CustomerType | null>;
  findByCode(code: string): Promise<CustomerType | null>;
  findAll(query: CustomerTypeQueryDto): Promise<CustomerType[]>;
  update(id: string, dto: UpdateCustomerTypeDto): Promise<CustomerType>;
  delete(id: string): Promise<CustomerType>;
}

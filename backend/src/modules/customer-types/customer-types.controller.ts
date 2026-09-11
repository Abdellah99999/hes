import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { CreateCustomerTypeDto } from "./dto/create-customer-type.dto";
import { UpdateCustomerTypeDto } from "./dto/update-customer-type.dto";
import { CustomerTypeQueryDto } from "./dto/customer-type-query.dto";
import { CustomerTypeUseCases } from "./application/customer-types.use-cases";

@ApiTags("Customer Types")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("customer-types")
export class CustomerTypesController {
  constructor(private readonly useCases: CustomerTypeUseCases) {}

  @Post()
  @RequirePermissions("referentials:manage")
  @ApiOperation({ summary: "Créer un nouveau type client" })
  @ApiResponse({ status: 201, description: "Type client créé" })
  @ApiResponse({ status: 409, description: "Code type client déjà existant" })
  async create(@Body() dto: CreateCustomerTypeDto) {
    return this.useCases.create(dto);
  }

  @Get()
  @RequirePermissions("referentials:read")
  @ApiOperation({ summary: "Lister les types de clients (référentiel)" })
  async findAll(@Query() query: CustomerTypeQueryDto) {
    return this.useCases.findAll(query);
  }

  @Get(":id")
  @RequirePermissions("referentials:read")
  @ApiOperation({ summary: "Obtenir un type client par son identifiant" })
  @ApiResponse({ status: 404, description: "Type client introuvable" })
  async findOne(@Param("id") id: string) {
    return this.useCases.findById(id);
  }

  @Patch(":id")
  @RequirePermissions("referentials:manage")
  @ApiOperation({ summary: "Modifier un type client" })
  @ApiResponse({ status: 404, description: "Type client introuvable" })
  async update(@Param("id") id: string, @Body() dto: UpdateCustomerTypeDto) {
    return this.useCases.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("referentials:manage")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Supprimer un type client (si non système)" })
  @ApiResponse({ status: 400, description: "Type système non supprimable" })
  async remove(@Param("id") id: string) {
    return this.useCases.delete(id);
  }
}

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/domain/auth.types";
import { DocumentService } from "./application/document.service";
import { DocumentType } from "./domain/document.types";
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class GenerateDocumentDto {
  @IsEnum(DocumentType)
  documentType!: DocumentType;

  @IsString()
  @IsNotEmpty({ message: "L'identifiant de l'entité est requis." })
  entityId!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  copiesCount?: number;
}

@ApiTags("Documents & Impression (Phase 13)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("documents")
export class DocumentsController {
  constructor(private readonly documentService: DocumentService) {}

  @Post("generate")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions("documents:generate")
  @ApiOperation({
    summary:
      "Générer un document officiel (PDF) avec versionnement et URL signée",
  })
  @ApiResponse({
    status: 201,
    description: "Document généré avec URL de téléchargement pré-signée",
  })
  async generateDocument(
    @Body() dto: GenerateDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const res = await this.documentService.generateAndStore(
      dto.documentType,
      dto.entityId,
      dto.copiesCount || 1,
      user,
    );

    return {
      document: res.document,
      downloadUrl: res.downloadUrl,
      fileName: res.fileName,
      mimeType: res.mimeType,
    };
  }

  @Get(":id/download-url")
  @RequirePermissions("documents:download")
  @ApiOperation({
    summary:
      "Obtenir une URL pré-signée éphémère (15 min) pour télécharger un document",
  })
  async getDownloadUrl(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentService.getDownloadUrl(id, user);
  }

  @Post("preview")
  @RequirePermissions("documents:generate")
  @ApiOperation({ summary: "Prévisualisation directe PDF (stream HTTP)" })
  async previewDocument(
    @Body() dto: GenerateDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const result = await this.documentService.generateAndStore(
      dto.documentType,
      dto.entityId,
      dto.copiesCount || 1,
      user,
    );

    res.set({
      "Content-Type": result.mimeType,
      "Content-Disposition": `inline; filename="${result.fileName}"`,
      "Content-Length": result.buffer.length,
    });

    res.end(result.buffer);
  }
}

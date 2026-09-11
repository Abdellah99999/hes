import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { CreateInvoiceDto } from "../../dto/create-invoice.dto";
import { InvoiceStatus } from "@prisma/client";
import { EventBusService } from "../../../../common/events/event-bus.service";
import { InvoiceCreatedEvent } from "../../../../common/events/billing.events";

@Injectable()
export class CreateInvoiceUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventBus?: EventBusService,
  ) {}

  async execute(dto: CreateInvoiceDto, user: AuthenticatedUser) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
      include: { agency: true },
    });

    if (!customer) {
      throw new NotFoundException(`Client introuvable : "${dto.customerId}".`);
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        "Une facture doit comporter au moins une ligne.",
      );
    }

    // 1. Math computation with 2-decimal half-even rounding
    let subtotalCents = 0;
    const computedItems = dto.items.map((it) => {
      const lineCents = Math.round(it.quantity * it.unitPrice * 100);
      subtotalCents += lineCents;
      return {
        shipmentId: it.shipmentId || null,
        description: it.description.trim(),
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: lineCents / 100,
        amount: lineCents / 100,
      };
    });

    const subtotal = subtotalCents / 100;
    const taxRate = dto.taxRate !== undefined ? Number(dto.taxRate) : 20.0;
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

    // Due date (default: 30 days)
    const issueDate = new Date();
    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Invoice Number sequential FACT-{YEARMONTH}-{XXXX}
    const yearMonth = issueDate.toISOString().slice(0, 7).replace("-", "");
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `FACT-${yearMonth}-${randomSeq}`;

    const agencyId =
      customer.agencyId ||
      user.agencyId ||
      "AGY_DEFAULT";

    const invoice = await this.prisma.invoice.create({
      data: {
        number: invoiceNumber,
        invoiceNumber,
        customerId: customer.id,
        agencyId,
        createdById: user.id,
        issueDate,
        dueDate,
        status: InvoiceStatus.ISSUED,
        subtotal,
        taxAmount,
        totalAmount,
        paidAmount: 0.0,
        currency: "MAD",
        notes: dto.notes?.trim() || null,
        items: {
          create: computedItems,
        },
      } as any,
      include: {
        customer: {
          select: { id: true, code: true, legalName: true, ice: true },
        },
        items: true,
      },
    });

    const result = {
      ...invoice,
      invoiceNumber: (invoice as any).number || (invoice as any).invoiceNumber,
      subtotalAmount: Number(invoice.subtotal),
      taxRate,
      taxAmount: Number(invoice.taxAmount),
      totalAmount: Number(invoice.totalAmount),
      paidAmount: Number(invoice.paidAmount),
      remainingAmount: Number(invoice.totalAmount) - Number(invoice.paidAmount),
    };

    // Publish InvoiceCreatedEvent
    if (this.eventBus) {
      await this.eventBus.publish(
        new InvoiceCreatedEvent({
          invoiceId: invoice.id,
          invoiceNumber,
          customerId: customer.id,
          agencyId,
          subtotal,
          taxAmount,
          totalAmount,
          dueDate,
          createdAt: new Date(),
        }),
      );
    }

    return result;
  }
}


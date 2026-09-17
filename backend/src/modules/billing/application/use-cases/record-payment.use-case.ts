import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../../../../prisma/prisma.service";
import { AuthenticatedUser } from "../../../auth/domain/auth.types";
import { RecordPaymentDto } from "../../dto/record-payment.dto";
import { InvoiceStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { EventBusService } from "../../../../common/events/event-bus.service";
import { PaymentRecordedEvent } from "../../../../common/events/billing.events";

@Injectable()
export class RecordPaymentUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventBus?: EventBusService,
  ) {}

  async execute(
    invoiceId: string,
    dto: RecordPaymentDto,
    user: AuthenticatedUser,
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true },
    });

    if (!invoice) {
      throw new NotFoundException(`Facture introuvable : "${invoiceId}".`);
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException(
        "Impossible d'enregistrer un paiement sur une facture annulée.",
      );
    }

    // Customer scope check
    if (
      user.role === "CUSTOMER" &&
      user.customerId &&
      invoice.customerId !== user.customerId
    ) {
      throw new ForbiddenException(
        "Accès refusé : vous ne pouvez régler que les factures de votre propre compte.",
      );
    }

    // Agency scope check
    if (
      !user.isGlobalScope &&
      user.agencyId &&
      invoice.agencyId &&
      invoice.agencyId !== user.agencyId
    ) {
      throw new ForbiddenException(
        "Accès refusé : la facture n'appartient pas à votre agence.",
      );
    }

    const currentPaid = Number(invoice.paidAmount || 0);
    const newPaid = Math.round((currentPaid + dto.amount) * 100) / 100;
    const totalAmount = Number(invoice.totalAmount);
    const newStatus =
      newPaid >= totalAmount
        ? InvoiceStatus.PAID
        : InvoiceStatus.PARTIALLY_PAID;

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod || PaymentMethod.CASH,
          reference: dto.reference?.trim() || null,
          status: PaymentStatus.PAID,
          paidAt: new Date(),
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaid,
          status: newStatus,
        },
      });

      return {
        payment: {
          id: payment.id,
          invoiceId: payment.invoiceId,
          amount: Number(payment.amount),
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          reference: payment.reference,
          paidAt: payment.paidAt,
          createdAt: payment.createdAt,
        },
        invoice: {
          id: updatedInvoice.id,
          invoiceNumber: updatedInvoice.invoiceNumber ?? "",
          totalAmount: Number(updatedInvoice.totalAmount),
          paidAmount: Number(updatedInvoice.paidAmount),
          remainingAmount:
            Math.round(
              (Number(updatedInvoice.totalAmount) -
                Number(updatedInvoice.paidAmount)) *
                100,
            ) / 100,
          status: updatedInvoice.status,
        },
      };
    });

    if (this.eventBus) {
      await this.eventBus.publish(
        new PaymentRecordedEvent({
          paymentId: result.payment.id,
          invoiceId: invoice.id,
          amount: result.payment.amount,
          paymentMethod: result.payment.paymentMethod,
          recordedAt: new Date(),
        }),
      );
    }

    return result;
  }
}

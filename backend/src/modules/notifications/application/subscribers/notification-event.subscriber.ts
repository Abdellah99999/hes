import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { EventBusService } from "../../../../common/events/event-bus.service";
import { PrismaService } from "../../../../prisma/prisma.service";
import { NotificationService } from "../notification.service";
import { NotificationChannel } from "../../domain/notification.types";

import { CollectionCompletedEvent } from "../../../../common/events/collection.events";
import {
  TransferCreatedEvent,
  TransferReceivedEvent,
} from "../../../../common/events/transfer.events";
import { ShipmentAssignedToCourierEvent } from "../../../../common/events/run.events";
import {
  DeliveryCompletedEvent,
  DeliveryFailedEvent,
} from "../../../../common/events/delivery.events";
import { ReturnCreatedEvent } from "../../../../common/events/return.events";
import { IncidentCreatedEvent } from "../../../../common/events/incident.events";
import { InvoiceCreatedEvent } from "../../../../common/events/billing.events";

@Injectable()
export class NotificationEventSubscriber implements OnModuleInit {
  private readonly logger = new Logger(NotificationEventSubscriber.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  onModuleInit() {
    this.logger.log(
      "[NotificationEventSubscriber] Registering domain event listeners...",
    );

    // 1. Collection Completed -> Notify Customer
    this.eventBus.subscribe<CollectionCompletedEvent>(
      "CollectionCompleted",
      async (event) => this.handleCollectionCompleted(event),
    );

    // 2. Transfer Created -> Notify Destination Agency Staff
    this.eventBus.subscribe<TransferCreatedEvent>(
      "TransferCreated",
      async (event) => this.handleTransferCreated(event),
    );

    // 3. Transfer Received -> Notify Origin Agency Staff
    this.eventBus.subscribe<TransferReceivedEvent>(
      "TransferReceived",
      async (event) => this.handleTransferReceived(event),
    );

    // 4. Shipment Assigned to Courier -> Notify Courier
    this.eventBus.subscribe<ShipmentAssignedToCourierEvent>(
      "ShipmentAssignedToCourier",
      async (event) => this.handleShipmentAssignedToCourier(event),
    );

    // 5. Delivery Completed -> Notify Sender Customer
    this.eventBus.subscribe<DeliveryCompletedEvent>(
      "DeliveryCompleted",
      async (event) => this.handleDeliveryCompleted(event),
    );

    // 6. Delivery Failed -> Notify Sender Customer & Supervisor
    this.eventBus.subscribe<DeliveryFailedEvent>(
      "DeliveryFailed",
      async (event) => this.handleDeliveryFailed(event),
    );

    // 7. Return Created -> Notify Customer
    this.eventBus.subscribe<ReturnCreatedEvent>("ReturnCreated", async (event) =>
      this.handleReturnCreated(event),
    );

    // 8. Incident Created -> Notify Supervisor & Reporting User
    this.eventBus.subscribe<IncidentCreatedEvent>(
      "IncidentCreated",
      async (event) => this.handleIncidentCreated(event),
    );

    // 9. Invoice Created -> Notify Customer
    this.eventBus.subscribe<InvoiceCreatedEvent>(
      InvoiceCreatedEvent.EVENT_NAME,
      async (event) => this.handleInvoiceCreated(event),
    );

    this.logger.log(
      "[NotificationEventSubscriber] All domain event listeners registered successfully.",
    );
  }

  // --- Handlers ---

  async handleCollectionCompleted(event: CollectionCompletedEvent) {
    const { payload } = event;
    const targetUserId = await this.resolveCustomerUserId(payload.customerId);
    if (!targetUserId) return;

    await this.notificationService.dispatch({
      userId: targetUserId,
      channel: NotificationChannel.IN_APP,
      title: `Collecte validée - ${payload.collectionNumber}`,
      body: `Collecte de ${payload.parcelsCount} colis effectuée avec succès. Expédition générée : ${payload.shipmentTrackingNumber}.`,
      metadata: {
        collectionId: payload.collectionId,
        shipmentTracking: payload.shipmentTrackingNumber,
      },
    });
  }

  async handleTransferCreated(event: TransferCreatedEvent) {
    const { payload } = event;
    const targetUserId =
      (await this.resolveAgencyStaffUserId(payload.destinationAgencyId)) ||
      payload.createdByUserId;

    await this.notificationService.dispatch({
      userId: targetUserId,
      channel: NotificationChannel.IN_APP,
      title: `Navette en transit - ${payload.transferNumber}`,
      body: `Une navette avec ${payload.totalExpectedParcels} colis est en route vers votre agence.`,
      metadata: { transferId: payload.transferId },
    });
  }

  async handleTransferReceived(event: TransferReceivedEvent) {
    const { payload } = event;
    const targetUserId =
      (await this.resolveAgencyStaffUserId(payload.originAgencyId)) ||
      payload.receivedByUserId;

    const discrepancyText = payload.hasDiscrepancy
      ? ` (${payload.missingCount} colis manquants)`
      : "";

    await this.notificationService.dispatch({
      userId: targetUserId,
      channel: NotificationChannel.IN_APP,
      title: `Navette réceptionnée - ${payload.transferNumber}`,
      body: `La navette a été réceptionnée : ${payload.receivedCount} colis reçus${discrepancyText}.`,
      metadata: {
        transferId: payload.transferId,
        hasDiscrepancy: payload.hasDiscrepancy,
      },
    });
  }

  async handleShipmentAssignedToCourier(
    event: ShipmentAssignedToCourierEvent,
  ) {
    const { payload } = event;
    await this.notificationService.dispatch({
      userId: payload.courierUserId,
      channel: NotificationChannel.PUSH,
      title: "Colis assigné à votre tournée",
      body: `Nouveau colis ${payload.trackingNumber} assigné à votre tournée ${payload.deliveryRunNumber}.`,
      contact: `device_token_courier_${payload.courierId}`,
      metadata: {
        deliveryRunId: payload.deliveryRunId,
        trackingNumber: payload.trackingNumber,
      },
    });
  }

  async handleDeliveryCompleted(event: DeliveryCompletedEvent) {
    const { payload } = event;
    const targetUserId =
      (await this.resolveShipmentSenderUserId(payload.shipmentId)) ||
      payload.registeredByUserId ||
      payload.courierUserId;

    await this.notificationService.dispatch({
      userId: targetUserId,
      channel: NotificationChannel.PUSH,
      title: `Colis Livré - ${payload.trackingNumber}`,
      body: `Votre expédition ${payload.trackingNumber} a été livrée à ${payload.recipientName}. Statut : ${payload.globalShipmentStatus}.`,
      contact: "device_token_customer",
      metadata: {
        shipmentId: payload.shipmentId,
        trackingNumber: payload.trackingNumber,
        status: payload.globalShipmentStatus,
      },
    });
  }

  async handleDeliveryFailed(event: DeliveryFailedEvent) {
    const { payload } = event;
    const targetUserId =
      (await this.resolveShipmentSenderUserId(payload.shipmentId)) ||
      payload.courierUserId;

    const reasonText = payload.refusalReasonCode
      ? ` (Motif : ${payload.refusalReasonCode})`
      : "";

    await this.notificationService.dispatch({
      userId: targetUserId,
      channel: NotificationChannel.IN_APP,
      title: `Échec de livraison - ${payload.trackingNumber}`,
      body: `Tentative de livraison non aboutie pour ${payload.trackingNumber}${reasonText}. Statut : ${payload.globalShipmentStatus}.`,
      metadata: {
        shipmentId: payload.shipmentId,
        trackingNumber: payload.trackingNumber,
        isRefusal: payload.isRefusal,
      },
    });
  }

  async handleReturnCreated(event: ReturnCreatedEvent) {
    const { payload } = event;
    const targetUserId =
      (await this.resolveShipmentSenderUserId(payload.shipmentId)) ||
      payload.createdByUserId;

    await this.notificationService.dispatch({
      userId: targetUserId,
      channel: NotificationChannel.IN_APP,
      title: `Dossier de retour initié - ${payload.returnNumber}`,
      body: `Un retour (${payload.returnType}) a été ouvert pour ${payload.parcelIds.length} colis.`,
      metadata: {
        returnId: payload.returnId,
        returnType: payload.returnType,
      },
    });
  }

  async handleIncidentCreated(event: IncidentCreatedEvent) {
    const { payload } = event;
    const targetUserId =
      payload.createdByUserId ||
      (await this.resolveShipmentSenderUserId(payload.shipmentId)) ||
      (await this.resolveAgencyStaffUserId(payload.agencyId));

    if (!targetUserId) return;

    await this.notificationService.dispatch({
      userId: targetUserId,
      channel: NotificationChannel.IN_APP,
      title: `Incident déclaré - ${payload.incidentNumber}`,
      body: `Incident ${payload.type} (Sévérité : ${payload.severity}) enregistré pour l'expédition.`,
      metadata: {
        incidentId: payload.incidentId,
        severity: payload.severity,
      },
    });
  }

  async handleInvoiceCreated(event: InvoiceCreatedEvent) {
    const { payload } = event;
    const targetUserId = await this.resolveCustomerUserId(payload.customerId);
    if (!targetUserId) return;

    await this.notificationService.dispatch({
      userId: targetUserId,
      channel: NotificationChannel.EMAIL,
      title: `Nouvelle facture émise - ${payload.invoiceNumber}`,
      body: `Votre facture ${payload.invoiceNumber} a été émise pour un montant de ${payload.totalAmount.toFixed(2)} MAD. Échéance le ${payload.dueDate ? new Date(payload.dueDate).toLocaleDateString("fr-FR") : "à réception"}.`,
      contact: "billing@client.ma",
      metadata: {
        invoiceId: payload.invoiceId,
        invoiceNumber: payload.invoiceNumber,
        totalAmount: payload.totalAmount,
      },
    });
  }

  // --- Helper Resolvers ---

  private async resolveCustomerUserId(
    customerId: string,
  ): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ id: customerId }, { customerId: customerId }],
      },
    });
    return user ? user.id : customerId;
  }

  private async resolveAgencyStaffUserId(
    agencyId: string,
  ): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      where: { agencyId },
    });
    return user ? user.id : null;
  }

  private async resolveShipmentSenderUserId(
    shipmentId: string,
  ): Promise<string | null> {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id: shipmentId },
      include: { senderCustomer: true },
    });
    if (shipment?.senderCustomerId) {
      return this.resolveCustomerUserId(shipment.senderCustomerId);
    }
    return null;
  }
}

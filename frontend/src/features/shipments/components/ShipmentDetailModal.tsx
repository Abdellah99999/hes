import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import { ShipmentStatusBadge, ParcelStatusBadge } from "./ShipmentStatusBadge";
import { ParcelStatus, ShipmentStatus } from "../schemas/shipment.schema";
import { TrackingTimeline, TimelineEventItem } from "./TrackingTimeline";
import { ManualStatusChangeModal } from "./ManualStatusChangeModal";
import { TrackingScannerModal } from "./TrackingScannerModal";
import {
  X,
  Package,
  Layers,
  Barcode,
  Scale,
  User,
  Building,
  MapPin,
  RefreshCw,
  History,
  UserCheck,
} from "lucide-react";

export interface ParcelItem {
  id: string;
  description: string;
  quantity: number;
  declaredValue?: number | null;
  hsCode?: string | null;
}

export interface ParcelDetail {
  id: string;
  trackingNumber: string;
  parcelIndex: number;
  weightKg: number;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  volumetricWeightKg?: number | null;
  status: ParcelStatus;
  barcode: string;
  notes?: string | null;
  items?: ParcelItem[];
  parcelType?: { id: string; code: string; name: string };
}

export interface ShipmentDetail {
  id: string;
  trackingNumber: string;
  originAgencyId: string;
  destinationAgencyId: string;
  senderCustomerId: string;
  recipientName: string;
  recipientPhone: string;
  recipientEmail?: string | null;
  recipientAddress: string;
  recipientCity: string;
  globalStatus: ShipmentStatus;
  serviceType: string;
  paymentMethod: string;
  shippingFee: number;
  declaredValue?: number | null;
  codAmount?: number | null;
  totalParcels: number;
  totalWeightKg: number;
  notes?: string | null;
  createdAt: string;
  originAgency?: { id: string; code: string; name: string };
  destinationAgency?: { id: string; code: string; name: string };
  senderCustomer?: { id: string; code: string; legalName: string };
  parcels: ParcelDetail[];
}

interface ShipmentDetailModalProps {
  shipment: ShipmentDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

// State machine allowed transitions table in UI to assist operator
const ALLOWED_PARCEL_TRANSITIONS: Record<ParcelStatus, ParcelStatus[]> = {
  REGISTERED: ["PICKED_UP", "CANCELLED"],
  PICKED_UP: ["IN_TRANSIT", "AT_HUB", "LOST", "DAMAGED"],
  IN_TRANSIT: ["AT_HUB", "LOST", "DAMAGED"],
  AT_HUB: ["IN_TRANSIT", "OUT_FOR_DELIVERY", "RETURNED", "LOST", "DAMAGED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "DELIVERY_FAILED", "LOST", "DAMAGED"],
  DELIVERY_FAILED: ["AT_HUB", "OUT_FOR_DELIVERY", "RETURNED"],
  DELIVERED: [],
  RETURNED: [],
  CANCELLED: [],
  LOST: [],
  DAMAGED: [],
};

export const ShipmentDetailModal: React.FC<ShipmentDetailModalProps> = ({
  shipment,
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"parcels" | "timeline">("parcels");
  const [selectedParcelForStatus, setSelectedParcelForStatus] = useState<ParcelDetail | null>(null);
  const [newStatus, setNewStatus] = useState<ParcelStatus | "">("");
  const [statusNotes, setStatusNotes] = useState("");
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Modals for Phase 5
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [activeParcelTracking, setActiveParcelTracking] = useState<string>("");
  const [activeParcelStatus, setActiveParcelStatus] = useState<ParcelStatus | undefined>(undefined);

  const { data: timelineData, isLoading: isTimelineLoading, refetch: refetchTimeline } = useQuery({
    queryKey: ["shipment-timeline", shipment?.id],
    queryFn: async () => {
      if (!shipment?.id) return { events: [] };
      return customFetch<{ events: TimelineEventItem[] }>(`/shipments/${shipment.id}/timeline`);
    },
    enabled: isOpen && !!shipment?.id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      parcelId,
      status,
      notes,
    }: {
      parcelId: string;
      status: ParcelStatus;
      notes?: string;
    }) => {
      return customFetch(`/shipments/parcels/${parcelId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, notes: notes || undefined }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      refetchTimeline();
      setSelectedParcelForStatus(null);
      setNewStatus("");
      setStatusNotes("");
      setUpdateError(null);
      onClose();
    },
    onError: (err: unknown) => {
      const apiErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const msg =
        apiErr?.response?.data?.message ||
        apiErr?.message ||
        "Impossible de changer le statut.";
      setUpdateError(Array.isArray(msg) ? msg.join(", ") : String(msg));
    },
  });

  if (!isOpen || !shipment) return null;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
      >
        <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-100 font-mono">
                    {shipment.trackingNumber}
                  </h2>
                  <ShipmentStatusBadge status={shipment.globalStatus} size="sm" />
                </div>
                <p className="text-xs text-slate-400">
                  Créée le {new Date(shipment.createdAt).toLocaleDateString("fr-FR")} à{" "}
                  {new Date(shipment.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setActiveParcelTracking(shipment.parcels?.[0]?.trackingNumber || shipment.trackingNumber);
                  setIsScannerModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Barcode className="w-3.5 h-3.5" />
                <span>Poste Scan</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 px-6 bg-slate-950/40 text-xs font-medium">
            <button
              onClick={() => setActiveTab("parcels")}
              className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === "parcels"
                  ? "border-b-blue-500 text-blue-400 font-bold"
                  : "border-b-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Colis & Articles ({shipment.parcels?.length || 0})</span>
            </button>
            <button
              onClick={() => setActiveTab("timeline")}
              className={`py-3 px-4 flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === "timeline"
                  ? "border-b-blue-500 text-blue-400 font-bold"
                  : "border-b-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <History className="w-4 h-4" />
              <span>Timeline de Traçabilité ({timelineData?.events?.length || 0})</span>
            </button>
          </div>

          <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6 text-xs">
            {/* Main Attributes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                <span className="text-slate-500 flex items-center gap-1 mb-1">
                  <Building className="w-3.5 h-3.5 text-blue-400" />
                  Acheminement
                </span>
                <div className="font-semibold text-slate-200">
                  {shipment.originAgency?.name || "Origine"} → {shipment.destinationAgency?.name || "Destination"}
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                <span className="text-slate-500 flex items-center gap-1 mb-1">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  Client Expéditeur
                </span>
                <div className="font-semibold text-slate-200 truncate">
                  {shipment.senderCustomer?.legalName || "Client"}
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                <span className="text-slate-500 flex items-center gap-1 mb-1">
                  <MapPin className="w-3.5 h-3.5 text-purple-400" />
                  Destinataire
                </span>
                <div className="font-semibold text-slate-200 truncate">
                  {shipment.recipientName} ({shipment.recipientCity})
                </div>
              </div>

              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
                <span className="text-slate-500 flex items-center gap-1 mb-1">
                  <Scale className="w-3.5 h-3.5 text-amber-400" />
                  Colisage Global
                </span>
                <div className="font-semibold text-slate-200">
                  {shipment.totalParcels} colis · {shipment.totalWeightKg.toFixed(2)} kg
                </div>
              </div>
            </div>

            {/* TAB 1: PARCELS LIST */}
            {activeTab === "parcels" && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    Colis Physiques Associés ({shipment.parcels?.length || 0})
                  </h3>
                  <span className="text-slate-500 text-[11px]">
                    Statuts individuels scannables
                  </span>
                </div>

                <div className="space-y-3">
                  {shipment.parcels?.map((parcel) => {
                    const allowedNextStatuses = ALLOWED_PARCEL_TRANSITIONS[parcel.status] || [];

                    return (
                      <div
                        key={parcel.id}
                        className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 font-mono font-bold text-[11px] border border-blue-800">
                              Colis {parcel.parcelIndex}/{shipment.totalParcels}
                            </span>
                            <span className="font-mono text-slate-100 font-bold text-xs">
                              {parcel.trackingNumber}
                            </span>
                            <ParcelStatusBadge status={parcel.status} />
                          </div>

                          <div className="flex items-center gap-4 text-slate-400 text-[11px]">
                            <span>Poids : <strong className="text-slate-200">{parcel.weightKg} kg</strong></span>
                            {parcel.lengthCm && parcel.widthCm && parcel.heightCm && (
                              <span>
                                Dim : {parcel.lengthCm}×{parcel.widthCm}×{parcel.heightCm} cm
                              </span>
                            )}
                            {parcel.volumetricWeightKg && (
                              <span>
                                Vol : <strong className="text-blue-300">{parcel.volumetricWeightKg.toFixed(2)} kg</strong>
                              </span>
                            )}
                            {parcel.barcode && (
                              <span className="font-mono text-slate-500 flex items-center gap-1">
                                <Barcode className="w-3.5 h-3.5" />
                                {parcel.barcode}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveParcelTracking(parcel.trackingNumber);
                              setActiveParcelStatus(parcel.status);
                              setIsManualModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-800/60 text-xs font-medium flex items-center gap-1.5 transition-colors"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Manuel</span>
                          </button>

                          {allowedNextStatuses.length > 0 ? (
                            <button
                              onClick={() => {
                                setSelectedParcelForStatus(parcel);
                                setNewStatus(allowedNextStatuses[0]);
                                setUpdateError(null);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Changer Statut</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-500 italic">
                              Statut terminal
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: TRACKING TIMELINE */}
            {activeTab === "timeline" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-400" />
                    Piste d'Audit & Historique Chronologique
                  </h3>
                  <button
                    type="button"
                    onClick={() => refetchTimeline()}
                    className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
                    title="Actualiser la timeline"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <TrackingTimeline
                  events={timelineData?.events || []}
                  isLoading={isTimelineLoading}
                />
              </div>
            )}

            {/* Quick status change form modal / drawer */}
            {selectedParcelForStatus && (
              <div className="p-4 bg-slate-900 border border-blue-800/80 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-slate-100 text-xs flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                    Mettre à jour le statut du Colis {selectedParcelForStatus.parcelIndex} ({selectedParcelForStatus.trackingNumber})
                  </h4>
                  <button
                    onClick={() => setSelectedParcelForStatus(null)}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {updateError && (
                  <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-[11px]">
                    {updateError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Nouveau statut autorisé (Machine à états)
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as ParcelStatus)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
                    >
                      {(ALLOWED_PARCEL_TRANSITIONS[selectedParcelForStatus.status] || []).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Motif / Commentaire
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Scanné au hub de Casablanca..."
                      value={statusNotes}
                      onChange={(e) => setStatusNotes(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedParcelForStatus(null)}
                    className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-200 text-xs"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={!newStatus || updateStatusMutation.isPending}
                    onClick={() => {
                      if (newStatus) {
                        updateStatusMutation.mutate({
                          parcelId: selectedParcelForStatus.id,
                          status: newStatus as ParcelStatus,
                          notes: statusNotes,
                        });
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Confirmer la transition</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Embedded Phase 5 Modals */}
      <ManualStatusChangeModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        defaultTrackingNumber={activeParcelTracking}
        currentStatus={activeParcelStatus}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["shipments"] });
          refetchTimeline();
        }}
      />

      <TrackingScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["shipments"] });
          refetchTimeline();
        }}
      />
    </>
  );
};

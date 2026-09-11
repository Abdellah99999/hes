import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import { useAuth } from "../../auth/hooks/useAuth";
import { ConfirmDeliveryModal } from "../../deliveries/components/ConfirmDeliveryModal";
import { RecordRefusalModal } from "../../deliveries/components/RecordRefusalModal";
import {
  Bike,
  Package,
  MapPin,
  Phone,
  Banknote,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  FileCheck,
  Ban,
  Navigation,
} from "lucide-react";
import { navigationService } from "../../navigation";

export interface CourierRunItem {
  id: string;
  sequenceOrder: number;
  status: string;
  isOutOfZone: boolean;
  parcel: {
    id: string;
    trackingNumber: string;
    weightKg: number;
    shipment: {
      recipientName: string;
      recipientPhone: string;
      recipientAddress: string;
      recipientCity: string;
      codAmount: number | null;
    };
  };
}

export interface CourierDeliveryRun {
  id: string;
  runNumber: string;
  shift: string;
  runDate: string;
  status: string;
  totalParcels: number;
  totalWeightKg: number;
  totalCodToCollect: number;
  zone?: { code: string; name: string };
  courier: {
    userId: string;
    user: { id: string; firstName: string; lastName: string; phone: string };
  };
  items: CourierRunItem[];
}

export const CourierMyRunsPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedShift, setSelectedShift] = useState("");
  const [confirmModalParcel, setConfirmModalParcel] = useState<{
    id: string;
    trackingNumber: string;
    recipientName: string;
    recipientPhone: string;
    recipientAddress: string;
    recipientCity: string;
    codAmount: number | null;
  } | null>(null);
  const [refusalModalParcel, setRefusalModalParcel] = useState<{
    id: string;
    trackingNumber: string;
    recipientName: string;
    recipientAddress: string;
    recipientCity: string;
    codAmount: number | null;
  } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-runs", selectedShift],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedShift) params.append("shift", selectedShift);
      return customFetch<{ data: CourierDeliveryRun[]; meta: { total: number } }>(
        `/runs/my-runs?${params.toString()}`,
      );
    },
  });

  const runs = data?.data || [];

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl">
              <Bike className="w-6 h-6" />
            </div>
            <span>Mes Missions & Tournées de Livraison</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Feuille de route personnelle du livreur : séquence ordonnée des colis à livrer et encaissements COD
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-950/40 border border-blue-800 text-blue-300 rounded-xl text-xs">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>Livreur : {user?.firstName} {user?.lastName}</span>
          </div>

          <select
            value={selectedShift}
            onChange={(e) => setSelectedShift(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">Tous les créneaux</option>
            <option value="MORNING">Matin</option>
            <option value="AFTERNOON">Après-midi</option>
            <option value="EVENING">Soir</option>
          </select>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Erreur de chargement de votre feuille de route.</span>
        </div>
      )}

      {isLoading && (
        <div className="p-12 text-center text-slate-500 text-xs">
          Chargement de vos tournées en cours...
        </div>
      )}

      {!isLoading && runs.length === 0 && (
        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-2xl text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h2 className="text-base font-bold text-slate-200">Aucune tournée assignée</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Vous n'avez aucune tournée en cours pour le moment. Votre superviseur d'agence publiera vos tournées dès que le chargement sera prêt.
          </p>
        </div>
      )}

      {!isLoading && (
        <div className="space-y-6">
          {runs.map((run) => (
            <div
              key={run.id}
              className="p-6 bg-slate-900/70 border border-slate-800 rounded-2xl space-y-5 shadow-xl shadow-black/20"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-400 text-base">
                      {run.runNumber}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold">
                      Créneau : {run.shift}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-semibold">
                      {run.status}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 block mt-1">
                    Zone principale : <strong className="text-slate-200">{run.zone?.name || "Non sectorisée"}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="text-right">
                    <span className="text-slate-500 text-[10px] block">Colis à livrer</span>
                    <span className="font-mono font-bold text-slate-200 text-sm">
                      {run.totalParcels} colis
                    </span>
                  </div>
                  <div className="text-right border-l border-slate-800 pl-4">
                    <span className="text-slate-500 text-[10px] block">COD total</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {Number(run.totalCodToCollect || 0).toFixed(2)} MAD
                    </span>
                  </div>
                </div>
              </div>

              {/* Items sequence */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-blue-400" />
                  <span>Ordre de livraison recommandé ({run.items.length} adresses)</span>
                </h3>

                <div className="space-y-2">
                  {run.items.map((it) => (
                    <div
                      key={it.id}
                      className="p-3.5 bg-slate-950/50 border border-slate-850 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-mono font-bold text-xs">
                            {it.sequenceOrder}
                          </span>
                          <span className="font-mono font-bold text-slate-200">
                            {it.parcel.trackingNumber}
                          </span>
                          <span className="text-slate-300 font-semibold">
                            — {it.parcel.shipment.recipientName}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-slate-400 text-[11px] pl-8">
                          <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                          <span>{it.parcel.shipment.recipientAddress}, {it.parcel.shipment.recipientCity}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 pl-8 sm:pl-0 shrink-0">
                        <div className="flex items-center gap-1 text-emerald-400 font-mono font-bold">
                          <Phone className="w-3.5 h-3.5 text-emerald-500" />
                          <a href={`tel:${it.parcel.shipment.recipientPhone}`} className="hover:underline">
                            {it.parcel.shipment.recipientPhone}
                          </a>
                        </div>

                        {it.parcel.shipment.codAmount && Number(it.parcel.shipment.codAmount) > 0 ? (
                          <div className="px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-800 text-amber-300 font-mono font-bold text-xs flex items-center gap-1">
                            <Banknote className="w-3.5 h-3.5" />
                            <span>{Number(it.parcel.shipment.codAmount).toFixed(2)} MAD</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Payé en ligne</span>
                        )}

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            title="Lancer la navigation Google Maps"
                            onClick={() =>
                              navigationService.navigateTo({
                                label: it.parcel.shipment.recipientName,
                                address: it.parcel.shipment.recipientAddress,
                                city: it.parcel.shipment.recipientCity,
                              })
                            }
                            className="px-2.5 py-1 bg-blue-600/90 hover:bg-blue-500 text-white font-semibold rounded-lg text-[11px] flex items-center gap-1 transition-colors shadow-sm"
                          >
                            <Navigation className="w-3 h-3" />
                            <span>Itinéraire</span>
                          </button>

                          <button
                            title="Confirmer la livraison avec POD"
                            onClick={() =>
                              setConfirmModalParcel({
                                id: it.parcel.id,
                                trackingNumber: it.parcel.trackingNumber,
                                recipientName: it.parcel.shipment.recipientName,
                                recipientPhone: it.parcel.shipment.recipientPhone,
                                recipientAddress: it.parcel.shipment.recipientAddress,
                                recipientCity: it.parcel.shipment.recipientCity,
                                codAmount: it.parcel.shipment.codAmount,
                              })
                            }
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-[11px] flex items-center gap-1 transition-colors shadow-sm"
                          >
                            <FileCheck className="w-3 h-3" />
                            <span>Livré</span>
                          </button>

                          <button
                            title="Signaler un refus (déclenche retour)"
                            onClick={() =>
                              setRefusalModalParcel({
                                id: it.parcel.id,
                                trackingNumber: it.parcel.trackingNumber,
                                recipientName: it.parcel.shipment.recipientName,
                                recipientAddress: it.parcel.shipment.recipientAddress,
                                recipientCity: it.parcel.shipment.recipientCity,
                                codAmount: it.parcel.shipment.codAmount,
                              })
                            }
                            className="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-semibold rounded-lg text-[11px] flex items-center gap-1 transition-colors"
                          >
                            <Ban className="w-3 h-3 text-rose-400" />
                            <span>Refus</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals for POD confirmation and Refusal */}
      <ConfirmDeliveryModal
        isOpen={!!confirmModalParcel}
        parcel={confirmModalParcel}
        onClose={() => setConfirmModalParcel(null)}
      />

      <RecordRefusalModal
        isOpen={!!refusalModalParcel}
        parcel={refusalModalParcel}
        onClose={() => setRefusalModalParcel(null)}
      />
    </div>
  );
};

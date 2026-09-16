import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import {
  CompleteCollectionModal,
  CollectionDetail,
} from "../components/CompleteCollectionModal";
import {
  Bike,
  Calendar,
  Clock,
  MapPin,
  Phone,
  User,
  Package,
  CheckCircle2,
  Sparkles,
  Navigation,
} from "lucide-react";
import { navigationService } from "../../navigation";

export const CourierMissionsPage: React.FC = () => {
  const [selectedMission, setSelectedMission] =
    useState<CollectionDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["courier-missions", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter) params.append("status", statusFilter);

      return customFetch<{
        data: CollectionDetail[];
        meta: { total: number };
      }>(`/collections/my-missions?${params.toString()}`);
    },
  });

  const missions = data?.data || [];

  return (
    <div className="w-full max-w-none md:max-w-5xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
              <Bike className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span>Mes Missions d'Enlèvement du Jour</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Feuille de route personnelle : ramassez les colis clients et validez
            les pesées pour créer les expéditions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto min-h-[44px] px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="">Toutes mes missions</option>
            <option value="ASSIGNED">Assignées (À réaliser)</option>
            <option value="IN_PROGRESS">En cours</option>
            <option value="COMPLETED">Complétées</option>
          </select>
        </div>
      </div>

      {/* Missions Grid */}
      {isLoading && (
        <div className="p-12 text-center text-slate-500 text-xs">
          Chargement de votre feuille de route...
        </div>
      )}

      {!isLoading && missions.length === 0 && (
        <div className="p-8 sm:p-12 bg-slate-900/40 border border-slate-800 rounded-2xl text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h2 className="text-base font-bold text-slate-200">
            Aucune mission en attente
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Toutes vos missions d'enlèvement assignées sont réalisées ou aucune
            mission n'est programmée pour le moment.
          </p>
        </div>
      )}

      {!isLoading && (
        <div className="flex flex-col gap-3.5 sm:gap-4">
          {missions.map((mission) => {
            const isCompleted = mission.status === "COMPLETED";

            return (
              <div
                key={mission.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-3.5 ${
                  isCompleted
                    ? "bg-slate-950/40 border-slate-800/60 opacity-80"
                    : "bg-slate-900/70 border-slate-800 hover:border-slate-700 shadow-lg shadow-black/20"
                }`}
              >
                {/* Header of card: Mission number, status, date & parcels */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-400 text-sm">
                      {mission.collectionNumber}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pl-2 border-l border-slate-800">
                      <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{mission.scheduledDate?.split("T")[0]}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg bg-slate-800/80 text-slate-300 font-semibold text-[10px] flex items-center gap-1">
                      <Package className="w-3 h-3 text-blue-400" />
                      <span>{mission.items?.length || 1} colis</span>
                    </span>

                    {isCompleted ? (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/80 font-semibold text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>COMPLÉTÉE</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-950 text-amber-300 border border-amber-800/80 font-semibold text-[10px] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>À RAMASSER</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Vertical Compact Details */}
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-start gap-2.5 text-slate-300">
                    <User className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-100 text-sm block">
                        {mission.customer?.legalName}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Contact sur place : {mission.pickupContactName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 text-slate-300">
                    <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-slate-200 block break-words">
                        {mission.pickupStreet}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        {mission.pickupCity}
                      </span>
                    </div>
                  </div>

                  {/* Touch-optimized Phone target */}
                  <div className="pt-1">
                    <a
                      href={`tel:${mission.pickupPhone}`}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-emerald-400 font-mono font-bold text-xs flex items-center gap-2 w-fit transition-colors"
                      title="Appeler le contact client"
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>{mission.pickupPhone}</span>
                    </a>
                  </div>
                </div>

                {/* Responsive Action Buttons (≥44px touch height, accessible spacing) */}
                <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    title="Lancer la navigation vers le point d'enlèvement"
                    onClick={() =>
                      navigationService.navigateTo({
                        label: mission.customer?.legalName || "Client",
                        street: mission.pickupStreet,
                        city: mission.pickupCity,
                      })
                    }
                    className="w-full min-h-[44px] px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    <Navigation className="w-4 h-4 shrink-0" />
                    <span>Itinéraire GPS</span>
                  </button>

                  {!isCompleted ? (
                    <button
                      onClick={() => setSelectedMission(mission)}
                      className="w-full min-h-[44px] px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/20"
                    >
                      <Sparkles className="w-4 h-4 shrink-0" />
                      <span>Peser & Valider l'Enlèvement</span>
                    </button>
                  ) : (
                    <div className="min-h-[44px] px-4 py-2.5 bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Expédition générée & prise en charge</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Complétion */}
      <CompleteCollectionModal
        isOpen={!!selectedMission}
        collection={selectedMission}
        onClose={() => setSelectedMission(null)}
        onSuccess={() => refetch()}
      />
    </div>
  );
};

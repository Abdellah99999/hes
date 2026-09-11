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
  const [selectedMission, setSelectedMission] = useState<CollectionDetail | null>(null);
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
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
              <Bike className="w-6 h-6" />
            </div>
            <span>Mes Missions d'Enlèvement du Jour</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Feuille de route personnelle : ramassez les colis clients et validez les pesées pour créer les expéditions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
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
        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-2xl text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h2 className="text-base font-bold text-slate-200">Aucune mission en attente</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Toutes vos missions d'enlèvement assignées sont réalisées ou aucune mission n'est programmée pour le moment.
          </p>
        </div>
      )}

      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {missions.map((mission) => {
            const isCompleted = mission.status === "COMPLETED";

            return (
              <div
                key={mission.id}
                className={`p-5 rounded-2xl border transition-all space-y-4 ${
                  isCompleted
                    ? "bg-slate-950/40 border-slate-800/60 opacity-80"
                    : "bg-slate-900/70 border-slate-800 hover:border-slate-700 shadow-lg shadow-black/20"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <span className="font-mono font-bold text-blue-400 text-xs">
                    {mission.collectionNumber}
                  </span>

                  <div>
                    {isCompleted ? (
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/80 font-semibold text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>COMPLÉTÉE</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-lg bg-amber-950 text-amber-300 border border-amber-800/80 font-semibold text-[10px] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>À RAMASSER</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2.5 text-slate-300">
                    <User className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block text-slate-100">
                        {mission.customer?.legalName}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Contact : {mission.pickupContactName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 text-slate-300">
                    <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium text-slate-200">
                        {mission.pickupStreet}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        {mission.pickupCity}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-slate-300">
                    <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                    <a
                      href={`tel:${mission.pickupPhone}`}
                      className="text-emerald-400 hover:underline font-mono text-xs"
                    >
                      {mission.pickupPhone}
                    </a>
                  </div>

                  <div className="flex items-center gap-4 pt-1 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      {mission.scheduledDate?.split("T")[0]}
                    </span>
                    <span className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-slate-500" />
                      {mission.items?.length || 1} colis prévu(s)
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
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
                    className="px-3 py-2 bg-blue-600/90 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Itinéraire</span>
                  </button>

                  {!isCompleted ? (
                    <button
                      onClick={() => setSelectedMission(mission)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-500/20"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Peser & Valider l'Enlèvement</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-400 font-medium">
                      Expédition générée & prise en charge
                    </span>
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

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import customFetch from "../../../lib/api-client";
import { DataTable, Column } from "../../../components/common/DataTable";
import { zoneSchema, ZoneFormData } from "../schemas/zone.schema";
import { useAuth } from "../../auth/hooks/useAuth";
import { PermissionGate } from "../../auth/components/PermissionGate";
import { Plus, Search, Map, Check, X, AlertCircle } from "lucide-react";

interface Zone {
  id: string;
  agencyId: string;
  code: string;
  name: string;
  description?: string | null;
  postalCodes?: string | null;
  isActive: boolean;
  agency?: {
    code: string;
    name: string;
  };
}

interface PaginatedZones {
  data: Zone[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const ZonesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: agenciesData } = useQuery<{ data: { id: string; name: string; code: string }[] }>({
    queryKey: ["agencies-lookup"],
    queryFn: () => customFetch("/agencies", { params: { limit: 100 } }),
  });

  const { data, isLoading } = useQuery<PaginatedZones>({
    queryKey: ["zones", page, limit, search, selectedAgencyId],
    queryFn: () =>
      customFetch<PaginatedZones>("/zones", {
        params: {
          page,
          limit,
          search: search || undefined,
          agencyId: selectedAgencyId || undefined,
        },
      }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ZoneFormData>({
    resolver: zodResolver(zoneSchema),
    defaultValues: {
      agencyId: user?.agencyId || "",
      code: "",
      name: "",
      description: "",
      postalCodes: "",
      isActive: true,
    },
  });

  const openCreateModal = () => {
    setEditingZone(null);
    setErrorMessage(null);
    reset({
      agencyId: user?.agencyId || "",
      code: "",
      name: "",
      description: "",
      postalCodes: "",
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (zone: Zone) => {
    setEditingZone(zone);
    setErrorMessage(null);
    reset({
      agencyId: zone.agencyId,
      code: zone.code,
      name: zone.name,
      description: zone.description || "",
      postalCodes: zone.postalCodes || "",
      isActive: zone.isActive,
    });
    setIsModalOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (newZone: ZoneFormData) =>
      customFetch("/zones", {
        method: "POST",
        body: JSON.stringify(newZone),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zones"] });
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      setErrorMessage(err?.data?.message || "Erreur lors de la création de la zone");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: ZoneFormData }) =>
      customFetch(`/zones/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zones"] });
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      setErrorMessage(err?.data?.message || "Erreur lors de la mise à jour");
    },
  });

  const onSubmit = (formData: ZoneFormData) => {
    if (editingZone) {
      updateMutation.mutate({ id: editingZone.id, updates: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const columns: Column<Zone>[] = [
    {
      key: "code",
      header: "Code Zone",
      render: (z) => (
        <span className="font-mono px-2 py-1 bg-indigo-950/70 text-indigo-300 border border-indigo-800/60 rounded font-semibold text-xs">
          {z.code}
        </span>
      ),
    },
    {
      key: "name",
      header: "Nom & Description",
      render: (z) => (
        <div>
          <div className="font-medium text-slate-100">{z.name}</div>
          {z.description && <div className="text-[11px] text-slate-400">{z.description}</div>}
        </div>
      ),
    },
    {
      key: "postalCodes",
      header: "Codes Postaux Couverts",
      render: (z) => (
        <span className="font-mono text-xs text-slate-300">
          {z.postalCodes || "Non spécifié"}
        </span>
      ),
    },
    {
      key: "isActive",
      header: "Statut",
      render: (z) =>
        z.isActive ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
            <Check className="w-2.5 h-2.5" /> Actif
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-950/80 text-rose-300 border border-rose-800/60">
            <X className="w-2.5 h-2.5" /> Inactif
          </span>
        ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Map className="w-6 h-6 text-indigo-500" />
            Zones Opérationnelles & Logistiques
          </h1>
          <p className="text-xs text-slate-400">
            Découpage territorial pour le dispatch des ramassages, livraisons et tournées
          </p>
        </div>

        <PermissionGate permissions={["zones:manage"]}>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Zone
          </button>
        </PermissionGate>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par code ou nom de zone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-900/60 border border-slate-800 text-slate-200 text-xs rounded-xl focus:outline-none focus:border-indigo-500"
          />
        </div>

        {user?.role === "SUPER_ADMIN" && agenciesData?.data && (
          <select
            value={selectedAgencyId}
            onChange={(e) => {
              setSelectedAgencyId(e.target.value);
              setPage(1);
            }}
            className="bg-slate-900/60 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
          >
            <option value="">Toutes les agences</option>
            {agenciesData.data.map((ag) => (
              <option key={ag.id} value={ag.id}>
                {ag.code} - {ag.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Data Table */}
      <DataTable<Zone>
        columns={columns}
        data={data?.data || []}
        total={data?.meta?.total || 0}
        page={page}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
        isLoading={isLoading}
        emptyMessage="Aucune zone trouvée pour votre agence"
        actions={(zone) => (
          <PermissionGate permissions={["zones:manage"]}>
            <button
              onClick={() => openEditModal(zone)}
              className="px-2.5 py-1 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/50 rounded-lg transition-colors"
            >
              Modifier
            </button>
          </PermissionGate>
        )}
      />

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-slate-100">
                {editingZone ? "Modifier la zone" : "Créer une nouvelle zone"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {user?.role === "SUPER_ADMIN" && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Agence de rattachement *
                  </label>
                  <select
                    {...register("agencyId")}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Sélectionnez l'agence...</option>
                    {agenciesData?.data.map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.code} - {ag.name}
                      </option>
                    ))}
                  </select>
                  {errors.agencyId && (
                    <p className="text-[11px] text-rose-400 mt-1">{errors.agencyId.message}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Code Zone (Majuscules, ex: ZN-AGA-01) *
                </label>
                <input
                  {...register("code")}
                  disabled={!!editingZone}
                  placeholder="ZN-AGA-01"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                />
                {errors.code && (
                  <p className="text-[11px] text-rose-400 mt-1">{errors.code.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nom de la zone *
                </label>
                <input
                  {...register("name")}
                  placeholder="Zone Portuaire & Industrielle"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                {errors.name && (
                  <p className="text-[11px] text-rose-400 mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Codes postaux (séparés par virgules)
                </label>
                <input
                  {...register("postalCodes")}
                  placeholder="80000, 80001, 80010"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  {...register("description")}
                  rows={3}
                  placeholder="Précisions géographiques, axes principaux..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Enregistrement..." : editingZone ? "Mettre à jour" : "Créer la zone"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

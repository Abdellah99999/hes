/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import customFetch from "../../../lib/api-client";
import { DataTable, Column } from "../../../components/common/DataTable";
import { addressSchema, AddressFormData } from "../schemas/address.schema";
import { useAuth } from "../../auth/hooks/useAuth";
import { PermissionGate } from "../../auth/components/PermissionGate";
import { MapPin, Plus, Search, X, AlertCircle, Navigation } from "lucide-react";

interface Address {
  id: string;
  agencyId: string;
  customerId?: string | null;
  zoneId?: string | null;
  type: string;
  title: string;
  street: string;
  additionalInfo?: string | null;
  city: string;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault: boolean;
  agency: { code: string; name: string };
  customer?: { id: string; code: string; legalName: string } | null;
  zone?: { id: string; code: string; name: string } | null;
}

interface PaginatedAddresses {
  data: Address[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const AddressesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: zonesData } = useQuery<{ data: { id: string; code: string; name: string }[] }>({
    queryKey: ["zones-lookup"],
    queryFn: () => customFetch("/zones", { params: { limit: 100 } }),
  });

  const { data, isLoading } = useQuery<PaginatedAddresses>({
    queryKey: ["addresses", page, limit, search, selectedType],
    queryFn: () =>
      customFetch<PaginatedAddresses>("/addresses", {
        params: {
          page,
          limit,
          search: search || undefined,
          type: selectedType || undefined,
        },
      }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      agencyId: user?.agencyId || "",
      customerId: "",
      zoneId: "",
      type: "DELIVERY",
      title: "",
      street: "",
      additionalInfo: "",
      city: "",
      postalCode: "",
      isDefault: false,
    },
  });

  const openCreateModal = () => {
    setEditingAddress(null);
    setErrorMessage(null);
    reset({
      agencyId: user?.agencyId || "",
      customerId: "",
      zoneId: "",
      type: "DELIVERY",
      title: "",
      street: "",
      additionalInfo: "",
      city: "",
      postalCode: "",
      isDefault: false,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (addr: Address) => {
    setEditingAddress(addr);
    setErrorMessage(null);
    reset({
      agencyId: addr.agencyId,
      customerId: addr.customerId || "",
      zoneId: addr.zoneId || "",
      type: addr.type as any,
      title: addr.title,
      street: addr.street,
      additionalInfo: addr.additionalInfo || "",
      city: addr.city,
      postalCode: addr.postalCode || "",
      latitude: addr.latitude,
      longitude: addr.longitude,
      isDefault: addr.isDefault,
    });
    setIsModalOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (newAddr: AddressFormData) =>
      customFetch("/addresses", {
        method: "POST",
        body: JSON.stringify(newAddr),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      setErrorMessage(err?.data?.message || "Erreur lors de la création de l'adresse");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: AddressFormData }) =>
      customFetch(`/addresses/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      setErrorMessage(err?.data?.message || "Erreur lors de la mise à jour");
    },
  });

  const onSubmit = (formData: AddressFormData) => {
    if (editingAddress) {
      updateMutation.mutate({ id: editingAddress.id, updates: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const columns: Column<Address>[] = [
    {
      key: "title",
      header: "Libellé & Type",
      render: (a) => (
        <div>
          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            {a.title}
            {a.isDefault && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                Par défaut
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono text-slate-400 uppercase">
            Type: {a.type}
          </span>
        </div>
      ),
    },
    {
      key: "address",
      header: "Adresse & Ville",
      render: (a) => (
        <div>
          <div className="text-slate-200">{a.street}</div>
          <div className="text-[11px] text-slate-400">
            {a.postalCode ? `${a.postalCode} ` : ""}
            {a.city}
          </div>
        </div>
      ),
    },
    {
      key: "zone",
      header: "Zone Opérationnelle",
      render: (a) =>
        a.zone ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950/60 text-indigo-300 border border-indigo-800/60">
            {a.zone.code} - {a.zone.name}
          </span>
        ) : (
          <span className="text-xs text-slate-500 italic">Non zoné</span>
        ),
    },
    {
      key: "customer",
      header: "Rattachement Client",
      render: (a) =>
        a.customer ? (
          <div className="text-xs text-slate-300">
            <div className="font-medium">{a.customer.legalName}</div>
            <div className="text-[10px] text-slate-500 font-mono">{a.customer.code}</div>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400 italic">Plateforme / Agence</span>
        ),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Navigation className="w-6 h-6 text-blue-500" />
            Référentiel des Adresses & Sites
          </h1>
          <p className="text-xs text-slate-400">
            Points de collecte, dépôts, quais de déchargement et adresses de facturation
          </p>
        </div>

        <PermissionGate permissions={["addresses:manage"]}>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Adresse
          </button>
        </PermissionGate>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par libellé, rue, ville ou code postal..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-900/60 border border-slate-800 text-slate-200 text-xs rounded-xl focus:outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={selectedType}
          onChange={(e) => {
            setSelectedType(e.target.value);
            setPage(1);
          }}
          className="bg-slate-900/60 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
        >
          <option value="">Tous les types d'adresses</option>
          <option value="DELIVERY">Livraison</option>
          <option value="BILLING">Facturation</option>
          <option value="HEADQUARTERS">Siège Social</option>
          <option value="WAREHOUSE">Entrepôt</option>
          <option value="OTHER">Autre</option>
        </select>
      </div>

      {/* Data Table */}
      <DataTable<Address>
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
        emptyMessage="Aucune adresse trouvée pour votre agence"
        actions={(addr) => (
          <PermissionGate permissions={["addresses:manage"]}>
            <button
              onClick={() => openEditModal(addr)}
              className="px-2.5 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-950/50 rounded-lg transition-colors"
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
                {editingAddress ? "Modifier l'adresse" : "Créer une nouvelle adresse"}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Libellé du site *
                  </label>
                  <input
                    {...register("title")}
                    placeholder="Entrepôt Principal"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                  {errors.title && (
                    <p className="text-[11px] text-rose-400 mt-1">{errors.title.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Type d'adresse *
                  </label>
                  <select
                    {...register("type")}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="DELIVERY">Livraison</option>
                    <option value="BILLING">Facturation</option>
                    <option value="HEADQUARTERS">Siège Social</option>
                    <option value="WAREHOUSE">Entrepôt</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Adresse (Rue / Voie / N°) *
                </label>
                <input
                  {...register("street")}
                  placeholder="Zone Industrielle Anza, Rue 4"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
                {errors.street && (
                  <p className="text-[11px] text-rose-400 mt-1">{errors.street.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Ville *
                  </label>
                  <input
                    {...register("city")}
                    placeholder="Agadir"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                  {errors.city && (
                    <p className="text-[11px] text-rose-400 mt-1">{errors.city.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Code Postal
                  </label>
                  <input
                    {...register("postalCode")}
                    placeholder="80000"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Zone Opérationnelle
                </label>
                <select
                  {...register("zoneId")}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Sélectionner une zone...</option>
                  {zonesData?.data.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.code} - {z.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isDefaultAddr"
                  {...register("isDefault")}
                  className="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0"
                />
                <label htmlFor="isDefaultAddr" className="text-xs text-slate-300">
                  Définir comme adresse par défaut
                </label>
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
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Enregistrement..." : editingAddress ? "Mettre à jour" : "Créer l'adresse"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

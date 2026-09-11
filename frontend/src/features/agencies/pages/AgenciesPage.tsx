/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import customFetch from "../../../lib/api-client";
import { DataTable, Column } from "../../../components/common/DataTable";
import { agencySchema, AgencyFormData } from "../schemas/agency.schema";
import { PermissionGate } from "../../auth/components/PermissionGate";
import { Plus, Search, Building2, Phone, Mail, MapPin, X, Check, AlertCircle } from "lucide-react";
import { APP_NAME } from "../../../lib/config";

interface Agency {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  city: string;
  address?: string | null;
  isActive: boolean;
  createdAt: string;
}

interface PaginatedAgencies {
  data: Agency[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const AgenciesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data, isLoading } = useQuery<PaginatedAgencies>({
    queryKey: ["agencies", page, limit, search],
    queryFn: () =>
      customFetch<PaginatedAgencies>("/agencies", {
        params: { page, limit, search: search || undefined },
      }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AgencyFormData>({
    resolver: zodResolver(agencySchema),
    defaultValues: {
      code: "",
      name: "",
      phone: "",
      email: "",
      city: "",
      address: "",
      isActive: true,
    },
  });

  const openCreateModal = () => {
    setEditingAgency(null);
    setErrorMessage(null);
    reset({
      code: "",
      name: "",
      phone: "",
      email: "",
      city: "",
      address: "",
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (agency: Agency) => {
    setEditingAgency(agency);
    setErrorMessage(null);
    reset({
      code: agency.code,
      name: agency.name,
      phone: agency.phone || "",
      email: agency.email || "",
      city: agency.city,
      address: agency.address || "",
      isActive: agency.isActive,
    });
    setIsModalOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (newAgency: AgencyFormData) =>
      customFetch("/agencies", {
        method: "POST",
        body: JSON.stringify(newAgency),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencies"] });
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      setErrorMessage(err?.data?.message || "Erreur lors de la création de l'agence");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: AgencyFormData }) =>
      customFetch(`/agencies/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agencies"] });
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      setErrorMessage(err?.data?.message || "Erreur lors de la mise à jour");
    },
  });

  const onSubmit = (formData: AgencyFormData) => {
    if (editingAgency) {
      updateMutation.mutate({ id: editingAgency.id, updates: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const columns: Column<Agency>[] = [
    {
      key: "code",
      header: "Code",
      render: (a) => (
        <span className="font-mono px-2 py-1 bg-blue-950/70 text-blue-300 border border-blue-800/60 rounded font-semibold text-xs">
          {a.code}
        </span>
      ),
    },
    {
      key: "name",
      header: "Raison Sociale",
      render: (a) => (
        <div>
          <div className="font-medium text-slate-100">{a.name}</div>
          {a.address && <div className="text-[11px] text-slate-400">{a.address}</div>}
        </div>
      ),
    },
    {
      key: "city",
      header: "Ville",
      render: (a) => (
        <span className="flex items-center gap-1.5 text-slate-300">
          <MapPin className="w-3 h-3 text-slate-500" />
          {a.city}
        </span>
      ),
    },
    {
      key: "contacts",
      header: "Contacts",
      render: (a) => (
        <div className="space-y-0.5 text-[11px]">
          {a.phone && (
            <div className="flex items-center gap-1 text-slate-300">
              <Phone className="w-2.5 h-2.5 text-slate-500" />
              {a.phone}
            </div>
          )}
          {a.email && (
            <div className="flex items-center gap-1 text-slate-400">
              <Mail className="w-2.5 h-2.5 text-slate-500" />
              {a.email}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "isActive",
      header: "Statut",
      render: (a) =>
        a.isActive ? (
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
            <Building2 className="w-6 h-6 text-blue-500" />
            Référentiel des Agences {APP_NAME}
          </h1>
          <p className="text-xs text-slate-400">
            Gestion du maillage territorial, des filiales régionales et de leurs paramètres d'exploitation
          </p>
        </div>

        <PermissionGate permissions={["agencies:manage"]}>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Agence
          </button>
        </PermissionGate>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par code, nom ou ville..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-900/60 border border-slate-800 text-slate-200 text-xs rounded-xl focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Data Table */}
      <DataTable<Agency>
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
        emptyMessage="Aucune agence trouvée pour ces critères"
        actions={(agency) => (
          <PermissionGate permissions={["agencies:manage"]}>
            <button
              onClick={() => openEditModal(agency)}
              className="px-2.5 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-950/50 rounded-lg transition-colors"
            >
              Modifier
            </button>
          </PermissionGate>
        )}
      />

      {/* Modal Create / Edit Agency */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-slate-100">
                {editingAgency ? "Modifier l'agence" : "Créer une nouvelle agence"}
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

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Code Agence (Majuscules, ex: AGA, CAS) *
                </label>
                <input
                  {...register("code")}
                  disabled={!!editingAgency}
                  placeholder="AGA"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
                {errors.code && (
                  <p className="text-[11px] text-rose-400 mt-1">{errors.code.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nom officiel de l'agence *
                </label>
                <input
                  {...register("name")}
                  placeholder="Agence Agadir Port"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
                {errors.name && (
                  <p className="text-[11px] text-rose-400 mt-1">{errors.name.message}</p>
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
                    Téléphone
                  </label>
                  <input
                    {...register("phone")}
                    placeholder="+212528112233"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Email de contact
                </label>
                <input
                  {...register("email")}
                  placeholder="contact.agadir@hes.ma"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
                {errors.email && (
                  <p className="text-[11px] text-rose-400 mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Adresse physique
                </label>
                <input
                  {...register("address")}
                  placeholder="Boulevard Mohammed V..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              {editingAgency && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    {...register("isActive")}
                    className="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0"
                  />
                  <label htmlFor="isActive" className="text-xs text-slate-300">
                    Agence active dans les opérations
                  </label>
                </div>
              )}

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
                  {isSubmitting ? "Enregistrement..." : editingAgency ? "Mettre à jour" : "Créer l'agence"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

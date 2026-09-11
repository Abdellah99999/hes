/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import customFetch from "../../../lib/api-client";
import { DataTable, Column } from "../../../components/common/DataTable";
import {
  customerSchema,
  CustomerFormData,
  assignManagerSchema,
  AssignManagerFormData,
  customerContactSchema,
  CustomerContactFormData,
} from "../schemas/customer.schema";
import { useAuth } from "../../auth/hooks/useAuth";
import { PermissionGate } from "../../auth/components/PermissionGate";
import {
  Users,
  Plus,
  Search,
  Building,
  UserCheck,
  History,
  Phone,
  Mail,
  X,
  AlertCircle,
  Eye,
  UserPlus,
  Briefcase,
} from "lucide-react";

interface Customer {
  id: string;
  agencyId: string;
  customerTypeId: string;
  code: string;
  legalName: string;
  tradeName?: string | null;
  ice?: string | null;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  status: "ACTIVE" | "SUSPENDED" | "PROSPECT";
  notes?: string | null;
  createdAt: string;
  agency: { id: string; code: string; name: string };
  customerType: { id: string; code: string; name: string };
  managerAssignments: {
    id: string;
    isCurrent: boolean;
    assignedAt: string;
    assignmentReason?: string | null;
    user: { id: string; firstName: string; lastName: string; email: string };
    assignedBy: { id: string; firstName: string; lastName: string };
  }[];
  contacts: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    mobile?: string | null;
    roleTitle?: string | null;
    isPrimary: boolean;
  }[];
  addresses: {
    id: string;
    title: string;
    street: string;
    city: string;
    type: string;
    isDefault: boolean;
  }[];
}

interface PaginatedCustomers {
  data: Customer[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const CustomersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("");
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  // Modals & Drawers state
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Lookups
  const { data: customerTypesData } = useQuery<{ id: string; code: string; name: string }[]>({
    queryKey: ["customer-types-lookup"],
    queryFn: () => customFetch("/customer-types"),
  });

  const { data: agenciesData } = useQuery<{ data: { id: string; code: string; name: string }[] }>({
    queryKey: ["agencies-lookup"],
    queryFn: () => customFetch("/agencies", { params: { limit: 100 } }),
  });

  const { data: usersData } = useQuery<{ data: { id: string; firstName: string; lastName: string; email: string }[] }>({
    queryKey: ["users-lookup"],
    queryFn: () => customFetch("/users", { params: { limit: 100 } }),
  });

  // Main Customers Query (Strictly server-side paginated & filtered)
  const { data, isLoading } = useQuery<PaginatedCustomers>({
    queryKey: ["customers", page, limit, search, selectedAgencyId, selectedTypeId, selectedStatus],
    queryFn: () =>
      customFetch<PaginatedCustomers>("/customers", {
        params: {
          page,
          limit,
          search: search || undefined,
          agencyId: selectedAgencyId || undefined,
          customerTypeId: selectedTypeId || undefined,
          status: selectedStatus || undefined,
        },
      }),
  });

  // History Query for detail drawer
  const { data: managerHistory, refetch: refetchHistory } = useQuery<any[]>({
    queryKey: ["customer-manager-history", viewingCustomer?.id],
    queryFn: () =>
      viewingCustomer
        ? customFetch(`/customers/${viewingCustomer.id}/managers/history`)
        : Promise.resolve([]),
    enabled: !!viewingCustomer,
  });

  // Form: Create / Edit Customer
  const customerForm = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      agencyId: user?.agencyId || "",
      customerTypeId: "",
      code: "",
      legalName: "",
      tradeName: "",
      ice: "",
      taxId: "",
      email: "",
      phone: "",
      status: "ACTIVE",
      notes: "",
      initialManagerUserId: "",
      initialManagerReason: "Attribution initiale à la création",
    },
  });

  // Form: Assign Manager
  const assignForm = useForm<AssignManagerFormData>({
    resolver: zodResolver(assignManagerSchema),
    defaultValues: {
      userId: "",
      assignmentReason: "",
    },
  });

  // Form: Create Contact
  const contactForm = useForm<CustomerContactFormData>({
    resolver: zodResolver(customerContactSchema),
    defaultValues: {
      customerId: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      mobile: "",
      roleTitle: "",
      isPrimary: false,
    },
  });

  const openCreateModal = () => {
    setEditingCustomer(null);
    setErrorMessage(null);
    customerForm.reset({
      agencyId: user?.agencyId || "",
      customerTypeId: customerTypesData?.[0]?.id || "",
      code: "",
      legalName: "",
      tradeName: "",
      ice: "",
      taxId: "",
      email: "",
      phone: "",
      status: "ACTIVE",
      notes: "",
      initialManagerUserId: "",
      initialManagerReason: "Attribution initiale",
    });
    setIsCustomerModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setErrorMessage(null);
    customerForm.reset({
      agencyId: c.agencyId,
      customerTypeId: c.customerTypeId,
      code: c.code,
      legalName: c.legalName,
      tradeName: c.tradeName || "",
      ice: c.ice || "",
      taxId: c.taxId || "",
      email: c.email || "",
      phone: c.phone || "",
      status: c.status,
      notes: c.notes || "",
    });
    setIsCustomerModalOpen(true);
  };

  const openAssignModal = (c: Customer) => {
    setViewingCustomer(c);
    setErrorMessage(null);
    assignForm.reset({
      userId: "",
      assignmentReason: "",
    });
    setIsAssignModalOpen(true);
  };

  const openContactModal = (c: Customer) => {
    setViewingCustomer(c);
    setErrorMessage(null);
    contactForm.reset({
      customerId: c.id,
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      mobile: "",
      roleTitle: "",
      isPrimary: false,
    });
    setIsContactModalOpen(true);
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (newCust: CustomerFormData) =>
      customFetch("/customers", {
        method: "POST",
        body: JSON.stringify(newCust),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setIsCustomerModalOpen(false);
    },
    onError: (err: any) => {
      setErrorMessage(err?.data?.message || "Erreur lors de la création du client");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: CustomerFormData }) =>
      customFetch(`/customers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setIsCustomerModalOpen(false);
    },
    onError: (err: any) => {
      setErrorMessage(err?.data?.message || "Erreur lors de la mise à jour");
    },
  });

  const assignManagerMutation = useMutation({
    mutationFn: ({ customerId, data }: { customerId: string; data: AssignManagerFormData }) =>
      customFetch(`/customers/${customerId}/managers`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await refetchHistory();
      setIsAssignModalOpen(false);
      // Refresh current viewing customer
      if (viewingCustomer) {
        const refreshed = await customFetch<Customer>(`/customers/${viewingCustomer.id}`);
        setViewingCustomer(refreshed);
      }
    },
    onError: (err: any) => {
      setErrorMessage(err?.data?.message || "Erreur lors de l'assignation du responsable");
    },
  });

  const createContactMutation = useMutation({
    mutationFn: (data: CustomerContactFormData) =>
      customFetch("/customer-contacts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      setIsContactModalOpen(false);
      if (viewingCustomer) {
        const refreshed = await customFetch<Customer>(`/customers/${viewingCustomer.id}`);
        setViewingCustomer(refreshed);
      }
    },
    onError: (err: any) => {
      setErrorMessage(err?.data?.message || "Erreur lors de l'ajout du contact");
    },
  });

  const columns: Column<Customer>[] = [
    {
      key: "code",
      header: "Code Client",
      render: (c) => (
        <span className="font-mono px-2 py-1 bg-blue-950/70 text-blue-300 border border-blue-800/60 rounded font-semibold text-xs">
          {c.code}
        </span>
      ),
    },
    {
      key: "legalName",
      header: "Raison Sociale & ICE",
      render: (c) => (
        <div>
          <div className="font-medium text-slate-100 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-blue-400" />
            {c.legalName}
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {c.ice ? `ICE: ${c.ice}` : c.tradeName || "-"}
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type & Agence",
      render: (c) => (
        <div className="space-y-1">
          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
            {c.customerType?.name || "B2B"}
          </span>
          <div className="text-[11px] text-slate-400">
            Agence: <strong className="text-slate-300">{c.agency?.code}</strong>
          </div>
        </div>
      ),
    },
    {
      key: "manager",
      header: "Responsable Interne (T)",
      render: (c) => {
        const currentManager = c.managerAssignments?.[0];
        return currentManager ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>
              {currentManager.user.firstName} {currentManager.user.lastName}
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-500 italic">Non assigné</span>
        );
      },
    },
    {
      key: "status",
      header: "Statut",
      render: (c) => {
        const badges = {
          ACTIVE: "bg-emerald-950/80 text-emerald-300 border-emerald-800/60",
          SUSPENDED: "bg-rose-950/80 text-rose-300 border-rose-800/60",
          PROSPECT: "bg-amber-950/80 text-amber-300 border-amber-800/60",
        };
        return (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${badges[c.status] || badges.ACTIVE}`}
          >
            {c.status}
          </span>
        );
      },
    },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-blue-500" />
            Référentiel Clients & Comptes Entreprises
          </h1>
          <p className="text-xs text-slate-400">
            Cloisonnement strict par agence, gestion du responsable de compte instantané et traçabilité historique
          </p>
        </div>

        <PermissionGate permissions={["customers:manage"]}>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nouveau Client
          </button>
        </PermissionGate>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par code, nom, ICE, email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-900/60 border border-slate-800 text-slate-200 text-xs rounded-xl focus:outline-none focus:border-blue-500"
          />
        </div>

        {user?.role === "SUPER_ADMIN" && agenciesData?.data && (
          <select
            value={selectedAgencyId}
            onChange={(e) => {
              setSelectedAgencyId(e.target.value);
              setPage(1);
            }}
            className="bg-slate-900/60 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
          >
            <option value="">Toutes les agences</option>
            {agenciesData.data.map((ag) => (
              <option key={ag.id} value={ag.id}>
                {ag.code} - {ag.name}
              </option>
            ))}
          </select>
        )}

        {customerTypesData && (
          <select
            value={selectedTypeId}
            onChange={(e) => {
              setSelectedTypeId(e.target.value);
              setPage(1);
            }}
            className="bg-slate-900/60 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
          >
            <option value="">Tous les types</option>
            {customerTypesData.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}

        <select
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setPage(1);
          }}
          className="bg-slate-900/60 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
        >
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actif</option>
          <option value="SUSPENDED">Suspendu</option>
          <option value="PROSPECT">Prospect</option>
        </select>
      </div>

      {/* Paginated Data Table */}
      <DataTable<Customer>
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
        emptyMessage="Aucun client trouvé selon les filtres de votre agence"
        actions={(customer) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => setViewingCustomer(customer)}
              title="Consulter la fiche complète"
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <PermissionGate permissions={["customers:manage"]}>
              <button
                onClick={() => openAssignModal(customer)}
                title="Changer de responsable interne"
                className="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/50 rounded-lg transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => openEditModal(customer)}
                className="px-2.5 py-1 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-950/50 rounded-lg transition-colors"
              >
                Modifier
              </button>
            </PermissionGate>
          </div>
        )}
      />

      {/* Customer Detail Drawer / Modal */}
      {viewingCustomer && !isAssignModalOpen && !isContactModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-slate-900/90 backdrop-blur-md px-6 py-4 border-b border-slate-800 flex items-center justify-between z-10">
              <div className="flex items-center gap-2.5">
                <Building className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="font-bold text-sm text-slate-100">
                    {viewingCustomer.legalName}
                  </h3>
                  <span className="font-mono text-xs text-slate-400">
                    {viewingCustomer.code} | {viewingCustomer.agency.name}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewingCustomer(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Top Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60">
                  <span className="text-slate-500 block mb-1">ICE (15 Chiffres)</span>
                  <span className="font-mono text-slate-200">{viewingCustomer.ice || "Non renseigné"}</span>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60">
                  <span className="text-slate-500 block mb-1">Identifiant Fiscal (IF)</span>
                  <span className="font-mono text-slate-200">{viewingCustomer.taxId || "Non renseigné"}</span>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60">
                  <span className="text-slate-500 block mb-1">Type de Compte</span>
                  <span className="text-blue-400 font-medium">{viewingCustomer.customerType?.name}</span>
                </div>
              </div>

              {/* Responsable Interne Actuel (Instant T) */}
              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                    <h4 className="font-semibold text-xs text-slate-200 uppercase tracking-wider">
                      Responsable Interne Actuel à l'instant T
                    </h4>
                  </div>
                  <PermissionGate permissions={["customers:manage"]}>
                    <button
                      onClick={() => openAssignModal(viewingCustomer)}
                      className="px-2.5 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <Briefcase className="w-3 h-3" />
                      Changer de responsable
                    </button>
                  </PermissionGate>
                </div>

                {viewingCustomer.managerAssignments?.[0] ? (
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/60">
                    <div>
                      <div className="font-semibold text-slate-100">
                        {viewingCustomer.managerAssignments[0].user.firstName}{" "}
                        {viewingCustomer.managerAssignments[0].user.lastName}
                      </div>
                      <div className="text-slate-400 text-[11px]">
                        {viewingCustomer.managerAssignments[0].user.email}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-400">
                      <div>Affecté le: {new Date(viewingCustomer.managerAssignments[0].assignedAt).toLocaleDateString()}</div>
                      <div className="italic text-slate-500">{viewingCustomer.managerAssignments[0].assignmentReason}</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">Aucun responsable interne affecté</p>
                )}
              </div>

              {/* Historique Chronologique des Responsables */}
              <div className="space-y-3">
                <h4 className="font-semibold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-400" />
                  Historique d'Attribution & Traçabilité Complète
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {managerHistory && managerHistory.length > 0 ? (
                    managerHistory.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                          item.isCurrent
                            ? "bg-emerald-950/20 border-emerald-800/40 text-slate-200"
                            : "bg-slate-950/40 border-slate-800/40 text-slate-400"
                        }`}
                      >
                        <div>
                          <div className="font-medium text-slate-200 flex items-center gap-2">
                            <span>
                              {item.user.firstName} {item.user.lastName}
                            </span>
                            {item.isCurrent && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-800">
                                Actif
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 italic">
                            Motif: {item.assignmentReason || "Non spécifié"}
                          </div>
                        </div>
                        <div className="text-right text-[10px] text-slate-500 font-mono">
                          <div>Du: {new Date(item.assignedAt).toLocaleDateString()}</div>
                          <div>
                            Au: {item.unassignedAt ? new Date(item.unassignedAt).toLocaleDateString() : "Présent"}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 italic">Aucun historique disponible</p>
                  )}
                </div>
              </div>

              {/* Contacts Interlocuteurs Client */}
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    Interlocuteurs chez le client ({viewingCustomer.contacts?.length || 0})
                  </h4>
                  <PermissionGate permissions={["customers:manage"]}>
                    <button
                      onClick={() => openContactModal(viewingCustomer)}
                      className="px-2.5 py-1 text-[11px] bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <UserPlus className="w-3 h-3" />
                      Ajouter un contact
                    </button>
                  </PermissionGate>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {viewingCustomer.contacts?.map((contact) => (
                    <div
                      key={contact.id}
                      className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60 text-xs space-y-1"
                    >
                      <div className="font-semibold text-slate-100 flex items-center justify-between">
                        <span>
                          {contact.firstName} {contact.lastName}
                        </span>
                        {contact.isPrimary && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                            Principal
                          </span>
                        )}
                      </div>
                      {contact.roleTitle && (
                        <div className="text-slate-400 text-[11px]">{contact.roleTitle}</div>
                      )}
                      {contact.email && (
                        <div className="text-slate-400 text-[11px] flex items-center gap-1">
                          <Mail className="w-2.5 h-2.5 text-slate-500" />
                          {contact.email}
                        </div>
                      )}
                      {contact.phone && (
                        <div className="text-slate-400 text-[11px] flex items-center gap-1">
                          <Phone className="w-2.5 h-2.5 text-slate-500" />
                          {contact.phone}
                        </div>
                      )}
                    </div>
                  ))}
                  {(!viewingCustomer.contacts || viewingCustomer.contacts.length === 0) && (
                    <p className="text-xs text-slate-500 italic col-span-2">
                      Aucun contact externe enregistré
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Customer */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-slate-100">
                {editingCustomer ? "Modifier la fiche client" : "Créer un nouveau compte client"}
              </h3>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={customerForm.handleSubmit(
                (data) => {
                  if (editingCustomer) {
                    updateMutation.mutate({ id: editingCustomer.id, updates: data });
                  } else {
                    createMutation.mutate(data);
                  }
                },
                (errs) => console.log("Validation errors:", errs),
              )}
              className="p-6 space-y-4"
            >
              {errorMessage && (
                <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {user?.role === "SUPER_ADMIN" && !editingCustomer && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Agence de rattachement *
                  </label>
                  <select
                    {...customerForm.register("agencyId")}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Sélectionnez l'agence...</option>
                    {agenciesData?.data.map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.code} - {ag.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Code Client (ex: CLI-AGA-001) *
                  </label>
                  <input
                    {...customerForm.register("code")}
                    disabled={!!editingCustomer}
                    placeholder="CLI-AGA-001"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                  {customerForm.formState.errors.code && (
                    <p className="text-[11px] text-rose-400 mt-1">
                      {customerForm.formState.errors.code.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Type de Client *
                  </label>
                  <select
                    {...customerForm.register("customerTypeId")}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Sélectionner le type...</option>
                    {customerTypesData?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {customerForm.formState.errors.customerTypeId && (
                    <p className="text-[11px] text-rose-400 mt-1">
                      {customerForm.formState.errors.customerTypeId.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Raison Sociale Officielle *
                </label>
                <input
                  {...customerForm.register("legalName")}
                  placeholder="Atlas Trading SARL"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
                {customerForm.formState.errors.legalName && (
                  <p className="text-[11px] text-rose-400 mt-1">
                    {customerForm.formState.errors.legalName.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    ICE Marocain (15 chiffres)
                  </label>
                  <input
                    {...customerForm.register("ice")}
                    placeholder="001234567000089"
                    maxLength={15}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                  />
                  {customerForm.formState.errors.ice && (
                    <p className="text-[11px] text-rose-400 mt-1">
                      {customerForm.formState.errors.ice.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Identifiant Fiscal (IF)
                  </label>
                  <input
                    {...customerForm.register("taxId")}
                    placeholder="12345678"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Email Principal
                  </label>
                  <input
                    {...customerForm.register("email")}
                    placeholder="contact@client.ma"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                  {customerForm.formState.errors.email && (
                    <p className="text-[11px] text-rose-400 mt-1">
                      {customerForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Téléphone
                  </label>
                  <input
                    {...customerForm.register("phone")}
                    placeholder="+212528223344"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {!editingCustomer && (
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-3">
                  <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                    Assignation initiale du responsable interne
                  </h4>
                  <select
                    {...customerForm.register("initialManagerUserId")}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Sélectionner un collaborateur...</option>
                    {usersData?.data.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Enregistrement..."
                    : editingCustomer
                    ? "Mettre à jour"
                    : "Créer le client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assign / Change Manager */}
      {isAssignModalOpen && viewingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-400" />
                Affecter un nouveau gestionnaire
              </h3>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={assignForm.handleSubmit((d) =>
                assignManagerMutation.mutate({
                  customerId: viewingCustomer.id,
                  data: d,
                }),
              )}
              className="p-6 space-y-4"
            >
              {errorMessage && (
                <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <p className="text-xs text-slate-400">
                L'attribution d'un nouveau gestionnaire clôturera automatiquement la période
                de responsabilité du gestionnaire précédent et archivera l'événement dans l'historique inaltérable.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nouveau responsable interne *
                </label>
                <select
                  {...assignForm.register("userId")}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Choisir le collaborateur...</option>
                  {usersData?.data.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} ({u.email})
                    </option>
                  ))}
                </select>
                {assignForm.formState.errors.userId && (
                  <p className="text-[11px] text-rose-400 mt-1">
                    {assignForm.formState.errors.userId.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Motif du changement / transfert *
                </label>
                <textarea
                  {...assignForm.register("assignmentReason")}
                  rows={3}
                  placeholder="Ex: Réorganisation commerciale, mutation de portefeuille, départ collaborateur..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
                {assignForm.formState.errors.assignmentReason && (
                  <p className="text-[11px] text-rose-400 mt-1">
                    {assignForm.formState.errors.assignmentReason.message}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={assignManagerMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  {assignManagerMutation.isPending ? "Affectation..." : "Confirmer l'affectation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Contact to Customer */}
      {isContactModalOpen && viewingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-slate-100">
                Ajouter un interlocuteur ({viewingCustomer.legalName})
              </h3>
              <button
                onClick={() => setIsContactModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={contactForm.handleSubmit((d) => createContactMutation.mutate(d))}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Prénom *
                  </label>
                  <input
                    {...contactForm.register("firstName")}
                    placeholder="Karim"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Nom *
                  </label>
                  <input
                    {...contactForm.register("lastName")}
                    placeholder="Benjelloun"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Fonction / Rôle
                </label>
                <input
                  {...contactForm.register("roleTitle")}
                  placeholder="Directeur Logistique"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    {...contactForm.register("email")}
                    placeholder="k.benjelloun@client.ma"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Téléphone
                  </label>
                  <input
                    {...contactForm.register("phone")}
                    placeholder="+212661223344"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isPrimary"
                  {...contactForm.register("isPrimary")}
                  className="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0"
                />
                <label htmlFor="isPrimary" className="text-xs text-slate-300">
                  Définir comme contact principal
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={createContactMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  {createContactMutation.isPending ? "Ajout..." : "Ajouter le contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

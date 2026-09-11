import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import {
  FileText,
  Search,
  Plus,
  Calendar,
  CheckCircle2,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { DocumentDownloadButton } from "../../documents/components/DocumentDownloadButton";

export interface InvoiceItemDetail {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string;
  subtotalAmount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  notes: string | null;
  customer: {
    id: string;
    code: string;
    legalName: string;
    ice: string | null;
    email: string | null;
  };
  items: InvoiceItemDetail[];
}

export const InvoicesPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);

  // Form state
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [taxRate] = useState(20.0);
  const [items, setItems] = useState<
    Array<{ description: string; quantity: number; unitPrice: number }>
  >([{ description: "Fret standard Casablanca -> Marrakech", quantity: 1, unitPrice: 65.0 }]);
  const [formError, setFormError] = useState<string | null>(null);

  // Queries
  const { data: customersData } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      return customFetch<{ data: Array<{ id: string; code: string; legalName: string }> }>(
        "/customers?limit=100",
      );
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", statusFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      if (searchTerm) params.append("search", searchTerm);
      return customFetch<{ data: InvoiceDetail[]; meta: { total: number } }>(
        `/invoices?${params.toString()}`,
      );
    },
  });

  const invoices = data?.data || [];
  const customers = customersData?.data || [];

  // Create invoice mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      return customFetch("/invoices", {
        method: "POST",
        body: JSON.stringify({
          customerId,
          taxRate,
          notes: notes.trim() || undefined,
          items,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setShowCreateModal(false);
      setCustomerId("");
      setNotes("");
      setItems([{ description: "", quantity: 1, unitPrice: 0 }]);
      setFormError(null);
    },
    onError: (err: unknown) => {
      const apiErr = err as { response?: { data?: { message?: string | string[] } }; message?: string };
      const msg = apiErr?.response?.data?.message || apiErr?.message || "Erreur de création de la facture.";
      setFormError(Array.isArray(msg) ? msg.join(", ") : String(msg));
    },
  });

  const addItemRow = () => {
    setItems([...items, { description: "", quantity: 1, unitPrice: 0 }]);
  };

  const removeItemRow = (idx: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== idx));
    }
  };

  const updateItemRow = (idx: number, field: string, val: string | number) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: val };
    setItems(next);
  };

  // Math preview
  const subtotalPreview = items.reduce(
    (acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
    0,
  );
  const taxPreview = Math.round(subtotalPreview * (taxRate / 100) * 100) / 100;
  const totalPreview = Math.round((subtotalPreview + taxPreview) * 100) / 100;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <span>Facturation des Prestations</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestion certifiée des factures de transport, calcul automatique de la TVA et suivi des règlements
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher FACT-..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">Tous les statuts</option>
            <option value="ISSUED">Émise (Non payée)</option>
            <option value="PARTIALLY_PAID">Partiellement payée</option>
            <option value="PAID">Payée</option>
            <option value="CANCELLED">Annulée</option>
          </select>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-blue-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvelle Facture</span>
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="p-12 text-center text-slate-500 text-xs">
          Chargement des factures en cours...
        </div>
      )}

      {!isLoading && invoices.length === 0 && (
        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-2xl text-center space-y-3">
          <FileText className="w-10 h-10 text-slate-600 mx-auto" />
          <h2 className="text-base font-bold text-slate-200">Aucune facture trouvée</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Émettez votre première facture de transport en cliquant sur "Nouvelle Facture".
          </p>
        </div>
      )}

      {!isLoading && invoices.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                onClick={() => setSelectedInvoice(inv)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-lg ${
                  selectedInvoice?.id === inv.id
                    ? "bg-slate-900 border-blue-500 ring-1 ring-blue-500/50"
                    : "bg-slate-900/70 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-400 text-sm">
                      {inv.invoiceNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        inv.status === "PAID"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          : inv.status === "PARTIALLY_PAID"
                            ? "bg-amber-950 text-amber-300 border border-amber-800"
                            : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>

                  <div className="text-right text-[11px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    <span>Échéance : {new Date(inv.dueDate).toLocaleDateString("fr-FR")}</span>
                  </div>
                </div>

                <div className="pt-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-200">{inv.customer.legalName}</div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Code : {inv.customer.code} {inv.customer.ice ? `• ICE: ${inv.customer.ice}` : ""}
                    </span>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-sm font-bold text-slate-100">
                      {Number(inv.totalAmount).toFixed(2)} MAD TTC
                    </div>
                    {Number(inv.remainingAmount) > 0 ? (
                      <span className="text-[10px] text-rose-400 font-semibold">
                        Reste dû : {Number(inv.remainingAmount).toFixed(2)} MAD
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 justify-end">
                        <CheckCircle2 className="w-3 h-3" /> Soldée
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Invoice detail panel */}
          <div>
            {selectedInvoice ? (
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 text-xs shadow-xl">
                <div className="border-b border-slate-800 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-blue-400 text-base">
                      {selectedInvoice.invoiceNumber}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold">
                      {selectedInvoice.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-slate-400">
                      Date d'émission : {new Date(selectedInvoice.issueDate).toLocaleDateString("fr-FR")}
                    </span>
                    <DocumentDownloadButton
                      documentType="INVOICE"
                      entityId={selectedInvoice.id}
                      label="Télécharger Facture PDF"
                    />
                  </div>
                </div>

                {/* Customer block */}
                <div className="p-3 bg-slate-950/50 border border-slate-850 rounded-xl space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Client Facturé
                  </span>
                  <div className="font-bold text-slate-200">{selectedInvoice.customer.legalName}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    ICE : {selectedInvoice.customer.ice || "Non renseigné"}
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Lignes de facturation ({selectedInvoice.items.length})
                  </span>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {selectedInvoice.items.map((it) => (
                      <div
                        key={it.id}
                        className="p-2 bg-slate-950/40 border border-slate-850 rounded-lg flex items-center justify-between text-[11px]"
                      >
                        <div className="space-y-0.5">
                          <div className="text-slate-200">{it.description}</div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Qté : {it.quantity} &bull; PU : {Number(it.unitPrice).toFixed(2)} MAD
                          </span>
                        </div>
                        <span className="font-mono font-bold text-slate-100">
                          {Number(it.totalPrice).toFixed(2)} MAD
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total box */}
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1 text-[11px] font-mono">
                  <div className="flex justify-between text-slate-400">
                    <span>Sous-total HT :</span>
                    <span>{Number(selectedInvoice.subtotalAmount).toFixed(2)} MAD</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>TVA ({selectedInvoice.taxRate}%) :</span>
                    <span>{Number(selectedInvoice.taxAmount).toFixed(2)} MAD</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-100 pt-1 border-t border-slate-800">
                    <span>Total TTC :</span>
                    <span className="text-blue-400">{Number(selectedInvoice.totalAmount).toFixed(2)} MAD</span>
                  </div>
                  <div className="flex justify-between text-xs text-rose-400 pt-1">
                    <span>Reste à payer :</span>
                    <span>{Number(selectedInvoice.remainingAmount).toFixed(2)} MAD</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-2xl text-center text-slate-500 text-xs">
                Sélectionnez une facture pour afficher le détail certifié et ses lignes de prestation.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal create invoice */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 text-xs shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <span>Émettre une Facture de Transport</span>
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-500 hover:text-slate-300 text-sm"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-200 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Client à facturer <span className="text-rose-400">*</span>
                </label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Sélectionner un client marchand...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.legalName} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Items row builder */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">
                    Lignes de Prestation (Fret / Suppléments)
                  </span>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 text-[11px]"
                  >
                    <Plus className="w-3 h-3" /> Ajouter une ligne
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                    >
                      <div className="sm:col-span-6">
                        <input
                          type="text"
                          placeholder="Description de la prestation..."
                          value={it.description}
                          onChange={(e) => updateItemRow(idx, "description", e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-850 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          min="1"
                          placeholder="Qté"
                          value={it.quantity}
                          onChange={(e) => updateItemRow(idx, "quantity", parseInt(e.target.value) || 1)}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-850 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Prix HT"
                          value={it.unitPrice}
                          onChange={(e) => updateItemRow(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 bg-slate-900 border border-slate-850 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          disabled={items.length <= 1}
                          className="text-slate-500 hover:text-rose-400 disabled:opacity-30 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total summary */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-right font-mono text-xs">
                <div className="text-slate-400">
                  Sous-total HT : <strong>{subtotalPreview.toFixed(2)} MAD</strong>
                </div>
                <div className="text-slate-400">
                  TVA (20.0%) : <strong>{taxPreview.toFixed(2)} MAD</strong>
                </div>
                <div className="text-sm font-bold text-blue-400 pt-1 border-t border-slate-800">
                  Total TTC : {totalPreview.toFixed(2)} MAD
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Notes ou mentions légales
                </label>
                <input
                  type="text"
                  placeholder="Ex: Facture récapitulative des expéditions semaine 35..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!customerId) {
                    setFormError("Veuillez sélectionner un client marchand.");
                    return;
                  }
                  if (items.some((it) => !it.description.trim() || it.unitPrice <= 0)) {
                    setFormError("Chaque ligne doit avoir une description et un prix supérieur à zéro.");
                    return;
                  }
                  setFormError(null);
                  createMutation.mutate();
                }}
                disabled={createMutation.isPending}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{createMutation.isPending ? "Émission en cours..." : "Confirmer l'Émission"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

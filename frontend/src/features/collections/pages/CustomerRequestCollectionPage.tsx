import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import { useAuth } from "../../auth/hooks/useAuth";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  PackagePlus,
  ShieldCheck,
} from "lucide-react";
import { APP_NAME } from "../../../lib/config";

interface ParcelItemInput {
  declaredWeightKg: number;
  description: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientCity: string;
  codAmount: number;
}

export const CustomerRequestCollectionPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [pickupContactName, setPickupContactName] = useState(
    user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "",
  );
  const [pickupPhone, setPickupPhone] = useState(user?.phone || "");
  const [pickupStreet, setPickupStreet] = useState("");
  const [pickupCity, setPickupCity] = useState("Casablanca");
  const [scheduledDate, setScheduledDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split("T")[0],
  );
  const [timeSlotStart, setTimeSlotStart] = useState("09:00");
  const [timeSlotEnd, setTimeSlotEnd] = useState("12:00");
  const [clientNotes, setClientNotes] = useState("");

  const [items, setItems] = useState<ParcelItemInput[]>([
    {
      declaredWeightKg: 1.0,
      description: "Marchandises diverses",
      recipientName: "",
      recipientPhone: "",
      recipientAddress: "",
      recipientCity: "Rabat",
      codAmount: 0,
    },
  ]);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNumber, setSuccessNumber] = useState<string | null>(null);

  const addItem = () => {
    setItems([
      ...items,
      {
        declaredWeightKg: 1.0,
        description: "Marchandises diverses",
        recipientName: "",
        recipientPhone: "",
        recipientAddress: "",
        recipientCity: "Casablanca",
        codAmount: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const updateItem = (index: number, field: keyof ParcelItemInput, value: unknown) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    setItems(next);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      return customFetch<{ collectionNumber: string }>("/collections", {
        method: "POST",
        body: JSON.stringify({
          pickupContactName: pickupContactName.trim(),
          pickupPhone: pickupPhone.trim(),
          pickupStreet: pickupStreet.trim(),
          pickupCity: pickupCity.trim(),
          scheduledDate,
          timeSlotStart,
          timeSlotEnd,
          clientNotes: clientNotes.trim() || undefined,
          items: items.map((i) => ({
            declaredWeightKg: Number(i.declaredWeightKg) || 1.0,
            description: i.description.trim() || undefined,
            recipientName: i.recipientName.trim(),
            recipientPhone: i.recipientPhone.trim(),
            recipientAddress: i.recipientAddress.trim(),
            recipientCity: i.recipientCity.trim(),
            codAmount: Number(i.codAmount) > 0 ? Number(i.codAmount) : undefined,
          })),
        }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      setSuccessNumber(data.collectionNumber);
      setErrorMessage(null);
    },
    onError: (err: unknown) => {
      const apiErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const msg =
        apiErr?.response?.data?.message ||
        apiErr?.message ||
        "Erreur lors de l'enregistrement de la demande de collecte.";
      setErrorMessage(Array.isArray(msg) ? msg.join(", ") : String(msg));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupContactName || !pickupPhone || !pickupStreet || !pickupCity) {
      setErrorMessage("Veuillez renseigner toutes les coordonnées de ramassage.");
      return;
    }
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.recipientName || !item.recipientPhone || !item.recipientAddress || !item.recipientCity) {
        setErrorMessage(`Veuillez compléter toutes les informations du destinataire pour le colis #${i + 1}.`);
        return;
      }
    }
    setErrorMessage(null);
    mutation.mutate();
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl">
              <PackagePlus className="w-6 h-6" />
            </div>
            <span>Demander un Enlèvement / Collecte</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Programmez la visite d'un coursier {APP_NAME} pour ramasser vos colis à votre adresse
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-950/40 border border-blue-800 text-blue-300 text-xs">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <span>Compte Client Sécurisé : {user?.email}</span>
        </div>
      </div>

      {successNumber ? (
        <div className="p-8 bg-slate-900/60 border border-emerald-800/80 rounded-2xl text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Demande d'enlèvement enregistrée avec succès !
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Numéro de demande :{" "}
              <span className="font-mono font-bold text-blue-400 text-sm">
                {successNumber}
              </span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Notre équipe d'exploitation affectera un coursier pour le créneau demandé ({scheduledDate} de {timeSlotStart} à {timeSlotEnd}).
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                setSuccessNumber(null);
                setItems([
                  {
                    declaredWeightKg: 1.0,
                    description: "Marchandises diverses",
                    recipientName: "",
                    recipientPhone: "",
                    recipientAddress: "",
                    recipientCity: "Rabat",
                    codAmount: 0,
                  },
                ]);
              }}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-md transition-colors"
            >
              Créer une autre demande
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6 text-xs">
          {errorMessage && (
            <div
              role="alert"
              className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Pickup Location & Contact */}
          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center text-xs">
                1
              </span>
              <span>Adresse & Contact d'Enlèvement</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nom du contact sur place <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Fatima Zahra"
                  value={pickupContactName}
                  onChange={(e) => setPickupContactName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Téléphone du contact <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: +212611223344"
                  value={pickupPhone}
                  onChange={(e) => setPickupPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Rue / Adresse physique d'enlèvement <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: 45 Rue des Alouettes, Maarif, Étage 2"
                  value={pickupStreet}
                  onChange={(e) => setPickupStreet(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Ville d'enlèvement <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Casablanca"
                  value={pickupCity}
                  onChange={(e) => setPickupCity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Scheduled Time Slot */}
          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center text-xs">
                2
              </span>
              <span>Créneau de Ramassage Souhaité</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Date d'enlèvement <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Créneau Début
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="time"
                    value={timeSlotStart}
                    onChange={(e) => setTimeSlotStart(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Créneau Fin
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="time"
                    value={timeSlotEnd}
                    onChange={(e) => setTimeSlotEnd(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Instructions d'accès / Remarques pour le coursier (Optionnel)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Sonnette Alpha Shop, demander le quai de chargement arrière"
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Declared Parcels */}
          <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center text-xs">
                  3
                </span>
                <span>Colis Déclarés ({items.length})</span>
              </h2>

              <button
                type="button"
                onClick={addItem}
                className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter un colis</span>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                    <span className="font-bold text-slate-200">Colis #{idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-rose-400 hover:text-rose-300 p-1 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Destinataire <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Nom destinataire"
                        value={item.recipientName}
                        onChange={(e) => updateItem(idx, "recipientName", e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Téléphone <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="+2126..."
                        value={item.recipientPhone}
                        onChange={(e) => updateItem(idx, "recipientPhone", e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Ville Destinataire <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Rabat, Marrakech..."
                        value={item.recipientCity}
                        onChange={(e) => updateItem(idx, "recipientCity", e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Adresse complète de livraison <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Adresse de livraison"
                        value={item.recipientAddress}
                        onChange={(e) => updateItem(idx, "recipientAddress", e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        COD (Montant à encaisser MAD)
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0.00"
                        value={item.codAmount || ""}
                        onChange={(e) =>
                          updateItem(idx, "codAmount", parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors shadow-md shadow-blue-500/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {mutation.isPending
                  ? "Enregistrement de la demande..."
                  : `Confirmer la demande (${items.length} colis)`}
              </span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

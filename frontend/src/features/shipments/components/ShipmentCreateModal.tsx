import React, { useState } from "react";
import { useForm, useFieldArray, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import {
  createShipmentSchema,
  CreateShipmentFormData,
} from "../schemas/shipment.schema";
import {
  X,
  Plus,
  Trash2,
  Package,
  User,
  CreditCard,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Scale,
  Box,
  Layers,
} from "lucide-react";

interface ShipmentCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ShipmentCreateModal: React.FC<ShipmentCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Fetch agencies
  const { data: agenciesData } = useQuery({
    queryKey: ["agencies-select"],
    queryFn: async () => {
      const res = await customFetch<{ data: Array<{ id: string; code: string; name: string }> }>("/agencies?limit=100");
      return res.data;
    },
    enabled: isOpen,
  });

  // Fetch customers
  const { data: customersData } = useQuery({
    queryKey: ["customers-select"],
    queryFn: async () => {
      const res = await customFetch<{ data: Array<{ id: string; code: string; legalName: string; agencyId: string }> }>("/customers?limit=100");
      return res.data;
    },
    enabled: isOpen,
  });

  // Fallback parcel types if API route not yet declared
  const parcelTypes = [
    { id: "e042cf72-46a2-4a7b-a316-cce932598380", code: "STANDARD_BOX", name: "Colis Standard (Carton)" },
    { id: "a153be83-57b3-5b8c-b427-dde043609491", code: "FLYER_DOC", name: "Pochette / Documents" },
    { id: "b264cf94-68c4-6c9d-c538-eef154710502", code: "BULKY_PACKAGE", name: "Colis Volumineux / Lourd" },
    { id: "c375da05-79d5-7dae-d649-ff0265821613", code: "PALLET", name: "Palette Sécurisée" },
  ];

  const defaultValues: CreateShipmentFormData = {
    senderCustomerId: "",
    senderAddressId: null,
    destinationAgencyId: "",
    recipientName: "",
    recipientPhone: "",
    recipientEmail: "",
    recipientAddress: "",
    recipientCity: "",
    recipientZoneId: null,
    parcels: [
      {
        parcelTypeId: parcelTypes[0].id,
        weightKg: 1,
        lengthCm: 25,
        widthCm: 20,
        heightCm: 15,
        notes: "",
        items: [],
      },
    ],
    serviceType: "STANDARD",
    paymentMethod: "PREPAID_CASH",
    shippingFee: 60,
    declaredValue: undefined,
    codAmount: undefined,
    notes: "",
  };

  const {
    register,
    control,
    handleSubmit,
    watch,
    trigger,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateShipmentFormData>({
    resolver: zodResolver(createShipmentSchema) as unknown as Resolver<CreateShipmentFormData>,
    defaultValues,
    mode: "onBlur",
  });

  // SINGLE SOURCE OF TRUTH for multi-parcels state
  const { fields, append, remove } = useFieldArray({
    control,
    name: "parcels",
  });

  const watchedParcels = watch("parcels");
  const watchedServiceType = watch("serviceType");
  const watchedPaymentMethod = watch("paymentMethod");
  const watchedShippingFee = watch("shippingFee");
  const watchedCodAmount = watch("codAmount");
  const watchedRecipientName = watch("recipientName");
  const watchedRecipientCity = watch("recipientCity");

  // Real-time totals computed strictly from watched form state
  const totalWeightKg = (watchedParcels || []).reduce(
    (sum, p) => sum + (Number(p?.weightKg) || 0),
    0,
  );

  const createMutation = useMutation({
    mutationFn: async (data: CreateShipmentFormData) => {
      // Clean undefined and format payload
      const payload = {
        ...data,
        shippingFee: Number(data.shippingFee),
        declaredValue: data.declaredValue ? Number(data.declaredValue) : undefined,
        codAmount: data.codAmount ? Number(data.codAmount) : undefined,
        parcels: data.parcels.map((p) => ({
          ...p,
          weightKg: Number(p.weightKg),
          lengthCm: p.lengthCm ? Number(p.lengthCm) : undefined,
          widthCm: p.widthCm ? Number(p.widthCm) : undefined,
          heightCm: p.heightCm ? Number(p.heightCm) : undefined,
        })),
      };

      return customFetch("/shipments", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      reset(defaultValues);
      setCurrentStep(1);
      setBackendError(null);
      if (onSuccess) onSuccess();
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
        "Une erreur est survenue lors de la création de l'expédition.";
      setBackendError(Array.isArray(msg) ? msg.join(", ") : String(msg));
    },
  });

  const handleNextStep = async () => {
    setBackendError(null);
    if (currentStep === 1) {
      const isValid = await trigger([
        "senderCustomerId",
        "destinationAgencyId",
        "recipientName",
        "recipientPhone",
        "recipientEmail",
        "recipientAddress",
        "recipientCity",
      ]);
      if (isValid) setCurrentStep(2);
    } else if (currentStep === 2) {
      const isValid = await trigger(["parcels"]);
      if (isValid) setCurrentStep(3);
    } else if (currentStep === 3) {
      const isValid = await trigger([
        "serviceType",
        "paymentMethod",
        "shippingFee",
        "declaredValue",
        "codAmount",
      ]);
      if (isValid) setCurrentStep(4);
    }
  };

  const handlePrevStep = () => {
    setBackendError(null);
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    }
  };

  const onSubmit = (data: CreateShipmentFormData) => {
    setBackendError(null);
    createMutation.mutate(data);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header with Wizard Step Indicator */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                Nouvelle Expédition & Multi-Colis
              </h2>
              <p className="text-xs text-slate-400">
                Création transactionnelle atomique avec numérotation unique garantie
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="grid grid-cols-4 border-b border-slate-800 text-xs font-medium bg-slate-950/40">
          {[
            { step: 1, label: "Expéditeur / Destinataire", icon: User },
            { step: 2, label: `Colis (${watchedParcels?.length || 1})`, icon: Box },
            { step: 3, label: "Service & Paiement", icon: CreditCard },
            { step: 4, label: "Confirmation", icon: CheckCircle },
          ].map(({ step, label, icon: Icon }) => (
            <div
              key={step}
              className={`px-4 py-3 flex items-center gap-2 border-r border-slate-800 last:border-r-0 transition-colors ${
                currentStep === step
                  ? "bg-blue-600/10 text-blue-400 border-b-2 border-b-blue-500 font-semibold"
                  : currentStep > step
                  ? "text-emerald-400"
                  : "text-slate-500"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                  currentStep === step
                    ? "bg-blue-600 text-white"
                    : currentStep > step
                    ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/40"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {currentStep > step ? "✓" : step}
              </span>
              <Icon className="w-3.5 h-3.5 hidden sm:inline opacity-70" />
              <span className="hidden sm:inline truncate">{label}</span>
            </div>
          ))}
        </div>

        {/* Backend Error Banner */}
        {backendError && (
          <div
            role="alert"
            className="m-6 p-4 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">Erreur de validation ou transaction</span>
              <span>{backendError}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-6 max-h-[65vh] overflow-y-auto space-y-6">
            {/* STEP 1: Expéditeur & Destinataire */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-400" />
                    1. Expéditeur & Agence d'acheminement
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="senderCustomerId"
                        className="block text-xs font-medium text-slate-300 mb-1.5"
                      >
                        Client Expéditeur <span className="text-rose-400">*</span>
                      </label>
                      <select
                        id="senderCustomerId"
                        {...register("senderCustomerId")}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      >
                        <option value="">-- Choisir un client --</option>
                        {customersData?.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.legalName} ({c.code})
                          </option>
                        ))}
                      </select>
                      {errors.senderCustomerId && (
                        <span className="text-[11px] text-rose-400 mt-1 block">
                          {errors.senderCustomerId.message}
                        </span>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="destinationAgencyId"
                        className="block text-xs font-medium text-slate-300 mb-1.5"
                      >
                        Agence de Destination / Hub <span className="text-rose-400">*</span>
                      </label>
                      <select
                        id="destinationAgencyId"
                        {...register("destinationAgencyId")}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      >
                        <option value="">-- Choisir l'agence d'arrivée --</option>
                        {agenciesData?.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.code})
                          </option>
                        ))}
                      </select>
                      {errors.destinationAgencyId && (
                        <span className="text-[11px] text-rose-400 mt-1 block">
                          {errors.destinationAgencyId.message}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80">
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-400" />
                    Destinataire Final
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Nom ou Société du Destinataire <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Société Marocaine de Transport"
                        {...register("recipientName")}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                      {errors.recipientName && (
                        <span className="text-[11px] text-rose-400 mt-1 block">
                          {errors.recipientName.message}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Téléphone Mobile <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: +212 661 234 567"
                        {...register("recipientPhone")}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                      {errors.recipientPhone && (
                        <span className="text-[11px] text-rose-400 mt-1 block">
                          {errors.recipientPhone.message}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Email de Notification
                      </label>
                      <input
                        type="email"
                        placeholder="destinataire@exemple.ma"
                        {...register("recipientEmail")}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                      {errors.recipientEmail && (
                        <span className="text-[11px] text-rose-400 mt-1 block">
                          {errors.recipientEmail.message}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Ville de Destination <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Casablanca, Agadir, Tanger..."
                        {...register("recipientCity")}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                      {errors.recipientCity && (
                        <span className="text-[11px] text-rose-400 mt-1 block">
                          {errors.recipientCity.message}
                        </span>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Adresse Physique Complète de Livraison <span className="text-rose-400">*</span>
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Numéro, rue, quartier, étage..."
                        {...register("recipientAddress")}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                      {errors.recipientAddress && (
                        <span className="text-[11px] text-rose-400 mt-1 block">
                          {errors.recipientAddress.message}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Colis Multiples (1/N, 2/N...) */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-400" />
                      Gestion des Colis Physiques ({fields.length} colis)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Chaque colis recevra son propre code-barres et son tracking individuel
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center gap-2">
                      <Scale className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-slate-400">Poids Total :</span>
                      <span className="font-mono font-bold text-slate-100">{totalWeightKg.toFixed(2)} kg</span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        append({
                          parcelTypeId: parcelTypes[0].id,
                          weightKg: 1,
                          lengthCm: 20,
                          widthCm: 15,
                          heightCm: 10,
                          notes: "",
                          items: [],
                        })
                      }
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ajouter un colis</span>
                    </button>
                  </div>
                </div>

                {errors.parcels?.root && (
                  <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-xl">
                    {errors.parcels.root.message}
                  </div>
                )}

                <div className="space-y-4">
                  {fields.map((field, index) => {
                    const length = watchedParcels?.[index]?.lengthCm || 0;
                    const width = watchedParcels?.[index]?.widthCm || 0;
                    const height = watchedParcels?.[index]?.heightCm || 0;
                    const volWeight = length && width && height ? (length * width * height) / 5000 : null;

                    return (
                      <div
                        key={field.id}
                        className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl relative space-y-4"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-blue-950 border border-blue-800 text-blue-300 text-[11px] font-mono font-bold">
                              Colis {index + 1} / {fields.length}
                            </span>
                            <span className="text-xs font-medium text-slate-300">
                              Gabarit & Poids
                            </span>
                          </div>

                          {fields.length > 1 && (
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                              title="Supprimer ce colis"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1.5">
                              Type de Colis <span className="text-rose-400">*</span>
                            </label>
                            <select
                              {...register(`parcels.${index}.parcelTypeId` as const)}
                              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                            >
                              {parcelTypes.map((pt) => (
                                <option key={pt.id} value={pt.id}>
                                  {pt.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1.5">
                              Poids Réel (kg) <span className="text-rose-400">*</span>
                            </label>
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              placeholder="1.5"
                              {...register(`parcels.${index}.weightKg` as const, {
                                valueAsNumber: true,
                              })}
                              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                            />
                            {errors.parcels?.[index]?.weightKg && (
                              <span className="text-[10px] text-rose-400 mt-1 block">
                                {errors.parcels[index]?.weightKg?.message}
                              </span>
                            )}
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-slate-300 mb-1.5">
                              Dimensions L x l x h (cm) & Poids Volumétrique
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                placeholder="L"
                                {...register(`parcels.${index}.lengthCm` as const, {
                                  valueAsNumber: true,
                                })}
                                className="w-16 px-2 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-center text-slate-100 font-mono"
                              />
                              <span className="text-slate-500 text-xs">×</span>
                              <input
                                type="number"
                                placeholder="l"
                                {...register(`parcels.${index}.widthCm` as const, {
                                  valueAsNumber: true,
                                })}
                                className="w-16 px-2 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-center text-slate-100 font-mono"
                              />
                              <span className="text-slate-500 text-xs">×</span>
                              <input
                                type="number"
                                placeholder="H"
                                {...register(`parcels.${index}.heightCm` as const, {
                                  valueAsNumber: true,
                                })}
                                className="w-16 px-2 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-center text-slate-100 font-mono"
                              />
                              <div className="text-[11px] text-slate-400 pl-2">
                                Vol. :{" "}
                                <span className="font-mono text-blue-300">
                                  {volWeight ? `${volWeight.toFixed(2)} kg` : "--"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">
                            Instructions ou notes particulières pour ce colis
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: Manipuler avec précaution, fragile, flacon verre..."
                            {...register(`parcels.${index}.notes` as const)}
                            className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 3: Service, Tarification & Paiement */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-400" />
                    Service & Conditions Financières
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Type de Service de Livraison
                      </label>
                      <select
                        {...register("serviceType")}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      >
                        <option value="STANDARD">Standard (24h - 48h)</option>
                        <option value="EXPRESS">Express (Prioritaire J+1)</option>
                        <option value="SAME_DAY">Same Day (Livraison le jour même)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Mode de Paiement
                      </label>
                      <select
                        {...register("paymentMethod")}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      >
                        <option value="PREPAID_CASH">Payé au départ (Espèces / Agence)</option>
                        <option value="PREPAID_ACCOUNT">Compte Client / Facturation Mensuelle</option>
                        <option value="CASH_ON_DELIVERY_COD">Contre Remboursement (COD à la livraison)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Frais de Port (MAD) <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        {...register("shippingFee", { valueAsNumber: true })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                      />
                      {errors.shippingFee && (
                        <span className="text-[11px] text-rose-400 mt-1 block">
                          {errors.shippingFee.message}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Valeur Marchande Déclarée pour Assurance (MAD)
                      </label>
                      <input
                        type="number"
                        step="10"
                        min="0"
                        placeholder="Optionnel"
                        {...register("declaredValue", { valueAsNumber: true })}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    {watchedPaymentMethod === "CASH_ON_DELIVERY_COD" && (
                      <div className="sm:col-span-2 p-3 bg-amber-950/40 border border-amber-800/80 rounded-xl">
                        <label className="block text-xs font-semibold text-amber-300 mb-1.5">
                          Montant à Encaisser chez le Destinataire (COD MAD) *
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          placeholder="Ex: 500"
                          {...register("codAmount", { valueAsNumber: true })}
                          className="w-full px-3 py-2 bg-slate-900 border border-amber-700/60 rounded-xl text-xs text-amber-200 font-mono"
                        />
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Instructions Globales de Transport
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Consignes particulières pour le chauffeur ou les opérateurs de quai..."
                        {...register("notes")}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Récapitulatif & Confirmation */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="p-4 bg-blue-950/20 border border-blue-800/40 rounded-xl">
                  <h3 className="text-sm font-semibold text-blue-300 mb-1 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-400" />
                    Récapitulatif de l'Expédition avant validation transactionnelle
                  </h3>
                  <p className="text-xs text-slate-400">
                    Vérifiez les informations ci-dessous. Dès confirmation, la séquence sera incrémentée de manière atomique.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                    <span className="text-slate-500 block uppercase tracking-wider font-semibold text-[10px]">
                      Destinataire & Acheminement
                    </span>
                    <div className="font-semibold text-slate-200 text-sm">{watchedRecipientName}</div>
                    <div className="text-slate-400">{watchedRecipientCity}</div>
                  </div>

                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                    <span className="text-slate-500 block uppercase tracking-wider font-semibold text-[10px]">
                      Colisage & Poids
                    </span>
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-slate-400">Total Colis :</span>{" "}
                        <span className="font-mono font-bold text-slate-100">{watchedParcels?.length} colis</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Poids Total :</span>{" "}
                        <span className="font-mono font-bold text-slate-100">{totalWeightKg.toFixed(2)} kg</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                    <span className="text-slate-500 block uppercase tracking-wider font-semibold text-[10px]">
                      Service & Frais
                    </span>
                    <div className="text-slate-300">Service : <span className="font-semibold text-blue-300">{watchedServiceType}</span></div>
                    <div className="text-slate-300">Frais : <span className="font-mono font-bold text-emerald-400">{watchedShippingFee} MAD</span></div>
                  </div>

                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                    <span className="text-slate-500 block uppercase tracking-wider font-semibold text-[10px]">
                      Mode de Règlement
                    </span>
                    <div className="font-medium text-slate-200">{watchedPaymentMethod}</div>
                    {watchedPaymentMethod === "CASH_ON_DELIVERY_COD" && (
                      <div className="text-amber-400 font-mono">À encaisser (COD) : {watchedCodAmount || 0} MAD</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handlePrevStep}
                className="px-4 py-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Précédent</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors"
              >
                Annuler
              </button>

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-blue-500/20"
                >
                  <span>Suivant</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting || createMutation.isPending}
                  className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-500/20"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>
                    {isSubmitting || createMutation.isPending
                      ? "Création atomique en cours..."
                      : "Confirmer & Créer l'Expédition"}
                  </span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

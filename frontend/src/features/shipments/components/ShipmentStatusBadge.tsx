import React from "react";
import { ShipmentStatus, ParcelStatus } from "../schemas/shipment.schema";
import {
  Clock,
  Truck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Ban,
  PackageCheck,
  Send,
  Warehouse,
} from "lucide-react";

interface ShipmentStatusBadgeProps {
  status: ShipmentStatus;
  size?: "sm" | "md" | "lg";
}

export const ShipmentStatusBadge: React.FC<ShipmentStatusBadgeProps> = ({
  status,
  size = "md",
}) => {
  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-2 font-semibold",
  };

  const config: Record<
    ShipmentStatus,
    { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    DRAFT: {
      label: "Brouillon",
      bg: "bg-slate-800/80",
      text: "text-slate-300",
      border: "border-slate-700",
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    REGISTERED: {
      label: "Enregistrée",
      bg: "bg-blue-950/60",
      text: "text-blue-400",
      border: "border-blue-800/80",
      icon: <Send className="w-3.5 h-3.5" />,
    },
    IN_TRANSIT: {
      label: "En Transit",
      bg: "bg-amber-950/60",
      text: "text-amber-300",
      border: "border-amber-800/80",
      icon: <Truck className="w-3.5 h-3.5" />,
    },
    OUT_FOR_DELIVERY: {
      label: "En Livraison",
      bg: "bg-purple-950/60",
      text: "text-purple-300",
      border: "border-purple-800/80",
      icon: <Truck className="w-3.5 h-3.5" />,
    },
    DELIVERED: {
      label: "Livrée Complète",
      bg: "bg-emerald-950/60",
      text: "text-emerald-300",
      border: "border-emerald-700/80",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    PARTIALLY_DELIVERED: {
      label: "Partiellement Livrée",
      bg: "bg-teal-950/60",
      text: "text-teal-300",
      border: "border-teal-700/80",
      icon: <PackageCheck className="w-3.5 h-3.5" />,
    },
    RETURNED: {
      label: "Retournée Expéditeur",
      bg: "bg-orange-950/60",
      text: "text-orange-300",
      border: "border-orange-800/80",
      icon: <RotateCcw className="w-3.5 h-3.5" />,
    },
    CANCELLED: {
      label: "Annulée",
      bg: "bg-rose-950/60",
      text: "text-rose-400",
      border: "border-rose-900/80",
      icon: <Ban className="w-3.5 h-3.5" />,
    },
    EXCEPTION: {
      label: "Avarie / Exception",
      bg: "bg-red-950/80",
      text: "text-red-300",
      border: "border-red-700",
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
    },
  };

  const item = config[status] || config.REGISTERED;

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium border shadow-sm backdrop-blur-xs ${item.bg} ${item.text} ${item.border} ${sizeClasses[size]}`}
    >
      {item.icon}
      <span>{item.label}</span>
    </span>
  );
};

export const ParcelStatusBadge: React.FC<{
  status: ParcelStatus;
  size?: "sm" | "md";
}> = ({ status, size = "sm" }) => {
  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
  };

  const config: Record<
    ParcelStatus,
    { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    REGISTERED: {
      label: "Enregistré",
      bg: "bg-blue-950/50",
      text: "text-blue-300",
      border: "border-blue-800/60",
      icon: <Clock className="w-3 h-3" />,
    },
    PICKED_UP: {
      label: "Pris en charge",
      bg: "bg-sky-950/50",
      text: "text-sky-300",
      border: "border-sky-800/60",
      icon: <Send className="w-3 h-3" />,
    },
    IN_TRANSIT: {
      label: "En Transit",
      bg: "bg-amber-950/50",
      text: "text-amber-300",
      border: "border-amber-800/60",
      icon: <Truck className="w-3 h-3" />,
    },
    AT_HUB: {
      label: "Au Hub de Tri",
      bg: "bg-indigo-950/50",
      text: "text-indigo-300",
      border: "border-indigo-800/60",
      icon: <Warehouse className="w-3 h-3" />,
    },
    OUT_FOR_DELIVERY: {
      label: "En Tournée",
      bg: "bg-purple-950/50",
      text: "text-purple-300",
      border: "border-purple-800/60",
      icon: <Truck className="w-3 h-3" />,
    },
    DELIVERED: {
      label: "Livré",
      bg: "bg-emerald-950/50",
      text: "text-emerald-300",
      border: "border-emerald-700/60",
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    DELIVERY_FAILED: {
      label: "Échec Distribution",
      bg: "bg-orange-950/50",
      text: "text-orange-300",
      border: "border-orange-800/60",
      icon: <AlertTriangle className="w-3 h-3" />,
    },
    RETURNED: {
      label: "Retourné",
      bg: "bg-slate-900/80",
      text: "text-slate-300",
      border: "border-slate-700/60",
      icon: <RotateCcw className="w-3 h-3" />,
    },
    LOST: {
      label: "Perdu",
      bg: "bg-rose-950/60",
      text: "text-rose-400",
      border: "border-rose-900",
      icon: <Ban className="w-3 h-3" />,
    },
    DAMAGED: {
      label: "Endommagé",
      bg: "bg-red-950/60",
      text: "text-red-400",
      border: "border-red-900",
      icon: <AlertTriangle className="w-3 h-3" />,
    },
    CANCELLED: {
      label: "Annulé",
      bg: "bg-slate-950/60",
      text: "text-slate-400",
      border: "border-slate-800",
      icon: <Ban className="w-3 h-3" />,
    },
  };

  const item = config[status] || config.REGISTERED;

  return (
    <span
      className={`inline-flex items-center rounded-md font-mono border ${item.bg} ${item.text} ${item.border} ${sizeClasses[size]}`}
    >
      {item.icon}
      <span>{item.label}</span>
    </span>
  );
};

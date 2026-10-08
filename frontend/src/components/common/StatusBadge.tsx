import React from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Ban,
  PackageCheck,
  Send,
  Truck,
  Warehouse,
  AlertCircle,
  FileText,
  Check,
} from "lucide-react";

export type StatusCategory =
  "success" | "warning" | "danger" | "info" | "return" | "neutral";

interface StatusMapping {
  category: StatusCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STATUS_MAP: Record<string, StatusMapping> = {
  // Livré / Succès (success - vert)
  DELIVERED: { category: "success", label: "Livré", icon: CheckCircle2 },
  COMPLETED: { category: "success", label: "Terminé", icon: CheckCircle2 },
  COLLECTED: { category: "success", label: "Collecté", icon: CheckCircle2 },
  PAID: { category: "success", label: "Payé", icon: Check },
  RESOLVED: { category: "success", label: "Résolu", icon: CheckCircle2 },
  SUCCESS: { category: "success", label: "Succès", icon: CheckCircle2 },
  UP: { category: "success", label: "Opérationnel", icon: CheckCircle2 },

  // Attente / Retard (warning - orange)
  DRAFT: { category: "warning", label: "Brouillon", icon: Clock },
  CREATED: { category: "warning", label: "Créé", icon: Clock },
  PENDING: { category: "warning", label: "En attente", icon: Clock },
  REQUESTED: { category: "warning", label: "Demandé", icon: Clock },
  OVERDUE: { category: "warning", label: "En retard", icon: AlertTriangle },
  UNDER_INVESTIGATION: {
    category: "warning",
    label: "En instruction",
    icon: Clock,
  },
  DEGRADED: { category: "warning", label: "Dégradé", icon: AlertTriangle },

  // Incident / Échec (danger - rouge)
  EXCEPTION: { category: "danger", label: "Exception", icon: AlertTriangle },
  FAILED: { category: "danger", label: "Échec", icon: AlertCircle },
  DELIVERY_FAILED: {
    category: "danger",
    label: "Échec livraison",
    icon: AlertCircle,
  },
  LOST: { category: "danger", label: "Perdu", icon: AlertCircle },
  DAMAGED: { category: "danger", label: "Endommagé", icon: AlertTriangle },
  REPORTED: { category: "danger", label: "Signalé", icon: AlertTriangle },
  DOWN: { category: "danger", label: "Interruption", icon: AlertCircle },

  // Information / En transit (info - bleu)
  REGISTERED: { category: "info", label: "Enregistré", icon: FileText },
  PICKED_UP: { category: "info", label: "Pris en charge", icon: Send },
  IN_TRANSIT: { category: "info", label: "En transit", icon: Truck },
  AT_HUB: { category: "info", label: "Au Hub", icon: Warehouse },
  OUT_FOR_DELIVERY: {
    category: "info",
    label: "En cours de livraison",
    icon: Truck,
  },
  IN_PROGRESS: { category: "info", label: "En cours", icon: Clock },
  ASSIGNED: { category: "info", label: "Assigné", icon: Send },
  ISSUED: { category: "info", label: "Émise", icon: FileText },
  PARTIALLY_DELIVERED: {
    category: "info",
    label: "Partiellement livré",
    icon: PackageCheck,
  },

  // Retour (return - violet)
  RETURNED: { category: "return", label: "Retourné", icon: RotateCcw },
  RETURN_REQUESTED: {
    category: "return",
    label: "Retour demandé",
    icon: RotateCcw,
  },

  // Annulé / Inactif (neutral - gris)
  CANCELLED: { category: "neutral", label: "Annulé", icon: Ban },
  CANCELED: { category: "neutral", label: "Annulé", icon: Ban },
  CLOSED: { category: "neutral", label: "Clôturé", icon: Ban },
  INACTIVE: { category: "neutral", label: "Inactif", icon: Ban },
};

export interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = "md",
  showIcon = true,
  className = "",
}) => {
  const normalizedKey = (status || "").toUpperCase();
  const mapping = STATUS_MAP[normalizedKey] || {
    category: "neutral" as StatusCategory,
    label: status,
    icon: Clock,
  };

  const displayText = label || mapping.label;
  const IconComponent = mapping.icon;

  const sizeClass =
    size === "sm"
      ? "status-badge--sm"
      : size === "lg"
        ? "status-badge--lg"
        : "status-badge--md";

  return (
    <span
      className={`status-badge status-badge--${mapping.category} ${sizeClass} ${className}`}
      data-status={normalizedKey}
      data-category={mapping.category}
    >
      {showIcon && <IconComponent className="status-badge__icon" />}
      <span className="status-badge__text">{displayText}</span>
    </span>
  );
};

export default StatusBadge;

import React from "react";
import { ParcelStatusBadge } from "./ShipmentStatusBadge";
import { ParcelStatus } from "../schemas/shipment.schema";
import {
  Barcode,
  User,
  Cpu,
  Building,
  Clock,
  MessageSquareQuote,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

export interface TimelineEventItem {
  id: string;
  source: "SCAN" | "MANUAL" | "SYSTEM" | string;
  status: ParcelStatus;
  previousStatus: ParcelStatus | null;
  createdAt: string | Date;
  notes: string | null;
  agency: {
    id: string;
    code: string;
    name: string;
  };
  operator: {
    id: string;
    name: string;
    email: string;
  } | null;
  parcel?: {
    id: string;
    parcelIndex: number;
    trackingNumber: string;
  } | null;
  scan?: {
    id: string;
    rawBarcode: string;
    scannerType: string;
  } | null;
}

interface TrackingTimelineProps {
  events: TimelineEventItem[];
  isLoading?: boolean;
}

export const TrackingTimeline: React.FC<TrackingTimelineProps> = ({
  events,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="py-8 text-center text-xs text-slate-400">
        Chargement de l'historique de traçabilité...
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-500 italic">
        Aucun événement de tracking enregistré pour le moment.
      </div>
    );
  }

  // Ensure chronological order (oldest to newest)
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
      {sortedEvents.map((evt) => {
        const dateObj = new Date(evt.createdAt);
        const formattedDate = dateObj.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        const formattedTime = dateObj.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        });

        // Source icon & style
        const sourceConfig = {
          SCAN: {
            label: "SCAN DOUCHETTE",
            icon: <Barcode className="w-3 h-3" />,
            badge: "bg-blue-950/60 text-blue-300 border-blue-800/60",
            dot: "bg-blue-500 ring-blue-500/20",
          },
          MANUAL: {
            label: "SAISIE MANUELLE",
            icon: <User className="w-3 h-3" />,
            badge: "bg-purple-950/60 text-purple-300 border-purple-800/60",
            dot: "bg-purple-500 ring-purple-500/20",
          },
          SYSTEM: {
            label: "SYSTÈME",
            icon: <Cpu className="w-3 h-3" />,
            badge: "bg-slate-900 text-slate-400 border-slate-700",
            dot: "bg-slate-500 ring-slate-500/20",
          },
        }[evt.source as "SCAN" | "MANUAL" | "SYSTEM"] || {
          label: evt.source,
          icon: <CheckCircle2 className="w-3 h-3" />,
          badge: "bg-slate-900 text-slate-300 border-slate-700",
          dot: "bg-slate-500 ring-slate-500/20",
        };

        return (
          <div key={evt.id} className="relative group">
            {/* Timeline node dot */}
            <div
              className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full ring-4 ${sourceConfig.dot}`}
            />

            <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2.5 text-xs hover:border-slate-700 transition-colors">
              {/* Header: Source badge, timestamp & Agency */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${sourceConfig.badge}`}
                  >
                    {sourceConfig.icon}
                    <span>{sourceConfig.label}</span>
                  </span>

                  {evt.parcel && (
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300">
                      Colis {evt.parcel.parcelIndex}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                  <span className="flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-blue-400" />
                    <span className="font-medium text-slate-300">{evt.agency?.name}</span>
                    <span className="text-slate-500 font-mono text-[10px]">({evt.agency?.code})</span>
                  </span>

                  <span className="flex items-center gap-1 font-mono text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {formattedDate} à {formattedTime}
                    </span>
                  </span>
                </div>
              </div>

              {/* Status Transition Row */}
              <div className="flex items-center gap-2 pt-1">
                {evt.previousStatus && (
                  <>
                    <ParcelStatusBadge status={evt.previousStatus} size="sm" />
                    <ArrowRight className="w-3 h-3 text-slate-600" />
                  </>
                )}
                <ParcelStatusBadge status={evt.status} size="sm" />
              </div>

              {/* Mandatory Notes / Operator Comment */}
              {evt.notes && (
                <div className="mt-2 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-300 text-[11px] flex items-start gap-2">
                  <MessageSquareQuote className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-medium block text-slate-200">
                      {evt.notes}
                    </span>
                    {evt.operator && (
                      <span className="text-[10px] text-slate-500 block">
                        Par : {evt.operator.name} ({evt.operator.email})
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Scan device info if present */}
              {evt.scan && (
                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 pt-1 border-t border-slate-900">
                  <span>Type lecteur : {evt.scan.scannerType}</span>
                  <span>·</span>
                  <span>Payload : {evt.scan.rawBarcode}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

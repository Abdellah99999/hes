import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import { useAuth } from "../../auth/hooks/useAuth";
import {
  Printer,
  Loader2,
  AlertCircle,
  Copy,
} from "lucide-react";

export type DocumentType =
  | "PARCEL_LABEL"
  | "DELIVERY_NOTE"
  | "INVOICE"
  | "TRANSFER_MANIFEST"
  | "DELIVERY_RUN_SHEET"
  | "COLLECTION_RECEIPT";

interface DocumentDownloadButtonProps {
  documentType: DocumentType;
  entityId: string;
  defaultCopies?: number;
  label?: string;
  allowCopiesSelector?: boolean;
  className?: string;
}

export const DocumentDownloadButton: React.FC<DocumentDownloadButtonProps> = ({
  documentType,
  entityId,
  defaultCopies = 1,
  label = "Télécharger PDF",
  allowCopiesSelector = false,
  className = "",
}) => {
  const { hasPermission } = useAuth();
  const [copiesCount, setCopiesCount] = useState(defaultCopies);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canGenerate = hasPermission("documents:generate");

  const mutation = useMutation({
    mutationFn: async () => {
      return customFetch<{
        document: { id: string; version: number; fileName: string };
        downloadUrl: string;
        fileName: string;
      }>("/documents/generate", {
        method: "POST",
        body: JSON.stringify({
          documentType,
          entityId,
          copiesCount,
        }),
      });
    },
    onSuccess: (res) => {
      setErrorMessage(null);
      // Open presigned URL in new tab or trigger download
      if (res.downloadUrl) {
        window.open(res.downloadUrl, "_blank", "noopener,noreferrer");
      }
    },
    onError: (err: unknown) => {
      const apiErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const msg =
        apiErr?.response?.data?.message ||
        apiErr?.message ||
        "Erreur lors de la génération du document.";
      setErrorMessage(Array.isArray(msg) ? msg.join(", ") : String(msg));
    },
  });

  if (!canGenerate) {
    return (
      <div className="text-[10px] text-slate-500 italic flex items-center gap-1">
        <AlertCircle className="w-3 h-3 text-slate-600" />
        <span>Impression non autorisée</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {allowCopiesSelector && (
          <div className="flex items-center gap-1 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs">
            <Copy className="w-3 h-3 text-slate-500" />
            <select
              aria-label="Nombre d'exemplaires"
              value={copiesCount}
              onChange={(e) => setCopiesCount(parseInt(e.target.value) || 1)}
              className="bg-transparent text-slate-200 focus:outline-none text-[11px]"
            >
              <option value={1}>1 ex.</option>
              <option value={2}>2 ex.</option>
              <option value={3}>3 ex.</option>
            </select>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            mutation.mutate();
          }}
          disabled={mutation.isPending}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
            className
              ? className
              : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20"
          } disabled:opacity-50`}
        >
          {mutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Printer className="w-3.5 h-3.5" />
          )}
          <span>{mutation.isPending ? "Génération..." : label}</span>
        </button>
      </div>

      {errorMessage && (
        <div className="text-[10px] text-rose-400 font-medium flex items-center gap-1">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};

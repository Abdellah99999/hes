import React, { useState } from "react";
import { useGetHealth, HealthResponse } from "../../api/health";
import { APP_NAME } from "../../lib/config";
import {
  Database,
  HardDrive,
  Server,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Boxes,
  ShieldCheck,
  Truck,
  MapPin,
  FileText,
  DollarSign,
} from "lucide-react";

export const SystemStatusPage: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const { data, error, isLoading, isFetching, refetch } = useGetHealth({
    query: {
      refetchInterval: autoRefresh ? 10000 : false,
    },
  });

  const healthData: HealthResponse | undefined = data;

  const isAllUp = healthData?.status === "ok";
  const isDegraded = healthData?.status === "degraded";

  const formatUptime = (seconds?: number): string => {
    if (!seconds && seconds !== 0) return "--";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      {/* En-tête sobre : Logo + Nom Unique (Pas de doublon, pas de "Phase 1") */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-700 flex items-center justify-center text-white shrink-0">
            <Truck className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {APP_NAME}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Supervision de l'infrastructure et connectivité en temps réel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700 cursor-pointer"
            />
            <span>Actualisation auto (10s)</span>
          </label>
          <button
            type="button"
            className="btn-action min-h-[44px] text-xs font-semibold"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Rafraîchir l'état des services"
          >
            <RefreshCw
              size={14}
              className={isFetching ? "animate-spin shrink-0" : "shrink-0"}
            />
            <span>{isFetching ? "Actualisation..." : "Actualiser"}</span>
          </button>
        </div>
      </header>

      {/* Bannière de Statut Global */}
      <section
        className="card p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6"
        data-testid="status-banner"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`w-3 h-3 rounded-full shrink-0 ${
                isAllUp
                  ? "bg-green-600 ring-4 ring-green-100 dark:ring-green-950"
                  : isDegraded
                    ? "bg-orange-600 ring-4 ring-orange-100 dark:ring-orange-950"
                    : "bg-red-600 ring-4 ring-red-100 dark:ring-red-950"
              }`}
            />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {isLoading
                ? "Analyse des systèmes en cours..."
                : isAllUp
                  ? "Tous les systèmes sont opérationnels"
                  : isDegraded
                    ? "Système partiellement dégradé"
                    : "Incident détecté sur un composant critique"}
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Contrôle d'intégrité de l'API REST, base relationnelle, cache
            distribué et stockage d'objets.
          </p>
        </div>

        <div className="flex items-center gap-6 border-t md:border-t-0 pt-4 md:pt-0 border-slate-200 dark:border-slate-800">
          <div>
            <div className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider mb-1">
              Uptime API
            </div>
            <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Clock size={14} className="text-blue-700 dark:text-blue-400" />
              <span>{formatUptime(healthData?.uptimeSeconds)}</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase text-slate-400 tracking-wider mb-1">
              Version Contrat
            </div>
            <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
              v{healthData?.version ?? "1.0.0"}
            </div>
          </div>
        </div>
      </section>

      {/* Grille des Services d'Infrastructure */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Backend API Service */}
        <div
          className="card flex flex-col justify-between"
          data-testid="service-api"
        >
          <div>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  NestJS REST API
                </h3>
                <p className="text-xs text-slate-500">
                  Moteur Clean Architecture
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Server size={18} />
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 min-h-[36px]">
              Endpoints `/api/v1/` avec validation stricte DTO et Swagger
              OpenAPI.
            </p>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">État :</span>
            <span
              className={`status-badge status-badge--sm ${
                !error ? "status-badge--success" : "status-badge--danger"
              }`}
            >
              {!error ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              <span>{!error ? "ONLINE" : "OFFLINE"}</span>
            </span>
          </div>
        </div>

        {/* PostgreSQL Database */}
        <div
          className="card flex flex-col justify-between"
          data-testid="service-database"
        >
          <div>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  PostgreSQL (Prisma)
                </h3>
                <p className="text-xs text-slate-500">Base relationnelle</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Database size={18} />
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 min-h-[36px]">
              Persistance multi-agences avec contraintes FK et audit trails.
            </p>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Latence : {healthData?.services?.database?.latencyMs ?? "--"} ms
            </span>
            <span
              className={`status-badge status-badge--sm ${
                healthData?.services?.database?.status === "up"
                  ? "status-badge--success"
                  : "status-badge--danger"
              }`}
            >
              {healthData?.services?.database?.status === "up" ? (
                <>
                  <CheckCircle2 size={12} />
                  <span>CONNECTÉ</span>
                </>
              ) : (
                <>
                  <XCircle size={12} />
                  <span>ERREUR</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Redis Cache */}
        <div
          className="card flex flex-col justify-between"
          data-testid="service-redis"
        >
          <div>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  Redis In-Memory
                </h3>
                <p className="text-xs text-slate-500">Sessions & Rate Limit</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                <HardDrive size={18} />
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 min-h-[36px]">
              Tokens révocables, limitation de débit et sessions distribuées.
            </p>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Latence : {healthData?.services?.redis?.latencyMs ?? "--"} ms
            </span>
            <span
              className={`status-badge status-badge--sm ${
                healthData?.services?.redis?.status === "up"
                  ? "status-badge--success"
                  : "status-badge--danger"
              }`}
            >
              {healthData?.services?.redis?.status === "up" ? (
                <>
                  <CheckCircle2 size={12} />
                  <span>OPÉRATIONNEL</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={12} />
                  <span>INDISPONIBLE</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* MinIO Object Storage */}
        <div
          className="card flex flex-col justify-between"
          data-testid="service-minio"
        >
          <div>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  MinIO S3
                </h3>
                <p className="text-xs text-slate-500">
                  Stockage documents & POD
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Boxes size={18} />
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 min-h-[36px]">
              Bordereaux, étiquettes, signatures tactiles et preuves de
              livraison.
            </p>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Latence : {healthData?.services?.storage?.latencyMs ?? "--"} ms
            </span>
            <span
              className={`status-badge status-badge--sm ${
                healthData?.services?.storage?.status === "up"
                  ? "status-badge--success"
                  : "status-badge--danger"
              }`}
            >
              {healthData?.services?.storage?.status === "up" ? (
                <>
                  <CheckCircle2 size={12} />
                  <span>DISPONIBLE</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={12} />
                  <span>ERREUR</span>
                </>
              )}
            </span>
          </div>
        </div>
      </section>

      {/* Modules Opérationnels */}
      <section className="card p-6">
        <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-2">
          Périmètre des Modules Métier
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Services applicatifs intégrés à la plateforme opérationnelle :
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col gap-1">
            <Truck size={16} className="text-blue-700 dark:text-blue-400" />
            <strong className="text-xs text-slate-800 dark:text-slate-200">
              Expéditions
            </strong>
            <span className="text-[10px] text-slate-500">Colis & scans</span>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col gap-1">
            <MapPin size={16} className="text-blue-700 dark:text-blue-400" />
            <strong className="text-xs text-slate-800 dark:text-slate-200">
              Agences
            </strong>
            <span className="text-[10px] text-slate-500">7 agences</span>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col gap-1">
            <ShieldCheck
              size={16}
              className="text-blue-700 dark:text-blue-400"
            />
            <strong className="text-xs text-slate-800 dark:text-slate-200">
              Sécurité
            </strong>
            <span className="text-[10px] text-slate-500">JWT & RBAC</span>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col gap-1">
            <FileText size={16} className="text-blue-700 dark:text-blue-400" />
            <strong className="text-xs text-slate-800 dark:text-slate-200">
              Transferts
            </strong>
            <span className="text-[10px] text-slate-500">Manifestes hub</span>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col gap-1">
            <CheckCircle2
              size={16}
              className="text-blue-700 dark:text-blue-400"
            />
            <strong className="text-xs text-slate-800 dark:text-slate-200">
              Livraisons
            </strong>
            <span className="text-[10px] text-slate-500">Dernier km & POD</span>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col gap-1">
            <DollarSign
              size={16}
              className="text-blue-700 dark:text-blue-400"
            />
            <strong className="text-xs text-slate-800 dark:text-slate-200">
              Facturation
            </strong>
            <span className="text-[10px] text-slate-500">Tarifs & COD</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SystemStatusPage;

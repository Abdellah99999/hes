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
    <div className="container">
      {/* Header */}
      <header className="header">
        <div className="brand">
          <div className="brand-badge">{APP_NAME}</div>
          <div className="brand-info">
            <h1>{APP_NAME}</h1>
            <p>
              Système de transport et logistique multi-agences • Phase 1
              Infrastructure
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{
                cursor: "pointer",
                accentColor: "var(--accent-primary)",
              }}
            />
            Auto-refresh (10s)
          </label>
          <button
            className="btn-action"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Rafraîchir l'état des services"
          >
            <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
            {isFetching ? "Actualisation..." : "Actualiser"}
          </button>
        </div>
      </header>

      {/* Global Status Banner */}
      <section className="hero-banner" data-testid="status-banner">
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              marginBottom: "0.5rem",
            }}
          >
            <div
              className={`status-indicator-pulse ${
                isAllUp
                  ? "pulse-up"
                  : isDegraded
                    ? "pulse-degraded"
                    : "pulse-error"
              }`}
            />
            <h2 style={{ fontSize: "1.4rem", fontWeight: 700 }}>
              {isLoading
                ? "Analyse des systèmes en cours..."
                : isAllUp
                  ? "Tous les systèmes sont opérationnels"
                  : isDegraded
                    ? "Système partiellement dégradé"
                    : "Incident détecté sur un composant critique"}
            </h2>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Vérification en temps réel de la connectivité API, base de données,
            cache et stockage objet.
          </p>
        </div>

        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
          <div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                marginBottom: "0.2rem",
              }}
            >
              Uptime API
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                fontSize: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <Clock size={15} color="var(--accent-primary)" />
              {formatUptime(healthData?.uptimeSeconds)}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                marginBottom: "0.2rem",
              }}
            >
              Version Contrat
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                fontSize: "1rem",
              }}
            >
              v{healthData?.version ?? "1.0.0"}
            </div>
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="grid">
        {/* Backend API Service */}
        <div className="card" data-testid="service-api">
          <div className="card-header">
            <div>
              <h3 className="card-title">NestJS REST API</h3>
              <p className="card-subtitle">
                Gateway & Clean Architecture Engine
              </p>
            </div>
            <div className="card-icon">
              <Server size={22} color="var(--accent-primary)" />
            </div>
          </div>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              minHeight: "40px",
            }}
          >
            Exposition des endpoints REST `/api/v1/` avec validation stricte DTO
            et Swagger OpenAPI.
          </p>
          <div className="card-metric">
            <span className="metric-label">État du service</span>
            <span className={`badge ${!error ? "badge-up" : "badge-down"}`}>
              {!error ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              {!error ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
        </div>

        {/* PostgreSQL Database */}
        <div className="card" data-testid="service-database">
          <div className="card-header">
            <div>
              <h3 className="card-title">PostgreSQL (Prisma)</h3>
              <p className="card-subtitle">
                Base relationnelle & intégrité des données
              </p>
            </div>
            <div className="card-icon">
              <Database size={22} color="#3b82f6" />
            </div>
          </div>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              minHeight: "40px",
            }}
          >
            Persistance multi-agences avec contraintes FK, migrations
            versionnées et audit trails.
          </p>
          <div className="card-metric">
            <span className="metric-label">
              Latence : {healthData?.services?.database?.latencyMs ?? "--"} ms
            </span>
            <span
              className={`badge ${
                healthData?.services?.database?.status === "up"
                  ? "badge-up"
                  : "badge-down"
              }`}
            >
              {healthData?.services?.database?.status === "up" ? (
                <>
                  <CheckCircle2 size={13} /> CONNECTÉ
                </>
              ) : (
                <>
                  <XCircle size={13} /> ERREUR
                </>
              )}
            </span>
          </div>
        </div>

        {/* Redis Cache */}
        <div className="card" data-testid="service-redis">
          <div className="card-header">
            <div>
              <h3 className="card-title">Redis In-Memory</h3>
              <p className="card-subtitle">Cache, sessions & rate limiting</p>
            </div>
            <div className="card-icon">
              <HardDrive size={22} color="#ef4444" />
            </div>
          </div>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              minHeight: "40px",
            }}
          >
            Gestion des tokens révocables, limitation de débit et sessions
            distribuées.
          </p>
          <div className="card-metric">
            <span className="metric-label">
              Latence : {healthData?.services?.redis?.latencyMs ?? "--"} ms
            </span>
            <span
              className={`badge ${
                healthData?.services?.redis?.status === "up"
                  ? "badge-up"
                  : "badge-down"
              }`}
            >
              {healthData?.services?.redis?.status === "up" ? (
                <>
                  <CheckCircle2 size={13} /> OPÉRATIONNEL
                </>
              ) : (
                <>
                  <AlertTriangle size={13} /> INDISPONIBLE
                </>
              )}
            </span>
          </div>
        </div>

        {/* MinIO Object Storage */}
        <div className="card" data-testid="service-minio">
          <div className="card-header">
            <div>
              <h3 className="card-title">MinIO Object Storage</h3>
              <p className="card-subtitle">Stockage S3 des documents & POD</p>
            </div>
            <div className="card-icon">
              <Boxes size={22} color="#10b981" />
            </div>
          </div>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              minHeight: "40px",
            }}
          >
            Stockage sécurisé des bordereaux, étiquettes, signatures tactiles et
            photos de livraison.
          </p>
          <div className="card-metric">
            <span className="metric-label">
              Latence : {healthData?.services?.storage?.latencyMs ?? "--"} ms
            </span>
            <span
              className={`badge ${
                healthData?.services?.storage?.status === "up"
                  ? "badge-up"
                  : "badge-down"
              }`}
            >
              {healthData?.services?.storage?.status === "up" ? (
                <>
                  <CheckCircle2 size={13} /> DISPONIBLE
                </>
              ) : (
                <>
                  <AlertTriangle size={13} /> ERREUR
                </>
              )}
            </span>
          </div>
        </div>
      </section>

      {/* Feature Modules Architecture Overview */}
      <section className="features-section">
        <h3 className="features-title">
          Architecture Modulaire & Découpage Métier
        </h3>
        <p className="features-desc">
          Structure des dossiers `src/features/` initialisée pour les
          développements ultérieurs :
        </p>

        <div className="features-tags">
          <div className="feature-pill">
            <Truck size={16} color="var(--accent-primary)" />
            <strong>shipments/</strong>
            <span>• Gestion colis & étiquettes</span>
          </div>

          <div className="feature-pill">
            <MapPin size={16} color="#3b82f6" />
            <strong>agencies/</strong>
            <span>• Réseau 7 agences</span>
          </div>

          <div className="feature-pill">
            <ShieldCheck size={16} color="#10b981" />
            <strong>auth/</strong>
            <span>• JWT & RBAC</span>
          </div>

          <div className="feature-pill">
            <FileText size={16} color="#f59e0b" />
            <strong>transfers/</strong>
            <span>• Manifestes inter-agences</span>
          </div>

          <div className="feature-pill">
            <CheckCircle2 size={16} color="#8b5cf6" />
            <strong>deliveries/</strong>
            <span>• Dernier km & POD</span>
          </div>

          <div className="feature-pill">
            <DollarSign size={16} color="#ec4899" />
            <strong>billing/</strong>
            <span>• Tarification & COD</span>
          </div>
        </div>
      </section>
    </div>
  );
};

import React from "react";
import { AppView } from "./navigation.types";
import { User } from "../../auth/context/auth-context.types";
import { APP_NAME } from "../../../lib/config";
import {
  X,
  Package,
  Truck,
  Layers,
  PackagePlus,
  Bike,
  RotateCcw,
  AlertOctagon,
  Gavel,
  FileText,
  Users as CustomersIcon,
  Map,
  Navigation,
  Building2,
  BarChart3,
  Activity,
  LogOut,
  User as UserIcon,
} from "lucide-react";

export interface AdminBurgerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  user: User | null;
  logout: () => void;
}

interface DrawerMenuItem {
  id: AppView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

interface DrawerCategory {
  title: string;
  items: DrawerMenuItem[];
}

export const AdminBurgerDrawer: React.FC<AdminBurgerDrawerProps> = ({
  isOpen,
  onClose,
  currentView,
  setCurrentView,
  user,
  logout,
}) => {
  if (!isOpen) return null;

  const categories: DrawerCategory[] = [
    {
      title: "Opérations & Quai",
      items: [
        {
          id: "shipments",
          label: "Expéditions",
          icon: Package,
          permission: "shipments:read",
        },
        {
          id: "transfers",
          label: "Transferts Hub",
          icon: Truck,
          permission: "shipments:read",
        },
        {
          id: "stock",
          label: "Stock Quai",
          icon: Layers,
          permission: "shipments:read",
        },
        {
          id: "delivery-assignment",
          label: "Tournées Quai",
          icon: Truck,
          permission: "runs:manage",
        },
        { id: "my-delivery-runs", label: "Mes Tournées", icon: Package },
        { id: "courier-missions", label: "Missions Enlèvement", icon: Bike },
        { id: "recover-return", label: "Colis Retour", icon: RotateCcw },
        {
          id: "returns-monitoring",
          label: "Suivi Retours",
          icon: RotateCcw,
          permission: "returns:manage",
        },
      ],
    },
    {
      title: "Relation Client & Litiges",
      items: [
        {
          id: "request-collection",
          label: "Demande Enlèvement",
          icon: PackagePlus,
        },
        {
          id: "report-incident",
          label: "Signaler Incident",
          icon: AlertOctagon,
        },
        {
          id: "incidents-management",
          label: "Gestion des Litiges",
          icon: Gavel,
          permission: "incidents:manage",
        },
        { id: "invoices", label: "Factures & Règlements", icon: FileText },
      ],
    },
    {
      title: "Réseau & Référentiel",
      items: [
        { id: "customers", label: "Clients", icon: CustomersIcon },
        { id: "zones", label: "Zones de Livraison", icon: Map },
        { id: "addresses", label: "Adresses", icon: Navigation },
        {
          id: "agencies",
          label: "Agences Réseau",
          icon: Building2,
          permission: "agencies:read",
        },
      ],
    },
    {
      title: "Supervision & Pilotage",
      items: [
        { id: "dashboard", label: "Tableau de Bord", icon: Layers },
        { id: "reports", label: "Rapports & Statistiques", icon: BarChart3 },
        { id: "status", label: "Statut Infrastructure", icon: Activity },
      ],
    },
  ];

  const handleSelect = (view: AppView) => {
    setCurrentView(view);
    onClose();
  };

  const hasPermission = (permission?: string): boolean => {
    if (!permission) return true;
    if (!user) return false;
    if (user.role === "SUPER_ADMIN") return true;
    return user.permissions?.includes(permission) ?? false;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menu principal administrateur"
      data-testid="admin-burger-drawer"
      className="fixed inset-0 z-50 flex"
    >
      {/* Backdrop */}
      <div
        data-testid="drawer-backdrop"
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity animate-fadeIn"
      />

      {/* Drawer content */}
      <div className="relative ml-auto w-80 max-w-[85vw] h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col z-10 animate-slideLeft">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xs shadow-md shadow-blue-500/20">
              {APP_NAME}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                {APP_NAME}
              </h2>
              <span className="text-[10px] text-slate-400">
                Navigation Système
              </span>
            </div>
          </div>
          <button
            type="button"
            data-testid="btn-close-drawer"
            onClick={onClose}
            aria-label="Fermer le menu"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        {user && (
          <div className="px-5 py-3 bg-slate-950/50 border-b border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-950 border border-blue-800 flex items-center justify-center text-blue-300">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-200 truncate">
                {user.firstName} {user.lastName}
              </p>
              <span className="inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950/80 border border-blue-800/80 text-blue-300">
                {user.role}
              </span>
            </div>
          </div>
        )}

        {/* Categories & Links */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {categories.map((cat) => {
            const visibleItems = cat.items.filter((item) =>
              hasPermission(item.permission),
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={cat.title}>
                <h3 className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  {cat.title}
                </h3>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-testid={`drawer-item-${item.id}`}
                        onClick={() => handleSelect(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                          isActive
                            ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                            : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`}
                        />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <button
            type="button"
            data-testid="drawer-logout-btn"
            onClick={() => {
              logout();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-950/30 border border-rose-900/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </div>
    </div>
  );
};

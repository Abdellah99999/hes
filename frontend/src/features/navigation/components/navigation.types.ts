export type AppView =
  | "login"
  | "forgot-password"
  | "status"
  | "dashboard"
  | "reports"
  | "shipments"
  | "transfers"
  | "stock"
  | "request-collection"
  | "courier-missions"
  | "delivery-assignment"
  | "my-delivery-runs"
  | "deferred-pod"
  | "recover-return"
  | "returns-monitoring"
  | "report-incident"
  | "incidents-management"
  | "invoices"
  | "agencies"
  | "zones"
  | "customers"
  | "addresses";

export interface NavItemConfig {
  id: AppView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  permissions?: string[];
  category?: "operations" | "customer" | "network" | "monitoring";
}

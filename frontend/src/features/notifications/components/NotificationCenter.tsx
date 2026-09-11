import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import customFetch from "../../../lib/api-client";
import {
  Bell,
  CheckCheck,
  Clock,
  Smartphone,
  Mail,
  MessageSquare,
  ShieldCheck,
  X,
} from "lucide-react";

export interface UserNotification {
  id: string;
  channel: "IN_APP" | "PUSH" | "EMAIL" | "WHATSAPP_SMS";
  status: "PENDING" | "SENT" | "FAILED" | "READ";
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  readAt?: string | null;
}

export const NotificationCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [pushPermissionStatus, setPushPermissionStatus] = useState<
    "default" | "granted" | "denied"
  >(
    typeof window !== "undefined" && "Notification" in window
      ? (Notification.permission as "default" | "granted" | "denied")
      : "default",
  );
  const queryClient = useQueryClient();

  // 1. Fetch user notifications
  const { data: notifications = [], isLoading } = useQuery<UserNotification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      return customFetch<UserNotification[]>("/notifications");
    },
    refetchInterval: 15000, // Background polling every 15s
  });

  // 2. Mark single notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      return customFetch(`/notifications/${id}/read`, { method: "PATCH" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // 3. Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return customFetch("/notifications/read-all", { method: "PATCH" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // 4. Push notification permission prompt for Web & Mobile
  const requestPushPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const permission = await Notification.requestPermission();
        setPushPermissionStatus(permission);
      } catch {
        setPushPermissionStatus("denied");
      }
    }
  };

  const unreadCount = notifications.filter((n) => n.status !== "READ").length;

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "PUSH":
        return <Smartphone className="w-3.5 h-3.5 text-indigo-400" />;
      case "EMAIL":
        return <Mail className="w-3.5 h-3.5 text-sky-400" />;
      case "WHATSAPP_SMS":
        return <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Centre de notifications"
        className="relative p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all shadow-sm"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            data-testid="notification-badge"
            className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-[18px] h-[18px] rounded-full bg-rose-600 text-white font-bold text-[10px] flex items-center justify-center shadow-lg animate-pulse"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          data-testid="notification-panel"
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold text-[10px]">
                  {unreadCount} non lues
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                  className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Tout marquer lu</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Push permission banner if not yet granted */}
          {pushPermissionStatus !== "granted" && (
            <div className="p-2.5 bg-indigo-950/30 border-b border-indigo-900/40 flex items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-2 text-indigo-300">
                <Smartphone className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Activer les alertes push mobiles</span>
              </div>
              <button
                type="button"
                onClick={requestPushPermission}
                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold text-[10px] shrink-0"
              >
                Autoriser
              </button>
            </div>
          )}

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-850">
            {isLoading ? (
              <div className="p-6 text-center text-slate-500">Chargement...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-1">
                <ShieldCheck className="w-6 h-6 mx-auto text-slate-600" />
                <p>Aucune notification</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (n.status !== "READ") {
                      markAsReadMutation.mutate(n.id);
                    }
                  }}
                  className={`p-3 transition-colors cursor-pointer flex items-start gap-2.5 ${
                    n.status !== "READ"
                      ? "bg-slate-850/40 hover:bg-slate-800/60"
                      : "hover:bg-slate-800/30 opacity-70"
                  }`}
                >
                  <div className="p-1.5 rounded-lg bg-slate-800 shrink-0 mt-0.5">
                    {getChannelIcon(n.channel)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-semibold truncate ${
                          n.status !== "READ" ? "text-slate-100" : "text-slate-300"
                        }`}
                      >
                        {n.title}
                      </span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        {new Date(n.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                      {n.body}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

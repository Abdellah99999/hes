import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationCenter } from "./NotificationCenter";
import customFetch from "../../../lib/api-client";

vi.mock("../../../lib/api-client", () => ({
  default: vi.fn(),
}));

describe("Phase 14 Frontend Tests: Notification Center, Badge Counter, Read Actions & Push Permissions", () => {
  let queryClient: QueryClient;

  const mockNotifications = [
    {
      id: "notif-1",
      channel: "PUSH",
      status: "SENT",
      title: "Colis Livré",
      body: "Votre expédition HES-CAS-001 a été livrée.",
      createdAt: new Date().toISOString(),
    },
    {
      id: "notif-2",
      channel: "IN_APP",
      status: "READ",
      title: "Bienvenue",
      body: "Bienvenue sur le portail HES Logistics.",
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it("Notification Center & Badge: Renders bell icon with unread count badge, opens dropdown on click", async () => {
    (customFetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockNotifications);

    render(
      <QueryClientProvider client={queryClient}>
        <NotificationCenter />
      </QueryClientProvider>,
    );

    // Assert unread badge shows 1 (notif-1 is SENT, notif-2 is READ)
    const badge = await screen.findByTestId("notification-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("1");

    // Click to open notification panel
    const bellBtn = screen.getByRole("button", { name: /centre de notifications/i });
    fireEvent.click(bellBtn);

    // Panel is opened and shows notification list
    expect(screen.getByTestId("notification-panel")).toBeInTheDocument();
    expect(screen.getByText("Colis Livré")).toBeInTheDocument();
    expect(screen.getByText("Bienvenue")).toBeInTheDocument();
  });

  it("Mark as Read: Clicking an unread notification triggers API call to mark as read", async () => {
    (customFetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockNotifications);

    render(
      <QueryClientProvider client={queryClient}>
        <NotificationCenter />
      </QueryClientProvider>,
    );

    const bellBtn = await screen.findByRole("button", { name: /centre de notifications/i });
    fireEvent.click(bellBtn);

    const unreadItem = await screen.findByText("Colis Livré");
    fireEvent.click(unreadItem);

    await waitFor(() => {
      expect(customFetch).toHaveBeenCalledWith(
        "/notifications/notif-1/read",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  it("Mark All as Read: Clicking 'Tout marquer lu' marks all notifications as read", async () => {
    (customFetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockNotifications);

    render(
      <QueryClientProvider client={queryClient}>
        <NotificationCenter />
      </QueryClientProvider>,
    );

    const bellBtn = await screen.findByRole("button", { name: /centre de notifications/i });
    fireEvent.click(bellBtn);

    const markAllBtn = await screen.findByRole("button", { name: /tout marquer lu/i });
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(customFetch).toHaveBeenCalledWith(
        "/notifications/read-all",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });
});

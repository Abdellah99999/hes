import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SystemStatusPage } from "./SystemStatusPage";
import * as healthApi from "../../api/health";
import { APP_NAME } from "../../lib/config";

describe("SystemStatusPage Component", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  it("renders operational status when all services are healthy (200 OK)", async () => {
    const mockHealthResponse: healthApi.HealthResponse = {
      status: "ok",
      timestamp: "2026-08-31T23:00:00.000Z",
      version: "1.0.0",
      uptimeSeconds: 3600,
      services: {
        database: { status: "up", latencyMs: 2 },
        redis: { status: "up", latencyMs: 1 },
        storage: { status: "up", latencyMs: 4 },
      },
    };

    vi.spyOn(healthApi, "useGetHealth").mockReturnValue({
      data: mockHealthResponse,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof healthApi.useGetHealth>);

    render(<SystemStatusPage />, { wrapper: createWrapper() });

    expect(screen.getByRole("heading", { name: APP_NAME })).toBeInTheDocument();
    expect(
      screen.getByText("Tous les systèmes sont opérationnels"),
    ).toBeInTheDocument();
    expect(screen.getByText(/1h 0m 0s/)).toBeInTheDocument();
    expect(screen.getByText("CONNECTÉ")).toBeInTheDocument();
    expect(screen.getByText("OPÉRATIONNEL")).toBeInTheDocument();
    expect(screen.getByText("DISPONIBLE")).toBeInTheDocument();
  });

  it("renders incident alert when a critical service is down", async () => {
    const mockUnhealthyResponse: healthApi.HealthResponse = {
      status: "error",
      timestamp: "2026-08-31T23:00:00.000Z",
      version: "1.0.0",
      uptimeSeconds: 120,
      services: {
        database: { status: "down", latencyMs: 0, error: "Connection failed" },
        redis: { status: "up", latencyMs: 1 },
        storage: { status: "up", latencyMs: 3 },
      },
    };

    vi.spyOn(healthApi, "useGetHealth").mockReturnValue({
      data: mockUnhealthyResponse,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof healthApi.useGetHealth>);

    render(<SystemStatusPage />, { wrapper: createWrapper() });

    expect(
      screen.getByText("Incident détecté sur un composant critique"),
    ).toBeInTheDocument();
    expect(screen.getByText("ERREUR")).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  shouldCacheRequest,
  executeFetchStrategy,
  registerServiceWorker,
} from "./pwa-service";

describe("PWA Service: Critical Cybersecurity API Exclusion & Cache Rules", () => {
  let mockCache: {
    match: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCache = {
      match: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe("1. shouldCacheRequest Rule Evaluation", () => {
    it("Strictly returns false for all /api/ endpoints containing sensitive data", () => {
      const sensitiveApiRoutes = [
        "http://localhost:5173/api/shipments",
        "http://localhost:5173/api/v1/auth/login",
        "http://localhost:5173/api/deliveries/parcel-123/confirm",
        "http://localhost:5173/api/runs/my-runs",
        "http://localhost:5173/api/incidents",
        "http://localhost:5173/api/invoices",
        "/api/deliveries/refuse",
        "/api/customers",
      ];

      sensitiveApiRoutes.forEach((route) => {
        expect(shouldCacheRequest(route, "GET")).toBe(false);
      });
    });

    it("Strictly returns false for all non-GET mutation methods (POST, PUT, DELETE, PATCH)", () => {
      expect(
        shouldCacheRequest("http://localhost:5173/assets/main.js", "POST"),
      ).toBe(false);
      expect(
        shouldCacheRequest("http://localhost:5173/index.html", "PUT"),
      ).toBe(false);
      expect(
        shouldCacheRequest(
          "http://localhost:5173/manifest.webmanifest",
          "DELETE",
        ),
      ).toBe(false);
      expect(
        shouldCacheRequest("http://localhost:5173/api/runs", "PATCH"),
      ).toBe(false);
    });

    it("Returns true for static App Shell assets and web icons", () => {
      const staticAssets = [
        "http://localhost:5173/assets/index-CXPT4HEy.js",
        "http://localhost:5173/assets/index-BFoWCw29.css",
        "http://localhost:5173/icons/icon-192x192.png",
        "http://localhost:5173/favicon.svg",
        "http://localhost:5173/manifest.webmanifest",
        "http://localhost:5173/index.html",
      ];

      staticAssets.forEach((asset) => {
        expect(shouldCacheRequest(asset, "GET")).toBe(true);
      });
    });
  });

  describe("2. CRITICAL NEGATIVE TEST: /api/* responses are NEVER written to CacheStorage", () => {
    it("CRITICAL: 200 OK response from /api/shipments is NEVER cached in CacheStorage", async () => {
      const apiRequest = new Request("http://localhost:5173/api/shipments", {
        method: "GET",
      });

      const fakeApiResponse = new Response(
        JSON.stringify({
          data: [
            {
              trackingNumber: "HES-CAS-001",
              recipientName: "Yassine Mansouri",
              recipientCin: "BE890123",
              codAmount: 450,
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );

      const fetchFn = vi.fn().mockResolvedValue(fakeApiResponse);

      const result = await executeFetchStrategy(apiRequest, mockCache, fetchFn);

      expect(fetchFn).toHaveBeenCalledWith(apiRequest);
      expect(result.status).toBe(200);

      // FORMAL PROOF: cache.put was NEVER called for this sensitive API route
      expect(mockCache.put).not.toHaveBeenCalled();
      expect(mockCache.match).not.toHaveBeenCalled();
    });

    it("CRITICAL: POST mutation to /api/deliveries/confirm is NEVER cached in CacheStorage", async () => {
      const mutationRequest = new Request(
        "http://localhost:5173/api/deliveries/parcel-99/confirm",
        {
          method: "POST",
          body: JSON.stringify({
            proofType: "DIGITAL_SIGNATURE",
            signatureDataUrl: "data:image/png;base64,signatureSecret",
          }),
        },
      );

      const fakeMutationResponse = new Response(
        JSON.stringify({ success: true, parcelId: "parcel-99" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

      const fetchFn = vi.fn().mockResolvedValue(fakeMutationResponse);

      const result = await executeFetchStrategy(
        mutationRequest,
        mockCache,
        fetchFn,
      );

      expect(fetchFn).toHaveBeenCalled();
      expect(result.status).toBe(200);

      // FORMAL PROOF: cache.put was NEVER called for this sensitive mutation
      expect(mockCache.put).not.toHaveBeenCalled();
    });

    it("Network failure on API returns clean 503 JSON without touching cache", async () => {
      const apiRequest = new Request("http://localhost:5173/api/runs/active", {
        method: "GET",
      });

      const fetchFn = vi
        .fn()
        .mockRejectedValue(new Error("Failed to fetch (offline)"));

      const result = await executeFetchStrategy(apiRequest, mockCache, fetchFn);

      expect(result.status).toBe(503);
      const json = await result.json();
      expect(json.error).toBe("Service Unavailable");

      // Verifies zero interaction with cache
      expect(mockCache.put).not.toHaveBeenCalled();
    });

    it("Caches static assets (App Shell) on 200 OK response", async () => {
      const assetRequest = new Request(
        "http://localhost:5173/assets/index-CXPT4HEy.js",
        {
          method: "GET",
        },
      );

      const fakeJsResponse = new Response("console.log('App shell loaded');", {
        status: 200,
        headers: { "Content-Type": "application/javascript" },
      });

      const fetchFn = vi.fn().mockResolvedValue(fakeJsResponse);

      const result = await executeFetchStrategy(
        assetRequest,
        mockCache,
        fetchFn,
      );

      expect(fetchFn).toHaveBeenCalledWith(assetRequest);
      expect(result.status).toBe(200);

      // For static assets, cache.put IS called to populate offline App Shell
      expect(mockCache.put).toHaveBeenCalledWith(
        assetRequest,
        expect.any(Response),
      );
    });
  });

  describe("3. Multi-Tab Safe Update Mechanism (skipWaiting / controllerchange)", () => {
    it("Notifies onUpdateAvailable when a waiting service worker is detected", async () => {
      const onUpdateAvailable = vi.fn();

      const mockWorker = {
        postMessage: vi.fn(),
      };

      const mockRegistration = {
        waiting: mockWorker,
        addEventListener: vi.fn(),
      };

      // Mock navigator.serviceWorker
      Object.defineProperty(navigator, "serviceWorker", {
        value: {
          register: vi.fn().mockResolvedValue(mockRegistration),
          addEventListener: vi.fn(),
        },
        configurable: true,
        writable: true,
      });

      // Temporarily override NODE_ENV to allow registration logic to run in test
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      await registerServiceWorker({ onUpdateAvailable });

      process.env.NODE_ENV = prevEnv;

      expect(onUpdateAvailable).toHaveBeenCalled();

      // Trigger the provided callback to simulate user clicking "Mettre à jour"
      const applyUpdateFn = onUpdateAvailable.mock.calls[0][0];
      applyUpdateFn();

      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: "SKIP_WAITING",
      });
    });
  });
});

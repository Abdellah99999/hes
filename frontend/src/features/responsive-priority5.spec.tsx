import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CourierMyRunsPage } from "./runs/pages/CourierMyRunsPage";
import { ConfirmDeliveryModal } from "./deliveries/components/ConfirmDeliveryModal";
import { RecordRefusalModal } from "./deliveries/components/RecordRefusalModal";
import { CustomerRequestCollectionPage } from "./collections/pages/CustomerRequestCollectionPage";
import { CourierMissionsPage } from "./collections/pages/CourierMissionsPage";
import * as authHook from "./auth/hooks/useAuth";
import customFetch from "../lib/api-client";

vi.mock("../lib/api-client", () => ({
  default: vi.fn(),
}));

describe("Priority 5: Responsive Field Screens & 44px Touch Target Audit (375px & 768px)", () => {
  let queryClient: QueryClient;

  const mockCourierUser = {
    id: "courier-1",
    email: "livreur.yassine@hes.ma",
    firstName: "Yassine",
    lastName: "Mansouri",
    phone: "+212600112233",
    role: "COURIER",
    agencyId: "ag-casa",
    isActive: true,
    tokenVersion: 1,
    permissions: ["deliveries:read", "deliveries:confirm", "collections:read"],
    isGlobalScope: false,
  };

  const mockCustomerUser = {
    id: "cust-1",
    email: "client.shop@fashion.ma",
    firstName: "Amine",
    lastName: "Tazi",
    phone: "+212699887766",
    role: "CUSTOMER",
    agencyId: "ag-casa",
    customerId: "cust-uuid-1",
    isActive: true,
    tokenVersion: 1,
    permissions: ["collections:create", "collections:read"],
    isGlobalScope: false,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      clearRect: vi.fn(),
      lineWidth: 0,
      lineCap: "",
      lineJoin: "",
      strokeStyle: "",
    });
  });

  describe("1. CourierMyRunsPage Responsive & Touch Targets", () => {
    const mockRunsData = {
      data: [
        {
          id: "run-uuid-1",
          runNumber: "RUN-CAS-2026-0001",
          shift: "MORNING",
          runDate: "2026-09-17",
          status: "IN_PROGRESS",
          totalParcels: 2,
          totalWeightKg: 4.5,
          totalCodToCollect: 600,
          zone: { code: "MAA", name: "Maârif Centre" },
          courier: {
            userId: "courier-1",
            user: {
              id: "courier-1",
              firstName: "Yassine",
              lastName: "Mansouri",
              phone: "+212600112233",
            },
          },
          items: [
            {
              id: "item-1",
              sequenceOrder: 1,
              status: "PENDING",
              isOutOfZone: false,
              parcel: {
                id: "parcel-1",
                trackingNumber: "HES-CAS-2026-000001-01",
                weightKg: 2.0,
                shipment: {
                  recipientName: "Khadija Bennani",
                  recipientPhone: "+212611223344",
                  recipientAddress: "15 Boulevard Zerktouni",
                  recipientCity: "Casablanca",
                  codAmount: 350,
                },
              },
            },
          ],
        },
      ],
      meta: { total: 1 },
    };

    it("Viewport 375px (Mobile): Outer container is not restricted to max-w-5xl and action buttons have min-h-[44px]", async () => {
      // Simulate Mobile 375px viewport
      window.innerWidth = 375;
      window.dispatchEvent(new Event("resize"));

      vi.spyOn(authHook, "useAuth").mockReturnValue({
        user: mockCourierUser,
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshSession: vi.fn(),
        fetchCurrentUser: vi.fn(),
        hasPermission: vi.fn().mockReturnValue(true),
        hasAnyPermission: vi.fn().mockReturnValue(true),
      });

      (
        customFetch as unknown as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(mockRunsData);

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <CourierMyRunsPage />
        </QueryClientProvider>,
      );

      // Verify outer container responsive classes
      const rootContainer = container.firstElementChild as HTMLElement;
      expect(rootContainer.className).toContain("w-full");
      expect(rootContainer.className).toContain("max-w-none");
      expect(rootContainer.className).toContain("md:max-w-5xl");

      // Verify run items exist
      const runItem = await screen.findByText("HES-CAS-2026-000001-01");
      expect(runItem).toBeInTheDocument();

      // Action buttons: Itinéraire, Livré, Refus
      const navBtn = screen.getByRole("button", { name: /itinéraire/i });
      const deliverBtn = screen.getByRole("button", { name: /livré/i });
      const refuseBtn = screen.getByRole("button", { name: /refus/i });

      // All action buttons MUST have min-h-[44px] tactile height
      expect(navBtn.className).toContain("min-h-[44px]");
      expect(deliverBtn.className).toContain("min-h-[44px]");
      expect(refuseBtn.className).toContain("min-h-[44px]");

      // Check phone link also meets >=44px touch target
      const phoneLink = screen.getByRole("link", { name: /\+212611223344/i });
      expect(phoneLink.className).toContain("min-h-[44px]");

      // Check shift select also meets >=44px touch target
      const shiftSelect = screen.getByRole("combobox");
      expect(shiftSelect.className).toContain("min-h-[44px]");
    });

    it("Viewport 768px (Tablet): Responsive layout renders cleanly with spaced touch buttons", async () => {
      // Simulate Tablet 768px viewport
      window.innerWidth = 768;
      window.dispatchEvent(new Event("resize"));

      vi.spyOn(authHook, "useAuth").mockReturnValue({
        user: mockCourierUser,
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshSession: vi.fn(),
        fetchCurrentUser: vi.fn(),
        hasPermission: vi.fn().mockReturnValue(true),
        hasAnyPermission: vi.fn().mockReturnValue(true),
      });

      (
        customFetch as unknown as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(mockRunsData);

      render(
        <QueryClientProvider client={queryClient}>
          <CourierMyRunsPage />
        </QueryClientProvider>,
      );

      const navBtn = await screen.findByRole("button", { name: /itinéraire/i });
      expect(navBtn.className).toContain("min-h-[44px]");
      expect(navBtn.parentElement?.className).toContain("gap-2.5");
    });
  });

  describe("2. ConfirmDeliveryModal & RecordRefusalModal Mobile Bottom Sheet & Radio Cards", () => {
    const mockParcel = {
      id: "parcel-modal-1",
      trackingNumber: "HES-CAS-2026-000101-01",
      recipientName: "Khadija Bennani",
      recipientPhone: "+212611223344",
      recipientAddress: "15 Boulevard Zerktouni",
      recipientCity: "Casablanca",
      codAmount: 350,
    };

    it("ConfirmDeliveryModal: Renders as Bottom Sheet on mobile (items-end, rounded-t-3xl) with drag handle and 44px touch targets", () => {
      window.innerWidth = 375;
      window.dispatchEvent(new Event("resize"));

      render(
        <QueryClientProvider client={queryClient}>
          <ConfirmDeliveryModal
            isOpen={true}
            parcel={mockParcel}
            onClose={vi.fn()}
          />
        </QueryClientProvider>,
      );

      // Modal dialog backdrop
      const dialog = screen.getByRole("dialog");
      expect(dialog.className).toContain("items-end");
      expect(dialog.className).toContain("sm:items-center");

      // Inner sheet container
      const sheet = dialog.firstElementChild as HTMLElement;
      expect(sheet.className).toContain("rounded-t-3xl");
      expect(sheet.className).toContain("sm:rounded-2xl");
      expect(sheet.className).toContain("w-full");

      // Drag indicator for mobile bottom sheet
      const dragHandle = sheet.querySelector(".bg-slate-700.rounded-full");
      expect(dragHandle).toBeInTheDocument();

      // Close button >= 44px
      const closeBtn = screen.getByRole("button", { name: /fermer/i });
      expect(closeBtn.className).toContain("min-h-[44px]");
      expect(closeBtn.className).toContain("min-w-[44px]");

      // Submit and cancel buttons >= 44px
      const submitBtn = screen.getByRole("button", {
        name: /confirmer la livraison \(pod\)/i,
      });
      const cancelBtn = screen.getByRole("button", { name: /annuler/i });
      expect(submitBtn.className).toContain("min-h-[44px]");
      expect(cancelBtn.className).toContain("min-h-[44px]");

      // Proof selector cards >= 48px
      const proofButtons = screen
        .getAllByRole("button")
        .filter(
          (b) =>
            b.textContent?.includes("Signature") ||
            b.textContent?.includes("Photo") ||
            b.textContent?.includes("Relevé"),
        );
      expect(proofButtons.length).toBe(3);
      proofButtons.forEach((b) => {
        expect(b.className).toContain("min-h-[48px]");
      });
    });

    it("RecordRefusalModal: Renders as Bottom Sheet on mobile and presents refusal reasons as large tactile radio cards", () => {
      window.innerWidth = 375;
      window.dispatchEvent(new Event("resize"));

      render(
        <QueryClientProvider client={queryClient}>
          <RecordRefusalModal
            isOpen={true}
            parcel={mockParcel}
            onClose={vi.fn()}
          />
        </QueryClientProvider>,
      );

      // Modal dialog backdrop Bottom Sheet classes
      const dialog = screen.getByRole("dialog");
      expect(dialog.className).toContain("items-end");
      expect(dialog.className).toContain("sm:items-center");

      const sheet = dialog.firstElementChild as HTMLElement;
      expect(sheet.className).toContain("rounded-t-3xl");
      expect(sheet.className).toContain("sm:rounded-2xl");

      // Mobile drag handle
      const dragHandle = sheet.querySelector(".bg-slate-700.rounded-full");
      expect(dragHandle).toBeInTheDocument();

      // 6 Large Tactile Radio Cards present with min-h-[48px]
      const radioCards = screen.getAllByRole("radio");
      expect(radioCards.length).toBe(6);

      radioCards.forEach((card) => {
        expect(card.className).toContain("min-h-[48px]");
      });

      // Initially first item DAMAGED_PACKAGE is selected
      expect(
        screen.getByTestId("refusal-reason-card-DAMAGED_PACKAGE"),
      ).toHaveAttribute("aria-checked", "true");

      // Tap on radio card "Montant COD contesté"
      const codDisputedCard = screen.getByTestId(
        "refusal-reason-card-COD_AMOUNT_DISPUTED",
      );
      fireEvent.click(codDisputedCard);

      expect(codDisputedCard).toHaveAttribute("aria-checked", "true");
      expect(
        screen.getByTestId("refusal-reason-card-DAMAGED_PACKAGE"),
      ).toHaveAttribute("aria-checked", "false");

      // Verify synced select combobox is in sync
      const select = screen.getByRole("combobox", {
        name: /motif officiel du refus/i,
      }) as HTMLSelectElement;
      expect(select.value).toBe("COD_AMOUNT_DISPUTED");

      // Submit & Cancel buttons >= 44px
      const submitBtn = screen.getByRole("button", {
        name: /confirmer le refus & retour/i,
      });
      const cancelBtn = screen.getByRole("button", { name: /annuler/i });
      expect(submitBtn.className).toContain("min-h-[44px]");
      expect(cancelBtn.className).toContain("min-h-[44px]");
    });
  });

  describe("3. CustomerRequestCollectionPage Sequential Steps & Touch Inputs", () => {
    it("Viewport 375px: Renders non-cramped sequential steps, progress bar, and touch inputs with min-h-[44px]", () => {
      window.innerWidth = 375;
      window.dispatchEvent(new Event("resize"));

      vi.spyOn(authHook, "useAuth").mockReturnValue({
        user: mockCustomerUser,
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        refreshSession: vi.fn(),
        fetchCurrentUser: vi.fn(),
        hasPermission: vi.fn().mockReturnValue(true),
        hasAnyPermission: vi.fn().mockReturnValue(true),
      });

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <CustomerRequestCollectionPage />
        </QueryClientProvider>,
      );

      // Verify responsive container
      const rootContainer = container.firstElementChild as HTMLElement;
      expect(rootContainer.className).toContain("w-full");
      expect(rootContainer.className).toContain("max-w-none");
      expect(rootContainer.className).toContain("md:max-w-4xl");

      // Verify 3-step progress bar
      expect(screen.getByText("1. Enlèvement")).toBeInTheDocument();
      expect(screen.getByText(/2\. Colis/i)).toBeInTheDocument();
      expect(screen.getByText("3. Créneau")).toBeInTheDocument();

      // Verify step section headers
      expect(
        screen.getByText(/Étape 1 : Adresse & Contact d'Enlèvement/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Étape 2 : Colis Déclarés/i)).toBeInTheDocument();
      expect(
        screen.getByText(
          /Étape 3 : Créneau de Ramassage Souhaité & Validation/i,
        ),
      ).toBeInTheDocument();

      // Check all text & tel inputs have min-h-[44px]
      const contactInput = screen.getByPlaceholderText(/Ex: Fatima Zahra/i);
      const phoneInput = screen.getByPlaceholderText(/Ex: \+212611223344/i);
      const streetInput = screen.getByPlaceholderText(
        /Ex: 45 Rue des Alouettes/i,
      );
      const cityInput = screen.getByPlaceholderText(/Ex: Casablanca/i);

      expect(contactInput.className).toContain("min-h-[44px]");
      expect(phoneInput.className).toContain("min-h-[44px]");
      expect(streetInput.className).toContain("min-h-[44px]");
      expect(cityInput.className).toContain("min-h-[44px]");

      // Add parcel button and submit button >= 44px
      const addParcelBtn = screen.getByRole("button", {
        name: /ajouter un colis/i,
      });
      const submitBtn = screen.getByRole("button", {
        name: /confirmer la demande/i,
      });

      expect(addParcelBtn.className).toContain("min-h-[44px]");
      expect(submitBtn.className).toContain("min-h-[48px]");
    });
  });

  describe("4. CourierMissionsPage Vertical Compact Cards & Touch Targets", () => {
    const mockMissionsData = {
      data: [
        {
          id: "col-uuid-1",
          collectionNumber: "COL-CAS-2026-000001",
          scheduledDate: "2026-09-17T09:00:00.000Z",
          timeSlotStart: "09:00",
          timeSlotEnd: "12:00",
          pickupContactName: "Karim Alami",
          pickupPhone: "+212622334455",
          pickupStreet: "88 Boulevard d'Anfa",
          pickupCity: "Casablanca",
          status: "ASSIGNED",
          customer: {
            id: "cust-1",
            legalName: "Atlas E-Commerce SARL",
          },
          items: [{ declaredWeightKg: 2.5 }],
        },
      ],
      meta: { total: 1 },
    };

    it("Viewport 375px: Replaces dense table/grid with vertical compact cards, phone link >=44px and action buttons >=44px", async () => {
      window.innerWidth = 375;
      window.dispatchEvent(new Event("resize"));

      (
        customFetch as unknown as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(mockMissionsData);

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <CourierMissionsPage />
        </QueryClientProvider>,
      );

      // Verify responsive container
      const rootContainer = container.firstElementChild as HTMLElement;
      expect(rootContainer.className).toContain("w-full");
      expect(rootContainer.className).toContain("max-w-none");
      expect(rootContainer.className).toContain("md:max-w-5xl");

      // Wait for mission card to render
      const missionNumber = await screen.findByText("COL-CAS-2026-000001");
      expect(missionNumber).toBeInTheDocument();

      // Card layout: vertical cards container
      const cardsList = missionNumber.closest(".flex.flex-col");
      expect(cardsList).toBeInTheDocument();

      // Customer info & address
      expect(screen.getByText("Atlas E-Commerce SARL")).toBeInTheDocument();
      expect(screen.getByText("88 Boulevard d'Anfa")).toBeInTheDocument();

      // Phone link >= 44px
      const phoneLink = screen.getByRole("link", { name: /\+212622334455/i });
      expect(phoneLink.className).toContain("min-h-[44px]");

      // Action buttons: Itinéraire GPS & Peser & Valider >= 44px
      const navBtn = screen.getByRole("button", { name: /itinéraire gps/i });
      const validateBtn = screen.getByRole("button", {
        name: /peser & valider l'enlèvement/i,
      });

      expect(navBtn.className).toContain("min-h-[44px]");
      expect(validateBtn.className).toContain("min-h-[44px]");

      // Filter select >= 44px
      const filterSelect = screen.getByRole("combobox");
      expect(filterSelect.className).toContain("min-h-[44px]");
    });
  });
});

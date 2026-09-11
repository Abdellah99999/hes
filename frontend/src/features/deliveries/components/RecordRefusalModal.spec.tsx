import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RecordRefusalModal, REFUSAL_REASONS_CATALOG } from "./RecordRefusalModal";
import customFetch from "../../../lib/api-client";

vi.mock("../../../lib/api-client", () => ({
  default: vi.fn(),
}));

describe("Phase 9 Frontend Tests: Refusal Modal Strictly Limited to Validated Reasons", () => {
  let queryClient: QueryClient;

  const sampleParcel = {
    id: "parcel-uuid-99",
    trackingNumber: "HES-CAS-2026-000099-01",
    recipientName: "Yassine Mansouri",
    recipientAddress: "12 Boulevard Zerktouni",
    recipientCity: "Casablanca",
    codAmount: 350.0,
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it("Form strictly offers the 6 validated refusal reasons and NO free text for the legal cause", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <RecordRefusalModal
          isOpen={true}
          parcel={sampleParcel}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );

    // Assert title and parcel number
    expect(screen.getByText("Signaler un Refus Destinataire")).toBeInTheDocument();
    expect(screen.getByText("HES-CAS-2026-000099-01")).toBeInTheDocument();

    // Verify select options match EXACTLY the official catalog
    const select = screen.getByRole("combobox", {
      name: /motif officiel du refus/i,
    }) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.options.length).toBe(REFUSAL_REASONS_CATALOG.length);

    REFUSAL_REASONS_CATALOG.forEach((item, index) => {
      expect(select.options[index].value).toBe(item.code);
      expect(select.options[index].text).toBe(item.label);
    });
  });

  it("Submitting a refusal calls POST /deliveries/:id/refuse with the chosen official code", async () => {
    (customFetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      parcel: { id: sampleParcel.id, status: "RETURNED" },
    });

    const onClose = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <RecordRefusalModal
          isOpen={true}
          parcel={sampleParcel}
          onClose={onClose}
        />
      </QueryClientProvider>,
    );

    const select = screen.getByRole("combobox", {
      name: /motif officiel du refus/i,
    });
    // Choose CONTENT_MISMATCH
    fireEvent.change(select, { target: { value: "CONTENT_MISMATCH" } });

    // Submit
    const submitBtn = screen.getByRole("button", {
      name: /confirmer le refus & retour/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(customFetch).toHaveBeenCalledWith(
        `/deliveries/${sampleParcel.id}/refuse`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            reasonCode: "CONTENT_MISMATCH",
          }),
        }),
      );
    });

    expect(onClose).toHaveBeenCalled();
  });
});

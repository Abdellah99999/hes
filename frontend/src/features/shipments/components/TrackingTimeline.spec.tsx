import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrackingTimeline, TimelineEventItem } from "./TrackingTimeline";

describe("Phase 5 Frontend Tests: TrackingTimeline Component", () => {
  const mockEvents: TimelineEventItem[] = [
    {
      id: "evt-2",
      source: "SCAN",
      status: "PICKED_UP",
      previousStatus: "REGISTERED",
      createdAt: "2026-09-02T10:00:00Z",
      notes: "Scan physique douchette",
      agency: { id: "ag-1", code: "CAS", name: "Casablanca Hub" },
      operator: { id: "u-1", name: "Karim Chauffeur", email: "karim@hes.ma" },
      scan: { id: "s-1", rawBarcode: "HES-CAS-2026-000001-01", scannerType: "BARCODE_1D" },
    },
    {
      id: "evt-1",
      source: "SYSTEM",
      status: "REGISTERED",
      previousStatus: null,
      createdAt: "2026-09-02T08:00:00Z", // Oldest
      notes: "Bordereau créé dans le système",
      agency: { id: "ag-1", code: "CAS", name: "Casablanca Hub" },
      operator: null,
    },
    {
      id: "evt-3",
      source: "MANUAL",
      status: "AT_HUB",
      previousStatus: "PICKED_UP",
      createdAt: "2026-09-02T14:30:00Z", // Newest
      notes: "Saisie manuelle justifiée suite à déchargement",
      agency: { id: "ag-1", code: "CAS", name: "Casablanca Hub" },
      operator: { id: "u-2", name: "Amine Tazi", email: "amine@hes.ma" },
    },
  ];

  it("should sort and render events in strictly chronological order (oldest to newest)", () => {
    render(<TrackingTimeline events={mockEvents} />);

    // Get all source labels in order of appearance in DOM
    const scanBadge = screen.getByText("SCAN DOUCHETTE");
    const systemBadge = screen.getByText("SYSTÈME");
    const manualBadge = screen.getByText("SAISIE MANUELLE");

    expect(systemBadge).toBeInTheDocument();
    expect(scanBadge).toBeInTheDocument();
    expect(manualBadge).toBeInTheDocument();

    // Verify DOM order: evt-1 (08:00) should appear before evt-2 (10:00) which appears before evt-3 (14:30)
    expect(systemBadge.compareDocumentPosition(scanBadge)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(scanBadge.compareDocumentPosition(manualBadge)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("should display mandatory operator comment and operator identity for manual changes", () => {
    render(<TrackingTimeline events={mockEvents} />);

    expect(
      screen.getByText(/Saisie manuelle justifiée suite à déchargement/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Par : Amine Tazi \(amine@hes.ma\)/i)).toBeInTheDocument();
  });

  it("should display scanner payload information when source is SCAN", () => {
    render(<TrackingTimeline events={mockEvents} />);

    expect(screen.getByText(/Type lecteur : BARCODE_1D/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Payload : HES-CAS-2026-000001-01/i),
    ).toBeInTheDocument();
  });

  it("should display empty state when events list is empty", () => {
    render(<TrackingTimeline events={[]} />);

    expect(
      screen.getByText(/Aucun événement de tracking enregistré/i),
    ).toBeInTheDocument();
  });
});

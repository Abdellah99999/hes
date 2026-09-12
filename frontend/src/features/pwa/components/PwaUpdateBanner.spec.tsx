import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PwaUpdateBanner } from "./PwaUpdateBanner";

describe("PwaUpdateBanner: Safe Notification and Non-destructive Reload Trigger Tests", () => {
  it("Does not render anything when no update is available", () => {
    render(
      <PwaUpdateBanner isUpdateAvailable={false} onApplyUpdate={vi.fn()} />,
    );
    expect(screen.queryByTestId("pwa-update-banner")).not.toBeInTheDocument();
  });

  it("Renders clear update prompt without auto-reloading when update is ready", () => {
    const onApplyUpdate = vi.fn();
    const onDismiss = vi.fn();

    render(
      <PwaUpdateBanner
        isUpdateAvailable={true}
        onApplyUpdate={onApplyUpdate}
        onDismiss={onDismiss}
      />,
    );

    const banner = screen.getByTestId("pwa-update-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent("Nouvelle version disponible");

    // Click "Mettre à jour maintenant"
    const updateBtn = screen.getByRole("button", {
      name: /mettre à jour maintenant/i,
    });
    fireEvent.click(updateBtn);
    expect(onApplyUpdate).toHaveBeenCalledTimes(1);

    // Dismiss button works
    const dismissBtn = screen.getByRole("button", { name: /plus tard/i });
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

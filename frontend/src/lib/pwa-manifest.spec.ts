import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Lighthouse PWA Criteria & Manifest Validation", () => {
  const manifestPath = path.resolve(
    __dirname,
    "../../public/manifest.webmanifest",
  );
  const indexPath = path.resolve(__dirname, "../../index.html");
  const swPath = path.resolve(__dirname, "../../public/sw.js");

  it("1. Manifest contains all required Lighthouse PWA fields", () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    // Name & Short name
    expect(manifest.name).toBe("HES Transport & Logistique");
    expect(manifest.short_name).toBe("HES Logistique");

    // Display & Orientation
    expect(manifest.display).toBe("standalone");
    expect(manifest.orientation).toBe("portrait");

    // Navigation URLs
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");

    // Theme & Background colors (Sleek dark theme)
    expect(manifest.theme_color).toBe("#0f172a");
    expect(manifest.background_color).toBe("#020617");

    // Icons: at least 192x192, 512x512, and maskable icon
    expect(manifest.icons).toBeInstanceOf(Array);
    const has192 = manifest.icons.some(
      (icon: { sizes: string; purpose: string }) =>
        icon.sizes === "192x192" && icon.purpose.includes("any"),
    );
    const has512 = manifest.icons.some(
      (icon: { sizes: string; purpose: string }) =>
        icon.sizes === "512x512" && icon.purpose.includes("any"),
    );
    const hasMaskable = manifest.icons.some(
      (icon: { purpose: string }) => icon.purpose === "maskable",
    );

    expect(has192).toBe(true);
    expect(has512).toBe(true);
    expect(hasMaskable).toBe(true);
  });

  it("2. Real Icon files exist on disk with valid byte sizes", () => {
    const iconsDir = path.resolve(__dirname, "../../public/icons");
    const requiredFiles = [
      "icon-192x192.png",
      "icon-512x512.png",
      "icon-maskable-192x192.png",
      "icon-maskable-512x512.png",
    ];

    requiredFiles.forEach((file) => {
      const filePath = path.join(iconsDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size).toBeGreaterThan(500); // Valid PNG file
    });
  });

  it("3. index.html defines complete PWA meta tags and Apple iOS compatibility links", () => {
    expect(fs.existsSync(indexPath)).toBe(true);
    const indexHtml = fs.readFileSync(indexPath, "utf-8");

    // Manifest link
    expect(indexHtml).toContain(
      '<link rel="manifest" href="/manifest.webmanifest" />',
    );

    // Theme color
    expect(indexHtml).toContain(
      '<meta name="theme-color" content="#0f172a" />',
    );

    // Apple iOS tags (essential for Safari/WebKit which ignore manifest)
    expect(indexHtml).toContain(
      '<meta name="apple-mobile-web-app-capable" content="yes" />',
    );
    expect(indexHtml).toContain(
      '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
    );
    expect(indexHtml).toContain(
      '<meta name="apple-mobile-web-app-title" content="HES Logistique" />',
    );
    expect(indexHtml).toContain(
      '<link rel="apple-touch-icon" href="/icons/icon-192x192.png" />',
    );
    expect(indexHtml).toContain("viewport-fit=cover");
  });

  it("4. Service Worker file is present and includes strict API isolation rules", () => {
    expect(fs.existsSync(swPath)).toBe(true);
    const swContent = fs.readFileSync(swPath, "utf-8");

    // Pre-cache App shell
    expect(swContent).toContain("hes-app-shell-v1");
    expect(swContent).toContain("APP_SHELL_PRECACHE");

    // Critical API exclusion
    expect(swContent).toContain("/api/");
    expect(swContent).toContain("isMutation");

    // Multi-tab safe skipWaiting
    expect(swContent).toContain("SKIP_WAITING");
    expect(swContent).toContain("clients.claim");
  });
});

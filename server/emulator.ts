import type { Express } from "express";

/**
 * Legacy /emulator endpoint — no longer used.
 *
 * EmulatorJS now runs directly in the parent React DOM instead of an iframe.
 * This route is preserved as a no-op stub so that server/index.ts doesn't
 * break. It can be removed entirely in a future cleanup.
 */
export function registerEmulatorRoute(app: Express, _emulatorJsDataUrl: string) {
  app.get("/emulator", (_req, res) => {
    res
      .status(410)
      .type("text")
      .send("This endpoint is deprecated. EmulatorJS now runs directly in the client.");
  });
}

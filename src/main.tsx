import * as Sentry from "@sentry/react";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";

import App from "./App.tsx";
import "./index.css";
import { appEnvironment } from "@/config/environment";
import { initAnalytics } from "@/lib/analytics";
import { ThemeProvider } from "@/providers/ThemeProvider";

const { sentryDsn, sentryRelease, appEnv, amplitudeApiKey } = appEnvironment.monitoring;

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: appEnv,
    release: sentryRelease,
    integrations: [
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
    ],
    tracesSampleRate: 0.2,
    beforeSend(event, hint) {
      const original = hint.originalException;

      if (
        original &&
        typeof original === "object" &&
        !(original instanceof Error)
      ) {
        const keys = Object.keys(original);
        const detail = keys
          .map((k) => `${k}=${JSON.stringify(original[k])}`)
          .join(", ");

        const error = new Error(
          `Non-Error exception captured: { ${detail} }`,
        );

        event.exception = {
          values: [
            {
              type: error.name,
              value: error.message,
              mechanism: event.exception?.values?.[0]?.mechanism,
            },
          ],
        };
      }

      return event;
    },
  });
}

initAnalytics(amplitudeApiKey);

if (import.meta.env.PROD && "serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("/sw.js").catch((error) => {
    console.error("Failed to register service worker:", error);
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);

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

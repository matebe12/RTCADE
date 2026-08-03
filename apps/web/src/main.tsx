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

import { ThemeProvider } from "@/providers/ThemeProvider";

const { sentryDsn, sentryRelease, appEnv, amplitudeApiKey } = appEnvironment.monitoring;

// Sentry 에러 모니터링은 첫 페인트 이후 requestIdleCallback으로 지연 로딩
if (sentryDsn) {
  const initSentry = () => {
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
          const plain = original as Record<string, unknown>;
          const keys = Object.keys(plain);
          const detail = keys
            .map((k) => `${k}=${JSON.stringify(plain[k])}`)
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
  };

  const idleCb = (window as any).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 2000));
  idleCb(initSentry);
}

// Amplitude analytics SDK(209KB)는 requestIdleCallback으로 지연 로딩하여 초기 로딩 속도 개선
if (amplitudeApiKey) {
  const idleCallback = (window as any).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 2000));
  idleCallback(() => {
    import("@/lib/analytics").then(({ initAnalytics: init }) => init(amplitudeApiKey));

  });
}

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

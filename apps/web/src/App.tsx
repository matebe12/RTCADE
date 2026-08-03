import * as Sentry from "@sentry/react";
import { Suspense, lazy, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { NicknameSetup } from "@/components/NicknameSetup";
import { Toaster } from "@rtcade/ui";
import { trackEvent } from "@/lib/analytics";
import { type UserProfile, getUserProfile } from "@/lib/user-profile";
import { AppTutorialProvider } from "@/tutorial/AppTutorialProvider";

const AppShell = lazy(() => import("@/components/layout/AppShell"));
const HomePage = lazy(() => import("@/pages/HomePage"));
const NetplayPage = lazy(() => import("@/pages/NetplayPage"));
const GameDetailPage = lazy(() => import("@/pages/GameDetailPage"));
const NoticesPage = lazy(() => import("@/pages/NoticesPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));

const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);

function RouteFallback() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "40vh",
        width: "100%",
        maxWidth: "72rem",
        alignItems: "center",
        justifyContent: "center",
        padding: "2.5rem 1rem",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          borderRadius: "1rem",
          border: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(23,23,23,0.95)",
          padding: "1.25rem 1.5rem",
          fontSize: "0.875rem",
          color: "#b0b0b0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        화면을 불러오는 중입니다.
      </div>
    </div>
  );
}

function PageViewTracker() {
  const location = useLocation();

  useEffect(() => {
    trackEvent("page_view", { path: location.pathname });
  }, [location.pathname]);

  return null;
}

function App() {
  const [profile, setProfile] = useState<UserProfile | null>(getUserProfile);
  const [showSetup, setShowSetup] = useState(false);

  const needsSetup = !profile;

  return (
    <Sentry.ErrorBoundary fallback={<RouteFallback />}>
      <PageViewTracker />
      <AppTutorialProvider blocked={needsSetup || showSetup}>
        <Suspense fallback={<RouteFallback />}>
          <SentryRoutes>
            <Route
              element={<AppShell profile={profile} onOpenProfile={() => setShowSetup(true)} />}
            >
              <Route index element={<HomePage hasProfile={!needsSetup} />} />
              <Route path="netplay" element={<NetplayPage hasProfile={!needsSetup} />} />
              <Route path="game" element={<GameDetailPage />} />
              <Route path="notices" element={<NoticesPage />} />
              <Route
                path="settings"
                element={
                  <SettingsPage profile={profile} onOpenProfile={() => setShowSetup(true)} />
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </SentryRoutes>
        </Suspense>
      </AppTutorialProvider>

      <NicknameSetup
        open={needsSetup || showSetup}
        profile={profile}
        allowClose={!needsSetup}
        onClose={() => setShowSetup(false)}
        onComplete={(p) => {
          setProfile(p);
          setShowSetup(false);
        }}
      />

      <Toaster position="top-center" richColors />
    </Sentry.ErrorBoundary>
  );
}

export default App;

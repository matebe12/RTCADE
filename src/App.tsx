import * as Sentry from "@sentry/react";
import { Suspense, lazy, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { NicknameSetup } from "@/components/NicknameSetup";
import { Toaster } from "@/components/ui/sonner";
import { trackEvent } from "@/lib/analytics";
import { type UserProfile, getUserProfile } from "@/lib/user-profile";
import { AppTutorialProvider } from "@/tutorial/AppTutorialProvider";

const AppShell = lazy(() => import("@/components/layout/AppShell"));
const HomePage = lazy(() => import("@/pages/HomePage"));
const NetplayPage = lazy(() => import("@/pages/NetplayPage"));
const NoticesPage = lazy(() => import("@/pages/NoticesPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));

const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);

function RouteFallback() {
  return (
    <div className="mx-auto flex min-h-[40vh] w-full max-w-6xl items-center justify-center px-4 py-10">
      <div className="rounded-2xl border border-border/70 bg-card/95 px-6 py-5 text-sm text-muted-foreground shadow-sm">
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

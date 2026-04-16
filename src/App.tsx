import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AppShell from "@/components/layout/AppShell";
import { NicknameSetup } from "@/components/NicknameSetup";
import HomePage from "@/pages/HomePage";
import NetplayPage from "@/pages/NetplayPage";
import NoticesPage from "@/pages/NoticesPage";
import SettingsPage from "@/pages/SettingsPage";
import { Toaster } from "@/components/ui/sonner";
import { type UserProfile, getUserProfile } from "@/lib/user-profile";

function App() {
  const [profile, setProfile] = useState<UserProfile | null>(getUserProfile);
  const [showSetup, setShowSetup] = useState(false);

  const needsSetup = !profile;

  return (
    <>
      <Routes>
        <Route element={<AppShell profile={profile} onOpenProfile={() => setShowSetup(true)} />}>
          <Route index element={<HomePage hasProfile={!needsSetup} />} />
          <Route path="netplay" element={<NetplayPage />} />
          <Route path="notices" element={<NoticesPage />} />
          <Route
            path="settings"
            element={<SettingsPage profile={profile} onOpenProfile={() => setShowSetup(true)} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>

      <NicknameSetup
        open={needsSetup || showSetup}
        onComplete={(p) => {
          setProfile(p);
          setShowSetup(false);
        }}
      />

      <Toaster position="top-center" richColors />
    </>
  );
}

export default App;

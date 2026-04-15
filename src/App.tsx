import { useState } from "react";
import NetplayLobby from "@/components/NetplayLobby";
import { NicknameSetup } from "@/components/NicknameSetup";
import { UserBadge } from "@/components/UserBadge";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { type UserProfile, getUserProfile } from "@/lib/user-profile";
import { Settings } from "lucide-react";

type Mode = "menu" | "netplay";

function App() {
  const [mode, setMode] = useState<Mode>("menu");
  const [profile, setProfile] = useState<UserProfile | null>(getUserProfile);
  const [showSetup, setShowSetup] = useState(false);

  const needsSetup = !profile;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-5">
      {/* Profile badge — top right */}
      {profile && (
        <div className="fixed top-4 right-4 z-50">
          <button
            onClick={() => setShowSetup(true)}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:bg-accent"
          >
            <UserBadge nickname={profile.nickname} avatar={profile.avatar} size="sm" />
            <Settings className="size-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      <h1
        className="font-[family-name:var(--font-arcade)] text-xl text-primary mb-2 cursor-pointer drop-shadow-[0_0_20px_rgba(0,212,255,0.5)]"
        onClick={() => setMode("menu")}
      >
        🕹 RETRO EMULATOR
      </h1>
      <p className="text-xs text-muted-foreground mb-5">브라우저에서 레트로 게임을 플레이</p>

      {mode === "menu" && (
        <Button
          variant="outline"
          size="lg"
          className="font-[family-name:var(--font-arcade)] text-xs"
          onClick={() => setMode("netplay")}
        >
          🌐 넷플레이
        </Button>
      )}

      {mode === "netplay" && <NetplayLobby />}

      {/* Nickname setup dialog */}
      <NicknameSetup
        open={needsSetup || showSetup}
        onComplete={(p) => {
          setProfile(p);
          setShowSetup(false);
        }}
      />

      <Toaster position="top-center" richColors />
    </div>
  );
}

export default App;

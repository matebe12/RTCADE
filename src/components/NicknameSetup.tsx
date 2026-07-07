import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trackEvent } from "@/lib/analytics";
import { type UserProfile, AVATAR_OPTIONS, saveUserProfile } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

interface NicknameSetupProps {
  open: boolean;
  profile: UserProfile | null;
  allowClose?: boolean;
  onClose?: () => void;
  onComplete: (profile: UserProfile) => void;
}

export function NicknameSetup({
  open,
  profile,
  allowClose = false,
  onClose,
  onComplete,
}: NicknameSetupProps) {
  const [nickname, setNickname] = useState(profile?.nickname ?? "");
  const [avatar, setAvatar] = useState(profile?.avatar ?? AVATAR_OPTIONS[0]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setNickname(profile?.nickname ?? "");
    setAvatar(profile?.avatar ?? AVATAR_OPTIONS[0]);
    setError("");
  }, [open, profile]);

  const handleSubmit = () => {
    const trimmed = nickname.trim();
    if (trimmed.length < 2 || trimmed.length > 10) {
      setError("닉네임은 2~10자로 입력해주세요");
      return;
    }
    const newProfile: UserProfile = { nickname: trimmed, avatar };
    saveUserProfile(newProfile);
    trackEvent(profile === null ? "profile_created" : "profile_updated");
    onComplete(newProfile);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && allowClose) {
          onClose?.();
        }
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={allowClose}
      >
        <DialogHeader>
          <DialogTitle className="font-arcade text-sm text-center">프로필 설정</DialogTitle>
          <DialogDescription className="text-center">
            닉네임과 아바타를 선택하세요
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Avatar selection */}
          <div className="grid grid-cols-8 gap-2">
            {AVATAR_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setAvatar(emoji)}
                className={cn(
                  "flex items-center justify-center text-2xl size-10 rounded-lg transition-all",
                  avatar === emoji
                    ? "bg-primary/20 ring-2 ring-primary scale-110"
                    : "hover:bg-muted",
                )}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Nickname input */}
          <div className="flex flex-col gap-2">
            <Input
              placeholder="닉네임 (2~10자)"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              maxLength={10}
              className="text-center"
            />
            {error && <p className="text-xs text-destructive-foreground text-center">{error}</p>}
          </div>

          <Button onClick={handleSubmit} disabled={nickname.trim().length < 2} className="w-full">
            시작하기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

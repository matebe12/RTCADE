import { useEffect } from "react";
import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ChatUser {
  nickname: string;
  avatar: string;
}

interface NetplayChatOverlayComposerProps {
  chatChannelState: string;
  className?: string;
  draft: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  isPeerTyping: boolean;
  onCancel: () => void;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  open: boolean;
  remoteUser: ChatUser | null;
}

export default function NetplayChatOverlayComposer({
  chatChannelState,
  className,
  draft,
  inputRef,
  isPeerTyping,
  onCancel,
  onDraftChange,
  onSend,
  open,
  remoteUser,
}: NetplayChatOverlayComposerProps) {
  if (!open) {
    return null;
  }

  const remoteDisplay = remoteUser ?? { nickname: "상대방", avatar: "🎮" };
  const isChatReady = chatChannelState === "open";

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const focusInput = () => {
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
    };

    focusInput();
    const frameId = window.requestAnimationFrame(focusInput);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [inputRef, open]);

  const placeholder = isPeerTyping
    ? `${remoteDisplay.nickname} 입력 중...`
    : isChatReady
      ? "메시지를 입력하세요"
      : "곧 입력할 수 있습니다";

  return (
    <div
      className={cn(
        "w-full max-w-[20rem] rounded-full border border-white/8 bg-black/22 p-1.5 text-white shadow-md backdrop-blur-[2px]",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              if (!draft.trim()) {
                onCancel();
                return;
              }
              onSend();
            }
          }}
          maxLength={300}
          placeholder={placeholder}
          disabled={!isChatReady}
          autoComplete="off"
          className="h-9 rounded-full border-white/8 bg-black/22 px-3 text-[13px] text-white placeholder:text-white/45"
        />

        <Button
          type="button"
          size="icon"
          className="size-9 shrink-0 rounded-full bg-white/12 text-white hover:bg-white/18"
          onClick={onSend}
          disabled={!isChatReady || !draft.trim()}
          aria-label="메시지 전송"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
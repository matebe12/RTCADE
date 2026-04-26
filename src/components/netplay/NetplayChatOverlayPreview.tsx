import { useEffect, useState } from "react";

import type { NetplayChatMessage } from "@/components/NetplayChatPanel";
import { cn } from "@/lib/utils";

const TRANSIENT_MESSAGE_WINDOW_MS = 7000;
const MAX_VISIBLE_MESSAGES = 4;

interface ChatUser {
  nickname: string;
  avatar: string;
}

interface NetplayChatOverlayPreviewProps {
  className?: string;
  localUser: ChatUser;
  messages: NetplayChatMessage[];
  remoteUser: ChatUser | null;
  senderFilter?: "all" | "local" | "remote";
  visible: boolean;
}

export default function NetplayChatOverlayPreview({
  className,
  localUser,
  messages,
  remoteUser,
  senderFilter = "all",
  visible,
}: NetplayChatOverlayPreviewProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!visible || messages.length === 0) {
      return undefined;
    }

    setNow(Date.now());

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [messages, visible]);

  if (!visible || messages.length === 0) {
    return null;
  }

  const remoteDisplay = remoteUser ?? { nickname: "상대방", avatar: "🎮" };
  const recentMessages = messages
    .filter((message) => now - message.sentAt < TRANSIENT_MESSAGE_WINDOW_MS)
    .filter((message) => {
      if (senderFilter === "all") {
        return true;
      }

      return message.sender === senderFilter;
    })
    .slice(-MAX_VISIBLE_MESSAGES);

  if (recentMessages.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-2 left-2 z-20 flex w-[min(20rem,calc(100%-1rem))] flex-col items-start gap-1.5",
        className,
      )}
    >
      {recentMessages.map((message) => {
        const isLocal = message.sender === "local";
        const author = isLocal
          ? {
              nickname: message.authorName || localUser.nickname,
              avatar: message.authorAvatar || localUser.avatar,
            }
          : {
              nickname: message.authorName || remoteDisplay.nickname,
              avatar: message.authorAvatar || remoteDisplay.avatar,
            };

        return (
          <div
            key={message.id}
            className={cn(
              "w-full rounded-xl border px-2.5 py-1.5 shadow-md backdrop-blur-[2px] transition-opacity duration-300",
              isLocal
                ? "border-white/8 bg-black/22 text-white/92"
                : "border-white/6 bg-black/14 text-white/88",
            )}
          >
            <div className="mb-0.5 flex items-center gap-1.5 text-[9px] text-white/48">
              <span className="text-[11px] leading-none">{author.avatar}</span>
              <span className="truncate font-medium">{author.nickname}</span>
            </div>
            <p className="line-clamp-2 text-[15px] leading-6 whitespace-pre-wrap break-words text-white/92">
              {message.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
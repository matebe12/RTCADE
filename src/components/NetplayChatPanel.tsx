import { useEffect, useRef } from "react";
import { MessageSquare, Send, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NETPLAY_COPY } from "@/netplay/netplayCopy";
import { cn } from "@/lib/utils";

export interface NetplayChatMessage {
  id: string;
  text: string;
  sender: "local" | "remote";
  sentAt: number;
}

interface ChatUser {
  nickname: string;
  avatar: string;
}

interface NetplayChatPanelProps {
  open: boolean;
  onCancel: () => void;
  messages: NetplayChatMessage[];
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  unreadCount: number;
  isPeerTyping: boolean;
  chatChannelState: string;
  localUser: ChatUser;
  remoteUser: ChatUser | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
});

export default function NetplayChatPanel({
  open,
  onCancel,
  messages,
  draft,
  onDraftChange,
  onSend,
  unreadCount,
  isPeerTyping,
  chatChannelState,
  localUser,
  remoteUser,
  inputRef,
}: NetplayChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [isPeerTyping, messages, open]);

  if (!open) return null;

  const remoteDisplay = remoteUser ?? { nickname: "상대방", avatar: "🎮" };
  const isChatReady = chatChannelState === "open";

  return (
    <Card className="flex w-full max-w-200 flex-col overflow-hidden border-border/70 bg-card/95 xl:h-150 xl:w-[320px] xl:max-w-[320px]">
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium tracking-normal">대화</CardTitle>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-base leading-none">{remoteDisplay.avatar}</span>
            <span className="truncate font-medium text-foreground">{remoteDisplay.nickname}</span>
            <Badge variant={isChatReady ? "secondary" : "outline"} className="text-[10px]">
              {isChatReady ? "사용 가능" : "준비 중"}
            </Badge>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={onCancel}
          aria-label="채팅 닫기"
        >
          <X className="size-4" />
        </Button>
      </CardHeader>

      <CardContent className="flex h-88 min-h-0 flex-1 flex-col gap-3 p-3">
        <ScrollArea className="min-h-0 flex-1 rounded-md border border-border/60 bg-background/50">
          <div className="flex min-h-full flex-col gap-3 p-3">
            {messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground">
                <MessageSquare className="size-8 opacity-50" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {NETPLAY_COPY.chatEmptyTitle}
                  </p>
                  <p className="text-xs">{NETPLAY_COPY.chatEmptyDescription}</p>
                </div>
              </div>
            ) : (
              messages.map((message) => {
                const isLocal = message.sender === "local";
                const author = isLocal ? localUser : remoteDisplay;

                return (
                  <div
                    key={message.id}
                    className={cn("flex", isLocal ? "justify-end" : "justify-start")}
                  >
                    <div className="max-w-[85%] space-y-1">
                      <div
                        className={cn(
                          "flex items-center gap-2 text-[10px] text-muted-foreground",
                          isLocal ? "justify-end" : "justify-start",
                        )}
                      >
                        <span className="font-medium text-foreground/80">{author.nickname}</span>
                        <span>{timeFormatter.format(message.sentAt)}</span>
                      </div>
                      <div
                        className={cn(
                          "rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap wrap-break-word",
                          isLocal
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground",
                        )}
                      >
                        {message.text}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="mt-auto space-y-2 border-t border-border/60 pt-3">
          <div className="min-h-4 text-[11px] text-muted-foreground">
            {isPeerTyping
              ? `${remoteDisplay.nickname} 입력 중...`
              : isChatReady
                ? NETPLAY_COPY.chatReadyHint
                : NETPLAY_COPY.chatPendingHint}
          </div>

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
                  onSend();
                }
              }}
              maxLength={300}
              placeholder={isChatReady ? "메시지를 입력하세요" : "곧 입력할 수 있습니다"}
              disabled={!isChatReady}
              autoComplete="off"
            />
            <Button
              type="button"
              size="icon"
              onClick={onSend}
              disabled={!isChatReady || !draft.trim()}
              aria-label="메시지 전송"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

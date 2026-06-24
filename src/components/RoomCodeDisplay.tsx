import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Copy, Check, Share2 } from "lucide-react";

interface RoomCodeDisplayProps {
  code: string;
  className?: string;
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
  } else {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}

export function RoomCodeDisplay({ code, className }: RoomCodeDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const handleCopy = async () => {
    try {
      await copyToClipboard(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleShare = async () => {
    const link = `${window.location.origin}/netplay?code=${code}`;
    // 모바일: 네이티브 공유 시트 (카카오, 문자 등)
    if (navigator.share) {
      try {
        await navigator.share({ title: "RTCADE 같이하기", text: `방 코드: ${code}`, url: link });
      } catch {
        // 사용자가 취소한 경우 — 무시
      }
      return;
    }
    // 데스크탑: 클립보드 복사 폴백
    try {
      await copyToClipboard(link);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* 방 코드 */}
      <div className="flex items-center gap-2">
        <span className="font-arcade text-2xl tracking-[0.5em] text-primary">{code}</span>
        <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={handleCopy} title="코드 복사">
          {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
        </Button>
      </div>

      {/* 친구 초대 — 모바일: 공유 시트, 데스크탑: 링크 복사 */}
      <Button variant="secondary" className="w-full gap-2" onClick={handleShare}>
        {shared ? (
          <Check className="size-4 text-green-500" />
        ) : (
          <Share2 className="size-4" />
        )}
        {shared ? "링크가 복사됐어요!" : "친구 초대하기"}
      </Button>
    </div>
  );
}

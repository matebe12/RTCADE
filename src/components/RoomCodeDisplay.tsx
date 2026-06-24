import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Copy, Check, Link2 } from "lucide-react";

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
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await copyToClipboard(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleCopyLink = async () => {
    try {
      const link = `${window.location.origin}/netplay?code=${code}`;
      await copyToClipboard(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="font-arcade text-2xl tracking-[0.5em] text-primary">{code}</span>
      <Button variant="ghost" size="icon" className="size-8" onClick={handleCopy} title="코드 복사">
        {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={handleCopyLink}
        title="참가 링크 복사"
      >
        {linkCopied ? <Check className="size-4 text-green-500" /> : <Link2 className="size-4" />}
      </Button>
    </div>
  );
}

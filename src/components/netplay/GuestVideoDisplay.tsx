import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";

import { Loader2 } from "lucide-react";

/**
 * Key-to-button mapping identical to the emulator iframe.
 * Button indices follow libretro convention (same as EmulatorJS).
 */
const KEY_TO_BUTTON: Record<string, number> = {
  ArrowUp: 4,
  ArrowDown: 5,
  ArrowLeft: 6,
  ArrowRight: 7,
  KeyA: 0,
  KeyS: 8,
  KeyD: 1,
  KeyF: 9,
  Digit1: 3,
  Digit5: 2,
  KeyQ: 10,
  KeyE: 11,
};

interface GuestVideoDisplayProps {
  videoStream: MediaStream | null;
  onLocalInput?: (button: number, down: boolean) => void;
  onChatShortcut?: () => void;
}

/**
 * GUEST-side display for video-streaming netplay.
 *
 * Renders a `<video>` element that plays the HOST's canvas stream received
 * over WebRTC. Keyboard input is captured directly and forwarded to the
 * parent via `onLocalInput`.
 */
const GuestVideoDisplay = forwardRef<HTMLDivElement, GuestVideoDisplayProps>(
  function GuestVideoDisplay({ videoStream, onLocalInput, onChatShortcut }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    useImperativeHandle(ref, () => containerRef.current!, []);

    // Attach MediaStream to video element
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !videoStream) return undefined;

      video.srcObject = videoStream;
      video.play().catch(() => {
        /* autoplay policy — user interaction unblocks later */
      });

      return () => {
        video.srcObject = null;
      };
    }, [videoStream]);

    // Keyboard input capture
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return undefined;

      const handleKeyDown = (e: KeyboardEvent) => {
        // Chat shortcut (Enter)
        if (
          e.code === "Enter" &&
          !e.repeat &&
          !e.altKey &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.shiftKey
        ) {
          e.stopImmediatePropagation();
          e.preventDefault();
          onChatShortcut?.();
          return;
        }

        const btn = KEY_TO_BUTTON[e.code];
        if (btn !== undefined) {
          e.stopImmediatePropagation();
          e.preventDefault();
          onLocalInput?.(btn, true);
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        const btn = KEY_TO_BUTTON[e.code];
        if (btn !== undefined) {
          e.stopImmediatePropagation();
          e.preventDefault();
          onLocalInput?.(btn, false);
        }
      };

      container.addEventListener("keydown", handleKeyDown, true);
      container.addEventListener("keyup", handleKeyUp, true);

      return () => {
        container.removeEventListener("keydown", handleKeyDown, true);
        container.removeEventListener("keyup", handleKeyUp, true);
      };
    }, [onLocalInput, onChatShortcut]);

    return (
      <div
        ref={containerRef}
        tabIndex={0}
        className="relative w-[800px] h-[600px] max-w-[95vw] max-h-[70vh] bg-neutral-900 rounded-lg overflow-hidden outline-none focus:ring-2 focus:ring-primary/60"
      >
        {videoStream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />
            <span className="text-sm">호스트 화면 수신 대기 중…</span>
          </div>
        )}
      </div>
    );
  },
);

export default GuestVideoDisplay;

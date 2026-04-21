import { useEffect, useRef, forwardRef, useImperativeHandle, useState, useCallback } from "react";

import { Loader2, WifiOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DisconnectSeverity } from "../../../shared/emulator-protocol";

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
  captureInput?: boolean;
  disconnectSeverity?: DisconnectSeverity;
  disconnectCountdown?: number; // seconds remaining before auto-disconnect
}

/**
 * GUEST-side display for video-streaming netplay.
 *
 * Renders a `<video>` element that plays the HOST's canvas stream received
 * over WebRTC, including audio. Keyboard input is captured directly and
 * forwarded to the parent via `onLocalInput`.
 */
const GuestVideoDisplay = forwardRef<HTMLDivElement, GuestVideoDisplayProps>(
  function GuestVideoDisplay(
    {
      videoStream,
      onLocalInput,
      onChatShortcut,
      captureInput = true,
      disconnectSeverity = "connected",
      disconnectCountdown,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay policy

    useImperativeHandle(ref, () => containerRef.current!, []);

    const toggleMute = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      const next = !isMuted;
      video.muted = next;
      setIsMuted(next);
      // If unmuting, ensure playback is active (some browsers pause when muted→unmuted)
      if (!next) {
        video.play().catch(() => {});
      }
    }, [isMuted]);

    // Attach MediaStream to video element
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !videoStream) return undefined;

      video.srcObject = videoStream;
      video.muted = isMuted;
      // Minimise playback buffer for low-latency WebRTC stream
      if ("latencyHint" in video) {
        (video as unknown as Record<string, unknown>).latencyHint = 0;
      }
      video.play().catch(() => {
        /* autoplay policy — user interaction unblocks later */
      });

      return () => {
        video.srcObject = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoStream]); // intentionally not including isMuted to avoid re-attaching

    // Keyboard input capture
    useEffect(() => {
      if (!captureInput) return undefined;

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
    }, [captureInput, onLocalInput, onChatShortcut]);

    const showDisconnectOverlay =
      disconnectSeverity === "warning" || disconnectSeverity === "danger";

    return (
      <div
        ref={containerRef}
        tabIndex={0}
        className="relative w-full aspect-[4/3] bg-neutral-900 rounded-lg overflow-hidden outline-none focus:ring-2 focus:ring-primary/60"
        onContextMenu={(e) => e.preventDefault()}
      >
        {videoStream ? (
          <>
            <video ref={videoRef} autoPlay playsInline className="h-full w-full object-contain" />
            {/* Mute/Unmute button overlay */}
            <div className="absolute bottom-3 right-3 z-10">
              <Button
                variant="secondary"
                size="sm"
                className="h-8 w-8 rounded-full p-0 opacity-60 hover:opacity-100 transition-opacity"
                onClick={toggleMute}
                title={isMuted ? "소리 켜기" : "소리 끄기"}
              >
                {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />
            <span className="text-sm">호스트 화면 수신 대기 중…</span>
          </div>
        )}

        {/* Disconnect severity overlay */}
        {showDisconnectOverlay && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 text-white transition-opacity">
            <WifiOff className="mb-3 size-10 text-yellow-400" />
            {disconnectSeverity === "warning" && (
              <>
                <p className="text-sm font-medium">호스트 연결 불안정</p>
                <p className="mt-1 text-xs text-muted-foreground">연결 복구 대기 중…</p>
              </>
            )}
            {disconnectSeverity === "danger" && (
              <>
                <p className="text-sm font-medium text-red-400">연결 복구 대기 중…</p>
                {disconnectCountdown != null && (
                  <p className="mt-1 text-xs text-red-300">
                    {disconnectCountdown}초 후 세션이 종료됩니다
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  },
);

export default GuestVideoDisplay;

import { useEffect, useRef, forwardRef, useImperativeHandle, useState, useCallback } from "react";

import { Loader2, WifiOff, Volume2, VolumeX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

type PlaybackStats = {
  droppedFrames: number | null;
  fps: number | null;
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
    const pressedButtonsRef = useRef(new Set<number>());
    const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay policy
    const [playbackState, setPlaybackState] = useState<
      "waiting-stream" | "waiting-playback" | "playing" | "stalled"
    >("waiting-stream");
    const [playbackStats, setPlaybackStats] = useState<PlaybackStats>({
      droppedFrames: null,
      fps: null,
    });

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
      if (!video) return undefined;

      if (!videoStream) {
        video.srcObject = null;
        setPlaybackState("waiting-stream");
        setPlaybackStats({ droppedFrames: null, fps: null });
        return undefined;
      }

      video.srcObject = videoStream;
      video.muted = isMuted;
      setPlaybackState("waiting-playback");
      // Minimise playback buffer for low-latency WebRTC stream
      if ("latencyHint" in video) {
        (video as unknown as Record<string, unknown>).latencyHint = 0;
      }
      const handleCanPlay = () => {
        setPlaybackState((current) => (current === "playing" ? current : "waiting-playback"));
      };
      const handlePlaying = () => {
        setPlaybackState("playing");
      };
      const handleStalled = () => {
        setPlaybackState((current) => (current === "waiting-stream" ? current : "stalled"));
      };

      video.addEventListener("canplay", handleCanPlay);
      video.addEventListener("loadeddata", handleCanPlay);
      video.addEventListener("playing", handlePlaying);
      video.addEventListener("stalled", handleStalled);
      video.addEventListener("waiting", handleStalled);
      video.addEventListener("emptied", handleStalled);
      video.play().catch(() => {
        /* autoplay policy — user interaction unblocks later */
      });

      return () => {
        video.removeEventListener("canplay", handleCanPlay);
        video.removeEventListener("loadeddata", handleCanPlay);
        video.removeEventListener("playing", handlePlaying);
        video.removeEventListener("stalled", handleStalled);
        video.removeEventListener("waiting", handleStalled);
        video.removeEventListener("emptied", handleStalled);
        video.srcObject = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoStream]); // intentionally not including isMuted to avoid re-attaching

    useEffect(() => {
      const video = videoRef.current;
      if (!videoStream || !video) {
        setPlaybackStats({ droppedFrames: null, fps: null });
        return undefined;
      }

      let cancelled = false;
      let lastFrames: number | null = null;
      let lastSampleAt = performance.now();

      const readVideoQuality = () => {
        if ("getVideoPlaybackQuality" in video) {
          return video.getVideoPlaybackQuality();
        }

        return null;
      };

      const publishStats = (frames: number | null, droppedFrames: number | null) => {
        const now = performance.now();

        if (frames === null) {
          setPlaybackStats({ droppedFrames, fps: null });
          return;
        }

        if (lastFrames === null) {
          lastFrames = frames;
          lastSampleAt = now;
          setPlaybackStats({ droppedFrames, fps: null });
          return;
        }

        const elapsedMs = now - lastSampleAt;

        if (elapsedMs < 900) {
          return;
        }

        const fps = Math.max(0, Math.round(((frames - lastFrames) * 1000) / elapsedMs));
        lastFrames = frames;
        lastSampleAt = now;
        setPlaybackStats({ droppedFrames, fps });
      };

      if ("requestVideoFrameCallback" in video && "cancelVideoFrameCallback" in video) {
        let frameCallbackId: number | null = null;

        const handleFrame: VideoFrameRequestCallback = (_now, metadata) => {
          if (cancelled) return;

          const quality = readVideoQuality();
          publishStats(
            quality?.totalVideoFrames ?? metadata.presentedFrames,
            quality?.droppedVideoFrames ?? null,
          );
          frameCallbackId = video.requestVideoFrameCallback(handleFrame);
        };

        frameCallbackId = video.requestVideoFrameCallback(handleFrame);

        return () => {
          cancelled = true;
          if (frameCallbackId !== null) {
            video.cancelVideoFrameCallback(frameCallbackId);
          }
        };
      }

      const interval = setInterval(() => {
        const quality = readVideoQuality();
        publishStats(quality?.totalVideoFrames ?? null, quality?.droppedVideoFrames ?? null);
      }, 1000);

      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }, [videoStream]);

    // Keyboard input capture
    useEffect(() => {
      if (!captureInput) return undefined;

      const container = containerRef.current;
      if (!container) return undefined;

      const releasePressedButtons = () => {
        if (pressedButtonsRef.current.size === 0) return;

        const pressedButtons = Array.from(pressedButtonsRef.current);
        pressedButtonsRef.current.clear();

        for (const btn of pressedButtons) {
          onLocalInput?.(btn, false);
        }
      };

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

          if (e.repeat || pressedButtonsRef.current.has(btn)) {
            return;
          }

          pressedButtonsRef.current.add(btn);
          onLocalInput?.(btn, true);
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        const btn = KEY_TO_BUTTON[e.code];
        if (btn !== undefined) {
          e.stopImmediatePropagation();
          e.preventDefault();

          if (!pressedButtonsRef.current.has(btn)) {
            return;
          }

          pressedButtonsRef.current.delete(btn);
          onLocalInput?.(btn, false);
        }
      };

      container.addEventListener("keydown", handleKeyDown, true);
      container.addEventListener("keyup", handleKeyUp, true);
      window.addEventListener("blur", releasePressedButtons);

      return () => {
        releasePressedButtons();
        container.removeEventListener("keydown", handleKeyDown, true);
        container.removeEventListener("keyup", handleKeyUp, true);
        window.removeEventListener("blur", releasePressedButtons);
      };
    }, [captureInput, onLocalInput, onChatShortcut]);

    const showDisconnectOverlay =
      disconnectSeverity === "warning" || disconnectSeverity === "danger";
    const showPlaybackOverlay = !videoStream || playbackState !== "playing";

    let playbackMessage = "호스트 화면 수신 대기 중…";

    if (videoStream && playbackState === "waiting-playback") {
      playbackMessage = "첫 화면을 불러오는 중…";
    } else if (videoStream && playbackState === "stalled") {
      playbackMessage = "화면 재생을 복구하는 중…";
    }

    return (
      <div
        ref={containerRef}
        tabIndex={0}
        className="relative aspect-4/3 w-full overflow-hidden rounded-lg bg-neutral-900 outline-none focus:ring-2 focus:ring-primary/60"
        onContextMenu={(e) => e.preventDefault()}
      >
        <video ref={videoRef} autoPlay playsInline className="h-full w-full object-contain" />

        {showPlaybackOverlay && (
          <div className="absolute inset-0 z-10 flex h-full w-full flex-col items-center justify-center gap-3 bg-black/60 text-muted-foreground backdrop-blur-[1px]">
            <Loader2 className="size-8 animate-spin" />
            <span className="text-sm">{playbackMessage}</span>
          </div>
        )}

        {videoStream && (
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
        )}

        {videoStream && playbackState === "playing" && playbackStats.fps !== null && (
          <div className="absolute bottom-3 left-3 z-10">
            <Badge
              variant="outline"
              className="border-border/60 bg-black/60 text-[10px] text-white tabular-nums backdrop-blur-sm"
              title={`재생 FPS ${playbackStats.fps}${playbackStats.droppedFrames === null ? "" : ` / 드롭 ${playbackStats.droppedFrames}`}`}
            >
              재생 {playbackStats.fps}fps
            </Badge>
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

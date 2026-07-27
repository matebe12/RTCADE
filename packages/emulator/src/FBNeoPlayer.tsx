/**
 * FBNeoPlayer — EmulatorPlayer의 FBNeo WASM 대체판
 *
 * 기존 EmulatorPlayer와 동일한 props 인터페이스를 제공하며,
 * 내부적으로 FBNeo WASM + Canvas 렌더링 + WebRTC 스트리밍을 처리한다.
 */
import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback } from "react";
import { Maximize2, Minimize2, Volume2, VolumeX } from "lucide-react";

import { ArcadeWrapper } from "./ArcadeWrapper";
import type { FBNeoInitFn } from "./types";
import { renderFrameToCanvas, fitCanvasToContainer, renderUpscaledFrame } from "./render";
import { keyToButtonMask } from "./input";
import { KEY_TO_BUTTON, BLOCKED_KEYS, EJS_BUTTON_TO_FBNEO_BIT, type FBNeoVariant } from "@rtcade/shared";

// ── Props ──────────────────────────────────────────────

interface FBNeoPlayerProps {
  romSource: File | string;
  variant: FBNeoVariant;
  role?: "host" | "guest";
  romPath?: string;           // e.g. "fbneo/kof97.zip"
  biosPath?: string;          // e.g. "fbneo/neogeo.zip"
  onLocalInput?: (button: number, down: boolean) => void;
  onEmulatorReady?: () => void;
  onChatShortcut?: () => void;
  onCanvasStreamReady?: (stream: MediaStream, pixelArt?: boolean) => void;
}

// ── Constants ──────────────────────────────────────────

const HOST_STREAM_CAPTURE_FPS = 60;

/**
 * captureStream()용 오프스크린 Canvas 업스케일 배율.
 * Neo Geo 304x224 → 3x = 912x672 (H264 매크로블록 57x42개 vs 네이티브 19x14개)
 * 정수 배율 사용으로 nearest-neighbor 업스케일 시 서브픽셀 아티팩트 없음.
 */
const HOST_STREAM_UPSCALE_FACTOR = 3;

// ── WASM variant → init import 매핑 ────────────────────

type WasmVariantInit = {
  initFn: () => Promise<{ default: FBNeoInitFn }>;
  wasmURL: string;
};

const wasmCache = new Map<FBNeoVariant, WasmVariantInit>();

/**
 * 모듈레벨 원격 버튼 핸들러.
 *
 * 마운트된 FBNeoPlayer 인스턴스가 useEffect로 등록하고, 언마운트 시 해제한다.
 * export된 `sendRemoteInput()`이 이 핸들러를 통해 React 컴포넌트 내부의
 * `remoteMaskRef`에 접근할 수 있게 한다.
 */
let _fbneoRemoteButtonHandler: ((button: number, down: boolean) => void) | null = null;
let _fbneoArcadeRef: ArcadeWrapper | null = null;

function getWasmImports(variant: FBNeoVariant): WasmVariantInit {
  if (!wasmCache.has(variant)) {
    // 각 변형은 동적으로 import 됨
    throw new Error(
      `FBNeoPlayer: WASM variant "${variant}" not preloaded. ` +
      `Call preloadWasmVariant("${variant}") before mounting.`,
    );
  }
  return wasmCache.get(variant)!;
}

/**
 * WASM 변형을 미리 로드한다. FBNeoPlayer 마운트 전에 호출해야 한다.
 */
export async function preloadWasmVariant(variant: FBNeoVariant): Promise<void> {
  if (wasmCache.has(variant)) return;

  switch (variant) {
    case "neogeo": {
      const [initMod, wasmMod] = await Promise.all([
        import("@mantou/fbneo/fbneo-neogeo"),
        import("@mantou/fbneo/fbneo-neogeo.wasm?url"),
      ]);
      wasmCache.set(variant, {
        initFn: () => Promise.resolve(initMod),
        wasmURL: (wasmMod as { default: string }).default,
      });
      break;
    }
    case "arcade": {
      const [initMod, wasmMod] = await Promise.all([
        import("@mantou/fbneo/fbneo-arcade"),
        import("@mantou/fbneo/fbneo-arcade.wasm?url"),
      ]);
      wasmCache.set(variant, {
        initFn: () => Promise.resolve(initMod),
        wasmURL: (wasmMod as { default: string }).default,
      });
      break;
    }
    case "konami": {
      const [initMod, wasmMod] = await Promise.all([
        import("@mantou/fbneo/fbneo-konami"),
        import("@mantou/fbneo/fbneo-konami.wasm?url"),
      ]);
      wasmCache.set(variant, {
        initFn: () => Promise.resolve(initMod),
        wasmURL: (wasmMod as { default: string }).default,
      });
      break;
    }
  }
}

// ── Helper: ROM URL 생성 ───────────────────────────────

function buildRomUrl(romPath: string, serverBase: string): string {
  if (!serverBase) {
    // 기본값: same-origin 상대 경로 (로컬 개발)
    return `/roms/${romPath}`;
  }
  return `${serverBase}/roms/${romPath}`;
}

// ── FBNeoPlayer 컴포넌트 ───────────────────────────────

const FBNeoPlayer = forwardRef<HTMLDivElement, FBNeoPlayerProps>(function FBNeoPlayer(
  {
    romSource,
    variant,
    role,
    romPath,
    biosPath,
    onLocalInput,
    onEmulatorReady,
    onChatShortcut,
    onCanvasStreamReady,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const arcadeRef = useRef<ArcadeWrapper | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamReadyRef = useRef(false);
  const gameReadyRef = useRef(false);
  const pressedMaskRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const audioGainRef = useRef<GainNode | null>(null);
  const remoteMaskRef = useRef(0);
  const canvasFittedRef = useRef(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [showControls, setShowControls] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const isNetplay = role === "host" || role === "guest";
  const localPlayer = role === "guest" ? 1 : 0;

  // ── Stable refs for callbacks ──────────────────────────
  const onEmulatorReadyRef = useRef(onEmulatorReady);
  onEmulatorReadyRef.current = onEmulatorReady;
  const onCanvasStreamReadyRef = useRef(onCanvasStreamReady);
  onCanvasStreamReadyRef.current = onCanvasStreamReady;

  useImperativeHandle(ref, () => containerRef.current!, []);

  // ── Remote input handler ────────────────────────────
  const handleRemoteButton = useCallback((button: number, down: boolean) => {
    const bit = EJS_BUTTON_TO_FBNEO_BIT[button];
    if (bit === undefined) return;
    if (down) {
      remoteMaskRef.current |= bit;
    } else {
      remoteMaskRef.current &= ~bit;
    }
  }, []);

  // Register/unregister the module-level handler so the exported
  // sendRemoteInput() can reach this instance.
  useEffect(() => {
    _fbneoRemoteButtonHandler = handleRemoteButton;
    return () => {
      _fbneoRemoteButtonHandler = null;
      remoteMaskRef.current = 0;
    };
  }, [handleRemoteButton]);

  // ── Main init effect ──────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let aborted = false;

    async function init() {
      if (!container) return;
      try {
        // 1. WASM variant preload
        await preloadWasmVariant(variant);
        if (aborted) return;

        const { initFn, wasmURL } = getWasmImports(variant);

        // 2. Create ArcadeWrapper
        const arcade = new ArcadeWrapper({ variant, onAudio: undefined });
        arcadeRef.current = arcade;
        _fbneoArcadeRef = arcade;

        const initModule = await initFn();
        arcade.setInit(initModule.default, wasmURL);
        if (aborted) return;

        // Audio setup
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          const audioCtx = new AudioCtx({ sampleRate: 44100 });
          audioCtxRef.current = audioCtx;

          // Audio destination for WebRTC capture (HOST)
          let audioDest: MediaStreamAudioDestinationNode | null = null;
          if (role === "host") {
            audioDest = audioCtx.createMediaStreamDestination();
            audioDestRef.current = audioDest;
          }

          const audioBuffer: Float32Array[] = [];
          const CHUNK_SIZE = 4096;
          (arcade as any)._onAudio = (left: Float32Array, right: Float32Array) => {
            const interleaved = new Float32Array(left.length * 2);
            for (let i = 0; i < left.length; i++) {
              interleaved[i * 2] = left[i];
              interleaved[i * 2 + 1] = right[i];
            }
            audioBuffer.push(interleaved);
          };

          const scriptNode = audioCtx.createScriptProcessor(CHUNK_SIZE, 0, 2);
          scriptNode.onaudioprocess = (e) => {
            const outL = e.outputBuffer.getChannelData(0);
            const outR = e.outputBuffer.getChannelData(1);
            outL.fill(0);
            outR.fill(0);
            let written = 0;
            while (audioBuffer.length > 0 && written < CHUNK_SIZE) {
              const chunk = audioBuffer.shift()!;
              const toWrite = Math.min(chunk.length / 2, CHUNK_SIZE - written);
              for (let i = 0; i < toWrite; i++) {
                outL[written + i] = chunk[i * 2];
                outR[written + i] = chunk[i * 2 + 1];
              }
              written += toWrite;
            }
          };
          const gainNode = audioCtx.createGain();
          gainNode.gain.value = 1;
          audioGainRef.current = gainNode;
          scriptNode.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          if (audioDest) {
            gainNode.connect(audioDest);
          }
          // AudioContext starts suspended, resume on first user interaction
          if (audioCtx.state === "suspended") {
            audioCtx.resume().catch(() => {});
          }
        } catch (err) {
          console.warn("[FBNeoPlayer] Audio setup failed, continuing without audio:", err);
        }

        // 3. Load BIOS (Neo Geo)
        if (biosPath) {
          const biosUrl = biosPath.startsWith("http") ? biosPath : buildRomUrl(biosPath, "");
          const biosRes = await fetch(biosUrl);
          if (aborted) return;
          if (!biosRes.ok) {
            throw new Error(`BIOS download failed for ${biosPath}: ${biosRes.status}`);
          }
          const biosBuffer = new Uint8Array(await biosRes.arrayBuffer());
          if (aborted) return;
          arcade.loadBios(biosBuffer, "neogeo");
        }

        // 4. Load ROM
        const romUrl = (typeof romSource === "string" && romSource.length > 0) ? romSource
          : romPath ? buildRomUrl(romPath, "")
          : "";
        if (!romUrl && romSource instanceof File) {
          throw new Error("Local file ROM not yet supported for FBNeo");
        }

        const romRes = await fetch(romUrl);
        if (aborted) return;
        if (!romRes.ok) {
          throw new Error(`ROM download failed: ${romRes.status}`);
        }
        const romBuffer = new Uint8Array(await romRes.arrayBuffer());
        if (aborted) return;
        const romName = (romPath?.split("/").pop() ?? "game").replace(/\.zip$/i, "");
        await arcade.loadRom(romBuffer, romName);
        if (aborted) return;

        // 5. Mark ready — separate effect will start the game loop
        setStatus("ready");
        gameReadyRef.current = true;
        onEmulatorReadyRef.current?.();
      } catch (err) {
        if (!aborted) {
          console.error("[FBNeoPlayer] Init error:", err);
          setStatus("error");
          setErrorMsg(err instanceof Error ? err.message : String(err));
        }
      }
    }

    init();

    return () => {
      aborted = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      streamReadyRef.current = false;
      gameReadyRef.current = false;
      arcadeRef.current?.destroy();
      arcadeRef.current = null;
      _fbneoArcadeRef = null;
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      audioDestRef.current = null;
      (window as unknown as Record<string, unknown>).__rtcade_game_running = false;
    };
  }, [variant, role, romPath, biosPath, isNetplay, localPlayer]);

  // ── Game loop (starts after status = "ready" so canvas is visible) ──
  useEffect(() => {
    if (status !== "ready" || !gameReadyRef.current) return;
    const arc = arcadeRef.current;
    const cvs = canvasRef.current;
    if (!arc || !cvs) return;

    let aborted = false;

    // HOST: 캡처용 오프스크린 Canvas 생성 (네이티브 해상도의 3배 → H264 인코딩 품질 향상)
    if (role === "host" && !captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement("canvas");
    }
    const capCvs = captureCanvasRef.current;

    const loop = () => {
      if (aborted) return;
      if (!canvasFittedRef.current && canvasRef.current) {
        fitCanvasToContainer(canvasRef.current, arc.width, arc.height);
        canvasFittedRef.current = true;
      }
      // Apply local input
      arc.setInput(localPlayer, pressedMaskRef.current);
      // Apply remote input (netplay only — guest's input via DataChannel)
      if (isNetplay) {
        const remotePlayer = localPlayer === 0 ? 1 : 0;
        arc.setInput(remotePlayer, remoteMaskRef.current);
      }
      arc.clockFrame();
      const buf = arc.getFrameBuffer();
      if (buf.length > 0 && canvasRef.current) {
        renderFrameToCanvas(canvasRef.current, buf, arc.width, arc.height, {
          smooth: false, autoResize: false,
        });
      }
      // HOST: 업스케일된 프레임을 캡처 Canvas에 렌더링 (WebRTC 스트리밍 품질 향상)
      if (capCvs && canvasRef.current) {
        renderUpscaledFrame(capCvs, canvasRef.current, arc.width, arc.height, HOST_STREAM_UPSCALE_FACTOR);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    // HOST: 스트림 캡처 시작 (offscreen capture canvas 사용)
    if (role === "host" && onCanvasStreamReadyRef.current) {
      startCaptureStream();
    }

    return () => {
      aborted = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [status, role]);

  // ── HOST: Canvas + Audio stream capture ───────────────
  function startCaptureStream() {
    if (streamReadyRef.current) return;

    const interval = setInterval(() => {
      if (streamReadyRef.current) { clearInterval(interval); return; }
      const capCvs = captureCanvasRef.current;
      if (!capCvs) return;

      try {
        const videoStream = capCvs.captureStream(HOST_STREAM_CAPTURE_FPS);
        for (const track of videoStream.getVideoTracks()) {
          track.contentHint = "motion";
        }
        // Add audio track from FBNeo audio capture
        const audioStream = audioDestRef.current?.stream;
        if (audioStream) {
          for (const track of audioStream.getAudioTracks()) {
            track.contentHint = "music";
            videoStream.addTrack(track);
          }
        }
        streamReadyRef.current = true;
        clearInterval(interval);
        onCanvasStreamReadyRef.current?.(videoStream, true);
        console.log("[FBNeoPlayer] Stream ready:", videoStream.getVideoTracks().length, "v +", videoStream.getAudioTracks().length, "a");
      } catch (e) {
        console.warn("[FBNeoPlayer] captureStream failed, retry:", e);
      }
    }, 100);
  }

  // ── Keyboard handling ─────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.isTrusted) return;

      // Netplay: 글로벌 키 캡처 (포커스 무관), 단 input/textarea 타이핑 중엔 제외
      if (isNetplay) {
        const el = document.activeElement;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) {
          return;
        }
      } else {
        if (!container.contains(document.activeElement)) return;
      }

      // Chat shortcut
      if (
        e.code === "Enter" && !e.repeat &&
        !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey
      ) {
        e.stopImmediatePropagation();
        e.preventDefault();
        onChatShortcut?.();
        return;
      }

      // FBNeo 비트마스크
      const fbMask = keyToButtonMask(e.code);
      if (fbMask !== 0) {
        e.stopImmediatePropagation();
        e.preventDefault();
        if (e.repeat) return;

        pressedMaskRef.current |= fbMask;

        // EmulatorJS 호환: per-button 콜백 변환
        const btn = KEY_TO_BUTTON[e.code];
        if (btn !== undefined) {
          onLocalInput?.(btn, true);
        }
        return;
      }

      // 차단 키
      if (BLOCKED_KEYS.has(e.code)) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.isTrusted) return;

      if (isNetplay) {
        const el = document.activeElement;
        if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) {
          return;
        }
      } else {
        if (!container.contains(document.activeElement)) return;
      }

      const fbMask = keyToButtonMask(e.code);
      if (fbMask !== 0) {
        e.stopImmediatePropagation();
        e.preventDefault();

        pressedMaskRef.current &= ~fbMask;

        const btn = KEY_TO_BUTTON[e.code];
        if (btn !== undefined) {
          onLocalInput?.(btn, false);
        }
        return;
      }

      if (BLOCKED_KEYS.has(e.code)) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };

    const releaseAll = () => {
      if (pressedMaskRef.current === 0) return;
      pressedMaskRef.current = 0;
      arcadeRef.current?.setInput(localPlayer, 0);
    };

    const listenerTarget = isNetplay ? window : container;
    // TS 6: capture-phase addEventListener expects (e: Event) => void
    const kd = (e: Event) => handleKeyDown(e as KeyboardEvent);
    const ku = (e: Event) => handleKeyUp(e as KeyboardEvent);
    listenerTarget.addEventListener("keydown", kd, true);
    listenerTarget.addEventListener("keyup", ku, true);
    window.addEventListener("blur", releaseAll);

    return () => {
      listenerTarget.removeEventListener("keydown", kd, true);
      listenerTarget.removeEventListener("keyup", ku, true);
      window.removeEventListener("blur", releaseAll);
      releaseAll();
    };
  }, [isNetplay, localPlayer, onChatShortcut, onLocalInput]);

  // ── Fullscreen ────────────────────────────────────────
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return undefined;
    const handler = () => {
      setIsFullscreen(document.fullscreenElement === wrapper);
      canvasFittedRef.current = false; // re-fit on next frame
    };
    wrapper.addEventListener("fullscreenchange", handler);
    return () => wrapper.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = () => {
    if (!wrapperRef.current) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void wrapperRef.current.requestFullscreen();
    }
  };

  const handleHostMute = useCallback(() => {
    const gn = audioGainRef.current;
    if (!gn) return;
    const next = !isMuted;
    gn.gain.value = next ? 0 : volume;
    setIsMuted(next);
  }, [isMuted, volume]);

  const handleHostVolume = useCallback((v: number) => {
    const gn = audioGainRef.current;
    if (!gn) return;
    gn.gain.value = v;
    setVolumeState(v);
    if (v > 0 && isMuted) {
      setIsMuted(false);
    }
  }, [isMuted]);

  // ── Render ────────────────────────────────────────────
  return (
    <div ref={wrapperRef} className="relative w-full" onMouseEnter={() => setShowControls(true)} onMouseLeave={() => setShowControls(false)}>
      {status === "loading" && (
        <div className="flex aspect-4/3 w-full items-center justify-center rounded-lg bg-neutral-900 text-sm text-muted-foreground">
          FBNeo WASM 로딩 중...
        </div>
      )}
      {status === "error" && (
        <div className="flex aspect-4/3 w-full flex-col items-center justify-center gap-2 rounded-lg bg-neutral-900">
          <span className="text-sm text-red-400">로딩 실패</span>
          <span className="text-xs text-muted-foreground">{errorMsg}</span>
        </div>
      )}
      <div
        ref={containerRef}
        tabIndex={0}
        className={
          isFullscreen
            ? "relative h-dvh w-screen overflow-hidden bg-black outline-none"
            : status === "ready"
              ? "relative aspect-4/3 w-full overflow-hidden rounded-lg bg-black outline-none focus:ring-2 focus:ring-primary/60"
              : "hidden"
        }
      >
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", imageRendering: "pixelated" }}
        />
      </div>
      {status === "ready" && (
        <div className={`absolute bottom-0 left-0 right-0 z-10 transition-opacity duration-200 ${showControls ? "opacity-100" : "opacity-0"}`}>
          <div className="flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8">
            <button
              type="button"
              onClick={handleHostMute}
              title={isMuted ? "소리 켜기" : "소리 끄기"}
              className="flex h-7 w-7 items-center justify-center rounded-md text-white hover:bg-white/20"
            >
              {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleHostVolume(parseFloat(e.target.value))}
              className="h-1 w-20 cursor-pointer accent-white"
              title={`볼륨 ${Math.round((isMuted ? 0 : volume) * 100)}%`}
            />
            <div className="flex-1" />
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "전체화면 종료" : "전체화면"}
              className="flex h-7 w-7 items-center justify-center rounded-md text-white hover:bg-white/20"
              aria-label={isFullscreen ? "전체화면 종료" : "전체화면"}
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// ── Exported helpers (EmulatorPlayer 호환) ──────────────

/** Notify FBNeoPlayer that the game should start (netplay handshake complete) */
export function sendStartGame(_ref: React.RefObject<HTMLDivElement | null>) {
  (window as unknown as Record<string, unknown>).__rtcade_game_running = true;
}

/** Focus the emulator container */
export function focusEmulator(ref: React.RefObject<HTMLDivElement | null>) {
  ref.current?.focus();
}

/**
 * 원격 플레이어의 버튼 입력을 FBNeoPlayer 인스턴스에 전달한다.
 *
 * 호스트의 `reconcileRemoteHeldMask`에서 버튼 단위로 호출된다.
 * `ref` 파라미터는 API 호환성을 위해 유지되지만 실제 dispatch는
 * 모듈레벨 `_fbneoRemoteButtonHandler`를 통해 이루어진다.
 *
 * FBNeoPlayer가 마운트되지 않은 상태에서는 호출이 무시된다.
 */
export function sendRemoteInput(
  ref: React.RefObject<HTMLDivElement | null>,
  button: number,
  down: boolean,
) {
  void ref;
  _fbneoRemoteButtonHandler?.(button, down);
}

/** Mark game as running */
export function markGameRunning() {
  (window as unknown as Record<string, unknown>).__rtcade_game_running = true;
}

/** 호스트 전용: FBNeo 게임을 초기 상태로 리셋 */
export function resetGame() {
  _fbneoArcadeRef?.reset();
}

export default FBNeoPlayer;

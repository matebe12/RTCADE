import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

import { appEnvironment } from "@/config/environment";
import { createEmulatorRuntimeBridge } from "@/lib/emulator-runtime-bridge";
import { CORE_REMAP, EJS_BUTTONS_CONFIG, KEY_TO_BUTTON, BLOCKED_KEYS } from "../../shared/emulator-protocol";
import { buildBackendUrl } from "@/lib/backend-url";

export type SystemCore =
  | "nes"
  | "snes"
  | "n64"
  | "gb"
  | "gba"
  | "nds"
  | "psx"
  | "psp"
  | "segaMD"
  | "segaMS"
  | "segaGG"
  | "segaSaturn"
  | "segaCD"
  | "sega32x"
  | "mame2003"
  | "mame2003_plus"
  | "arcade"
  | "fbneo"
  | "atari2600"
  | "atari7800"
  | "lynx"
  | "jaguar"
  | "3do"
  | "coleco"
  | "vb"
  | "dosbox";

interface EmulatorPlayerProps {
  romSource: File | string; // File (local) or URL string (server)
  core: SystemCore;
  role?: "host" | "guest"; // undefined = solo mode
  romPath?: string; // e.g. "mame2003/mslug3.zip" for server-served ROM
  biosPath?: string; // e.g. "mame2003/neogeo.zip"
  onLocalInput?: (button: number, down: boolean) => void;
  onEmulatorReady?: () => void;
  onSaveState?: (state: ArrayBuffer) => void;
  onStateLoaded?: () => void;
  onSaveStateError?: (error: string) => void;
  onResyncState?: (state: ArrayBuffer) => void;
  onResyncLoaded?: () => void;
  onResyncFailed?: () => void;
  onChatShortcut?: () => void;
  onCanvasStreamReady?: (stream: MediaStream) => void;
}

/** CSS to hide EmulatorJS UI buttons we don't want (keep volume only) */
const EJS_HIDE_BUTTONS_CSS = [
  "playPause",
  "play",
  "pause",
  "restart",
  "mute",
  "unmute",
  "screenshot",
  "saveState",
  "loadState",
  "quickSave",
  "quickLoad",
  "screenRecord",
  "saveSavFiles",
  "loadSavFiles",
  "cacheManager",
  "cheat",
  "exitEmulation",
  "settings",
  "fullscreen",
  "gamepad",
]
  .map((btn) => `[data-btn="${btn}"]{display:none!important}`)
  .join("");

// Temporary safety switch while diagnosing host startup aborts.
const HOST_AUDIO_CAPTURE_ENABLED = false;
const HOST_STREAM_CAPTURE_FPS = 60;

/**
 * Install an AudioContext monkey-patch BEFORE EmulatorJS loads.
 * This captures the AudioContext it creates and taps into the audio output
 * for WebRTC streaming.
 *
 * Strategy (two-layer capture):
 *
 * Layer 1 (existing): Replace AudioContext constructor — override the
 * `destination` getter so connections to destination go through our
 * GainNode splitter (speakers + MediaStreamDestination).
 *
 * Layer 2 (new): Monkey-patch `AudioNode.prototype.connect` — if any
 * node connects directly to an `AudioDestinationNode` (bypassing our
 * patched destination getter), intercept the call and insert the
 * splitter GainNode. This catches cases where Emscripten SDL2 caches
 * the real destination reference before our getter patch takes effect.
 */
function installAudioCapture(): void {
  if ((window as unknown as Record<string, unknown>).__rtcade_audio_patched) return;
  (window as unknown as Record<string, unknown>).__rtcade_audio_patched = true;

  const OrigAudioContext = window.AudioContext;
  // Save originals for cleanup
  (window as unknown as Record<string, unknown>).__rtcade_orig_audio_context = OrigAudioContext;
  const origConnect = AudioNode.prototype.connect as (
    this: AudioNode,
    destinationNode: AudioNode | AudioParam,
    ...args: unknown[]
  ) => AudioNode;
  (window as unknown as Record<string, unknown>).__rtcade_orig_connect = origConnect;

  /**
   * Given an AudioContext, ensure we have a splitter (GainNode → speakers + MediaStreamDestination).
   * Returns the splitter info or undefined if creation fails.
   */
  function ensureSplitter(ctx: AudioContext) {
    const win = window as unknown as Record<string, unknown>;
    const existing = win.__rtcade_audio_splitter as
      | {
          stream: MediaStream;
          ctx: AudioContext;
          dest: MediaStreamAudioDestinationNode;
          fakeDestination: GainNode;
        }
      | undefined;
    if (existing && existing.ctx === ctx) return existing;

    try {
      const dest = ctx.createMediaStreamDestination();
      const fakeDestination = ctx.createGain();
      fakeDestination.gain.value = 1;
      origConnect.call(fakeDestination, ctx.destination as AudioNode); // speakers
      origConnect.call(fakeDestination, dest as AudioNode); // WebRTC capture

      const splitter = { stream: dest.stream, ctx, dest, fakeDestination };
      win.__rtcade_audio_splitter = splitter;
      console.log("[EMULATOR] Audio splitter created for AudioContext");
      return splitter;
    } catch (e) {
      console.warn("[EMULATOR] Audio splitter creation failed:", e);
      return undefined;
    }
  }

  // ── Layer 2: AudioNode.prototype.connect intercept ──
  AudioNode.prototype.connect = function (
    this: AudioNode,
    destinationNode: AudioNode | AudioParam,
    ...rest: unknown[]
  ): AudioNode {
    // If connecting to the real AudioDestinationNode, redirect through splitter
    if (destinationNode instanceof AudioDestinationNode) {
      const splitter = ensureSplitter(this.context as AudioContext);
      if (splitter) {
        // Connect source → splitter instead of source → destination
        return origConnect.call(this, splitter.fakeDestination as AudioNode, ...rest);
      }
    }
    return origConnect.call(this, destinationNode, ...rest);
  } as typeof AudioNode.prototype.connect;

  // ── Layer 1: AudioContext constructor patch with destination override ──
  const patchedCtor = function (
    this: AudioContext,
    ...args: ConstructorParameters<typeof AudioContext>
  ) {
    const ctx = new OrigAudioContext(...args);

    try {
      const splitter = ensureSplitter(ctx);
      if (splitter) {
        // Override destination getter as additional safety net
        Object.defineProperty(ctx, "destination", {
          get() {
            return splitter.fakeDestination;
          },
          configurable: true,
        });
      }
      console.log(
        "[EMULATOR] Audio capture installed via destination override + connect intercept",
      );
    } catch (e) {
      console.warn("[EMULATOR] Audio capture setup failed:", e);
    }

    return ctx;
  } as unknown as typeof AudioContext;

  // Copy static properties so instanceof checks still work
  Object.setPrototypeOf(patchedCtor, OrigAudioContext);
  Object.setPrototypeOf(patchedCtor.prototype, OrigAudioContext.prototype);
  (window as unknown as Record<string, unknown>).AudioContext = patchedCtor;
}

/**
 * Remove audio capture monkey-patch and clean up.
 */
function removeAudioCapture(): void {
  const win = window as unknown as Record<string, unknown>;

  // Restore original AudioContext constructor
  const orig = win.__rtcade_orig_audio_context;
  if (orig) {
    win.AudioContext = orig;
    delete win.__rtcade_orig_audio_context;
  }

  // Restore original AudioNode.prototype.connect
  const origConnect = win.__rtcade_orig_connect as typeof AudioNode.prototype.connect | undefined;
  if (origConnect) {
    AudioNode.prototype.connect = origConnect;
    delete win.__rtcade_orig_connect;
  }

  // Disconnect splitter nodes to release resources
  const splitter = win.__rtcade_audio_splitter as
    | {
        fakeDestination?: GainNode;
        dest?: MediaStreamAudioDestinationNode;
      }
    | undefined;
  if (splitter) {
    try {
      splitter.fakeDestination?.disconnect();
    } catch {
      /* */
    }
    try {
      splitter.dest?.disconnect();
    } catch {
      /* */
    }
  }
  delete win.__rtcade_audio_splitter;
  delete win.__rtcade_audio_patched;
}

/**
 * Globals that WE set before loading loader.js.
 * We only clean these up — NOT the ones EmulatorJS sets internally
 * (EJS_STORAGE, EJS_emulator, etc.) to avoid race conditions with
 * React Strict Mode double-invoke.
 */
const OUR_EJS_GLOBALS = [
  "EJS_player",
  "EJS_core",
  "EJS_pathtodata",
  "EJS_color",
  "EJS_startOnLoaded",
  "EJS_language",
  "EJS_disableAutoLang",
  "EJS_gameID",
  "EJS_Buttons",
  "EJS_ready",
  "EJS_onGameStart",
  "EJS_gameUrl",
  "EJS_biosUrl",
] as const;

function buildLoadedEmulatorConfig(win: Record<string, unknown>) {
  const config: Record<string, unknown> = {
    gameUrl: win.EJS_gameUrl,
    dataPath: win.EJS_pathtodata,
    system: win.EJS_core,
    biosUrl: win.EJS_biosUrl,
    color: win.EJS_color,
    buttonOpts: win.EJS_Buttons,
    startOnLoad: win.EJS_startOnLoaded,
    gameId: win.EJS_gameID,
  };

  return config;
}

function bindLoadedEmulatorEvents(win: Record<string, unknown>) {
  const emulator = win.EJS_emulator as
    | { on?: (event: string, handler: () => void) => void }
    | undefined;

  if (!emulator?.on) {
    return;
  }

  if (typeof win.EJS_ready === "function") {
    emulator.on("ready", win.EJS_ready as () => void);
  }

  if (typeof win.EJS_onGameStart === "function") {
    emulator.on("start", win.EJS_onGameStart as () => void);
  }
}

/**
 * Clean up EJS globals that we set, and destroy the EmulatorJS instance.
 * Preserves EJS_STORAGE (class defined by loader.js) so subsequent
 * mounts don't hit "EJS_STORAGE is not a constructor".
 */
function cleanupEJSGlobals() {
  const win = window as unknown as Record<string, unknown>;

  // Destroy the running EmulatorJS instance if it exists and has a gameManager
  // (partially initialized instances don't have callEvent and crash on exit)
  const emu = win.EJS_emulator as
    | {
        callEvent?: (name: string) => void;
        gameManager?: unknown;
      }
    | undefined;
  if (emu?.gameManager) {
    try {
      emu.callEvent?.("exit");
    } catch {
      /* best-effort */
    }
  }
  delete win.EJS_emulator;

  // Only delete the globals WE explicitly set
  for (const key of OUR_EJS_GLOBALS) {
    try {
      delete win[key];
    } catch {
      win[key] = undefined;
    }
  }

  // Clean up our custom globals
  delete win._videoCaptureActive;
  delete win._videoCaptureInFlight;
}

const EmulatorPlayer = forwardRef<HTMLDivElement, EmulatorPlayerProps>(function EmulatorPlayer(
  {
    romSource,
    core,
    role,
    romPath,
    biosPath,
    onLocalInput,
    onEmulatorReady,
    onSaveState: _onSaveState,
    onStateLoaded: _onStateLoaded,
    onSaveStateError: _onSaveStateError,
    onResyncState: _onResyncState,
    onResyncLoaded: _onResyncLoaded,
    onResyncFailed: _onResyncFailed,
    onChatShortcut,
    onCanvasStreamReady,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const streamReadyFiredRef = useRef(false);
  const pressedButtonsRef = useRef(new Set<number>());
  const gameRunningRef = useRef(false);
  const readyHandshakeCompleteRef = useRef(false);
  const isNetplay = role === "host" || role === "guest";
  const shouldCaptureAudio = role === "host" && HOST_AUDIO_CAPTURE_ENABLED;
  const localPlayer = role === "guest" ? 1 : 0;

  // Stable refs for callback props so the main effect doesn't depend on them
  const onEmulatorReadyRef = useRef(onEmulatorReady);
  onEmulatorReadyRef.current = onEmulatorReady;

  useImperativeHandle(ref, () => containerRef.current!, []);

  // Mount EmulatorJS directly in the container div
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    // Aborted flag — prevents async script callbacks from running
    // after React Strict Mode cleanup.
    let aborted = false;
    let initTimerId: number | null = null;
    let gameUrlObjectUrl: string | null = null;

    // Install audio capture before EJS loads
    if (shouldCaptureAudio) {
      installAudioCapture();
    }

    // Create the game mount point
    const gameDiv = document.createElement("div");
    const gameId = `game-${Math.random().toString(36).slice(2, 10)}`;
    gameDiv.id = gameId;
    gameDiv.style.width = "100%";
    gameDiv.style.height = "100%";
    container.appendChild(gameDiv);

    // Inject CSS to hide unwanted EmulatorJS buttons
    const style = document.createElement("style");
    style.textContent = EJS_HIDE_BUTTONS_CSS;
    document.head.appendChild(style);
    styleRef.current = style;

    const ejsCore = CORE_REMAP[core] || core;
    const win = window as unknown as Record<string, unknown>;

    // Suppress WakeLock
    try {
      Object.defineProperty(navigator, "wakeLock", {
        value: {
          request: () =>
            Promise.resolve({
              released: false,
              release: () => Promise.resolve(),
              addEventListener: () => {},
              removeEventListener: () => {},
              onrelease: null,
              type: "screen",
            }),
        },
        writable: true,
        configurable: true,
      });
    } catch {
      /* already defined */
    }

    // Set EJS globals
    win.EJS_player = `#${gameId}`;
    win.EJS_core = ejsCore;
    win.EJS_pathtodata = appEnvironment.emulatorJsDataUrl;
    win.EJS_color = "#00d4ff";
    win.EJS_startOnLoaded = true;
    win.EJS_language = "en-US";
    win.EJS_disableAutoLang = false;
    win.EJS_gameID = 1;
    win.EJS_Buttons = { ...EJS_BUTTONS_CONFIG };

    // EJS_ready — fires when EmulatorJS UI is loaded
    win.EJS_ready = () => {
      console.log("[EMULATOR] EJS_ready fired");
    };

    // For netplay: intercept game start to pause and verify gameManager
    if (isNetplay) {
      gameRunningRef.current = false;
      readyHandshakeCompleteRef.current = false;
      win.EJS_onGameStart = () => {
        if (aborted) return;
        if (readyHandshakeCompleteRef.current) return;

        const ejs = win.EJS_emulator as { gameManager?: unknown } | undefined;
        if (!ejs) return;

        console.log("[EMULATOR] EJS_onGameStart fired (netplay), waiting for host ready gate...");

        let attempt = 0;
        function tryReady() {
          if (aborted) return;
          if (readyHandshakeCompleteRef.current) return;

          attempt++;
          console.log("[EMULATOR] Ready attempt", attempt);
          const ejsInner = win.EJS_emulator as { gameManager?: unknown } | undefined;
          if (ejsInner?.gameManager) {
            console.log("[EMULATOR] gameManager detected, netplay host ready");
            readyHandshakeCompleteRef.current = true;
            onEmulatorReadyRef.current?.();
            return;
          }

          if (attempt < 10) {
            setTimeout(tryReady, 200);
          } else {
            console.warn("[EMULATOR] Max attempts reached, sending ready anyway");
            readyHandshakeCompleteRef.current = true;
            onEmulatorReadyRef.current?.();
          }
        }
        setTimeout(tryReady, 500);
      };
    }

    function loadEJSScript() {
      if (aborted) return;

      // If loader.js was already evaluated on a previous mount (EJS_STORAGE exists),
      // we cannot re-evaluate it — `class EJS_STORAGE` is a block-scoped declaration
      // that throws on redeclaration. Recreate the EmulatorJS instance with the
      // same constructor shape loader.js uses: new EmulatorJS(EJS_player, config).
      if (win.EJS_STORAGE && typeof win.EmulatorJS === "function") {
        const EmulatorJSCtor = win.EmulatorJS as new (
          selector: string,
          config: Record<string, unknown>,
        ) => unknown;

        win.EJS_emulator = new EmulatorJSCtor(
          String(win.EJS_player),
          buildLoadedEmulatorConfig(win),
        );
        bindLoadedEmulatorEvents(win);
        return;
      }

      const script = document.createElement("script");
      script.src = appEnvironment.emulatorJsLoaderUrl;
      script.async = true;
      document.body.appendChild(script);
      scriptRef.current = script;
    }

    function scheduleEJSLoad() {
      if (aborted) return;

      // Delay actual loader execution to the next macrotask so React Strict Mode's
      // dev-only mount/unmount probe can cancel before EmulatorJS starts any work.
      initTimerId = window.setTimeout(() => {
        initTimerId = null;
        if (aborted) return;
        loadEJSScript();
      }, 0);
    }

    // Set game URL
    if (romPath) {
      // Server ROM
      win.EJS_gameUrl = buildBackendUrl(`/roms/${romPath}`);
      if (biosPath) {
        win.EJS_biosUrl = buildBackendUrl(`/roms/${biosPath}`);
      }
    } else if (romSource instanceof File) {
      // Local file — read and create blob URL
      romSource.arrayBuffer().then((buffer) => {
        if (aborted) return;
        const blob = new Blob([buffer]);
        gameUrlObjectUrl = URL.createObjectURL(blob);
        win.EJS_gameUrl = gameUrlObjectUrl;
        // Load the script after setting the URL
        scheduleEJSLoad();
      });
      // Return early; script will be loaded after file read
      return () => cleanup();
    }

    // For server ROM, load script immediately
    if (romPath || typeof romSource === "string") {
      scheduleEJSLoad();
    }

    function cleanup() {
      console.warn("[EMULATOR] cleanup invoked", {
        role,
        romPath,
        aborted,
      });

      aborted = true;

      if (initTimerId !== null) {
        window.clearTimeout(initTimerId);
        initTimerId = null;
      }

      // Remove injected elements
      if (scriptRef.current) {
        scriptRef.current.remove();
        scriptRef.current = null;
      }
      if (styleRef.current) {
        styleRef.current.remove();
        styleRef.current = null;
      }

      // Stop any video streams
      streamReadyFiredRef.current = false;

      // Clean up EJS globals (preserves EJS_STORAGE for next mount)
      cleanupEJSGlobals();
      if (shouldCaptureAudio) {
        removeAudioCapture();
      }

      if (gameUrlObjectUrl) {
        URL.revokeObjectURL(gameUrlObjectUrl);
        gameUrlObjectUrl = null;
      }

      // Clear the container after EmulatorJS cleanup so any in-flight exit logic
      // still sees the DOM it mounted into.
      if (container) {
        container.innerHTML = "";
      }

      // Reset game-running flag
      (window as unknown as Record<string, unknown>).__rtcade_game_running = false;
      pressedButtonsRef.current.clear();
      gameRunningRef.current = false;
      readyHandshakeCompleteRef.current = false;
    }

    return () => cleanup();
  }, [romSource, core, role, romPath, biosPath, isNetplay, localPlayer, shouldCaptureAudio]);

  // Keyboard event listeners on the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    // For netplay, add a window-level capture listener to intercept
    // keys BEFORE EmulatorJS's own document/window-level listeners can
    // handle them with default key mappings, AND before our container
    // handler (which does the actual simulateInput call).
    let windowKeyDown: ((e: KeyboardEvent) => void) | null = null;
    let windowKeyUp: ((e: KeyboardEvent) => void) | null = null;

    const releasePressedButtons = () => {
      if (pressedButtonsRef.current.size === 0) return;

      const pressedButtons = Array.from(pressedButtonsRef.current);
      pressedButtonsRef.current.clear();

      const ejs = (window as unknown as Record<string, unknown>).EJS_emulator as
        | { gameManager?: { simulateInput: (p: number, b: number, v: number) => void } }
        | undefined;

      for (const btn of pressedButtons) {
        ejs?.gameManager?.simulateInput(localPlayer, btn, 0);
        if (isNetplay) {
          onLocalInput?.(btn, false);
        }
      }
    };

    if (isNetplay) {
      windowKeyDown = (e: KeyboardEvent) => {
        // Only intercept when our container (or a descendant) has focus
        if (!e.isTrusted) return;
        if (!container.contains(document.activeElement)) return;

        // Chat shortcut
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
        if (btn === undefined) {
          if (BLOCKED_KEYS.has(e.code)) {
            e.stopImmediatePropagation();
            e.preventDefault();
          }
          return;
        }
        e.stopImmediatePropagation();
        e.preventDefault();

        if (!(window as unknown as Record<string, unknown>).__rtcade_game_running) return;
        if (e.repeat || pressedButtonsRef.current.has(btn)) return;

        pressedButtonsRef.current.add(btn);
        const ejs = (window as unknown as Record<string, unknown>).EJS_emulator as
          | { gameManager?: { simulateInput: (p: number, b: number, v: number) => void } }
          | undefined;
        ejs?.gameManager?.simulateInput(localPlayer, btn, 1);
        onLocalInput?.(btn, true);
      };
      windowKeyUp = (e: KeyboardEvent) => {
        if (!e.isTrusted) return;
        if (!container.contains(document.activeElement)) return;
        const btn = KEY_TO_BUTTON[e.code];
        if (btn === undefined) {
          if (BLOCKED_KEYS.has(e.code)) {
            e.stopImmediatePropagation();
            e.preventDefault();
          }
          return;
        }
        e.stopImmediatePropagation();
        e.preventDefault();

        if (!(window as unknown as Record<string, unknown>).__rtcade_game_running) return;
        if (!pressedButtonsRef.current.has(btn)) return;

        pressedButtonsRef.current.delete(btn);
        const ejs = (window as unknown as Record<string, unknown>).EJS_emulator as
          | { gameManager?: { simulateInput: (p: number, b: number, v: number) => void } }
          | undefined;
        ejs?.gameManager?.simulateInput(localPlayer, btn, 0);
        onLocalInput?.(btn, false);
      };
      window.addEventListener("keydown", windowKeyDown, true);
      window.addEventListener("keyup", windowKeyUp, true);
    } else {
      // Solo mode: intercept keys and use same KEY_TO_BUTTON mapping
      // so controls are consistent with netplay (1/5/A/S/D/F).
      windowKeyDown = (e: KeyboardEvent) => {
        if (!e.isTrusted) return;
        if (!container.contains(document.activeElement)) return;
        const btn = KEY_TO_BUTTON[e.code];
        if (btn === undefined) {
          if (BLOCKED_KEYS.has(e.code)) {
            e.stopImmediatePropagation();
            e.preventDefault();
          }
          return;
        }
        e.stopImmediatePropagation();
        e.preventDefault();
        if (e.repeat || pressedButtonsRef.current.has(btn)) return;

        pressedButtonsRef.current.add(btn);
        const ejs = (window as unknown as Record<string, unknown>).EJS_emulator as
          | { gameManager?: { simulateInput: (p: number, b: number, v: number) => void } }
          | undefined;
        ejs?.gameManager?.simulateInput(0, btn, 1);
      };
      windowKeyUp = (e: KeyboardEvent) => {
        if (!e.isTrusted) return;
        if (!container.contains(document.activeElement)) return;
        const btn = KEY_TO_BUTTON[e.code];
        if (btn === undefined) {
          if (BLOCKED_KEYS.has(e.code)) {
            e.stopImmediatePropagation();
            e.preventDefault();
          }
          return;
        }
        e.stopImmediatePropagation();
        e.preventDefault();
        if (!pressedButtonsRef.current.has(btn)) return;

        pressedButtonsRef.current.delete(btn);
        const ejs = (window as unknown as Record<string, unknown>).EJS_emulator as
          | { gameManager?: { simulateInput: (p: number, b: number, v: number) => void } }
          | undefined;
        ejs?.gameManager?.simulateInput(0, btn, 0);
      };
      window.addEventListener("keydown", windowKeyDown, true);
      window.addEventListener("keyup", windowKeyUp, true);
    }

    window.addEventListener("blur", releasePressedButtons);

    return () => {
      releasePressedButtons();
      if (windowKeyDown) window.removeEventListener("keydown", windowKeyDown, true);
      if (windowKeyUp) window.removeEventListener("keyup", windowKeyUp, true);
      window.removeEventListener("blur", releasePressedButtons);
    };
  }, [isNetplay, localPlayer, onChatShortcut, onLocalInput]);

  // HOST: capture canvas stream after emulator is ready
  // We wait for BOTH canvas AND audio to be available before firing.
  // EmulatorJS creates the canvas during loading, but AudioContext is
  // only created when the game starts playing. If we fire too early,
  // the stream will be video-only and the guest won't get audio.
  useEffect(() => {
    if (role !== "host" || !onCanvasStreamReady || streamReadyFiredRef.current) return undefined;

    let canvasFound = false;
    let audioWaitCount = 0;
    const MAX_AUDIO_WAIT = 30; // 30 × 500ms = 15s max wait for audio

    const interval = setInterval(() => {
      if (streamReadyFiredRef.current) {
        clearInterval(interval);
        return;
      }

      const canvas = containerRef.current?.querySelector("canvas");
      if (!canvas) return;

      if (!canvasFound) {
        canvasFound = true;
        console.log("[EMULATOR] Canvas found, waiting for audio...");
      }

      // Check if the audio splitter has been created (game must be playing)
      const audioSplitter = shouldCaptureAudio
        ? ((window as unknown as Record<string, unknown>).__rtcade_audio_splitter as
            | {
                stream?: MediaStream;
              }
            | undefined)
        : undefined;
      const hasAudio = shouldCaptureAudio && !!audioSplitter?.stream;

      if (shouldCaptureAudio && !hasAudio) {
        audioWaitCount++;
        if (audioWaitCount < MAX_AUDIO_WAIT) return; // keep waiting
        console.warn("[EMULATOR] Audio not available after 15s, proceeding with video only");
      }

      try {
        const videoStream = canvas.captureStream(HOST_STREAM_CAPTURE_FPS);

        for (const track of videoStream.getVideoTracks()) {
          track.contentHint = "detail";
        }

        if (hasAudio && audioSplitter?.stream) {
          for (const track of audioSplitter.stream.getAudioTracks()) {
            track.contentHint = "music";
            videoStream.addTrack(track);
          }
          console.log("[EMULATOR] Combined A/V stream ready");
        } else {
          console.log("[EMULATOR] Video-only stream ready (audio capture disabled)");
        }

        streamReadyFiredRef.current = true;
        clearInterval(interval);
        onCanvasStreamReady(videoStream);
      } catch (e) {
        console.warn("[EMULATOR] captureStream failed, will retry:", e);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [role, onCanvasStreamReady, shouldCaptureAudio]);

  // Fullscreen toggle — requestFullscreen on the wrapper div so the button
  // is included in the fullscreen surface. When fullscreen, aspect-4/3 is
  // dropped and the container expands to fill the viewport.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return undefined;

    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === wrapper);
    };

    wrapper.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => wrapper.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!wrapperRef.current) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void wrapperRef.current.requestFullscreen();
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div
        ref={containerRef}
        tabIndex={0}
        className={
          isFullscreen
            ? "relative h-dvh w-screen overflow-hidden bg-neutral-900 outline-none"
            : "relative aspect-4/3 w-full overflow-hidden rounded-lg bg-neutral-900 outline-none focus:ring-2 focus:ring-primary/60"
        }
        style={isFullscreen ? undefined : { contain: "layout style paint" }}
      />
      <button
        type="button"
        onClick={toggleFullscreen}
        title={isFullscreen ? "전체화면 종료" : "전체화면"}
        className="absolute bottom-2 right-2 flex size-7 items-center justify-center rounded-md bg-black/50 text-white opacity-0 transition-opacity hover:bg-black/80 hover:opacity-100 focus:opacity-100 [div:fullscreen_&]:opacity-100"
        aria-label={isFullscreen ? "전체화면 종료" : "전체화면"}
      >
        {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
      </button>
    </div>
  );
});

/**
 * Notify EmulatorPlayer that the game should start (netplay).
 * Directly calls EJS_emulator.play() and marks game as running.
 */
export function sendStartGame(containerRef: React.RefObject<HTMLDivElement | null>) {
  const bridge = createEmulatorRuntimeBridge(containerRef);
  bridge.sync.startGame();
  // Mark game as running so the keyboard handler starts processing input
  (window as unknown as Record<string, unknown>).__rtcade_game_running = true;
}

export function focusEmulator(containerRef: React.RefObject<HTMLDivElement | null>) {
  const bridge = createEmulatorRuntimeBridge(containerRef);
  bridge.ui.focus();
}

/**
 * Get a save state from the emulator (HOST).
 * Returns the state buffer or null on failure.
 * Retries up to `maxRetries` times for MAME cores.
 */
export async function requestSaveState(
  containerRef: React.RefObject<HTMLDivElement | null>,
  maxRetries = 5,
): Promise<ArrayBuffer | null> {
  const bridge = createEmulatorRuntimeBridge(containerRef);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const state = bridge.sync.getSaveState();
    if (state && state.byteLength > 0) {
      console.log(`[EMULATOR] getState() success on attempt ${attempt}, size: ${state.byteLength}`);
      return state;
    }
    console.warn(`[EMULATOR] getState() attempt ${attempt} failed, retrying...`);
    // Play briefly then pause before retry (MAME needs this)
    bridge.sync.play();
    await new Promise((r) => setTimeout(r, 300));
    bridge.sync.pause();
    await new Promise((r) => setTimeout(r, 300));
  }
  console.error("[EMULATOR] getState() failed after all retries");
  return null;
}

/**
 * Load a save state into the emulator (GUEST).
 */
export function loadSaveState(
  containerRef: React.RefObject<HTMLDivElement | null>,
  state: ArrayBuffer,
): boolean {
  const bridge = createEmulatorRuntimeBridge(containerRef);
  return bridge.sync.loadSaveState(state);
}

/**
 * Send a remote input event into the emulator.
 */
export function sendRemoteInput(
  containerRef: React.RefObject<HTMLDivElement | null>,
  button: number,
  down: boolean,
) {
  const bridge = createEmulatorRuntimeBridge(containerRef);
  bridge.input.sendRemoteInput(button, down);
}

/**
 * Get a resync state (micro-pause, get state, resume).
 */
export function requestResyncGetState(
  containerRef: React.RefObject<HTMLDivElement | null>,
): ArrayBuffer | null {
  const bridge = createEmulatorRuntimeBridge(containerRef);
  return bridge.sync.getResyncState();
}

/**
 * Load a resync state (micro-pause, load state, resume).
 */
export function requestResyncLoadState(
  containerRef: React.RefObject<HTMLDivElement | null>,
  state: ArrayBuffer,
): boolean {
  const bridge = createEmulatorRuntimeBridge(containerRef);
  return bridge.sync.loadResyncState(state);
}

/** Mark the game as "running" for input gating (netplay) */
export function markGameRunning() {
  // The EmulatorPlayer component tracks this internally via gameRunningRef,
  // but other callers can't access it. We use a window-level flag as fallback.
  (window as unknown as Record<string, unknown>).__rtcade_game_running = true;
}

export default EmulatorPlayer;

export const SYSTEM_OPTIONS: { value: SystemCore; label: string; extensions: string }[] = [
  { value: "nes", label: "NES", extensions: ".nes,.zip" },
  { value: "snes", label: "SNES", extensions: ".smc,.sfc,.zip" },
  { value: "n64", label: "N64", extensions: ".z64,.n64,.v64,.zip" },
  { value: "gb", label: "Game Boy", extensions: ".gb,.gbc,.zip" },
  { value: "gba", label: "GBA", extensions: ".gba,.zip" },
  { value: "nds", label: "NDS", extensions: ".nds,.zip" },
  { value: "psx", label: "PS1", extensions: ".bin,.cue,.iso,.pbp,.chd,.zip" },
  { value: "psp", label: "PSP", extensions: ".iso,.cso,.pbp" },
  { value: "segaMD", label: "Mega Drive", extensions: ".md,.gen,.bin,.zip" },
  { value: "segaMS", label: "Master System", extensions: ".sms,.zip" },
  { value: "segaGG", label: "Game Gear", extensions: ".gg,.zip" },
  { value: "segaSaturn", label: "Saturn", extensions: ".bin,.cue,.iso,.chd" },
  { value: "segaCD", label: "Sega CD", extensions: ".bin,.cue,.iso,.chd" },
  { value: "sega32x", label: "32X", extensions: ".32x,.zip" },
  { value: "mame2003", label: "MAME 2003+", extensions: ".zip" },
  { value: "arcade", label: "FBNeo (아케이드)", extensions: ".zip" },
  { value: "atari2600", label: "Atari 2600", extensions: ".a26,.zip" },
  { value: "atari7800", label: "Atari 7800", extensions: ".a78,.zip" },
  { value: "lynx", label: "Atari Lynx", extensions: ".lnx,.zip" },
  { value: "jaguar", label: "Atari Jaguar", extensions: ".j64,.jag,.zip" },
  { value: "3do", label: "3DO", extensions: ".iso,.bin,.cue,.chd" },
  { value: "coleco", label: "ColecoVision", extensions: ".col,.zip" },
  { value: "vb", label: "Virtual Boy", extensions: ".vb,.vboy,.zip" },
  { value: "dosbox", label: "DOS", extensions: ".zip,.exe,.com" },
];

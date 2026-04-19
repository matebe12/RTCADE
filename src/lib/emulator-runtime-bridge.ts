import type { RefObject } from "react";

import type { EJSEmulatorInstance } from "../../shared/emulator-protocol";

/**
 * Direct runtime bridge to EmulatorJS running in the parent DOM.
 * Replaces the old postMessage-based iframe bridge.
 * All calls go directly to window.EJS_emulator / gameManager.
 */

export interface EmulatorRuntimeBridge {
  input: {
    simulateLocalInput: (player: number, button: number, value: number) => void;
    sendRemoteInput: (button: number, down: boolean) => void;
  };
  sync: {
    getSaveState: () => ArrayBuffer | null;
    loadSaveState: (state: ArrayBuffer) => boolean;
    getResyncState: () => ArrayBuffer | null;
    loadResyncState: (state: ArrayBuffer) => boolean;
    startGame: () => void;
    pause: () => void;
    play: () => void;
  };
  capture: {
    /** Get a MediaStream captured from the emulator canvas. autoFps=0 means manual requestFrame(). */
    getCaptureStream: (fps?: number) => MediaStream | null;
    /** Get an audio MediaStream by tapping into the emulator's AudioContext. */
    getAudioStream: () => MediaStream | null;
  };
  ui: {
    focus: () => void;
  };
  /** Get the EJS_emulator instance if available. */
  getEmulator: () => EJSEmulatorInstance | null;
}

function getEJSEmulator(): EJSEmulatorInstance | null {
  const ejs = (window as unknown as Record<string, unknown>).EJS_emulator as EJSEmulatorInstance | undefined;
  if (!ejs?.gameManager) return null;
  return ejs;
}

function findEmulatorCanvas(containerRef: RefObject<HTMLDivElement | null>): HTMLCanvasElement | null {
  if (!containerRef.current) return null;
  return containerRef.current.querySelector("canvas");
}

/**
 * Try to find the AudioContext used by EmulatorJS and create a MediaStream
 * destination from it for audio capture.
 */
function captureAudioFromEJS(): MediaStream | null {
  try {
    const ejs = getEJSEmulator();
    if (!ejs) return null;

    // EmulatorJS stores its AudioContext on the emulator instance or globally.
    // Try known paths to find it.
    const runtime = ejs as unknown as Record<string, unknown>;

    // Path 1: EJS_emulator.Module.SDL2.audioContext (Emscripten SDL2 audio)
    const module = runtime.Module as Record<string, unknown> | undefined;
    const sdl2 = module?.SDL2 as Record<string, unknown> | undefined;
    let audioCtx = sdl2?.audioContext as AudioContext | undefined;

    // Path 2: direct audioContext property
    if (!audioCtx) {
      audioCtx = runtime.audioContext as AudioContext | undefined;
    }

    // Path 3: search for any AudioContext in the Emscripten module
    if (!audioCtx && module) {
      for (const key of Object.keys(module)) {
        const val = module[key];
        if (val instanceof AudioContext) {
          audioCtx = val;
          break;
        }
      }
    }

    if (!audioCtx || audioCtx.state === "closed") return null;

    const dest = audioCtx.createMediaStreamDestination();
    // Connect the AudioContext destination to our capture node.
    // We need to find the node connected to audioCtx.destination.
    // Workaround: we monkey-patch createGain or use an AnalyserNode approach.
    // Simplest: replace destination prototype — but that's risky.
    // Instead, we create a GainNode as a splitter:
    // existing output → GainNode → destination
    //                             → MediaStreamDestination
    // But we can't retroactively insert into the graph.
    // 
    // Best approach: Use AudioContext.prototype.createMediaStreamDestination
    // and connect it after the fact. We override destination getter.
    //
    // Practical approach: Just capture all audio from the page context.
    // If EmulatorJS is the only audio source, this works.
    
    // Actually simplest reliable approach: use captureStream on an <audio> or 
    // use the MediaStream from canvas which only has video.
    // For now, return null and we'll capture audio in EmulatorPlayer via 
    // AudioContext monkey-patching before EJS loads.
    
    // If we already have a splitter node installed (see EmulatorPlayer), use it
    const splitter = (window as unknown as Record<string, unknown>).__rtcade_audio_splitter as {
      stream: MediaStream;
    } | undefined;
    if (splitter?.stream) {
      return splitter.stream;
    }

    return null;
  } catch {
    return null;
  }
}

export function createEmulatorRuntimeBridge(
  containerRef: RefObject<HTMLDivElement | null>,
  /** 0 = local player, 1 = remote player (or vice versa for guest) */
  localPlayer: number = 0,
  remotePlayer: number = 1,
): EmulatorRuntimeBridge {
  return {
    input: {
      simulateLocalInput(player: number, button: number, value: number) {
        const ejs = getEJSEmulator();
        ejs?.gameManager.simulateInput(player, button, value);
      },
      sendRemoteInput(button: number, down: boolean) {
        const ejs = getEJSEmulator();
        ejs?.gameManager.simulateInput(remotePlayer, button, down ? 1 : 0);
      },
    },
    sync: {
      getSaveState(): ArrayBuffer | null {
        try {
          const ejs = getEJSEmulator();
          if (!ejs) return null;
          const state = ejs.gameManager.getState();
          const buf = (state as unknown as { buffer?: ArrayBuffer }).buffer ?? state;
          if (buf instanceof ArrayBuffer && buf.byteLength > 0) return buf;
          if (ArrayBuffer.isView(buf) && buf.byteLength > 0) return (buf as Uint8Array).buffer as ArrayBuffer;
          return null;
        } catch (e) {
          console.warn("[BRIDGE] getSaveState failed:", e);
          return null;
        }
      },
      loadSaveState(state: ArrayBuffer): boolean {
        try {
          const ejs = getEJSEmulator();
          if (!ejs) return false;
          ejs.gameManager.loadState(new Uint8Array(state));
          return true;
        } catch (e) {
          console.warn("[BRIDGE] loadSaveState failed:", e);
          return false;
        }
      },
      getResyncState(): ArrayBuffer | null {
        try {
          const ejs = getEJSEmulator();
          if (!ejs) return null;
          ejs.pause();
          const state = ejs.gameManager.getState();
          const buf = (state as unknown as { buffer?: ArrayBuffer }).buffer ?? state;
          ejs.play();
          if (buf instanceof ArrayBuffer && buf.byteLength > 0) return buf;
          if (ArrayBuffer.isView(buf) && buf.byteLength > 0) return (buf as Uint8Array).buffer as ArrayBuffer;
          return null;
        } catch (e) {
          console.warn("[BRIDGE] getResyncState failed:", e);
          try { getEJSEmulator()?.play(); } catch { /* */ }
          return null;
        }
      },
      loadResyncState(state: ArrayBuffer): boolean {
        try {
          const ejs = getEJSEmulator();
          if (!ejs) return false;
          ejs.pause();
          ejs.gameManager.loadState(new Uint8Array(state));
          ejs.play();
          return true;
        } catch (e) {
          console.warn("[BRIDGE] loadResyncState failed:", e);
          try { getEJSEmulator()?.play(); } catch { /* */ }
          return false;
        }
      },
      startGame() {
        const ejs = getEJSEmulator();
        ejs?.play();
      },
      pause() {
        const ejs = getEJSEmulator();
        ejs?.pause();
      },
      play() {
        const ejs = getEJSEmulator();
        ejs?.play();
      },
    },
    capture: {
      getCaptureStream(fps = 60): MediaStream | null {
        const canvas = findEmulatorCanvas(containerRef);
        if (!canvas) return null;
        try {
          return canvas.captureStream(fps);
        } catch (e) {
          console.warn("[BRIDGE] captureStream failed:", e);
          return null;
        }
      },
      getAudioStream(): MediaStream | null {
        return captureAudioFromEJS();
      },
    },
    ui: {
      focus() {
        containerRef.current?.focus();
      },
    },
    getEmulator(): EJSEmulatorInstance | null {
      return getEJSEmulator();
    },
  };
}


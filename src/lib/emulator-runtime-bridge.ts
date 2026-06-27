import type { RefObject } from "react";

import type { EJSEmulatorInstance } from "../../shared/emulator-protocol";

/**
 * React DOM에서 직접 실행되는 EmulatorJS와의 런타임 연결 계층.
 * 이전에 iframe postMessage 방식을 대체하며, 직접 `window.EJS_emulator` / `gameManager`를 호출한다.
 */

export interface EmulatorRuntimeBridge {
  input: {
    /** 로컀 플레이어의 에뮬레이터 입력을 시뮬레이션한다. */
    simulateLocalInput: (player: number, button: number, value: number) => void;
    /** 원격 플레이어(원개임 HOST)의 입력을 에뮬레이터에 전달한다. GUEST에서 호출한다. */
    sendRemoteInput: (button: number, down: boolean) => void;
  };
  sync: {
    /** 에뮬레이터를 시작(재개)시킨다. HOST가 게임 시작 신호를 받았을 때 호출한다. */
    startGame: () => void;
  };
  capture: {
    /**
     * 에뮬레이터 캔버스에서 MediaStream을 캡처한다.
     * @param fps - 추출 프레임레이트 (0이면 수동 requestFrame)
     */
    getCaptureStream: (fps?: number) => MediaStream | null;
    /** EmulatorJS의 AudioContext에서 오디오 MediaStream을 캡처한다. */
    getAudioStream: () => MediaStream | null;
  };
  ui: {
    /** 에뮬레이터 컨테이너에 포커스를 설정한다. */
    focus: () => void;
  };
  /** 에뮬레이터 인스턴스(`window.EJS_emulator`)를 반환한다. 초기화 전이라면 `null`. */
  getEmulator: () => EJSEmulatorInstance | null;
}

type EmulatorContainerTarget = RefObject<HTMLDivElement | null> | (() => HTMLDivElement | null);

function getEJSEmulator(): EJSEmulatorInstance | null {
  const ejs = (window as unknown as Record<string, unknown>).EJS_emulator as
    | EJSEmulatorInstance
    | undefined;
  if (!ejs?.gameManager) return null;
  return ejs;
}

function getContainerElement(target: EmulatorContainerTarget): HTMLDivElement | null {
  return typeof target === "function" ? target() : target.current;
}

function findEmulatorCanvas(target: EmulatorContainerTarget): HTMLCanvasElement | null {
  const container = getContainerElement(target);
  if (!container) return null;
  return container.querySelector("canvas");
}

/**
 * EmulatorJS의 AudioContext를 색인하여 오디오 MediaStream을 캡처하려 시도한다.
 * `window.__rtcade_audio_splitter`가 EmulatorPlayer에서 사전 설치되어 있어야 실제 오디오를 얻을 수 있다.
 * @returns 오디오 MediaStream 또는 `null`
 */
function captureAudioFromEJS(): MediaStream | null {
  try {
    const ejs = getEJSEmulator();
    if (!ejs) return null;

    // EmulatorJS는 에뮬레이터 인스턴스 또는 전역에 AudioContext를 저장한다.
    // 알려진 경로를 순서대로 탐색한다.
    const runtime = ejs as unknown as Record<string, unknown>;

    // 경로 1: EJS_emulator.Module.SDL2.audioContext (Emscripten SDL2 오디오)
    const module = runtime.Module as Record<string, unknown> | undefined;
    const sdl2 = module?.SDL2 as Record<string, unknown> | undefined;
    let audioCtx = sdl2?.audioContext as AudioContext | undefined;

    // 경로 2: audioContext 직접 프로퍼티
    if (!audioCtx) {
      audioCtx = runtime.audioContext as AudioContext | undefined;
    }

    // 경로 3: Emscripten 모듈 내부에서 AudioContext 실뢰 탐색
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

    // 오디오 캡처를 위해 EmulatorPlayer에서 사전에 설치한 splitter 노드를 확인한다.
    const splitter = (window as unknown as Record<string, unknown>).__rtcade_audio_splitter as
      | {
          stream: MediaStream;
        }
      | undefined;
    if (splitter?.stream) {
      return splitter.stream;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * EmulatorRuntimeBridge 인스턴스를 생성한다.
 * 동일한 `containerTarget`에 대해 여러 번 호출해도 안전하다.
 * @param containerTarget - 에뮬레이터가 마운트된 DOM 컨테이너 (React ref 또는 getter 함수)
 * @param _localPlayer - 로컀 플레이어 인덱스 (0 기본값, 현재 미사용)
 * @param remotePlayer - 원격 플레이어 인덱스 (GUEST 입력 수신 시 적용되는 슬롯)
 * @returns EmulatorRuntimeBridge 인터페이스 객체
 */
export function createEmulatorRuntimeBridge(
  containerTarget: EmulatorContainerTarget,
  /** 0 = local player, 1 = remote player (or vice versa for guest) */
  _localPlayer: number = 0,
  remotePlayer: number = 1,
): EmulatorRuntimeBridge {
  void _localPlayer;

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
      startGame() {
        const ejs = getEJSEmulator();
        ejs?.play();
      },
    },
    capture: {
      getCaptureStream(fps = 60): MediaStream | null {
        const canvas = findEmulatorCanvas(containerTarget);
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
        getContainerElement(containerTarget)?.focus();
      },
    },
    getEmulator(): EJSEmulatorInstance | null {
      return getEJSEmulator();
    },
  };
}

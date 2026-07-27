/**
 * MameWrapper — 순수 MAME 2003+ libretro WASM 래퍼
 *
 * EmulatorJS UI 없이 mame2003_plus_libretro.wasm 코어만 직접 구동한다.
 * ArcadeWrapper와 동일한 IArcade 인터페이스를 구현.
 */
import type { ArcadeGameInfo } from "./types";

// Per-button → libretro RETRO_DEVICE_JOYPAD index (MAME 2003+)
const BTN_TO_RETRO: Record<number, number> = {
  0: 1,  // A     → RETRO_DEVICE_ID_JOYPAD_B
  1: 3,  // D     → RETRO_DEVICE_ID_JOYPAD_Y
  2: 8,  // Sel   → RETRO_DEVICE_ID_JOYPAD_SELECT
  3: 9,  // Start → RETRO_DEVICE_ID_JOYPAD_START
  4: 4,  // UP    → RETRO_DEVICE_ID_JOYPAD_UP
  5: 5,  // DOWN  → RETRO_DEVICE_ID_JOYPAD_DOWN
  6: 6,  // LEFT  → RETRO_DEVICE_ID_JOYPAD_LEFT
  7: 7,  // RIGHT → RETRO_DEVICE_ID_JOYPAD_RIGHT
  8: 0,  // S     → RETRO_DEVICE_ID_JOYPAD_A
  9: 2,  // F     → RETRO_DEVICE_ID_JOYPAD_X
  10: 10, // Q    → RETRO_DEVICE_ID_JOYPAD_L
  11: 11, // E    → RETRO_DEVICE_ID_JOYPAD_R
};

interface MameModule {
  callMain(args: string[]): void;
  _simulate_input(player: number, button: number, value: number): void;
  _toggleMainLoop(pause: number): void;
  _system_restart(): void;
  _load_state(slot: string, type: number): number;
  FS: { mkdir(p: string): void; writeFile(p: string, d: Uint8Array): void; readFile(p: string): Uint8Array; unlink(p: string): void };
  EmulatorJSGetState?: () => number;
  getMemoryData?: () => Uint8Array;
  canvas: HTMLCanvasElement;
  AL?: { currentCtx: AudioContext };
  delete: () => void;
}

type EJSInitFn = (opts: Record<string, unknown>) => Promise<MameModule>;

export class MameWrapper {
  private _module: MameModule | null = null;
  private _canvas: HTMLCanvasElement | null = null;
  private _gameInfo: ArcadeGameInfo = { width: 320, height: 224, vidBits: 16, rotateGame: 0, flipped: false, fps: 60, aspectX: 4, aspectY: 3 };
  private _frameNum = 0;
  private _paused = false;
  private _lastInput = [0, 0];

  get width() { return this._gameInfo.width; }
  get height() { return this._gameInfo.height; }
  get gameInfo() { return this._gameInfo; }
  get frameNum() { return this._frameNum; }
  get canvas() { return this._canvas; }

  async loadRom(bytes: Uint8Array, filename: string): Promise<ArcadeGameInfo> {
    const mod = this._module;
    if (!mod) throw new Error("MameWrapper: module not initialized — call setInit first");

    const romName = filename.replace(/\.(zip|ZIP)$/, "");
    mod.FS.mkdir("/data");
    mod.FS.mkdir("/data/roms");
    mod.FS.writeFile(`/data/roms/${romName}.zip`, bytes);

    // Write retroarch.cfg
    const cfg = "video_driver = \"gl\"\naudio_driver = \"openal\"\ninput_driver = \"rwebinput\"\n";
    mod.FS.writeFile("/data/retroarch.cfg", new TextEncoder().encode(cfg));

    mod.callMain([`/data/roms/${romName}.zip`]);
    this._frameNum = 0;
    return this._gameInfo;
  }

  setInit(initFn: () => Promise<{ default: EJSInitFn }>, wasmURL: string, canvas: HTMLCanvasElement): void {
    this._canvas = canvas;
    const self = this;
    const modPromise = initFn().then((m) => m.default({
      canvas,
      noInitialRun: true,
      arguments: [] as string[],
      locateFile: (path: string) => path.endsWith(".wasm") ? wasmURL : path,
      preRun: [(mod: MameModule) => {
        // FS is ready, set up RetroArch directories
        try {
          mod.FS.mkdir("/data");
        } catch { /* exists */ }
      }],
    }));

    // Store as promise — loadRom awaits it
    this._module = null as unknown as MameModule;
    modPromise.then((m) => {
      self._module = m;
    });
  }

  clockFrame(): number {
    if (this._paused) return this._frameNum;
    const mod = this._module;
    if (!mod) return 0;
    // RetroArch runs its own loop — we just count frames via rAF
    return ++this._frameNum;
  }

  setInput(player: number, mask: number): void {
    if (player < 0 || player > 1) return;
    const prev = this._lastInput[player] ?? 0;
    const mod = this._module;

    for (let btn = 0; btn < 12; btn++) {
      const bit = 1 << btn;
      const wasDown = (prev & bit) !== 0;
      const isDown = (mask & bit) !== 0;
      if (wasDown !== isDown && mod) {
        const retroBtn = BTN_TO_RETRO[btn];
        if (retroBtn !== undefined) {
          mod._simulate_input(player, retroBtn, isDown ? 1 : 0);
        }
      }
    }
    this._lastInput[player] = mask;
  }

  getFrameBuffer(): Uint8ClampedArray {
    // RetroArch renders to WebGL canvas — no direct pixel buffer.
    // Use canvas.captureStream() instead.
    return new Uint8ClampedArray();
  }

  getAudioSamples(): Int16Array {
    // Audio handled via RetroArch's OpenAL/WebAudio — no direct buffer.
    return new Int16Array();
  }

  reset(): void {
    this._module?._system_restart();
  }

  destroy(): void {
    try { this._module?.delete(); } catch { /* ignore */ }
    this._module = null;
    this._canvas = null;
  }
}

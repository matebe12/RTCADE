/**
 * ArcadeWrapper — @mantou/fbneo WASM 래퍼 클래스
 *
 * nesbox의 Arcade 클래스(https://github.com/mantou132/nesbox/blob/dev/packages/arcade/src/index.ts)
 * 구현을 기반으로, GGPO 롤백 넷플레이에 필요한 API를 제공한다.
 *
 * 주요 기능:
 * - ROM 로딩 및 초기화
 * - 프레임 단위 실행 (clockFrame)
 * - 상태 저장/복원 (saveState / loadState)
 * - 입력 비트마스크 설정 (setInput)
 * - 프레임 버퍼 접근 (getFrameBuffer)
 * - 오디오 출력 (getAudioSamples)
 */

import type { ArcadeGameInfo, FBNeoInitFn, FBNeoModule } from "./types";
import { Controllers } from "./input";

/** 16비트 정수 최대값 */
const INT16_MAX = 2 ** 15 - 1;

  /** 아케이드 클래스 인터페이스 */
export interface IArcade {
  /** BIOS 로드 (Neo Geo 필수 — 게임 ROM보다 먼저 호출) */
  loadBios?(bytes: Uint8Array, filename: string): void;
  /** ROM 로드 */
  loadRom(bytes: Uint8Array, filename: string): Promise<ArcadeGameInfo>;
  /** 한 프레임 실행 (입력 수집 + 에뮬레이션 + 렌더링) */
  clockFrame(): number;
  /** 특정 플레이어 입력 설정 */
  setInput(player: number, mask: number): void;
  /** 현재 프레임 번호 */
  get frameNum(): number;
  /** 현재 게임 정보 */
  get gameInfo(): ArcadeGameInfo | null;
  /** 게임 너비 (픽셀) */
  get width(): number;
  /** 게임 높이 (픽셀) */
  get height(): number;
  /** WASM 변형 */
  get variant(): "arcade" | "neogeo" | "konami";
  /** RGBA 프레임 버퍼 (Uint8ClampedArray, width*height*4) */
  getFrameBuffer(): Uint8ClampedArray;
  /** 오디오 출력 콜백 (샘플링된 오디오 데이터) */
  getAudioSamples(): Int16Array;
  /** 상태 저장 (세이브스테이트) */
  saveState(): Uint8Array;
  /** 상태 복원 (로드스테이트) */
  loadState(state: Uint8Array): void;
  /** 롤백 후 프레임 카운터 설정 */
  setFrameNum(n: number): void;
  /** 리셋 */
  reset(): void;
  /** 리소스 정리 */
  destroy(): void;
}

/** ArcadeWrapper 생성 옵션 */
export interface ArcadeWrapperOptions {
  /** 특정 WASM 변형 선택 (기본: arcade) */
  variant?: "arcade" | "neogeo" | "konami";
  /** 오디오 출력 콜백 */
  onAudio?: (left: Float32Array, right: Float32Array) => void;
  /** 프레임 렌더링 콜백 (기본: 내부 버퍼에 저장) */
  onFrame?: (frame: Uint8ClampedArray, width: number, height: number) => void;
}

export class ArcadeWrapper implements IArcade {
  // ---- 게임 메타데이터 ----
  private _gameInfo: ArcadeGameInfo | null = null;

  // ---- 프레임 버퍼 ----
  private _frameBuffer = new Uint8ClampedArray();
  private _width = 0;
  private _height = 0;
  private _vidBits: 16 | 32 = 32;

  // ---- 오디오 ----
  private _audioBuffer = new Int16Array();
  private _onAudio?: (left: Float32Array, right: Float32Array) => void;

  // ---- FBNeo 모듈 ----
  private _fbneo: FBNeoModule | undefined;
  private _statePath = "";

  // ---- 프레임 카운터 ----
  private _frameNum = 0;

  // ---- 입력 ----
  private _controllers = new Controllers(2);

  // ---- 초기화 ----
  private _initFn: FBNeoInitFn | null = null;
  private _wasmURL = "";
  private _variant: "arcade" | "neogeo" | "konami";
  private _biosBuffer: { bytes: Uint8Array; filename: string } | null = null;
  private _romFilename: string | null = null;

  constructor(options: ArcadeWrapperOptions = {}) {
    this._variant = options.variant ?? "arcade";
    this._onAudio = options.onAudio;
  }

  // ──────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────

  /**
   * FBNeo WASM 이니셜라이저를 설정한다.
   * `loadRom` 호출 전에 반드시 호출해야 한다.
   */
  setInit(initFn: FBNeoInitFn, wasmURL: string): void {
    this._initFn = initFn;
    this._wasmURL = wasmURL;
  }

  /**
   * BIOS 파일을 Emscripten 가상 FS에 미리 넣는다.
   * Neo Geo 게임 실행 전에 반드시 `neogeo.zip`을 로드해야 한다.
   * `loadRom()`보다 먼저 호출해야 한다 (WASM init 후).
   *
   * @param bytes BIOS zip 파일의 Uint8Array
   * @param filename BIOS 파일명 (예: "neogeo")
   */
  loadBios(bytes: Uint8Array, filename: string): void {
    if (this._fbneo) {
      // WASM이 이미 초기화됐으면 바로 FS에 쓴다
      this._fbneo.FS.mkdir("roms");
      this._fbneo.FS.writeFile(`roms/${filename}.zip`, bytes);
    } else {
      // WASM init 전이면 버퍼만 저장해두고 loadRom에서 처리
      this._biosBuffer = { bytes, filename };
    }
  }

  /**
   * ROM을 로드하고 FBNeo를 초기화한다.
   * @param bytes ROM zip 파일의 Uint8Array
   * @param filename ROM 파일명 (예: "kof97")
   * @returns 게임 메타데이터 (해상도, 비트뎁스 등)
   */
  async loadRom(bytes: Uint8Array, filename: string): Promise<ArcadeGameInfo> {
    if (!this._initFn) {
      throw new Error("ArcadeWrapper: setInit() must be called before loadRom()");
    }

    const initFn = this._initFn;
    const wasmURL = this._wasmURL;

    // ROM 로딩 완료 대기용 Promise
    let resolveRomProps: (value: ArcadeGameInfo) => void;
    const romPropsReady = new Promise<ArcadeGameInfo>((resolve) => {
      resolveRomProps = resolve;
    });

    // 이미 초기화된 모듈이 있으면 재사용
    if (!this._fbneo) {
      this._fbneo = await initFn({
        start: () => {
          // startMain 호출은 loadRom 내부에서 처리
        },
        locateFile: (path, prefix) => {
          if (path.endsWith(".wasm")) return wasmURL;
          return prefix + path;
        },
        setRomProps: (width, height, _rotateGame, flipped, vidImageDepth, fps, aspectX, aspectY) => {
          const info: ArcadeGameInfo = {
            width,
            height,
            vidBits: vidImageDepth === 16 ? 16 : 32,
            rotateGame: _rotateGame,
            flipped,
            fps,
            aspectX,
            aspectY,
          };
          this._width = width;
          this._height = height;
          this._vidBits = vidImageDepth === 16 ? 16 : 32;
          this._gameInfo = info;
          resolveRomProps(info);
        },
        setVisibleSize: () => { /* no-op */ },
        setAspectRatio: () => { /* no-op */ },
        audioCallback: (soundPtr, length) => {
          this._audioBuffer = new Int16Array(this._fbneo!.HEAP16.buffer as ArrayBuffer, soundPtr, length);
          if (this._onAudio) {
            const sampleCount = length / 2;
            const left = new Float32Array(sampleCount);
            const right = new Float32Array(sampleCount);
            for (let i = 0; i < sampleCount; i++) {
              left[i] = this._audioBuffer[2 * i] / INT16_MAX;
              right[i] = this._audioBuffer[2 * i + 1] / INT16_MAX;
            }
            this._onAudio(left, right);
          }
        },
        drawScreen: (vidImagePtr) => {
          this.renderFrame(vidImagePtr);
        },
        // ──── FBNeo가 기대하는 아카이브/파일/입력 콜백 ────
        addArchive: () => { /* no-op */ },
        addFile: () => { /* no-op */ },
        addInput: () => { /* no-op */ },
      });
    }

    const fbneo = this._fbneo;

    // 상태 파일 경로
    this._statePath = `/libsdl/fbneo/states/${filename}.fs.all`;

    // ROM 파일을 가상 FS에 쓰기 전에 BIOS가 있으면 먼저 쓴다
    fbneo.FS.mkdir("roms");
    if (this._biosBuffer) {
      fbneo.FS.writeFile(`roms/${this._biosBuffer.filename}.zip`, this._biosBuffer.bytes);
      this._biosBuffer = null; // consume once
    }
    fbneo.FS.writeFile(`roms/${filename}.zip`, bytes);
    this._romFilename = filename;

    // 에뮬레이터 시작 (startMain 호출)
    const startMain = fbneo.cwrap("startMain", "number", ["string"]);
    startMain(filename);

    // ROM 정보 수신 대기
    const gameInfo = await romPropsReady;

    // 컨트롤러 초기화
    this._controllers = new Controllers(2);

    return gameInfo;
  }

  /**
   * 한 프레임을 실행한다.
   * 1. 입력 수집 (_collectGameInputs)
   * 2. 에뮬레이션 실행 (_doLoop)
   * 3. 프레임 번호 증가
   *
   * @returns 현재 프레임 번호 (증가 후)
   */
  clockFrame(): number {
    if (!this._fbneo) return 0;

    // 모든 플레이어의 현재 입력을 FBNeo에 전달
    for (let p = 0; p < 2; p++) {
      this._fbneo._setEmInput(p, this._controllers.getMask(p));
    }

    // 한 프레임 실행
    this._fbneo._collectGameInputs();
    this._fbneo._doLoop();

    // 내부 프레임 카운터 증가 (FBNeo WASM에는 getFrameNum export가 없음)
    return ++this._frameNum;
  }

  /**
   * 특정 플레이어의 입력 비트마스크를 설정한다.
   * @param player 0 = 1P, 1 = 2P
   * @param mask 12비트 입력 마스크
   */
  setInput(player: number, mask: number): void {
    this._controllers.setMask(player, mask);
  }

  /** 현재 프레임 번호 */
  get frameNum(): number {
    return this._frameNum;
  }

  /** 현재 WASM 변형 */
  get variant(): "arcade" | "neogeo" | "konami" {
    return this._variant;
  }

  /** 현재 게임 메타데이터 */
  get gameInfo(): ArcadeGameInfo | null {
    return this._gameInfo;
  }

  /** 게임 너비 */
  get width(): number {
    return this._width;
  }

  /** 게임 높이 */
  get height(): number {
    return this._height;
  }

  /**
   * 현재 RGBA 프레임 버퍼를 반환한다.
   * Uint8ClampedArray, 길이 = width * height * 4
   */
  getFrameBuffer(): Uint8ClampedArray {
    return this._frameBuffer;
  }

  /**
   * 최신 오디오 샘플을 반환한다.
   * Int16Array, 인터리브드 스테레오 (L,R,L,R...)
   */
  getAudioSamples(): Int16Array {
    return this._audioBuffer;
  }

  /**
   * 현재 게임 상태를 저장하여 Uint8Array로 반환한다.
   * GGPO 롤백의 상태 스냅샷으로 사용된다.
   */
  saveState(): Uint8Array {
    if (!this._fbneo) {
      throw new Error("ArcadeWrapper: FBNeo not initialized");
    }
    this._fbneo._saveAllState(1);
    return this._fbneo.FS.readFile(this._statePath);
  }

  /**
   * 저장된 게임 상태를 복원한다.
   * GGPO 롤백 시 이전 상태로 되돌릴 때 사용된다.
   */
  loadState(state: Uint8Array): void {
    if (!this._fbneo) {
      throw new Error("ArcadeWrapper: FBNeo not initialized");
    }
    this._fbneo.FS.writeFile(this._statePath, state);
    this._fbneo._saveAllState(0);
    // NOTE: _frameNum은 GGPOEngine이 setFrameNum()으로 직접 설정한다 (리셋하지 않음)
  }

  /** 롤백 등으로 상태 로드 후 프레임 카운터를 직접 설정한다 */
  setFrameNum(n: number): void {
    this._frameNum = n;
  }

  /**
   * 에뮬레이터를 리셋한다.
   */
  reset(): void {
    if (!this._fbneo || !this._romFilename) return;
    this._frameNum = 0;
    // Re-run the ROM from the beginning
    const startMain = this._fbneo.cwrap("startMain", "number", ["string"]);
    startMain(this._romFilename);
    this._controllers.reset();
  }

  /**
   * 리소스를 정리한다.
   */
  destroy(): void {
    this._fbneo = undefined;
    this._gameInfo = null;
    this._frameBuffer = new Uint8ClampedArray();
    this._audioBuffer = new Int16Array();
    this._controllers.reset();
  }

  // ──────────────────────────────────────────────
  // Private
  // ──────────────────────────────────────────────

  /**
   * FBNeo drawScreen 콜백에서 호출된다.
   * HEAP으로부터 RGBA 픽셀 데이터를 읽어 내부 버퍼에 저장한다.
   */
  private renderFrame(vidImagePtr: number): void {
    if (!this._fbneo) return;

    const pixelCount = this._width * this._height;
    this._frameBuffer = new Uint8ClampedArray(pixelCount * 4);

    if (this._vidBits === 16) {
      // 16비트 컬러 → RGBA 변환 (RGB565)
      const src = new Uint8Array(this._fbneo.HEAP8.buffer, vidImagePtr, pixelCount * 2);
      const dst = this._frameBuffer;
      for (let i = 0; i < pixelCount; i++) {
        const offset = i * 2;
        const color = ((src[offset + 1] << 8) & 0xff00) | (src[offset] & 0xff);
        const dstOffset = i * 4;
        dst[dstOffset] = ((color >> 11) & 0x1f) << 3; // R
        dst[dstOffset + 1] = ((color >> 5) & 0x3f) << 2; // G
        dst[dstOffset + 2] = (color & 0x1f) << 3; // B
        dst[dstOffset + 3] = 255; // A
      }
    } else {
      // 32비트 컬러 → RGBA 변환 (BGRA → RGBA)
      const src = new Uint8Array(this._fbneo.HEAP8.buffer, vidImagePtr, pixelCount * 4);
      const dst = this._frameBuffer;
      for (let i = 0; i < pixelCount; i++) {
        const offset = i * 4;
        const dstOffset = i * 4;
        dst[dstOffset] = src[offset + 2]; // B → R
        dst[dstOffset + 1] = src[offset + 1]; // G → G
        dst[dstOffset + 2] = src[offset]; // R → B
        dst[dstOffset + 3] = 255; // A
      }
    }
  }
}
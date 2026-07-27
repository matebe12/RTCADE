/**
 * FBNeo WASM 타입 정의
 *
 * @mantou/fbneo의 Emscripten 런타임 모듈과의 상호작용을 위한
 * 최소 서브셋 타입을 정의한다.
 */

/** Emscripten 모듈 인스턴스 (`init()` 반환값) */
export interface FBNeoModule {
  /** HEAP8 버퍼 (Int8Array) */
  HEAP8: Int8Array;
  /** HEAP16 버퍼 (Int16Array) */
  HEAP16: Int16Array;
  /** Emscripten 가상 파일시스템 */
  FS: {
    mkdir(path: string): void;
    writeFile(path: string, data: Uint8Array): void;
    readFile(path: string): Uint8Array;
  };
  /** C 함수 래핑 */
  cwrap<T extends (...args: unknown[]) => unknown>(
    ident: string,
    returnType: string,
    argTypes: string[],
  ): T;
  /** C 함수 직접 호출 */
  ccall(ident: string, returnType: string, argTypes: string[], args: unknown[]): unknown;
  /** 에뮬레이터 시작 (내부 main loop) */
  start(): void;
  /** 로우레벨: C 함수 직접 접근 */
  _collectGameInputs(): void;
  _doLoop(): void;
  _setEmInput(player: number, inputMask: number): void;
  /** 상태 저장: 1=저장, 0=복원 */
  _saveAllState(direction: number): void;
}

/** FBNeo 초기화 옵션 */
export interface FBNeoInitOptions {
  /** 메인 루프 시작 콜백 */
  start: () => void;
  /** WASM 파일 경로 지정 */
  locateFile: (path: string, prefix: string) => string;
  /** ROM 해상도 정보 수신 */
  setRomProps: (
    width: number,
    height: number,
    rotateGame: number,
    flipped: boolean,
    vidImageDepth: number,
    nBurnFPS: number,
    aspectX: number,
    aspectY: number,
  ) => void;
  /** 가시 영역 설정 */
  setVisibleSize: (pnWidth: number, pnHeight: number) => void;
  /** 화면비 설정 */
  setAspectRatio: (pnXAspect: number, pnYAspect: number) => void;
  /** 오디오 콜백 (Int16Array 포인터 + 샘플 수) */
  audioCallback: (soundPtr: number, length: number) => void;
  /** 화면 그리기 콜백 (RGBA 픽셀 포인터) */
  drawScreen: (vidImagePtr: number) => void;
  /** ROM 파일 추가 콜백 */
  addFile?: (romName: string, nType: number, nRet: number) => void;
  /** 입력 장치 이름 콜백 */
  addInput?: (szName: string, key: number) => void;
  /** 아카이브 추가 콜백 */
  addArchive?: (szName: string, szFullName: string, bFound: boolean) => void;
}

/** FBNeo init 함수 타입 */
export type FBNeoInitFn = (options: FBNeoInitOptions) => Promise<FBNeoModule>;

/** 게임 ROM 메타데이터 */
export interface ArcadeGameInfo {
  width: number;
  height: number;
  vidBits: 16 | 32;
  rotateGame: number;
  flipped: boolean;
  fps: number;
  aspectX: number;
  aspectY: number;
}

/** 오디오 출력 콜백 */
export type AudioOutputCallback = (left: Float32Array, right: Float32Array) => void;
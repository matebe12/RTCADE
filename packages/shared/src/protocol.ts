/**
 * RTCADE 공통 프로토콜
 *
 * 키 매핑, 하트비트 상수, 세션 역할 등 클라이언트와 서버 양쪽에서
 * 공유하는 상수 및 타입을 정의한다.
 */

/* ---------- 키보드 키 → EmulatorJS 버튼 번호 매핑 (HOST와 GUEST 공유) ---------- */

export const KEY_TO_BUTTON: Record<string, number> = {
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

/** 기본 키보드 핸들러를 차단해야 하는 키 목록 */
export const BLOCKED_KEYS: ReadonlySet<string> = new Set([
  "KeyZ",
  "KeyX",
  "KeyC",
  "KeyV",
]);

/* ---------- FBNeo 입력 비트마스크 상수 ---------- */

export const INP_LEFT   = 1 << 0;
export const INP_RIGHT  = 1 << 1;
export const INP_UP     = 1 << 2;
export const INP_DOWN   = 1 << 3;
export const INP_START  = 1 << 4;
export const INP_SELECT = 1 << 5;
export const INP_B1     = 1 << 6;
export const INP_B2     = 1 << 7;
export const INP_B3     = 1 << 8;
export const INP_B4     = 1 << 9;
export const INP_B5     = 1 << 10;
export const INP_B6     = 1 << 11;

export const INP_DIRECTIONS = INP_LEFT | INP_RIGHT | INP_UP | INP_DOWN;

/** FBNeo WASM 변형 */
export type FBNeoVariant = "arcade" | "neogeo" | "konami";

/** FBNeo 게임 정보 */
export interface FBNeoGameInfo {
  width: number;
  height: number;
  vidBits: number;
  fps: number;
  aspectRatio: number;
}

/* ---------- 하트비트 / 연결 해제 프로토콜 ---------- */

export const HEARTBEAT_INTERVAL_MS = 5_000;
export const HEARTBEAT_WARN_TIMEOUT_MS = 15_000;
export const HEARTBEAT_DANGER_TIMEOUT_MS = 45_000;
export const HEARTBEAT_DISCONNECT_TIMEOUT_MS = 60_000;

export type DisconnectSeverity = "connected" | "warning" | "danger" | "disconnected";

/* ---------- 방 / 세션 ---------- */

export const MAX_SPECTATORS_PER_ROOM = 5;
export type NetplaySessionRole = "host" | "guest" | "spectator";

/* ---------- @deprecated EmulatorJS 전용 — FBNeo 교체 후 제거 ---------- */

export interface EJSGameManager {
  simulateInput(player: number, button: number, value: number): void;
  getState(): Uint8Array;
  loadState(state: Uint8Array): void;
}

export interface EJSEmulatorInstance {
  gameManager: EJSGameManager;
  play(): void;
  pause(): void;
}

export const CORE_REMAP: Record<string, string> = {
  mame2003: "mame2003_plus",
  arcade: "fbneo",
};

export const EJS_BUTTONS_CONFIG: Record<string, boolean> = {
  playPause: false, play: false, pause: false, restart: false,
  mute: false, unmute: false, settings: false, fullscreen: false,
  saveState: false, loadState: false, screenRecord: false,
  gamepad: false, cheat: false, volume: true,
  saveSavFiles: false, loadSavFiles: false, quickSave: false,
  quickLoad: false, screenshot: false, cacheManager: false, exitEmulation: false,
};

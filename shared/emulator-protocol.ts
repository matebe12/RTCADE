/**
 * Emulator Direct API Protocol
 *
 * EmulatorJS runs directly in the parent DOM (no iframe).
 * All communication is via direct function calls to window.EJS_emulator.
 * This file defines the typed interface for those interactions.
 */

/* ---------- EJS runtime types (minimal subset we depend on) ---------- */

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

/* ---------- Key-to-button mapping (shared between HOST and GUEST) ---------- */

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

/* ---------- EJS global config shape ---------- */

export interface EJSGlobalConfig {
  EJS_player: string;
  EJS_core: string;
  EJS_pathtodata: string;
  EJS_gameUrl: string;
  EJS_biosUrl?: string;
  EJS_color: string;
  EJS_startOnLoaded: boolean;
  EJS_language: string;
  EJS_disableAutoLang: boolean;
  EJS_gameID: number;
  EJS_ready: () => void;
  EJS_onGameStart?: () => void;
  EJS_Buttons: Record<string, boolean>;
  EJS_emulator?: EJSEmulatorInstance;
}

/* ---------- Core remap (shared between client and server) ---------- */

export const CORE_REMAP: Record<string, string> = {
  mame2003: "mame2003_plus",
  arcade: "fbneo",
};

/* ---------- EJS button visibility config ---------- */

export const EJS_BUTTONS_CONFIG: Record<string, boolean> = {
  playPause: false,
  play: false,
  pause: false,
  restart: false,
  mute: false,
  unmute: false,
  settings: false,
  fullscreen: false,
  saveState: false,
  loadState: false,
  screenRecord: false,
  gamepad: false,
  cheat: false,
  volume: true,
  saveSavFiles: false,
  loadSavFiles: false,
  quickSave: false,
  quickLoad: false,
  screenshot: false,
  cacheManager: false,
  exitEmulation: false,
};

/* ---------- Heartbeat / disconnect protocol (DataChannel control msgs) ---------- */

export const HEARTBEAT_INTERVAL_MS = 5_000;
export const HEARTBEAT_WARN_TIMEOUT_MS = 15_000;
export const HEARTBEAT_DANGER_TIMEOUT_MS = 45_000;
export const HEARTBEAT_DISCONNECT_TIMEOUT_MS = 60_000;

export type DisconnectSeverity = "connected" | "warning" | "danger" | "disconnected";

export const MAX_SPECTATORS_PER_ROOM = 10;

export type NetplaySessionRole = "host" | "guest" | "spectator";

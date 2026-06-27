/**
 * EmulatorJS 런타임 직접 연결 프로토콜
 *
 * EmulatorJS는 iframe 없이 부모 DOM 안에서 직접 실행된다.
 * 모든 통신은 `window.EJS_emulator` 전역 객체를 통한 직접 함수 호출로 이루어진다.
 * 이 파일은 해당 상호작용에 대한 타입 정의를 담고 있으며, 클라이언트와 서버 양쪽에서 공유한다.
 */

/* ---------- EJS 런타임 타입 (의존하는 최소 서브셋) ---------- */

/** EmulatorJS 게임 매니저 인터페이스. 입력 시뮬레이션과 저장 상태를 관리한다. */
export interface EJSGameManager {
  /** 지정한 플레이어의 버튼 입력을 시뮬레이션한다. */
  simulateInput(player: number, button: number, value: number): void;
  /** 현재 게임 상태를 바이트 배열로 반환한다 (세이브 스테이트). */
  getState(): Uint8Array;
  /** 바이트 배열로 게임 상태를 복원한다 (로드 스테이트). */
  loadState(state: Uint8Array): void;
}

/** EmulatorJS 에뮬레이터 인스턴스. `window.EJS_emulator`로 접근한다. */
export interface EJSEmulatorInstance {
  gameManager: EJSGameManager;
  /** 에뮬레이터를 재개한다. */
  play(): void;
  /** 에뮬레이터를 일시정지한다. */
  pause(): void;
}

/* ---------- 키보드 키 → 버튼 번호 매핑 (HOST와 GUEST 공유) ---------- */

/**
 * 키보드 키 코드를 에뮬레이터 버튼 번호로 매핑한다.
 * HOST가 직접 에뮬레이터에 입력을 전달할 때와
 * GUEST가 DataChannel로 입력 이벤트를 전송할 때 모두 이 매핑을 사용한다.
 */

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

/**
 * EmulatorJS가 기본으로 처리하지만 `KEY_TO_BUTTON`에 포함되지 않은 키 목록.
 * 이 키들은 EmulatorJS가 직접 처리하기 전에 `stopImmediatePropagation`과
 * `preventDefault`로 차단해야 한다. 그렇지 않으면 DataChannel을 거치지 않고
 * HOST 에뮬레이터에만 입력이 적용된다.
 */
export const BLOCKED_KEYS: ReadonlySet<string> = new Set([
  "KeyZ", // EmulatorJS default: button 1 (B)
  "KeyX", // EmulatorJS default: button 0 (A) — conflicts with our KeyA mapping
  "KeyC", // EmulatorJS default: button 2 in some cores
  "KeyV", // EmulatorJS default: button 3 in some cores
]);

/* ---------- EJS 전역 설정 형태 ---------- */

/** `window`에 주입하는 EmulatorJS 초기화 설정 객체의 타입. */

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

/* ---------- 코어 리맵 (클라이언트와 서버 공유) ---------- */

/**
 * ROM 코어 이름을 EmulatorJS 실제 코어 이름으로 변환하는 매핑.
 * 예: `mame2003` → `mame2003_plus`, `arcade` → `fbneo`
 */

export const CORE_REMAP: Record<string, string> = {
  mame2003: "mame2003_plus",
  arcade: "fbneo",
};

/* ---------- EJS 버튼 표시 설정 ---------- */

/** EmulatorJS UI에서 노출/숨길 버튼 항목을 지정하는 설정. RTCADE에서는 대부분 숨김 처리한다. */

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

/* ---------- 하트비트 / 연결 해제 프로토콜 (DataChannel 제어 메시지) ---------- */

/** HOST → GUEST 방향 하트비트 전송 간격 (밀리초). */
export const HEARTBEAT_INTERVAL_MS = 5_000;
/** 하트비트가 이 시간 이상 미수신 시 '경고' 상태로 전환 (밀리초). */
export const HEARTBEAT_WARN_TIMEOUT_MS = 15_000;
/** 하트비트가 이 시간 이상 미수신 시 '위험' 상태로 전환 (밀리초). */
export const HEARTBEAT_DANGER_TIMEOUT_MS = 45_000;
/** 하트비트가 이 시간 이상 미수신 시 연결 해제로 처리 (밀리초). */
export const HEARTBEAT_DISCONNECT_TIMEOUT_MS = 60_000;

/** GUEST 측 연결 상태 심각도. 하트비트 타임아웃에 따라 단계적으로 악화된다. */
export type DisconnectSeverity = "connected" | "warning" | "danger" | "disconnected";

/** 방 1개에 허용되는 최대 관전자 수. */
export const MAX_SPECTATORS_PER_ROOM = 5;

/** 넷플레이 참가자의 역할. */
export type NetplaySessionRole = "host" | "guest" | "spectator";

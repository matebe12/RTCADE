/**
 * GGPO 넷플레이 공통 타입 정의
 */

/**
 * GGPO 입력 메시지 — DataChannel "input"으로 전송
 */
export interface GGPOInputMessage {
  type: "input";
  /** 이 입력이 적용될 프레임 번호 */
  frameNum: number;
  /** 입력 비트마스크 (12비트) */
  inputMask: number;
  /** 시퀀스 번호 (패킷 순서 추적) */
  seq: number;
  /** 전송 시 performance.now() */
  sentAt: number;
}

/**
 * GGPO 제어 메시지 — DataChannel "control"으로 전송
 */
export type GGPOControlMessage =
  | { type: "peer-ready" }
  | { type: "start-signal" }
  | { type: "heartbeat"; ts: number }
  | { type: "init-state" } // 초기 상태 도착 알림 (payload는 binary로 전송)
  | { type: "frame-sync"; frameNum: number }
  | { type: "state-hash"; frameNum: number; hash: number };

/**
 * GGPO 엔진 설정
 */
export interface GGPOEngineConfig {
  /** 입력 지연 프레임 수 (네트워크 지연 흡수용) */
  delayFrames: number;
  /** 롤백 가능한 최대 프레임 수 (링 버퍼 크기) */
  maxHistoryFrames: number;
  /** 최대 롤백 깊이 (이 이상은 전체 리싱크) */
  maxRollbackFrames: number;
}

/**
 * GGPO 엔진 기본 설정
 */
export const DEFAULT_GGPO_CONFIG: GGPOEngineConfig = {
  delayFrames: 3,
  maxHistoryFrames: 60,
  maxRollbackFrames: 15,
};

/**
 * 입력 큐 항목
 */
export interface InputEntry {
  frameNum: number;
  localMask: number;
  remoteMask: number;
  remoteReceived: boolean;
  predicted: boolean;
}

/**
 * 상태 스냅샷 항목
 */
export interface StateSnapshot {
  frameNum: number;
  state: Uint8Array;
  sizeBytes: number;
}

/**
 * GGPO 세션 통계
 */
export interface GGPOSessionStats {
  /** 현재 프레임 번호 */
  currentFrame: number;
  /** 입력 지연 프레임 수 */
  delayFrames: number;
  /** 총 롤백 횟수 */
  totalRollbacks: number;
  /** 마지막 롤백 깊이 (프레임 수) */
  lastRollbackDepth: number | null;
  /** 예측 성공률 (예측 맞은 비율) */
  predictionAccuracy: number;
  /** 원격 입력 수신율 */
  remoteInputRate: number;
  /** 상태 스냅샷 평균 크기 (bytes) */
  avgStateSize: number;
  /** 네트워크 RTT (ms) */
  rttMs: number | null;
}

/**
 * GGPO 플레이어 역할
 */
export type GGPOPlayerRole = "host" | "guest";

/**
 * GGPO 세션 상태
 */
export type GGPOSessionState =
  | "idle"
  | "loading"
  | "syncing"
  | "playing"
  | "paused"
  | "disconnected";

/**
 * GGPO 이벤트
 */
export interface GGPOEventHandlers {
  /** 롤백 발생 시 */
  onRollback?: (fromFrame: number, toFrame: number) => void;
  /** 상태 불일치 감지 시 (심각한 경우) */
  onDesync?: (frameNum: number) => void;
  /** 세션 통계 업데이트 */
  onStats?: (stats: GGPOSessionStats) => void;
  /** 입력 전송 콜백 */
  onSendInput?: (frameNum: number, inputMask: number) => void;
  /** 프레임 렌더링 콜백 */
  onFrame?: (frameNum: number) => void;
}
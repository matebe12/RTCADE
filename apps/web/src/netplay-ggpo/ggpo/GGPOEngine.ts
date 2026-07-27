/**
 * GGPOEngine — GGPO 롤백 넷플레이 코어 엔진
 *
 * InputQueue, StateHistory, RollbackController를 조합하여
 * GGPO 방식의 넷플레이 루프를 실행한다.
 *
 * 사용법:
 * 1. init(arcade) 호출
 * 2. addRemoteInput(frameNum, mask)로 원격 입력 주입
 * 3. 매 프레임: tick(localInputMask) → 렌더링
 * 4. stats로 현재 통계 확인
 */

import type { IArcade } from "@rtcade/emulator";
import { InputQueue } from "./InputQueue";
import { StateHistory } from "./StateHistory";
import { RollbackController } from "./RollbackController";
import type {
  GGPOEngineConfig,
  GGPOEventHandlers,
  GGPOSessionStats,
} from "../types";
import { DEFAULT_GGPO_CONFIG } from "../types";

export class GGPOEngine {
  private arcade: IArcade | null = null;
  private inputQueue: InputQueue;
  private stateHistory: StateHistory;
  private rollbackController: RollbackController | null = null;
  private config: GGPOEngineConfig;
  private handlers: GGPOEventHandlers;

  private _frameNum = 0;
  private _started = false;
  private _playerIndex: 0 | 1 = 0; // 내가 1P면 0, 2P면 1

  constructor(config: Partial<GGPOEngineConfig> = {}, handlers: GGPOEventHandlers = {}) {
    this.config = { ...DEFAULT_GGPO_CONFIG, ...config };
    this.handlers = handlers;
    this.inputQueue = new InputQueue(this.config.delayFrames);
    this.stateHistory = new StateHistory(this.config.maxHistoryFrames);
  }

  /**
   * 아케이드 인스턴스와 연결하고 GGPO 엔진을 초기화한다.
   */
  init(arcade: IArcade, playerIndex: 0 | 1 = 0): void {
    this.arcade = arcade;
    this._playerIndex = playerIndex;
    this.rollbackController = new RollbackController(
      arcade,
      this.inputQueue,
      this.stateHistory,
      this.config,
      this.handlers,
      this._playerIndex,
    );
    this._frameNum = 0;
    this._started = false;
  }

  /**
   * 게임 시작 — 에뮬레이터의 프레임 카운터를 리셋하고 시작 상태를 저장한다.
   */
  start(): void {
    if (!this.arcade) {
      throw new Error("GGPOEngine: arcade not initialized");
    }
    this._started = true;
    this.arcade.reset();
    this._frameNum = 0;
    this.stateHistory.save(0, this.arcade.saveState());
  }

  /** GUEST용: reset 없이 주어진 상태로 시작 (HOST와 동기화된 상태) */
  startFromState(state: Uint8Array): void {
    if (!this.arcade) {
      throw new Error("GGPOEngine: arcade not initialized");
    }
    this._started = true;
    this.arcade.loadState(state);
    this._frameNum = 0;
    this.stateHistory.save(0, state);
  }

  /**
   * 원격 입력 수신 시 호출한다.
   * 내부적으로 InputQueue에 저장하고 필요시 롤백을 수행한다.
   *
   * @param frameNum 입력이 적용될 프레임 번호
   * @param mask 입력 비트마스크
   */
  addRemoteInput(frameNum: number, mask: number): void {
    this.rollbackController?.handleRemoteInput(frameNum, mask);
  }

  /**
   * 한 틱(프레임)을 진행한다.
   *
   * @param localMask 내 로컬 입력 마스크
   * @param renderFrame true면 drawScreen 콜백을 통해 렌더링한다
   * @returns 현재 프레임 번호
   */
  tick(localMask: number): number {
    if (!this.arcade || !this._started) return 0;

    // 1. 로컬 입력 저장
    this.inputQueue.addLocalInput(this._frameNum, localMask);

    // 2. delay frames 적용된 입력 조회
    const { localMask: effectiveLocal, remoteMask } =
      this.inputQueue.getInputs(this._frameNum);

    // 3. 에뮬레이터 한 프레임 실행
    this.arcade.setInput(this._playerIndex, effectiveLocal);
    this.arcade.setInput(this._playerIndex === 0 ? 1 : 0, remoteMask);

    this.arcade.clockFrame();
    this._frameNum = this.arcade.frameNum;

    // 4. 상태 스냅샷 저장
    const state = this.arcade.saveState();
    this.stateHistory.save(this._frameNum, state);

    // 5. 입력 전송 콜백
    this.handlers.onSendInput?.(this._frameNum, localMask);

    // 6. 프레임 콜백
    this.handlers.onFrame?.(this._frameNum);

    // 7. 주기적 통계 업데이트 (매 60프레임)
    if (this._frameNum % 60 === 0) {
      this.handlers.onStats?.(this.getStats());
    }

    return this._frameNum;
  }

  /**
   * 현재 GGPO 세션 통계를 반환한다.
   */
  getStats(): GGPOSessionStats {
    return {
      currentFrame: this._frameNum,
      delayFrames: this.config.delayFrames,
      totalRollbacks: this.rollbackController?.totalRollbacks ?? 0,
      lastRollbackDepth: this.rollbackController?.lastRollbackDepth ?? null,
      predictionAccuracy: this.inputQueue.getPredictionAccuracy(),
      remoteInputRate: this.inputQueue.getRemoteInputRate(this._frameNum),
      avgStateSize: this.stateHistory.avgSizeBytes,
      rttMs: null, // WebRTC 레이어에서 채움
    };
  }

  /**
   * 입력 지연 프레임 수를 동적으로 조정한다.
   */
  setDelayFrames(frames: number): void {
    this.config.delayFrames = Math.max(0, Math.min(10, frames));
    this.inputQueue.setDelayFrames(this.config.delayFrames);
  }

  /** 현재 프레임 번호 */
  get frameNum(): number {
    return this._frameNum;
  }

  /** 엔진이 시작되었는지 */
  get started(): boolean {
    return this._started;
  }

  /** 내 플레이어 인덱스 */
  get playerIndex(): 0 | 1 {
    return this._playerIndex;
  }

  /**
   * 엔진 정지 및 리셋
   */
  stop(): void {
    this._started = false;
    this.inputQueue.reset();
    this.stateHistory.reset();
    this.rollbackController?.reset();
  }

  /**
   * 모든 리소스 정리
   */
  destroy(): void {
    this.stop();
    this.arcade = null;
    this.rollbackController = null;
  }
}
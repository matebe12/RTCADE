/**
 * RollbackController — GGPO 롤백 검출 및 재시뮬레이션
 *
 * 원격 입력이 뒤늦게 도착하여 예측과 불일치할 경우,
 * 해당 프레임으로 롤백하고 그 시점부터 현재까지 재시뮬레이션한다.
 *
 * 주요 기능:
 * - 입력 불일치 감지
 * - 롤백 실행 (상태 복원 + 재시뮬레이션)
 * - 롤백 깊이 제한
 * - 재시뮬레이션 중 렌더링 스킵
 */

import type { IArcade } from "@rtcade/emulator";
import { InputQueue } from "./InputQueue";
import { StateHistory } from "./StateHistory";
import type { GGPOEngineConfig, GGPOEventHandlers } from "../types";

export class RollbackController {
  private arcade: IArcade;
  private inputQueue: InputQueue;
  private stateHistory: StateHistory;
  private config: GGPOEngineConfig;
  private handlers: GGPOEventHandlers;
  private _playerIndex: 0 | 1;

  private _totalRollbacks = 0;
  private _lastRollbackDepth = 0;
  private _isRollingBack = false;

  constructor(
    arcade: IArcade,
    inputQueue: InputQueue,
    stateHistory: StateHistory,
    config: GGPOEngineConfig,
    handlers: GGPOEventHandlers,
    playerIndex: 0 | 1 = 0,
  ) {
    this.arcade = arcade;
    this.inputQueue = inputQueue;
    this.stateHistory = stateHistory;
    this.config = config;
    this.handlers = handlers;
    this._playerIndex = playerIndex;
  }

  /** 총 롤백 횟수 */
  get totalRollbacks(): number {
    return this._totalRollbacks;
  }

  /** 마지막 롤백 깊이 */
  get lastRollbackDepth(): number {
    return this._lastRollbackDepth;
  }

  /**
   * 원격 입력 수신 시 호출된다.
   * 예측 불일치가 있으면 롤백을 수행한다.
   *
   * @param frameNum 원격 입력이 해당되는 프레임 번호
   * @param mask 실제 원격 입력 마스크
   * @returns 롤백이 발생했는지 여부
   */
  handleRemoteInput(frameNum: number, mask: number): boolean {
    const { mismatch } = this.inputQueue.addRemoteInput(frameNum, mask);

    if (!mismatch) return false;

    // 롤백 깊이 체크
    const currentFrame = this.arcade.frameNum;
    const rollbackDepth = currentFrame - frameNum;

    if (rollbackDepth > this.config.maxRollbackFrames) {
      // 너무 깊은 롤백 → 전체 리싱크 요청
      console.warn(
        `[RollbackController] rollback too deep (${rollbackDepth} > ${this.config.maxRollbackFrames}), requesting full resync`,
      );
      this.handlers.onDesync?.(currentFrame);
      return false;
    }

    // 롤백 실행
    this.performRollback(frameNum, currentFrame);
    return true;
  }

  /**
   * 롤백 실행
   * 1. 대상 프레임의 상태 스냅샷으로 복원
   * 2. 대상 프레임부터 현재 프레임까지 재시뮬레이션
   * 3. 결과 렌더링
   */
  private performRollback(fromFrame: number, toFrame: number): void {
    if (this._isRollingBack) return;

    this._isRollingBack = true;
    this._totalRollbacks++;
    this._lastRollbackDepth = toFrame - fromFrame;

    console.log(
      `[RollbackController] rollback #${this._totalRollbacks}: frame ${fromFrame} → ${toFrame} (depth: ${this._lastRollbackDepth})`,
    );

    // 1. 상태 복원
    const snapshot = this.stateHistory.get(fromFrame);
    if (!snapshot) {
      console.warn("[RollbackController] no snapshot for rollback frame, skipping");
      this._isRollingBack = false;
      return;
    }

    this.arcade.loadState(snapshot.state);
    this.arcade.setFrameNum(fromFrame);

    // 2. 재시뮬레이션 — playerIndex에 따라 local/remote 방향 정확히 매핑
    const remoteIndex: 0 | 1 = this._playerIndex === 0 ? 1 : 0;
    for (let f = fromFrame; f < toFrame; f++) {
      const { localMask, remoteMask } = this.inputQueue.getInputs(f);
      this.arcade.setInput(this._playerIndex, localMask);
      this.arcade.setInput(remoteIndex, remoteMask);
      this.arcade.clockFrame();
    }

    // 3. 마지막 프레임은 정상 렌더링
    this.handlers.onRollback?.(fromFrame, toFrame);

    this._isRollingBack = false;
  }

  /**
   * 이전 프레임으로 수동 롤백 (디버그 용도).
   */
  manualRollback(frameNum: number): void {
    const snapshot = this.stateHistory.get(frameNum);
    if (!snapshot) {
      console.warn("[RollbackController] no snapshot for manual rollback");
      return;
    }
    this.arcade.loadState(snapshot.state);
  }

  reset(): void {
    this._totalRollbacks = 0;
    this._lastRollbackDepth = 0;
    this._isRollingBack = false;
  }
}
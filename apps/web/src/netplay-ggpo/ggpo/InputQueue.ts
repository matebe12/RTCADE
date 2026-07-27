/**
 * InputQueue — GGPO 입력 버퍼
 *
 * 각 프레임에 대한 HOST/GUEST의 입력을 저장하고 관리한다.
 * delay frames만큼 지연된 시점의 원격 입력을 조회한다.
 *
 * 주요 기능:
 * - 프레임별 로컬 입력 저장
 * - 원격 입력 수신 및 저장
 * - 지연 프레임 시점의 입력 조회
 * - 입력 예측 (마지막 알려진 입력으로)
 * - 시퀀스 갭 검출
 */

import type { InputEntry } from "../types";

export class InputQueue {
  private inputs = new Map<number, InputEntry>();
  private _minFrame = 0;
  private _lastRemoteFrame = -1;
  private _lastRemoteMask = 0;
  private _delayFrames: number;

  constructor(delayFrames: number) {
    this._delayFrames = delayFrames;
  }

  /** 입력 지연 프레임 설정 업데이트 */
  setDelayFrames(frames: number): void {
    this._delayFrames = Math.max(0, Math.min(10, frames));
  }

  get delayFrames(): number {
    return this._delayFrames;
  }

  /**
   * 로컬 입력을 저장한다.
   * @returns 저장된 입력 엔트리
   */
  addLocalInput(frameNum: number, mask: number): InputEntry {
    const existing = this.inputs.get(frameNum);
    const entry: InputEntry = {
      frameNum,
      localMask: mask,
      remoteMask: existing?.remoteMask ?? 0,
      remoteReceived: existing?.remoteReceived ?? false,
      predicted: !existing?.remoteReceived,
    };
    this.inputs.set(frameNum, entry);
    this.cleanup(frameNum);
    return entry;
  }

  /**
   * 원격 입력을 저장한다.
   * @returns 해당 프레임에 예측이 불일치했는지 여부
   */
  addRemoteInput(frameNum: number, mask: number): { mismatch: boolean; previousMask: number } {
    const existing = this.inputs.get(frameNum);
    const previousMask = existing?.remoteMask ?? this._lastRemoteMask;
    const mismatch = existing ? existing.remoteMask !== mask : false;

    const entry: InputEntry = {
      frameNum,
      localMask: existing?.localMask ?? 0,
      remoteMask: mask,
      remoteReceived: true,
      predicted: false,
    };
    this.inputs.set(frameNum, entry);

    this._lastRemoteFrame = Math.max(this._lastRemoteFrame, frameNum);
    this._lastRemoteMask = mask;

    return { mismatch, previousMask };
  }

  /**
   * 특정 프레임의 combined 입력을 조회한다.
   * (로컬 입력 + 원격 입력)
   *
   * delay frames를 적용: 현재 프레임 - delayFrames 시점의 입력을 조회
   *
   * @returns { localMask, remoteMask, remoteReceived }
   */
  getInputs(frameNum: number): {
    localMask: number;
    remoteMask: number;
    remoteReceived: boolean;
  } {
    const localFrame = frameNum;
    const remoteFrame = frameNum - this._delayFrames;

    const localEntry = this.inputs.get(localFrame);
    const remoteEntry = this.inputs.get(remoteFrame);

    const localMask = localEntry?.localMask ?? 0;
    const remoteReceived = remoteEntry?.remoteReceived ?? false;
    const remoteMask = remoteReceived
      ? (remoteEntry?.remoteMask ?? 0)
      : this._lastRemoteMask; // predict

    // 예측 시 remoteMask를 entry에 기록 — 실제 입력 도착 시 mismatch 감지 가능
    if (!remoteReceived && remoteEntry) {
      remoteEntry.remoteMask = remoteMask;
      remoteEntry.predicted = true;
    }

    return { localMask, remoteMask, remoteReceived };
  }

  /**
   * 특정 프레임의 로컬 입력 마스크를 반환한다.
   */
  getLocalMask(frameNum: number): number {
    return this.inputs.get(frameNum)?.localMask ?? 0;
  }

  /**
   * 특정 프레임의 원격 입력 마스크를 반환한다.
   */
  getRemoteMask(frameNum: number): number {
    return this.inputs.get(frameNum)?.remoteMask ?? 0;
  }

  /**
   * 특정 프레임에 원격 입력이 도착했는지 확인한다.
   */
  hasRemoteInput(frameNum: number): boolean {
    return this.inputs.get(frameNum)?.remoteReceived ?? false;
  }

  /**
   * sequence gap이 있는지 확인한다.
   * 원격 입력의 마지막 수신 프레임과 현재 프레임 사이의 간격이
   * delayFrames의 2배를 초과하면 gap으로 판정한다.
   */
  hasSequenceGap(frameNum: number): boolean {
    const gap = frameNum - this._delayFrames - this._lastRemoteFrame;
    return gap > this._delayFrames * 2;
  }

  /**
   * 모든 원격 입력을 초기화한다.
   */
  resetRemoteInputs(): void {
    this._lastRemoteFrame = -1;
    this._lastRemoteMask = 0;
    for (const entry of this.inputs.values()) {
      entry.remoteMask = 0;
      entry.remoteReceived = false;
      entry.predicted = true;
    }
  }

  /**
   * 예측 성공률을 계산한다.
   */
  getPredictionAccuracy(): number {
    let total = 0;
    let correct = 0;
    for (const entry of this.inputs.values()) {
      if (entry.remoteReceived) {
        total++;
        if (entry.remoteMask === this._lastRemoteMask) {
          correct++;
        }
      }
    }
    return total > 0 ? correct / total : 1;
  }

  /**
   * 입력 수신율을 계산한다.
   */
  getRemoteInputRate(frameNum: number): number {
    let received = 0;
    let total = 0;
    for (let f = Math.max(0, frameNum - 60); f < frameNum; f++) {
      total++;
      if (this.inputs.get(f)?.remoteReceived) {
        received++;
      }
    }
    return total > 0 ? received / total : 1;
  }

  /**
   * 모든 입력 데이터를 초기화한다.
   */
  reset(): void {
    this.inputs.clear();
    this._minFrame = 0;
    this._lastRemoteFrame = -1;
    this._lastRemoteMask = 0;
  }

  /**
   * 오래된 입력 데이터를 정리한다.
   */
  private cleanup(currentFrame: number): void {
    const minFrame = currentFrame - 120; // 2초 분량 유지
    if (minFrame <= this._minFrame) return;

    for (const frameNum of this.inputs.keys()) {
      if (frameNum < minFrame) {
        this.inputs.delete(frameNum);
      }
    }
    this._minFrame = minFrame;
  }
}
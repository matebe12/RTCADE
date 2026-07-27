/**
 * StateHistory — GGPO 상태 스냅샷 링 버퍼
 *
 * 각 프레임의 에뮬레이터 상태를 저장하는 링 버퍼.
 * 롤백 시 특정 프레임의 상태로 되돌리기 위해 사용된다.
 *
 * 주요 기능:
 * - 프레임별 상태 저장 (링 버퍼)
 * - 특정 프레임의 상태 조회
 * - 오래된 상태 자동 제거
 * - 메모리 사용량 추적
 */

import type { StateSnapshot } from "../types";

export class StateHistory {
  private snapshots: (StateSnapshot | null)[];
  private _size: number;
  private _totalSizeBytes = 0;
  private _totalSaved = 0;

  constructor(maxFrames: number) {
    this._size = maxFrames;
    this.snapshots = new Array(maxFrames).fill(null);
  }

  /**
   * 특정 프레임의 상태를 저장한다.
   * 링 버퍼 인덱스 = frameNum % size
   */
  save(frameNum: number, state: Uint8Array): void {
    const index = frameNum % this._size;
    const oldSnapshot = this.snapshots[index];

    // 이전 스냅샷 메모리 해제
    if (oldSnapshot) {
      this._totalSizeBytes -= oldSnapshot.sizeBytes;
    }

    // 새 스냅샷 저장 (복사본)
    const stateCopy = new Uint8Array(state);
    const snapshot: StateSnapshot = {
      frameNum,
      state: stateCopy,
      sizeBytes: stateCopy.byteLength,
    };

    this.snapshots[index] = snapshot;
    this._totalSizeBytes += snapshot.sizeBytes;
    this._totalSaved++;
  }

  /**
   * 특정 프레임의 상태를 반환한다.
   * null: 해당 프레임의 상태가 없음 (이미 제거되었거나 저장되지 않음)
   */
  get(frameNum: number): StateSnapshot | null {
    const index = frameNum % this._size;
    const snapshot = this.snapshots[index];
    if (snapshot && snapshot.frameNum === frameNum) {
      return snapshot;
    }
    return null;
  }

  /**
   * 특정 프레임의 상태가 존재하는지 확인한다.
   */
  has(frameNum: number): boolean {
    const index = frameNum % this._size;
    const snapshot = this.snapshots[index];
    return snapshot !== null && snapshot.frameNum === frameNum;
  }

  /**
   * 가장 최근 상태 스냅샷을 반환한다.
   */
  getLatest(): StateSnapshot | null {
    let latest: StateSnapshot | null = null;
    for (const snapshot of this.snapshots) {
      if (snapshot && (!latest || snapshot.frameNum > latest.frameNum)) {
        latest = snapshot;
      }
    }
    return latest;
  }

  /**
   * 특정 프레임 이전의 가장 가까운 상태를 찾는다.
   * 롤백 대상 프레임의 상태가 없을 때 사용한다.
   */
  findNearest(targetFrame: number): StateSnapshot | null {
    let nearest: StateSnapshot | null = null;
    for (const snapshot of this.snapshots) {
      if (snapshot && snapshot.frameNum <= targetFrame) {
        if (!nearest || snapshot.frameNum > nearest.frameNum) {
          nearest = snapshot;
        }
      }
    }
    return nearest;
  }

  /**
   * 지정된 프레임보다 오래된 모든 상태를 제거한다.
   */
  trimBefore(frameNum: number): void {
    for (let i = 0; i < this._size; i++) {
      const snapshot = this.snapshots[i];
      if (snapshot && snapshot.frameNum < frameNum) {
        this._totalSizeBytes -= snapshot.sizeBytes;
        this.snapshots[i] = null;
      }
    }
  }

  /**
   * 모든 상태 스냅샷을 제거한다.
   */
  reset(): void {
    this.snapshots.fill(null);
    this._totalSizeBytes = 0;
    this._totalSaved = 0;
  }

  /** 저장된 스냅샷 수 */
  get count(): number {
    return this.snapshots.filter((s) => s !== null).length;
  }

  /** 총 메모리 사용량 (bytes) */
  get totalSizeBytes(): number {
    return this._totalSizeBytes;
  }

  /** 평균 상태 크기 (bytes) */
  get avgSizeBytes(): number {
    return this._totalSaved > 0 ? Math.round(this._totalSizeBytes / this._totalSaved) : 0;
  }

  /** 링 버퍼 크기 */
  get size(): number {
    return this._size;
  }
}
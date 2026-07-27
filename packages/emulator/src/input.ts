/**
 * FBNeo 입력 매핑
 *
 * 키보드 입력을 FBNeo 비트마스크로 변환하고,
 * 플레이어별 입력 상태를 관리한다.
 */

/** FBNeo 입력 비트마스크 상수 */
export const INP_LEFT = 1 << 0;
export const INP_RIGHT = 1 << 1;
export const INP_UP = 1 << 2;
export const INP_DOWN = 1 << 3;
export const INP_START = 1 << 4;
export const INP_SELECT = 1 << 5;
export const INP_B1 = 1 << 6;
export const INP_B2 = 1 << 7;
export const INP_B3 = 1 << 8;
export const INP_B4 = 1 << 9;
export const INP_B5 = 1 << 10;
export const INP_B6 = 1 << 11;

/** 방향키 입력 */
export const INP_DIRECTIONS = INP_LEFT | INP_RIGHT | INP_UP | INP_DOWN;

/** 1P 기본 키보드 매핑 */
export const DEFAULT_KEY_MAP_P1: Record<string, number> = {
  ArrowUp: INP_UP,
  ArrowDown: INP_DOWN,
  ArrowLeft: INP_LEFT,
  ArrowRight: INP_RIGHT,
  KeyA: INP_B1,
  KeyS: INP_B2,
  KeyD: INP_B3,
  KeyF: INP_B4,
  KeyQ: INP_B5,
  KeyW: INP_B6,
  Digit1: INP_START,
  Digit5: INP_SELECT,
};

/** 2P 기본 키보드 매핑 (numpad) */
export const DEFAULT_KEY_MAP_P2: Record<string, number> = {
  Numpad8: INP_UP,
  Numpad2: INP_DOWN,
  Numpad4: INP_LEFT,
  Numpad6: INP_RIGHT,
  Numpad0: INP_B1,
  Numpad1: INP_B2,
  Numpad5: INP_B3,
  Numpad3: INP_B4,
  Numpad7: INP_B5,
  Numpad9: INP_B6,
  NumpadEnter: INP_START,
  NumpadAdd: INP_SELECT,
};

/**
 * Controllers 클래스
 * 플레이어별 입력 비트마스크를 관리하고 FBNeo에 전달한다.
 */
export class Controllers {
  private controllers: Int32Array;

  constructor(playerCount = 2) {
    this.controllers = new Int32Array(playerCount);
  }

  /** 특정 플레이어의 입력 마스크를 가져온다. */
  getMask(player: number): number {
    if (player < 0 || player >= this.controllers.length) return 0;
    return this.controllers[player];
  }

  /** 특정 플레이어의 입력을 업데이트한다. */
  setMask(player: number, mask: number): void {
    if (player < 0 || player >= this.controllers.length) return;
    this.controllers[player] = mask;
  }

  /** 특정 플레이어의 버튼을 설정한다. */
  setButton(player: number, buttonBit: number, pressed: boolean): void {
    if (player < 0 || player >= this.controllers.length) return;
    if (pressed) {
      this.controllers[player] |= buttonBit;
    } else {
      this.controllers[player] &= ~buttonBit;
    }
  }

  /** 모든 플레이어의 입력을 초기화한다. */
  reset(): void {
    this.controllers.fill(0);
  }

  /** FBNeo에 전달할 인자를 반환한다 (player, mask). */
  getArgs(player: number): [number, number] {
    return [player, this.getMask(player)];
  }
}

/**
 * 키보드 이벤트로부터 플레이어 식별 (1P vs 2P).
 * numpad 키는 2P, 나머지는 1P로 간주한다.
 */
export function getPlayerFromKey(code: string): number {
  if (code in DEFAULT_KEY_MAP_P2) return 1;
  return 0;
}

/** 키보드 코드를 FBNeo 비트마스크로 변환 */
export function keyToButtonMask(code: string): number {
  return DEFAULT_KEY_MAP_P1[code] ?? DEFAULT_KEY_MAP_P2[code] ?? 0;
}

/** 두 입력 마스크가 동일한지 비교 */
export function masksEqual(a: number, b: number): boolean {
  return a === b;
}

/**
 * 키 입력 이벤트를 FBNeo에 직접 전달하는 유틸리티.
 * `ArcadeWrapper`가 이를 래핑해서 사용한다.
 */
export class InputHandler {
  private controllers: Controllers;
  private onInputChange?: (player: number, mask: number) => void;

  constructor(playerCount = 2) {
    this.controllers = new Controllers(playerCount);
  }

  setOnInputChange(callback: (player: number, mask: number) => void): void {
    this.onInputChange = callback;
  }

  handleKeyDown(code: string): void {
    const player = getPlayerFromKey(code);
    const mask = keyToButtonMask(code);
    if (mask === 0) return;

    const prevMask = this.controllers.getMask(player);
    this.controllers.setButton(player, mask, true);
    const newMask = this.controllers.getMask(player);

    if (prevMask !== newMask) {
      this.onInputChange?.(player, newMask);
    }
  }

  handleKeyUp(code: string): void {
    const player = getPlayerFromKey(code);
    const mask = keyToButtonMask(code);
    if (mask === 0) return;

    const prevMask = this.controllers.getMask(player);
    this.controllers.setButton(player, mask, false);
    const newMask = this.controllers.getMask(player);

    if (prevMask !== newMask) {
      this.onInputChange?.(player, newMask);
    }
  }

  getMask(player: number): number {
    return this.controllers.getMask(player);
  }

  setMask(player: number, mask: number): void {
    this.controllers.setMask(player, mask);
  }

  reset(): void {
    this.controllers.reset();
  }

  /** 현재 1P 마스크 반환 */
  get player1Mask(): number {
    return this.controllers.getMask(0);
  }

  /** 현재 2P 마스크 반환 */
  get player2Mask(): number {
    return this.controllers.getMask(1);
  }
}
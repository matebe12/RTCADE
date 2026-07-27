/**
 * @rtcade/emulator — FBNeo WASM 에뮬레이터 통합 패키지
 */
export { ArcadeWrapper } from "./ArcadeWrapper";
export type { IArcade } from "./ArcadeWrapper";
export { keyToButtonMask, Controllers, InputHandler, DEFAULT_KEY_MAP_P1, DEFAULT_KEY_MAP_P2 } from "./input";
export { renderFrameToCanvas, fitCanvasToContainer, clearCanvas } from "./render";
export type { ArcadeGameInfo, FBNeoModule } from "./types";
export { default as FBNeoPlayer, preloadWasmVariant, sendStartGame, focusEmulator, sendRemoteInput, markGameRunning } from "./FBNeoPlayer";

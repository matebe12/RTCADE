---
description: "Use when modifying EmulatorPlayer, the direct EmulatorJS runtime bridge, shared emulator protocol, or the deprecated /emulator server stub"
applyTo:
  - "src/components/EmulatorPlayer.tsx"
  - "src/lib/emulator-runtime-bridge.ts"
  - "shared/emulator-protocol.ts"
  - "server/emulator.ts"
---

# EmulatorJS / 런타임 가이드

## 런타임 모델

- EmulatorJS는 iframe이 아니라 부모 React DOM에 직접 마운트된다.
- 통신은 `postMessage`가 아니라 `window.EJS_emulator`와 `createEmulatorRuntimeBridge()`를 통해 직접 수행한다.
- postMessage 기반 브릿지나 서버 HTML 생성 구조로 되돌리지 말 것.

## EJS 초기화

- `EmulatorPlayer.tsx`가 `EJS_*` 전역을 설정하고 정리까지 책임진다.
- 새 `EJS_*` 전역을 추가하면 `OUR_EJS_GLOBALS`와 cleanup 경로를 함께 갱신한다.
- `cleanupEJSGlobals()`와 `removeAudioCapture()`는 항상 짝으로 유지한다.

## 입력 처리

- 넷플레이와 솔로 모두 `KEY_TO_BUTTON`를 기준으로 입력을 주입한다.
- 넷플레이는 window 캡처 + `stopImmediatePropagation()` + `preventDefault()`로 EmulatorJS 기본 키보드 핸들러를 차단한다.
- Enter는 넷플레이 채팅 단축키로 먼저 소비된다.
- `localPlayer` 또는 원격 플레이어 인덱스를 바꾸면 `shared/emulator-protocol.ts`와 브릿지 호출도 같이 맞춘다.

## 상태 / 캡처

- HOST 상태 저장과 리싱크는 `requestSaveState()` / `requestResyncGetState()`와 `loadSaveState()` / `requestResyncLoadState()` 쌍으로 유지한다.
- MAME 코어는 `getState()` 첫 시도 실패 가능성이 있어 재시도 로직을 유지한다.
- HOST 비디오와 오디오 전송은 `installAudioCapture()`와 캔버스 `captureStream()` 조합에 의존하므로, 스트리밍 방식을 바꿀 때는 GUEST 렌더 경로까지 함께 수정한다.
- `GuestVideoDisplay`는 HOST 스트림을 받는 쪽이므로, 캡처 포맷을 바꾸면 넷플레이 쪽도 같이 손본다.

## 서버 관련

- `/emulator`는 현재 410 응답을 주는 deprecated stub이다.
- 서버에서 EmulatorJS HTML을 다시 생성하는 구조로 되돌리지 말고, 실시간 런타임은 클라이언트 브릿지에서만 관리한다.

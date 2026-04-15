---
description: "Use when modifying EmulatorPlayer, iframe communication, EmulatorJS configuration, postMessage protocol, or emulator HTML generation"
applyTo: "src/components/EmulatorPlayer.tsx"
---

# EmulatorJS / iframe 통신 가이드

## iframe 격리 원칙

- EmulatorJS는 **iframe 안에서만** 실행됨. React에서 직접 접근 불가
- 모든 통신은 `postMessage` API로만 수행
- `EmulatorPlayer.tsx`의 export 함수들이 postMessage 래퍼 역할

## postMessage 프로토콜

React → iframe:
| type | 용도 |
|------|------|
| `remoteInput` | 상대방 입력 주입 |
| `start-game` | pause 해제, 게임 시작 |
| `get-save-state` | 초기 상태 추출 요청 |
| `load-save-state` | 초기 상태 로드 |
| `resync-get-state` | 리싱크 상태 추출 (micro-pause) |
| `resync-load-state` | 리싱크 상태 로드 (micro-pause) |

iframe → React:
| type | 용도 |
|------|------|
| `localInput` | 로컬 키보드 입력 전달 |
| `emulator-ready` | 에뮬레이터 로딩 완료 |
| `save-state` | 추출된 세이브 스테이트 (ArrayBuffer, transferable) |
| `state-loaded` | 상태 로드 완료 |
| `save-state-error` | 상태 추출/로드 실패 |
| `resync-state` | 리싱크용 상태 (ArrayBuffer, transferable) |
| `resync-loaded` | 리싱크 로드 완료 |
| `resync-failed` | 리싱크 실패 |

## 키보드 입력 차단

넷플레이 모드에서는 `stopImmediatePropagation()` + `preventDefault()`로 EmulatorJS 내장 키보드 핸들러를 완전 차단.
`KEY_TO_BUTTON` 맵에 있는 키만 `simulateInput()`으로 수동 주입.
이 차단을 제거하면 GUEST 키가 HOST 캐릭터를 조종하는 버그 발생.

## EmulatorJS 설정 (server/index.ts `/emulator`)

- `EJS_Buttons`: 설정/전체화면/컨트롤러만 표시, 나머지 숨김
- 코어 리매핑: `mame2003` → `mame2003_plus`, `arcade` → `fbneo`
- MAME 코어는 `getState()` 첫 시도 실패 가능 → 최대 10회 재시도 로직 있음
- `EJS_startOnLoaded = true`: 로딩 즉시 시작, 넷플레이 시 `EJS_onGameStart`에서 pause

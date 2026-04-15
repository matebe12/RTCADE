---
description: "Use when modifying netplay sync, P2P connection, WebRTC DataChannel, resync logic, peer.ts, signaling.ts, or NetplayLobby.tsx playing state"
applyTo: "src/netplay/**"
---

# Netplay 수정 가이드

## 아키텍처 제약

- **HOST = source of truth**: 상태는 항상 HOST→GUEST 단방향 전송. GUEST→HOST 상태 전송 금지
- **서버는 시그널링만**: 게임 데이터(입력/세이브스테이트)는 반드시 DataChannel P2P로 교환
- **입력은 즉시 적용**: 프레임 버퍼링/딜레이 없음 (과거 시도 실패, copilot-instructions.md 참조)

## peer.ts 수정 시 주의사항

- `_closing` 플래그: `close()` 호출 시 자신의 `onDisconnected` 콜백 방지용. 새 disconnect 경로 추가 시 반드시 `if (!this._closing)` 가드 포함
- DataChannel 메시지: JSON(입력/시그널)과 Binary(상태 청크)가 혼합됨. `onmessage`에서 `instanceof ArrayBuffer` 분기 필수
- Binary 청크: 초기 상태 64KB, 리싱크 256KB. 두 스트림(`pendingState`, `pendingResync`)이 동시에 올 수 있음
- `resetRemoteSeq()`: 리싱크 후 시퀀스 카운터 리셋 필수, 안 하면 불필요한 gap 경고 발생

## NetplayLobby.tsx 리싱크 수정 시 주의사항

- `resyncInProgressRef`: 3초 타임아웃 안전장치 있음. 새 resync 경로 추가 시 반드시 `false`로 리셋하는 코드 포함
- idle 체크 제거됨: 과거 `IDLE_THRESHOLD_MS` 체크가 있었으나 격투 게임에서 resync 미실행 버그로 제거. **idle 기반 resync 다시 도입 금지**
- `resyncActiveRef`: cleanup 시 false로 설정 + 타이머 clear 필수

## 시그널링 메시지 추가 시

1. `src/netplay/signaling.ts` — `SignalingMessage` 타입에 추가
2. `src/netplay/peer.ts` — `onSignaling` switch case 추가
3. `server/index.ts` — WebSocket 메시지 핸들러에 추가
4. 3곳 모두 일관되게 수정

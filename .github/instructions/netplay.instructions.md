---
description: "Use when modifying netplay sync, P2P connection, WebRTC DataChannel, resync logic, peer.ts, signaling.ts, NetplayLobby.tsx playing state, GuestVideoDisplay.tsx, or shared netplay protocol constants"
applyTo:
  - "src/components/NetplayLobby.tsx"
  - "src/components/NetplayPlayingScreen.tsx"
  - "src/components/netplay/**"
  - "src/netplay/**"
  - "shared/emulator-protocol.ts"
---

# Netplay 수정 가이드

## 아키텍처

- HOST가 source of truth다.
- 서버는 WebSocket signaling만 담당하고, 게임 데이터는 DataChannel P2P로만 교환한다.
- 현재 넷플레이는 video streaming 우선이다. HOST는 캔버스와 오디오 스트림을 보내고 GUEST는 `GuestVideoDisplay`로 렌더한다.
- `useNetplayResyncLoop`는 `videoStreamingMode`일 때 periodic resync를 건너뛴다.

## DataChannel 분리

- `input`: 버튼 이벤트, unordered / unreliable.
- `control`: `peer-ready`, `state-loaded`, `start-signal`, `resync-loaded`, `resync-failed`, `heartbeat`.
- `state`: save-state와 resync state chunk 전송.
- `repair`: `input-sync` held mask 보정용.
- `chat`: 채팅 메시지와 typing 상태.
- channel type을 추가하거나 바꾸면 `peer.ts`, hook 소비처, UI 표시 상태를 함께 맞춘다.

## peer.ts 주의사항

- `_closing` 가드는 disconnect 경로마다 유지한다.
- `resetRemoteSeq(nextExpectedSeq)`는 guest resync 후 stale input을 버리기 위한 장치이므로 지우지 않는다.
- `sendInput()`은 local held mask 갱신, input 전송, repair sync 갱신을 한 묶음으로 유지한다.
- `startVideoStreaming()`는 renegotiation을 유발하므로 track 추가/삭제 시 `onnegotiationneeded` 흐름을 깨지 말 것.

## 동기화 훅

- `useNetplaySession`는 chat, peer-room, initial sync, resync, lifecycle, history 훅을 합친 오케스트레이터다.
- `useNetplayInitialSync`와 `useNetplayResyncLoop`는 항상 같이 본다.
- 현재 resync는 `resyncInProgressRef`, timeout, backoff, deferred idle window를 함께 쓰는 구조다. 한 부분만 바꾸지 말고 전체를 맞춰야 한다.
- `videoStreamingMode`가 바뀌면 `NetplayPlayingScreen`, `GuestVideoDisplay`, `useNetplayInitialSync`, `useNetplayResyncLoop`를 같이 손본다.
- `HEARTBEAT_*` 임계값을 바꾸면 `shared/emulator-protocol.ts`와 disconnect UI도 같이 검토한다.

## signaling 추가

- 메시지 타입은 `src/netplay/signaling.ts`와 `server/signaling.ts`를 항상 같이 수정한다.
- 새 signaling 타입이 room state나 UI에 영향을 주면 `useNetplayPeerFactory`, `useNetplayRoomEntry`, store도 같이 점검한다.

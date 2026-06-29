# WebRTC 연결 흐름 — 코드 위치 포함

> 방 만들기부터 게임 화면이 GUEST에 뜨기까지의 전 과정.
> 각 단계마다 실제 코드가 어느 파일, 어느 함수에 있는지 함께 기록한다.

---

## 한 줄 요약

> **시그널링 = 서로 찾는 과정, 그 이후 = 찾은 사람끼리 직접 통신**

시그널링 구간(1~3단계)은 서버 WebSocket을 통해 연결 정보를 주고받는 과정이다.  
RTCPeerConnection이 `connected` 상태가 되는 순간 시그널링이 끝나고, 이후로는 서버 없이 브라우저끼리 직접 통신한다.  
"직접 통신" 안에는 DataChannel(데이터)과 MediaStream 트랙(영상/오디오) 두 종류가 있고, 둘 다 같은 RTCPeerConnection 통로를 쓴다.

---

## 단계별 흐름

### 1단계 — 방 코드 교환 (서버 경유)

HOST가 ROM을 선택하면 `src/netplay/useNetplayRoomEntry.ts`의 `startHostingRoom()`이 호출된다. 여기서 `peer.createRoom()`을 호출한다.

`peer.createRoom()`은 `src/netplay/peer.ts`의 `NetplayPeer` 클래스 안에 있다. 내부적으로 `SignalingClient.send({ type: "create-room", ... })`를 호출한다.

`SignalingClient`는 `src/netplay/signaling.ts`에 있다. 이 클래스가 서버 WebSocket에 연결하고 메시지를 주고받는 역할을 한다.

서버 쪽에서는 `server/signaling.ts`의 `attachSignalingServer()` 안에서 `"create-room"` 메시지를 받아 `server/roomStore.ts`의 `createRoom()`을 호출한다. 6자리 코드가 여기서 생성된다.

GUEST가 코드를 입력하면 같은 경로로 `peer.joinRoom()`이 호출되고, 서버는 `roomStore.attachGuest()`를 실행한다.

---

### 2단계 — SDP 협상 (코덱·기능 맞추기)

서버가 HOST에게 "게스트 왔어"를 보내면 `src/netplay/peer.ts`의 `PeerEventHandler.onGuestJoined()`가 호출된다.

`NetplayPeer` 내부에서 `RTCPeerConnection`을 생성하고 `createOffer()`를 호출한다. 만들어진 offer는 `SignalingClient.send({ type: "offer", sdp })`로 서버에 전달된다.

서버 `server/signaling.ts`는 `"offer"` 메시지를 받으면 상대방 WebSocket에 그대로 전달한다. 중계만 한다.

GUEST 쪽 `peer.ts`가 `"offer"`를 받으면 `setRemoteDescription()`을 호출하고 `createAnswer()`를 만들어서 다시 서버에 보낸다. HOST도 받아서 `setRemoteDescription()`을 호출한다.

> **SDP란?**  
> "나는 H.264 쓸 수 있고 Opus 오디오 되고 DataChannel 지원해" 같은 능력 협상 문서다.  
> offer/answer 형식으로 주고받으며, 이게 끝나면 어떤 코덱으로 통신할지 합의된다.

---

### 3단계 — ICE candidate 교환 (IP 주소 찾아서 주고받기)

`peer.ts`에서 `RTCPeerConnection`을 생성할 때 `onicecandidate` 이벤트 핸들러를 등록한다. candidate가 발견될 때마다 자동으로 `SignalingClient.send({ type: "ice-candidate", candidate })`가 호출된다.

서버 `server/signaling.ts`는 `"ice-candidate"` 메시지를 받으면 상대방에게 그대로 전달한다. 받은 쪽 `peer.ts`는 `RTCPeerConnection.addIceCandidate()`를 호출한다.

이 과정이 양쪽에서 동시에 진행된다. 가장 먼저 연결에 성공한 경로가 사용된다.

> **ICE candidate 우선순위**
> 1. `host` — 로컬 IP (같은 와이파이면 이것만으로 연결)
> 2. `srflx` — STUN 서버로 알아낸 공인 IP
> 3. `relay` — TURN 서버 중계 (방화벽 환경 최후 수단)
>
> **STUN**은 "내 공인 IP가 뭐야?"를 물어보는 서버다.  
> **TURN**은 직접 연결이 안 될 때 데이터를 중계해주는 서버다.  
> ICE candidate를 발견하는 즉시 전송하고 상대방이 받자마자 시도하는 방식을 **trickle ICE**라고 한다.

---

### 4단계 — 연결 수립, DataChannel 오픈

`RTCPeerConnection`이 `connected`가 되면 `PeerEventHandler.onConnected()`가 호출된다.  
이 콜백은 `src/netplay/useNetplayPeerFactory.ts`에서 등록한 것이고, `setStatus()`로 UI에 "연결됨"을 표시한다.

DataChannel 4개는 HOST 쪽 `peer.ts`에서 `createDataChannel()`로 미리 만들어둔 것이다. 연결이 수립되면 자동으로 열린다.

| 채널 | 신뢰성 | 용도 |
|------|--------|------|
| `input` | 비신뢰성 | GUEST 버튼 입력 (최신 값만 중요, 유실 허용) |
| `control` | 신뢰성 | peer-ready, start-signal, heartbeat |
| `repair` | 비신뢰성 | 120ms 주기 눌린 버튼 상태 보정 |
| `chat` | 신뢰성 | 채팅 메시지, 타이핑 상태 |

> 버튼 입력 채널을 비신뢰성으로 설정한 이유: TCP처럼 패킷 유실 시 재전송을 기다리면 입력 지연이 생긴다. 버튼은 최신 상태만 중요하므로 유실되면 그냥 버리고 다음 걸 보내는 게 낫다.

**이 시점부터 서버와의 연결은 더 이상 사용되지 않는다.**

---

### 5단계 — peer-ready / start-signal 교환

DataChannel `"control"`이 열리면 `src/netplay/useNetplayInitialSync.ts`가 동작한다.

GUEST 쪽에서 DataChannel이 열리는 순간 `peer.sendPeerReady()`를 호출한다.  
`peer.ts`에서 `controlDC.send({ type: "peer-ready" })`로 전송한다.

HOST 쪽 `peer.ts`가 이 메시지를 받으면 `PeerEventHandler.onPeerReady()`를 호출한다.  
이 콜백은 `useNetplayPeerFactory.ts`에서 등록됐고, 체인을 타고 `useNetplayInitialSync.ts`의 `handlePeerReady()`에 도달한다.

HOST 에뮬레이터도 준비됐고(localReady) GUEST도 준비됐으면(remoteReady) `startGame()`이 실행된다.  
여기서 `peer.sendStartSignal()`로 `{ type: "start-signal" }`을 GUEST에게 보낸다.

GUEST는 `start-signal`을 받으면 `handlePeerStartSignal()` → `startGame()` → `setGameStarted(true)`가 실행되고 `<video>` 재생이 시작된다.

---

### 6단계 — 비디오 캡처 및 스트림 전송

HOST 쪽 `startGame()`이 실행될 때 `onHostGameStarted()` 콜백이 호출된다.  
이 콜백은 `src/netplay/useNetplaySession.ts`에서 등록됐고, `handleStartVideoCapture()`를 실행한다.

`handleStartVideoCapture()`는 `src/lib/emulator-runtime-bridge.ts`의 `captureStream()`을 호출한다.

```
captureStream()
  1. canvas.captureStream(60)              → 60fps 영상 트랙
  2. videoTrack.contentHint = "detail"    → 픽셀 선명도 우선 인코딩 힌트
  3. captureAudioFromEJS()
       └─ EJS_emulator.Module.SDL2.audioContext 탐색
       └─ AudioContext.createMediaStreamDestination()
       └─ audioTrack.contentHint = "music"
  4. new MediaStream([videoTrack, audioTrack]) 반환
```

그 결과로 만들어진 `MediaStream`을 `peer.startVideoStreaming(stream)`에 넘긴다.  
`peer.ts` 안에서 `RTCPeerConnection.addTrack()`을 호출하고, 이게 **renegotiation(재협상)** 을 트리거한다.

> **renegotiation이란?**  
> 처음 SDP 협상 때는 DataChannel만 있었다. 나중에 `addTrack()`으로 영상/오디오를 추가하면 협상 내용과 실제가 달라지므로 SDP를 다시 짧게 협상해야 한다. 이 과정이 자동으로 일어난다.

재협상이 끝나면 GUEST 쪽으로 영상과 소리가 흘러들어가기 시작한다.

GUEST 쪽 `peer.ts`의 `ontrack` 이벤트가 발생하면 `PeerEventHandler.onVideoStream(stream)`이 호출되고,  
`src/netplay/useNetplaySession.ts`에서 `setGuestVideoStream(stream)`으로 상태를 업데이트한다.  
`src/components/netplay/GuestVideoDisplay.tsx`의 `<video srcObject={stream} autoPlay />` 태그에 스트림이 연결되고 화면이 뜬다.

---

## 전체 코드 흐름 요약

```
[방 코드 교환]
useNetplayRoomEntry.ts → peer.createRoom() / peer.joinRoom()
  └─ peer.ts (NetplayPeer) → SignalingClient.send()
       └─ src/netplay/signaling.ts → WebSocket
            └─ server/signaling.ts → server/roomStore.ts

[SDP / ICE — 시그널링 구간]
peer.ts 내부
  → RTCPeerConnection createOffer / createAnswer
  → onicecandidate → SignalingClient.send()
  → server/signaling.ts가 상대방에게 중계
  → RTCPeerConnection addIceCandidate

[연결 수립]
onConnected → useNetplayPeerFactory.ts에서 등록한 콜백
DataChannel 4개 오픈 (peer.ts에서 생성)

[게임 시작 동기화]
useNetplayInitialSync.ts
  → peer.sendPeerReady() / peer.sendStartSignal()  (peer.ts)

[비디오 캡처]
useNetplaySession.ts → handleStartVideoCapture()
  └─ emulator-runtime-bridge.ts → captureStream()
       └─ peer.startVideoStreaming() → addTrack() → renegotiation
            └─ GuestVideoDisplay.tsx → <video srcObject={stream} />
```

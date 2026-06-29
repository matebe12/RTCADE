// WebRTC 연결 흐름 — 각 심볼에서 F12(정의로 이동) 사용 가능
// 실행 코드 없음. 흐름 추적용 참조 파일.

import { NetplayPeer } from "../src/netplay/peer";
import { SignalingClient } from "../src/netplay/signaling";
import { attachSignalingServer } from "../server/signaling";
import { createRoomStore } from "../server/roomStore";
import { useNetplayRoomEntry } from "../src/netplay/useNetplayRoomEntry";
import { useNetplayPeerFactory } from "../src/netplay/useNetplayPeerFactory";
import { useNetplayInitialSync } from "../src/netplay/useNetplayInitialSync";
import { useNetplaySession } from "../src/netplay/useNetplaySession";
import { createEmulatorRuntimeBridge } from "../src/lib/emulator-runtime-bridge";

// ─── 1단계: 방 코드 교환 ────────────────────────────────────────────────────
// HOST: useNetplayRoomEntry → startHostingRoom() → peer.createRoom()
// GUEST: useNetplayRoomEntry → joinRoom() → peer.joinRoom()
// WebSocket 메시지를 SignalingClient가 서버로 전송한다.
// 서버는 attachSignalingServer 안에서 받아 createRoomStore().createRoom() / attachGuest() 실행.

const _step1 = {
  hook:             useNetplayRoomEntry,
  peerClass:        NetplayPeer,
  createRoom:       NetplayPeer.prototype.createRoom,
  joinRoom:         NetplayPeer.prototype.joinRoom,
  signalingClient:  SignalingClient,
  serverHandler:    attachSignalingServer,
  serverStore:      createRoomStore,
};

// ─── 2단계: SDP 협상 (코덱·기능 맞추기) ──────────────────────────────────────
// GUEST 입장 신호 → HOST가 RTCPeerConnection 생성 + createOffer()
// offer = "H.264 가능, Opus 가능, DataChannel 가능" 능력 협상 문서
// SignalingClient.send({ type: "offer" }) → 서버 중계 → GUEST
// GUEST: createAnswer() → 서버 중계 → HOST
// 양쪽 setRemoteDescription() → 코덱 합의 완료
// 모든 RTCPeerConnection 로직은 NetplayPeer 클래스 내부에 있다.

const _step2 = {
  peerClass:        NetplayPeer,
  signalingClient:  SignalingClient,
  serverHandler:    attachSignalingServer,
};

// ─── 3단계: ICE candidate 교환 (IP 주소 찾아서 주고받기) ──────────────────────
// RTCPeerConnection.onicecandidate 발생 시마다 SignalingClient.send({ type: "ice-candidate" })
// 서버가 상대방에게 중계 → 받은 쪽 RTCPeerConnection.addIceCandidate()
//
// candidate 우선순위:
//   "host"  — 로컬 IP (같은 와이파이면 이것만으로 연결)
//   "srflx" — STUN으로 알아낸 공인 IP
//   "relay" — TURN 서버 중계 (방화벽 환경 최후 수단)
//
// 발견 즉시 전송, 상대방이 받자마자 시도 = trickle ICE
// 가장 먼저 성공한 경로로 RTCPeerConnection → "connected"
// 이 순간 시그널링 끝. 이후 서버 개입 없음.

const _step3 = {
  peerClass:        NetplayPeer,
  signalingClient:  SignalingClient,
  serverHandler:    attachSignalingServer,
};

// ─── 4단계: 연결 수립, DataChannel 오픈 ──────────────────────────────────────
// "connected" → useNetplayPeerFactory에서 등록한 PeerEventHandler.onConnected() 호출
// DataChannel 4개는 NetplayPeer 생성 시 createDataChannel()로 미리 만들어둔 것
//
//   "input"   비신뢰성 — 버튼 입력. 패킷 유실 허용. 재전송 없이 빠름.
//   "control" 신뢰성   — peer-ready, start-signal, heartbeat
//   "repair"  비신뢰성 — 120ms마다 눌린 버튼 전체 상태 강제 보정
//   "chat"    신뢰성   — 채팅 메시지, 타이핑 상태
//
// 이 시점부터 서버는 더 이상 사용되지 않는다.

const _step4 = {
  factoryHook:      useNetplayPeerFactory,
  peerClass:        NetplayPeer,
};

// ─── 5단계: peer-ready / start-signal 교환 ────────────────────────────────────
// DataChannel "control" 오픈 → useNetplayInitialSync 동작 시작
//
// GUEST: 오픈 즉시 peer.sendPeerReady() → controlDC.send({ type: "peer-ready" })
// HOST:  수신 → localReady && remoteReady → startGame()
//          1. emulatorRuntime.resumeGame()   에뮬레이터 재개
//          2. onHostGameStarted()            비디오 캡처 시작 (6단계로)
//          3. peer.sendStartSignal()         "start-signal" 전송
// GUEST: 수신 → setGameStarted(true) → <video> 재생 시작

const _step5 = {
  syncHook:         useNetplayInitialSync,
  sendPeerReady:    NetplayPeer.prototype.sendPeerReady,
  sendStartSignal:  NetplayPeer.prototype.sendStartSignal,
};

// ─── 6단계: 비디오 캡처 및 스트림 전송 ──────────────────────────────────────
// HOST: onHostGameStarted() → handleStartVideoCapture() (useNetplaySession 내부)
//   → createEmulatorRuntimeBridge().getCaptureStream(60)  60fps 영상 트랙
//   → captureAudioFromEJS()                               게임 오디오 트랙
//   → peer.startVideoStreaming(stream)
//       → RTCPeerConnection.addTrack() → renegotiation(SDP 재협상) 자동 발생
//
// renegotiation: 처음엔 DataChannel만 협상했다.
//   addTrack()으로 영상/오디오 추가 시 SDP가 달라지므로 짧게 다시 협상한다.
//   재협상 완료 → GUEST 쪽으로 영상/소리 스트리밍 시작
//
// GUEST: ontrack → PeerEventHandler.onVideoStream(stream)
//   → setGuestVideoStream(stream) → <video srcObject={stream} autoPlay />

const _step6 = {
  sessionHook:          useNetplaySession,
  runtimeBridge:        createEmulatorRuntimeBridge,
  startVideoStreaming:   NetplayPeer.prototype.startVideoStreaming,
};

export type _Refs = typeof _step1 & typeof _step2 & typeof _step3
  & typeof _step4 & typeof _step5 & typeof _step6;

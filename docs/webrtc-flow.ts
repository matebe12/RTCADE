// WebRTC 연결 여정 — 방 만들기부터 GUEST 화면에 게임이 뜨기까지
// 실행 코드 없음. 각 심볼에서 F12(정의로 이동) 사용 가능.

import { NetplayPeer } from "../src/netplay/peer";
import { SignalingClient } from "../src/netplay/signaling";
import { attachSignalingServer } from "../server/signaling";
import { createRoomStore } from "../server/roomStore";
import { useNetplayRoomEntry } from "../src/netplay/useNetplayRoomEntry";
import { useNetplayPeerRoomFlow } from "../src/netplay/useNetplayPeerRoomFlow";
import { useNetplayPeerFactory } from "../src/netplay/useNetplayPeerFactory";
import { useNetplayInitialSync } from "../src/netplay/useNetplayInitialSync";
import { useNetplaySession } from "../src/netplay/useNetplaySession";
import { createEmulatorRuntimeBridge } from "../src/lib/emulator-runtime-bridge";

// ────────────────────────────────────────────────────────────────────────────
// [HOST] ROM 선택 → 방 만들기
// ────────────────────────────────────────────────────────────────────────────
// 사용자가 ROM을 고르면 NetplayLobby가 handleCreateRoom()을 호출한다.
// 훅 체인을 타고 내려온다:
//   useNetplaySession → useNetplayPeerRoomFlow → useNetplayRoomEntry
//
// useNetplayRoomEntry 안에서:
//   1. GET /api/ice-servers → ICE 서버 목록 수신
//   2. useNetplayPeerFactory.createPeer() → NetplayPeer 인스턴스 생성
//      NetplayPeer 생성자 안에서 SignalingClient가 서버 WebSocket에 연결된다.
//   3. peer.createRoom() → SignalingClient.send({ type: "create-room", ... })
//      서버(attachSignalingServer)가 받아서 createRoomStore().createRoom() 실행
//      → 6자리 코드 생성 → "room-created" 응답 → LobbyState.step = "waiting"

const _1_host_creates_room = {
  entryHook:        useNetplayRoomEntry,
  roomFlowHook:     useNetplayPeerRoomFlow,
  sessionHook:      useNetplaySession,
  factoryHook:      useNetplayPeerFactory,
  peerClass:        NetplayPeer,
  signalingClient:  SignalingClient,
  serverHandler:    attachSignalingServer,
  serverStore:      createRoomStore,
  createRoom:       NetplayPeer.prototype.createRoom,
};

// ────────────────────────────────────────────────────────────────────────────
// [GUEST] 코드 입력 → 방 입장
// ────────────────────────────────────────────────────────────────────────────
// 같은 흐름으로 useNetplayRoomEntry.joinRoom() 호출
//   peer.joinRoom() → SignalingClient.send({ type: "join-room", code })
//   서버: createRoomStore().attachGuest() 실행
//         → HOST WebSocket에 "guest-joined" 알림 전송
//         → GUEST에 "room-joined" 응답 → LobbyState.step = "waiting"

const _2_guest_joins_room = {
  entryHook:    useNetplayRoomEntry,
  joinRoom:     NetplayPeer.prototype.joinRoom,
  serverStore:  createRoomStore,
};

// ────────────────────────────────────────────────────────────────────────────
// [시그널링 시작] SDP 협상 — 코덱·기능 맞추기
// ────────────────────────────────────────────────────────────────────────────
// HOST가 "guest-joined" 수신 → NetplayPeer 내부에서 RTCPeerConnection 생성
//   createOffer() 호출
//   offer 안에 담기는 내용: "H.264 가능, Opus 오디오 가능, DataChannel 가능"
//
//   SignalingClient.send({ type: "offer", sdp })
//   → 서버(attachSignalingServer)가 GUEST WebSocket에 그대로 중계
//   → GUEST: setRemoteDescription(offer) → createAnswer()
//   → SignalingClient.send({ type: "answer", sdp })
//   → 서버가 HOST에 중계
//   → HOST: setRemoteDescription(answer)
//
// 양쪽의 코덱·형식 합의 완료.
// 이 과정의 RTCPeerConnection 로직은 전부 NetplayPeer 클래스 내부에 있다.

const _3_sdp_negotiation = {
  peerClass:        NetplayPeer,
  signalingClient:  SignalingClient,
  serverHandler:    attachSignalingServer,
};

// ────────────────────────────────────────────────────────────────────────────
// [시그널링 계속] ICE candidate 교환 — IP 주소 찾아서 주고받기
// ────────────────────────────────────────────────────────────────────────────
// SDP 협상과 동시에 양쪽이 각자 연결 가능한 주소(candidate)를 수집한다.
//
//   RTCPeerConnection.onicecandidate 발생마다
//   → SignalingClient.send({ type: "ice-candidate", candidate })
//   → 서버가 상대방에게 중계
//   → 받은 쪽: RTCPeerConnection.addIceCandidate()
//
// candidate를 발견하는 즉시 전송하고 상대방이 바로 시도한다 (trickle ICE).
//
// 수집되는 candidate 종류:
//   "host"  — 로컬 IP. 같은 와이파이면 이것만으로 연결된다.
//   "srflx" — STUN 서버로 알아낸 공인 IP. 집 공유기 뒤에서도 연결 가능.
//   "relay" — TURN 서버 중계. 강한 방화벽 환경의 최후 수단.
//
// 가장 먼저 성공한 경로로 RTCPeerConnection 상태가 "connected"가 된다.
// === 이 순간 시그널링 끝. 이후 서버는 더 이상 개입하지 않는다. ===

const _4_ice_exchange = {
  peerClass:        NetplayPeer,
  signalingClient:  SignalingClient,
  serverHandler:    attachSignalingServer,
};

// ────────────────────────────────────────────────────────────────────────────
// [연결 수립] DataChannel 오픈
// ────────────────────────────────────────────────────────────────────────────
// "connected" → useNetplayPeerFactory에서 등록한 PeerEventHandler.onConnected() 호출
//
// DataChannel 4개가 열린다.
// (HOST 쪽 NetplayPeer 생성자에서 createDataChannel()로 미리 만들어둔 것)
//
//   "input"   비신뢰성 — GUEST 버튼 입력. 패킷 유실 허용. 재전송 없이 빠름.
//   "control" 신뢰성   — peer-ready, start-signal, heartbeat. 반드시 도착.
//   "repair"  비신뢰성 — 120ms마다 눌린 버튼 전체 상태 강제 보정.
//   "chat"    신뢰성   — 채팅 메시지, 타이핑 상태.

const _5_connection_established = {
  factoryHook:  useNetplayPeerFactory,
  peerClass:    NetplayPeer,
};

// ────────────────────────────────────────────────────────────────────────────
// [게임 시작 동기화] peer-ready / start-signal
// ────────────────────────────────────────────────────────────────────────────
// useNetplayInitialSync가 DataChannel "control"이 열리는 시점부터 동작한다.
//
// GUEST: "control" 오픈 즉시
//   → peer.sendPeerReady()  (에뮬레이터가 없으므로 기다릴 게 없음)
//
// HOST: 에뮬레이터 로딩 완료(localReady) + peer-ready 수신(remoteReady)
//   → startGame() 실행
//       1. emulatorRuntime.resumeGame()     에뮬레이터 재개
//       2. onHostGameStarted()              비디오 캡처 시작 트리거 → 다음 단계로
//       3. peer.sendStartSignal()           GUEST에 시작 신호 전송
//
// GUEST: "start-signal" 수신
//   → setGameStarted(true) → <video> 재생 시작

const _6_ready_handshake = {
  syncHook:         useNetplayInitialSync,
  sendPeerReady:    NetplayPeer.prototype.sendPeerReady,
  sendStartSignal:  NetplayPeer.prototype.sendStartSignal,
};

// ────────────────────────────────────────────────────────────────────────────
// [HOST] 비디오 캡처 → WebRTC 스트림으로 전송
// ────────────────────────────────────────────────────────────────────────────
// onHostGameStarted() → handleStartVideoCapture() (useNetplaySession 내부)
//   → createEmulatorRuntimeBridge().getCaptureStream(60)
//       canvas.captureStream(60)                  60fps 영상 트랙
//       videoTrack.contentHint = "detail"         픽셀 선명도 우선 인코딩 힌트
//       captureAudioFromEJS()
//           EJS_emulator.Module.SDL2.audioContext 탐색
//           AudioContext.createMediaStreamDestination()
//           audioTrack.contentHint = "music"
//       → MediaStream([videoTrack, audioTrack]) 반환
//
//   → peer.startVideoStreaming(stream)
//       RTCPeerConnection.addTrack() 호출
//       → renegotiation(SDP 재협상) 자동 발생
//          처음 협상 때는 DataChannel만 있었으므로
//          영상/오디오 추가 시 SDP를 짧게 다시 협상한다.
//       재협상 완료 → GUEST 쪽으로 영상/소리 스트리밍 시작

const _7_video_capture_and_stream = {
  sessionHook:          useNetplaySession,
  runtimeBridge:        createEmulatorRuntimeBridge,
  startVideoStreaming:   NetplayPeer.prototype.startVideoStreaming,
};

// ────────────────────────────────────────────────────────────────────────────
// [GUEST] 영상 수신 → 화면에 표시
// ────────────────────────────────────────────────────────────────────────────
// RTCPeerConnection.ontrack 이벤트 발생
//   → PeerEventHandler.onVideoStream(stream)  (useNetplayPeerFactory에서 등록)
//   → useNetplaySession 내부에서 setGuestVideoStream(stream) 호출
//   → GuestVideoDisplay 컴포넌트: <video srcObject={stream} autoPlay />
//      게임 화면이 GUEST 브라우저에 뜬다.
//
// 이후 GUEST가 버튼을 누르면:
//   peer.sendInput() → "input" DataChannel → HOST NetplayPeer.onInput()
//   → emulatorRuntimeBridge.sendInput() → 에뮬레이터 버튼 적용
//   → 화면 변화 → MediaStream에 즉시 반영 → GUEST 화면에 전달

const _8_guest_receives_video = {
  sessionHook:    useNetplaySession,
  runtimeBridge:  createEmulatorRuntimeBridge,
  sendInput:      NetplayPeer.prototype.sendInput,
};

export type _Refs =
  typeof _1_host_creates_room &
  typeof _2_guest_joins_room &
  typeof _3_sdp_negotiation &
  typeof _4_ice_exchange &
  typeof _5_connection_established &
  typeof _6_ready_handshake &
  typeof _7_video_capture_and_stream &
  typeof _8_guest_receives_video;

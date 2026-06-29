/**
 * @file webrtc-flow.ts
 *
 * WebRTC 연결 흐름 문서 — 실행 코드 없음.
 * import로 심볼을 참조하기 때문에 각 항목에서 F12(정의로 이동)가 동작한다.
 *
 * ──────────────────────────────────────────────────────────────────
 * 한 줄 요약
 *   시그널링(1~3단계) = 서버를 통해 서로를 찾는 과정
 *   그 이후(4~6단계) = 찾은 브라우저끼리 서버 없이 직접 통신
 *
 * "직접 통신"에는 두 종류가 있다.
 *   DataChannel  — 버튼 입력, 게임 시작 신호, 채팅 등 데이터
 *   MediaStream  — 게임 화면과 소리 (영상/오디오 트랙)
 * ──────────────────────────────────────────────────────────────────
 */

// ─────────────────────────────────────────────
// 1단계 — 방 코드 교환 (서버 경유, WebRTC 아직 없음)
// ─────────────────────────────────────────────
/**
 * HOST: ROM 선택 → startHostingRoom() → peer.createRoom()
 * GUEST: 코드 입력 → joinRoom() → peer.joinRoom()
 *
 * SignalingClient가 서버 WebSocket에 연결하고,
 * "create-room" / "join-room" 메시지를 전송한다.
 *
 * 서버는 attachSignalingServer() 안에서 메시지를 받아
 * createRoomStore().createRoom() / attachGuest()를 실행한다.
 * 6자리 방 코드는 createRoomStore() 내부에서 생성된다.
 */
import { useNetplayRoomEntry } from "../src/netplay/useNetplayRoomEntry";
import { SignalingClient } from "../src/netplay/signaling";
import { attachSignalingServer } from "../server/signaling";
import { createRoomStore } from "../server/roomStore";

// ─────────────────────────────────────────────
// 2단계 — SDP 협상 (코덱·기능 맞추기)
// ─────────────────────────────────────────────
/**
 * GUEST 입장 신호를 받은 HOST가 RTCPeerConnection을 생성하고
 * createOffer()로 SDP offer를 만든다.
 * offer 안에는 "H.264 영상, Opus 오디오, DataChannel 가능" 같은 정보가 담긴다.
 *
 * SignalingClient.send({ type: "offer", sdp }) → 서버 중계 → GUEST
 * GUEST는 createAnswer()로 응답 → 서버 중계 → HOST
 * 양쪽이 setRemoteDescription() 호출 → 코덱·형식 합의 완료
 *
 * 이 모든 RTCPeerConnection 로직은 NetplayPeer 클래스 안에 있다.
 * offer/answer를 전달하는 서버 쪽 핸들러도 attachSignalingServer() 내부다.
 */
import { NetplayPeer } from "../src/netplay/peer";

// ─────────────────────────────────────────────
// 3단계 — ICE candidate 교환 (IP 주소 찾아서 주고받기)
// ─────────────────────────────────────────────
/**
 * RTCPeerConnection의 onicecandidate 이벤트가 발생할 때마다
 * SignalingClient.send({ type: "ice-candidate", candidate })로 전송한다.
 * 서버는 그대로 상대방에게 전달하고, 받은 쪽은 addIceCandidate()를 호출한다.
 *
 * candidate 우선순위:
 *   "host"  — 로컬 IP (같은 네트워크면 이것만으로 연결)
 *   "srflx" — STUN 서버로 알아낸 공인 IP
 *   "relay" — TURN 서버 중계 (방화벽 환경 최후 수단)
 *
 * candidate를 발견하는 즉시 전송하고 상대방이 바로 시도하는 방식 = trickle ICE
 * NetplayCandidateType이 이 세 가지를 타입으로 정의하고 있다.
 *
 * 가장 먼저 성공한 경로로 연결이 확정되면 RTCPeerConnection 상태가 "connected"가 된다.
 * 이 순간 시그널링이 끝난다. 이후 서버는 더 이상 개입하지 않는다.
 */
import { type NetplayCandidateType } from "../src/netplay/peer";

// ─────────────────────────────────────────────
// 4단계 — 연결 수립, DataChannel 오픈
// ─────────────────────────────────────────────
/**
 * RTCPeerConnection이 "connected"가 되면
 * useNetplayPeerFactory에서 등록한 PeerEventHandler.onConnected()가 호출된다.
 *
 * DataChannel 4개는 HOST 쪽 NetplayPeer 생성 시 createDataChannel()로 미리 만든 것이다.
 * 연결 수립과 함께 자동으로 열린다.
 *
 *   "input"   (비신뢰성) — GUEST 버튼 입력. 패킷 유실 허용, 재전송 없음. 빠름.
 *   "control" (신뢰성)  — peer-ready, start-signal, heartbeat. 반드시 도착해야 함.
 *   "repair"  (비신뢰성) — 120ms마다 눌린 버튼 전체 상태 강제 동기화.
 *   "chat"    (신뢰성)  — 채팅 메시지, 타이핑 상태.
 *
 * PeerEventHandler는 NetplayPeer 생성 시 useNetplayPeerFactory에서 주입한다.
 */
import { useNetplayPeerFactory } from "../src/netplay/useNetplayPeerFactory";
import { type PeerEventHandler } from "../src/netplay/peer";

// ─────────────────────────────────────────────
// 5단계 — peer-ready / start-signal 교환
// ─────────────────────────────────────────────
/**
 * DataChannel "control"이 열리면 useNetplayInitialSync가 동작한다.
 *
 * GUEST: DataChannel 오픈 즉시 → peer.sendPeerReady()
 *   → controlDC.send({ type: "peer-ready" })
 *
 * HOST: peer-ready 수신 → handlePeerReady()
 *   localReady(에뮬레이터 로딩 완료) && remoteReady(peer-ready 수신)
 *   → startGame()
 *     1. emulatorRuntime.resumeGame()   에뮬레이터 재개
 *     2. onHostGameStarted()            비디오 캡처 시작 트리거 (6단계로)
 *     3. peer.sendStartSignal()         "start-signal" 전송
 *
 * GUEST: start-signal 수신 → handlePeerStartSignal() → startGame()
 *   → setGameStarted(true) → <video> 태그 재생 시작
 */
import { useNetplayInitialSync } from "../src/netplay/useNetplayInitialSync";

// ─────────────────────────────────────────────
// 6단계 — 비디오 캡처 및 스트림 전송
// ─────────────────────────────────────────────
/**
 * HOST: onHostGameStarted() → handleStartVideoCapture() (useNetplaySession 내부)
 *   → createEmulatorRuntimeBridge().captureStream()
 *
 * captureStream() 내부:
 *   1. canvas.captureStream(60)              60fps 영상 트랙
 *   2. videoTrack.contentHint = "detail"    픽셀 선명도 우선 인코딩 힌트
 *   3. captureAudioFromEJS()
 *        EJS_emulator.Module.SDL2.audioContext 탐색
 *        AudioContext.createMediaStreamDestination()
 *        audioTrack.contentHint = "music"
 *   4. new MediaStream([videoTrack, audioTrack]) 반환
 *
 * → peer.startVideoStreaming(stream)
 *   → RTCPeerConnection.addTrack() → renegotiation(SDP 재협상) 자동 발생
 *
 * renegotiation: 처음 협상 때는 DataChannel만 있었다.
 * addTrack()으로 영상/오디오를 추가하면 SDP가 달라지므로 짧게 다시 협상한다.
 * 재협상이 끝나면 GUEST 쪽으로 영상/소리가 흘러들어간다.
 *
 * GUEST: ontrack 이벤트 → PeerEventHandler.onVideoStream(stream)
 *   → setGuestVideoStream(stream) (useNetplaySession)
 *   → GuestVideoDisplay: <video srcObject={stream} autoPlay />
 */
import { useNetplaySession } from "../src/netplay/useNetplaySession";
import { createEmulatorRuntimeBridge } from "../src/lib/emulator-runtime-bridge";

// ─────────────────────────────────────────────
// 사용하지 않는 import 경고 억제용 (실행 코드 없는 문서 파일)
// ─────────────────────────────────────────────
export type _Refs = {
  _1: typeof useNetplayRoomEntry;
  _2: typeof SignalingClient;
  _3: typeof attachSignalingServer;
  _4: typeof createRoomStore;
  _5: typeof NetplayPeer;
  _6: NetplayCandidateType;
  _7: typeof useNetplayPeerFactory;
  _8: PeerEventHandler;
  _9: typeof useNetplayInitialSync;
  _10: typeof useNetplaySession;
  _11: typeof createEmulatorRuntimeBridge;
};

# RTCADE — 코드 흐름 문서

> 페이지별 렌더링 순서, 함수 호출 체인, 방 생성부터 게임 시작까지의 전체 흐름을 기록한다.
> 코드를 처음 보는 사람도 전체 구조를 파악할 수 있도록 작성됐다.

---

## 1. 전체 아키텍처 한 눈에 보기

```
[브라우저 — Vite + React 19]         [서버 — Express 5 + ws]
  App.tsx                              server/index.ts
    └─ AppShell (레이아웃)               ├─ roomStore  (방 메모리 저장)
        ├─ HomePage                      ├─ signaling  (WebSocket 시그널링)
        ├─ NetplayPage                   ├─ romApi     (ROM 파일 서빙)
        │    └─ NetplayLobby             ├─ statsApi   (통계)
        │         ├─ useNetplaySession   └─ operationsDatabase (PostgreSQL)
        │         └─ useSoloSession
        ├─ NoticesPage
        └─ SettingsPage
```

**데이터 흐름 원칙**
- 서버는 방 코드 관리·시그널링만 담당한다. 게임 데이터는 서버를 거치지 않는다.
- HOST가 게임을 실행하고 화면/소리를 WebRTC MediaStream으로 GUEST에게 직접 전송한다.
- GUEST의 버튼 입력은 DataChannel(비신뢰성)로 HOST에 직접 전달된다.

---

## 2. 앱 시작 순서

### 2-1. 진입점

```
main.tsx
  └─ ReactDOM.createRoot → <App />
```

### 2-2. App.tsx 초기화 순서

```
App()
  1. getUserProfile()         ← localStorage에서 닉네임/아바타 읽기
  2. useState(profile)        ← 없으면 null → NicknameSetup 다이얼로그 표시
  3. AppTutorialProvider      ← 튜토리얼 컨텍스트 제공
  4. Routes 렌더              ← React Router
       / → HomePage
       /netplay → NetplayPage
       /notices → NoticesPage
       /settings → SettingsPage
  5. NicknameSetup            ← 프로필 없을 때 모달로 표시 (전체 차단)
  6. Toaster                  ← sonner 전역 toast
```

---

## 3. 페이지별 상세 흐름

### 3-1. HomePage (`/`)

```
HomePage
  ├─ usePageSeo()              ← <title>, og:title 등 SEO 메타태그 주입
  ├─ useOperationsStats()      ← GET /api/stats 폴링 (방문자 수, 현재 플레이 수 등)
  ├─ useOperationsNotices()    ← GET /api/notices 폴링 (운영 공지)
  └─ 렌더
       ├─ 통계 카드 (방문자, 게임 세션 수)
       ├─ 공지 목록
       └─ GameCard 목록 (인기 게임 썸네일)
```

---

### 3-2. NetplayPage (`/netplay`)

```
NetplayPage
  1. usePageSeo()
  2. detectMobileAccess()       ← 모바일이면 "PC 전용" 안내 화면 반환
  3. useNetplayLobbyStore()     ← Zustand 전역 상태 구독
       - state.step             : 현재 화면 단계
       - mode                   : "netplay" | "solo"
  4. useEffect → cleanup        ← 페이지 언마운트 시 resetLobby() 호출
  5. NetplayLobby 렌더           ← 실제 모든 로직은 여기서 처리
```

---

### 3-3. NetplayLobby (핵심 컴포넌트)

**`LobbyState.step`** 값에 따라 렌더할 화면이 결정된다.

| step | 화면 | 설명 |
|------|------|------|
| `menu` | NetplayMenuScreen | 메인 메뉴 (넷플레이/혼자하기/관전 선택) |
| `browse` | NetplayBrowseRomsScreen | 넷플레이용 ROM 목록 |
| `solo-browse` | SoloBrowseRomsScreen | 혼자하기용 ROM 목록 |
| `public-rooms` | NetplayPublicRoomsScreen | 공개 방 목록 |
| `watch-rooms` | NetplayWatchingRoomsScreen | 관전 가능한 방 목록 |
| `waiting` | NetplayWaitingScreen | 대기실 (방 코드 표시, 준비 버튼) |
| `join-input` | NetplayJoinRoomScreen | 방 코드 입력 화면 |
| `spectate-input` | NetplaySpectateCodeScreen | 관전 코드 입력 화면 |
| `playing` | NetplayPlayingScreen | 게임 실행 화면 (HOST/GUEST) |
| `watching` | NetplayWatchingScreen | 관전 화면 |
| `solo-playing` | SoloPlayingScreen | 혼자하기 게임 화면 |
| `session-summary` | NetplaySessionSummary | 세션 종료 결과 화면 |

**NetplayLobby 초기화 순서:**

```
NetplayLobby()
  1. useNetplayLobbyStore()     ← Zustand에서 모든 UI 상태 구독
  2. useNetplayDiscovery()      ← ROM 목록·공개방 목록 fetch 담당
  3. useSoloSession()           ← 혼자하기 세션 관리
  4. useNetplaySession()        ← 넷플레이 세션 전체 관리 (핵심)
  5. state.step에 따라 화면 분기 렌더
```

---

## 4. 넷플레이 훅 계층 구조

```
useNetplaySession                   ← 모든 것을 조합하는 최상위 훅
  ├─ useNetplayPeerRoomFlow         ← Peer 생성 + 방 입/퇴장
  │    ├─ useNetplayPeerFactory     ← NetplayPeer 인스턴스 생성 + 이벤트 연결
  │    └─ useNetplayRoomEntry       ← 방 생성/입장/관전 시그널링 호출
  ├─ useNetplaySyncRuntime          ← 게임 시작 동기화 (HOST ↔ GUEST)
  │    └─ useNetplayInitialSync     ← peer-ready / start-signal 교환
  ├─ useNetplaySessionLifecycle     ← 세션 시작/종료 처리
  ├─ useNetplaySessionHistory       ← 최근 게임·상대방 기록 저장
  └─ useNetplayChatControls         ← 채팅 입력 관리
```

---

## 5. 방 만들고 게임 시작하기 — 전체 함수 호출 순서

### 5-1. HOST: 방 만들기 (ROM 선택 → 대기실)

```
[사용자 클릭: ROM 선택]
NetplayLobby.handleCreateRoom(romInfo)
  └─ useNetplaySession.handleCreateRoom()
       └─ useNetplayPeerRoomFlow.handleCreateRoom()
            └─ useNetplayRoomEntry.startHostingRoom({ romFilename, romPath, core })
                 1. fetchNetplayRtcConfiguration()     ← GET /api/ice-servers
                 2. createPeer(rtcConfiguration)
                      └─ useNetplayPeerFactory.createPeer()
                           └─ new NetplayPeer(handlers, rtcConfiguration)
                                └─ new SignalingClient(SERVER_WS_URL)
                                     └─ WebSocket 연결 시작
                 3. peer.createRoom({ romFilename, core, bios, isPublic, nickname, avatar })
                      └─ SignalingClient.send({ type: "create-room", ... })
                           → 서버: roomStore.createRoom() → 6자리 코드 생성
                           ← 서버: { type: "room-created", code: "123456" }
                 4. setState({ step: "waiting", code: "123456", role: "host", ... })
                      → 화면: NetplayWaitingScreen (방 코드 표시)
```

---

### 5-2. GUEST: 방 입장 (코드 입력 → 대기실)

```
[사용자 입력: 방 코드 "123456"]
NetplayLobby.handleJoinRoom()
  └─ useNetplaySession.handleJoinRoom()
       └─ useNetplayPeerRoomFlow.handleJoinRoom()
            └─ useNetplayRoomEntry.joinRoom(code)
                 1. fetchNetplayRtcConfiguration()     ← GET /api/ice-servers
                 2. createPeer(rtcConfiguration)        ← NetplayPeer + SignalingClient 생성
                 3. peer.joinRoom({ code, nickname, avatar })
                      └─ SignalingClient.send({ type: "join-room", code })
                           → 서버: roomStore.attachGuest(room, guestWs)
                           ← 서버: { type: "room-joined", code, role: "guest", romPath, ... }
                 4. setState({ step: "waiting", role: "guest", ... })
                      → 화면: NetplayWaitingScreen (준비 버튼 표시)
```

---

### 5-3. WebRTC 연결 수립 (HOST ↔ GUEST 시그널링)

서버는 메시지를 중계만 한다. 실제 연결은 브라우저끼리 직접 이뤄진다.

```
HOST                    서버(signaling.ts)               GUEST

peer.joinRoom 수신 시
  RTCPeerConnection 생성
  createOffer()
  → { type: "offer", sdp }  →  상대방에게 전달  →  setRemoteDescription(offer)
                                                    createAnswer()
  ← { type: "answer", sdp } ←  상대방에게 전달  ←  answer 전송
  setRemoteDescription(answer)

  ↔ ICE candidates 교환 (양방향, 여러 번)

  RTCPeerConnection 수립 완료 (CONNECTED)
  DataChannel "input", "control", "repair", "chat" 오픈
  → PeerEventHandler.onConnected() 호출
```

---

### 5-4. 대기실 — 준비 상태 관리

```
[GUEST 클릭: 준비 버튼]
NetplayLobby.handleSetRoomReady()
  └─ peer.send({ type: "set-ready", ready: true })
       → 서버: roomStore.setParticipantReady(room, guestWs, true)
       ← 서버: room-lobby-updated 브로드캐스트 (모든 참가자에게)
            → PeerEventHandler.onRoomLobbyUpdated(info)
                 └─ setState({ canStart: true, ... })
                      → 화면: HOST에게 "시작" 버튼 활성화

[HOST 클릭: 시작 버튼]
NetplayLobby.handleStartRoomSession()
  └─ peer.send({ type: "start-session" })
       → 서버: roomStore.markPlaying(room)
       ← 서버: room-session-started 브로드캐스트
            → PeerEventHandler.onSessionStarted(info)
                 └─ setState({ step: "playing", role: "host"|"guest" })
                      → 화면: NetplayPlayingScreen + EmulatorPlayer
```

---

### 5-5. 게임 시작 동기화 (HOST ↔ GUEST ready 교환)

`step: "playing"` 진입 후 에뮬레이터 로딩이 완료되면 진행된다.

```
HOST                                    GUEST
EmulatorPlayer 로딩 완료
  → handleEmulatorReady()
      └─ useNetplayInitialSync.localReadyRef = true
                                        DataChannel "control" 오픈
                                          → peer.sendPeerReady()
                                              └─ DC.send({ type: "peer-ready" })

HOST가 peer-ready 수신
  PeerEventHandler.onPeerReady()
    └─ useNetplayInitialSync.handlePeerReady()
         if (localReady && remoteReady):
           startGame("HOST 동기화 완료", notifyPeer: true)
             1. emulatorRuntime.resumeGame()    ← 에뮬레이터 재개
             2. onHostGameStarted()             ← 비디오 캡처 시작 트리거
             3. peer.sendStartSignal()
                  └─ DC.send({ type: "start-signal" })

                                        GUEST가 start-signal 수신
                                          PeerEventHandler.onStartSignal()
                                            └─ handlePeerStartSignal()
                                                 startGame("GUEST start-signal 수신", false)
                                                   └─ setGameStarted(true)
                                                        → <video> 태그 재생 시작
```

---

### 5-6. HOST 비디오 캡처 시작

```
onHostGameStarted() 콜백 (useNetplaySession 내부)
  └─ handleStartVideoCapture()
       └─ emulatorRuntimeBridge.captureStream()
            1. canvas = document.querySelector("#emulator canvas")
            2. videoStream = canvas.captureStream(60)
            3. videoTrack.contentHint = "detail"
            4. captureAudioFromEJS(emulatorRef)
                 ├─ EJS_emulator.Module.SDL2.audioContext 탐색
                 ├─ AudioContext.createMediaStreamDestination()
                 └─ audioTrack.contentHint = "music"
            5. MediaStream(videoTrack + audioTrack) 반환

  → peer.startVideoStreaming(stream)
       └─ RTCPeerConnection.addTrack(videoTrack, stream)
       └─ RTCPeerConnection.addTrack(audioTrack, stream)
          → WebRTC 재협상(renegotiation) → GUEST에게 스트림 전달

GUEST 측:
  PeerEventHandler.onVideoStream(stream)
    └─ setGuestVideoStream(stream)
         → GuestVideoDisplay: <video srcObject={stream} autoPlay />
```

---

### 5-7. 실행 중 입력 흐름

```
GUEST 키 누름
  NetplayPlayingScreen → handleLocalInput(button, down)
    └─ peer.sendInput(button, down, seq++)
         └─ inputDC.send({ type:"input", button, down, heldMask, seq, sentAt })

HOST 수신
  PeerEventHandler.onInput(msg)
    └─ handleRemoteInput(msg)
         └─ emulatorRuntimeBridge.sendInput(button, down)
              └─ window.EJS_emulator.gameManager.simulateInput(0, button, down ? 1 : 0)
                   → 에뮬레이터에 버튼 입력 적용
                   → 화면 변화 → MediaStream에 즉시 반영 → GUEST 화면에 전달
```

**`repair` 채널 (입력 드리프트 보정):**
```
120ms마다 HOST → GUEST
  repairDC.send({ type: "input-sync", heldMask, seq })
    → GUEST: 현재 눌린 버튼 상태를 강제로 맞춤 (패킷 유실 보정)
```

---

### 5-8. 세션 종료 흐름

```
[상대방 연결 끊김 또는 나가기]
PeerEventHandler.onDisconnected()
  └─ useNetplaySessionLifecycle.completeSession("peer-left")
       1. peer.close()
       2. useNetplaySessionHistory.markSessionEnded()
            └─ localStorage에 최근 게임·상대방 기록 저장
       3. setState({ step: "session-summary", ... })
            → NetplaySessionSummary 화면 표시

[재매치 버튼]
  handleSummaryRematch() → 같은 ROM으로 방 다시 생성 (5-1 흐름 반복)

[다른 게임 버튼]
  handleSummaryChooseAnotherGame() → setState({ step: "browse" })
```

---

## 6. 혼자하기(Solo) 흐름

```
[메뉴 → 혼자하기 선택]
setState({ step: "solo-browse" })
  → SoloBrowseRomsScreen: ROM 목록 표시

[ROM 선택]
useSoloSession.startSoloGame(romInfo)
  1. recordGameSession()         ← POST /api/game-sessions
  2. upsertActivePlaySession()   ← POST /api/active-play-sessions
  3. setState({ step: "solo-playing", ... })
       → SoloPlayingScreen + EmulatorPlayer

[게임 중 — 15초마다]
  upsertActivePlaySession()      ← heartbeat (활성 세션 TTL 갱신)

[나가기]
useSoloSession.handleBack()
  1. completeGameSession()       ← POST /api/game-sessions/:id/complete
  2. endActivePlaySession()      ← DELETE /api/active-play-sessions/:id
  3. upsertRecentGame()          ← localStorage 최근 게임 기록 업데이트
  4. setState({ step: "menu" })
```

---

## 7. 서버 초기화 순서 (server/index.ts)

```
bootstrap()
  1. getServerConfig()                    ← 환경변수 파싱 (PORT, CORS_ORIGIN, DB URL 등)
  2. createRoomStore()                    ← 방 메모리 저장소 초기화
  3. createOperationsDatabase(dbUrl)      ← PostgreSQL 연결 (없으면 폴백 모드)
  4. createPlaySessionStore()             ← 혼자하기 세션 TTL 저장소
  5. createServer(express()) + WebSocketServer
  6. operationsDatabase.initialize()      ← DB 테이블 자동 생성
  7. operationsDatabase.closeStaleGameSessions()  ← 이전 서버 재시작 후 미완료 세션 정리
  8. playSessionStore.startPruneInterval()       ← 30초 TTL 만료 체크 시작

  미들웨어 등록 순서:
  app.use(express.json())
  app.use(createCorsMiddleware(allowedOrigins))
  app.use(createVisitorTrackingMiddleware(db))   ← GET 요청마다 방문자 쿠키 처리

  라우트 등록 순서:
  registerRomRoutes()          ← GET /roms/*, GET /api/roms
  registerIceServerRoutes()    ← GET /api/ice-servers
  registerPublicRoomRoutes()   ← GET /api/rooms, GET /api/rooms/playing
  registerNoticeRoutes()       ← GET/POST/PATCH /api/notices
  registerStatsRoutes()        ← GET /api/stats, POST /api/game-sessions 등

  WebSocket:
  attachSignalingServer(wss, roomStore)   ← ws:// 연결 시그널링 처리 시작

  9. server.listen(PORT)
  process.on("SIGTERM"|"SIGINT") → graceful shutdown
```

---

## 8. 시그널링 서버 메시지 처리 (server/signaling.ts)

| 클라이언트 → 서버 | 서버 처리 | 서버 → 클라이언트 |
|---|---|---|
| `create-room` | `roomStore.createRoom()` | `room-created` (HOST) |
| `join-room` | `roomStore.attachGuest()` | `room-joined` (GUEST) + `room-lobby-updated` (전체) |
| `spectate-room` | `roomStore.attachSpectator()` | `room-joined` (관전자) |
| `set-ready` | `roomStore.setParticipantReady()` | `room-lobby-updated` (전체) |
| `start-session` | `roomStore.markPlaying()` | `room-session-started` (전체) |
| `update-room-game` | `roomStore.updateRoomGame()` | `room-lobby-updated` (전체) |
| `kick-participant` | `detachGuest()` / `detachSpectator()` | `room-kicked` (대상) |
| `offer` / `answer` / `ice-candidate` | 상대방에게 중계 | 그대로 전달 |
| `leave-room` | `roomStore.deleteRoom()` 또는 분리 | `peer-disconnected` (상대방) |

---

## 9. DataChannel 구성 (peer.ts)

```
NetplayPeer 생성 시 DataChannel 4개:

  "input"   (ordered: false, maxRetransmits: 0)  ← 버튼 입력 (비신뢰성, 최신만 필요)
  "control" (ordered: true,  reliable)            ← peer-ready, start-signal, heartbeat
  "repair"  (ordered: false, maxRetransmits: 0)  ← 120ms 주기 held-mask 보정
  "chat"    (ordered: true,  reliable)            ← 채팅 메시지, 타이핑 상태
```

---

## 10. 상태 관리 구조 (Zustand)

```
useNetplayLobbyStore (Zustand)
  ├─ mode: "netplay" | "solo"
  ├─ state: LobbyState                ← 현재 화면 단계 (step으로 구분)
  ├─ joinCode, roomVisibility
  ├─ status, error                    ← 상단 상태 메시지
  ├─ dcState, chatChannelState        ← DataChannel 상태
  ├─ gameStarted                      ← 에뮬레이터 시작 여부
  ├─ opponentProfile                  ← 상대방 닉네임/아바타
  ├─ chatMessages, chatOpen, chatDraft, unreadChatCount
  ├─ isPeerTyping
  ├─ syncDisplay, networkStats
  ├─ recentGames, recentOpponents, favoriteGames
  └─ menuPublicRooms
```

모든 UI 상태는 Zustand store에 있고, `NetplayLobby`가 전부 구독한다.
하위 화면 컴포넌트(NetplayWaitingScreen, NetplayPlayingScreen 등)는 필요한 값만 props로 받는다.

# RTCADE GGPO 롤백 넷플레이 설계 문서

## 1. 개요

EmulatorJS + 미디어 스트리밍 방식을 **@mantou/fbneo** (FinalBurn Neo WASM) + GGPO 롤백 방식으로 완전히 대체한다.

- 솔로 플레이도 FBNeo WASM으로 교체
- 넷플레이는 입력만 P2P로 교환하고 양쪽이 각자 렌더링
- 비디오 스트리밍 완전 제거 → 대역폭 절감, 입력 지연 최소화
- 기존 EmulatorJS 코드는 그대로 보존, 신규 코드는 별도 폴더에 작성

## 2. `@mantou/fbneo` 패키지 분석

### 2.1 패키지 정보

| 항목 | 값 |
|------|-----|
| 이름 | @mantou/fbneo |
| 버전 | 0.0.4 |
| 저장소 | https://github.com/mantou132/FBNeo (nesbox 브랜치) |
| 예제 | https://github.com/mantou132/nesbox/blob/dev/packages/arcade/src/index.ts |
| 크기 | unpacked 39.6MB |

### 2.2 제공되는 WASM 변형

| 파일 | 용도 | 크기 추정 |
|------|------|-----------|
| `fbneo-arcade.js` / `.wasm` | 일반 아케이드 (CPS1, CPS2, System16 등) | ~39MB |
| `fbneo-neogeo.js` / `.wasm` | Neo Geo 전용 | ~19MB |
| `fbneo-konami.js` / `.wasm` | Konami 전용 | ~?MB |

### 2.3 핵심 API

| API | 설명 | GGPO 연관성 |
|-----|------|-------------|
| `init({...})` | WASM 모듈 초기화, 콜백 등록 | 초기화 |
| `cwrap('startMain', ...)` | ROM 로드 후 메인루프 시작 | 게임 시작 |
| `_collectGameInputs()` | 입력 수집 | 매 프레임 |
| `_doLoop()` | 한 프레임 실행 | **매 프레임 단위 실행 가능 (핵심)** |
| `_setEmInput(player, inputMask)` | 플레이어 입력 비트마스크 설정 | **입력 주입 (핵심)** |
| `_saveAllState(1)` / `_saveAllState(0)` | 상태 저장/로드 트리거 | **상태 스냅샷 (핵심)** |
| `FS.readFile()` / `FS.writeFile()` | Emscripten 가상 파일시스템 | 상태 저장/복원 |
| `frameNum` | 현재 프레임 번호 (증가만 함) | **롤백 추적 (핵심)** |
| `drawScreen(vidImagePtr)` | 프레임 렌더링 콜백 | 화면 출력 |
| `audioCallback(soundPtr, length)` | 오디오 콜백 (Int16Array) | 사운드 출력 |

### 2.4 상태 저장/복원 메커니즘

```typescript
// 상태 저장
this.#fbneo!._saveAllState(1);                         // FS에 현재 상태 쓰기
return this.#fbneo!.FS.readFile(this.#statePath);      // 파일 읽기 → Uint8Array

// 상태 복원
this.#fbneo!.FS.writeFile(this.#statePath, state);     // FS에 상태 쓰기
this.#fbneo!._saveAllState(0);                         // FS에서 상태 읽어 복원
```

상태 파일 경로: `/libsdl/fbneo/states/{romname}.fs.all`

### 2.5 입력 비트마스크

```typescript
// 6버튼 아케이드 (kof, sfa 등)
INP_LEFT = 1, INP_RIGHT = 2, INP_UP = 4, INP_DOWN = 8,
INP_START = 16, INP_SELECT = 32,
INP_B1 = 64, INP_B2 = 128, INP_B3 = 256,
INP_B4 = 512, INP_B5 = 1024, INP_B6 = 2048
```

### 2.6 주의사항

- `startMain()` 호출 전에는 `buf.data` 접근 불가 (Emscripten lazy init)
- `frameNum`은 `load_rom` 시 0으로 리셋
- `clock_frame()`은 `_collectGameInputs()` + `_doLoop()` 순서로 호출해야 함
- WASM 파일이 매우 크므로 Service Worker 캐싱 또는 CDN 필요
- SharedArrayBuffer 사용 시 COOP/COEP 헤더 필수

## 3. GGPO 롤백 알고리즘 개요

### 3.1 기본 원리

1. **입력 지연 (Delay Frames)**: 네트워크 지연을 흡수하기 위해 일정 프레임(보통 2~4)만큼 입력 적용을 지연
2. **예측 실행**: 원격 입력이 도착하지 않은 프레임은 마지막 알려진 입력으로 예측
3. **롤백 + 재시뮬레이션**: 뒤늦게 도착한 입력이 예측과 다르면 해당 프레임으로 롤백 후 재실행

### 3.2 알고리즘

```
상수: DELAY_FRAMES = 3, HISTORY_SIZE = 60

매 프레임:
  1. 로컬 입력 읽기 (keyboard)
  2. remote peer에게 { frameNum, inputMask } 전송
  3. (frameNum - DELAY_FRAMES) 시점의 원격 입력 확인
     - 도착: 해당 입력으로 결정
     - 미도착: 마지막 알려진 입력으로 예측
  4. _collectGameInputs() → _doLoop() → frameNum++
  5. 상태 스냅샷: stateHistory[frameNum % HISTORY_SIZE] = saveState()
  6. drawScreen() → Canvas 렌더링

원격 입력 수신 시:
  1. 해당 프레임의 예측과 실제 입력 비교
  2. 불일치 → 롤백:
     a. loadState(stateHistory[frameNum])
     b. 저장된 입력들로 frameNum → currentFrame 재시뮬레이션
     c. 결과 렌더링
```

### 3.3 롤백 최적화

- 롤백이 발생한 프레임부터 현재 프레임까지 최대한 빠르게 재실행 (렌더링 생략 가능)
- 상태 스냅샷은 메모리상 링 버퍼로 관리 (HISTORY_SIZE = 60프레임 = 1초)
- 예측이 대부분 맞으면 (정적 상태) 롤백은 드물게 발생

## 4. 아키텍처

### 4.1 디렉토리 구조 (신규)

```
src/
  lib/
    fbneo/                    # FBNeo WASM 래퍼
      ArcadeWrapper.ts        # nesbox Arcade 클래스 기반
      input.ts                # 키보드→비트마스크 매핑
      render.ts               # RGBA → Canvas 렌더링
  netplay-ggpo/               # GGPO 넷플레이 (신규)
    ggpo/
      GGPOEngine.ts           # 롤백 엔진 코어
      InputQueue.ts           # 프레임별 입력 버퍼
      StateHistory.ts         # 상태 스냅샷 링 버퍼
      RollbackController.ts   # 롤백 검출 + 재시뮬레이션
    GGPONetplayPeer.ts        # WebRTC P2P (input/control/chat)
    useGGPOSession.ts         # 세션 관리 훅
    types.ts                  # 공통 타입
  components/
    netplay-ggpo/             # FBNeo 전용 UI
      GGPOPlayingScreen.tsx
      GGPOPlayerCanvas.tsx
      GGPONetworkStats.tsx
server/
  ggpo/
    signaling.ts              # 시그널링 (기존 roomStore 재활용)
docs/
  ggpo-netplay-design.md      # 본 문서
```

### 4.2 전체 아키텍처

```
┌─────────────── HOST ───────────────┐       ┌────────────── GUEST ──────────────┐
│ ArcadeWrapper (FBNeo WASM)         │       │ ArcadeWrapper (FBNeo WASM)         │
│   frameNum = 0,1,2...              │       │   frameNum = 0,1,2...              │
│   clockFrame() → render + audio    │       │   clockFrame() → render + audio    │
│   saveState() → Uint8Array         │       │   saveState() → Uint8Array         │
│   loadState(Uint8Array)            │       │   loadState(Uint8Array)            │
│                                    │       │                                    │
│ ┌──────────────────────────────┐   │       │ ┌──────────────────────────────┐   │
│ │  GGPOEngine                   │   │       │ │  GGPOEngine                   │   │
│ │  - InputQueue (delay frames)   │   │       │ │  - InputQueue (delay frames)   │   │
│ │  - StateHistory ring buffer    │◄──┼───────┼─│  - StateHistory ring buffer    │   │
│ │  - RollbackController          │   │WebRTC │ │  - RollbackController          │   │
│ └──────────────────────────────┘   │       │ └──────────────────────────────┘   │
│                                    │       │                                    │
│ WebRTC DataChannel:                │       │ WebRTC DataChannel:                │
│   "input"  (unreliable)            │       │   "input"  (unreliable)            │
│   "control" (reliable)             │       │   "control" (reliable)             │
│   "chat"   (reliable)              │       │   "chat"   (reliable)              │
└────────────────────────────────────┘       └────────────────────────────────────┘
```

### 4.3 WebRTC DataChannel 설계

| 채널 | 타입 | 용도 | 메시지 포맷 |
|------|------|------|------------|
| `input` | Unordered/Unreliable | 프레임별 입력 교환 | `{ type: "input", frameNum, inputMask, seq, sentAt }` |
| `control` | Ordered/Reliable | 피어 준비, 게임 시작, 하트비트, 동기화 | `{ type: "peer-ready"/"start-signal"/"heartbeat"/"state-hash" }` |
| `chat` | Ordered/Reliable | 채팅 메시지 + 타이핑 상태 | `{ type: "chat-message"/"chat-typing", ... }` |

**repair 채널은 삭제**: GGPO의 롤백이 input sync를 대체한다.
**video 스트리밍은 삭제**: 양쪽이 각자 FBNeo로 렌더링한다.

## 5. 구현 단계

### Phase 0 — 환경 구성
- [x] feature/ggpo-netplay 브랜치 생성
- [x] @mantou/fbneo 설치
- [x] Vite WASM 서빙 + COOP/COEP 헤더 설정
- [ ] docs/ggpo-netplay-design.md 문서 작성
- [ ] 폴더 구조 생성

### Phase 1 — FBNeo 솔로 플레이
- ArcadeWrapper 클래스 구현 (Nes 인터페이스 기반)
- Canvas 렌더링, 키보드 입력, 오디오 출력
- saveState() / loadState() / clockFrame() API 검증
- 성능 측정 (60fps 유지)

### Phase 2 — GGPO 엔진 코어
- InputQueue: 프레임별 입력 버퍼 (delay frames)
- StateHistory: 링 버퍼 상태 스냅샷 (60프레임)
- RollbackController: 예측 불일치 감지 → 롤백 → 재시뮬레이션
- 로컬 2인용 검증 (입력 교환 시뮬레이션)

### Phase 3 — WebRTC P2P 통합
- GGPONetplayPeer: input/control/chat DataChannel
- 시그널링: 기존 roomStore + signaling 재활용
- 입력 교환: 매 프레임 양방향 GGPOInputMessage

### Phase 4 — UI 통합
- GGPOPlayingScreen, GGPOPlayerCanvas
- 넷플레이 로비에 FBNeo 코어 선택 추가
- 네트워크 상태 표시 (delay frames, rollback count, RTT)

## 6. 위험 요소

| 위험 | 영향 | 대응 |
|------|------|------|
| saveState/loadState 성능 | 롤백 시 지연 | 스냅샷 크기 최적화, 압축 고려 |
| WASM 39MB 로딩 시간 | 첫 방문 시 대기 | Service Worker 캐싱, 로딩 UI |
| 브라우저 탭 백그라운드 | 프레임 드리프트 | visibilitychange 감지, UI 경고 |
| FBNeo 호환 ROM | 돌릴 수 있는 게임 제한 | game list 기반 필터링 |
| 롤백 시 오디오 팝/글리치 | 체감 저하 | 오디오 버퍼 초기화 또는 mute during rollback |

## 7. 참고 자료

- [mantou132/FBNeo](https://github.com/mantou132/FBNeo)
- [nesbox Arcade 예제](https://github.com/mantou132/nesbox/blob/dev/packages/arcade/src/index.ts)
- [GGPO 논문](https://www.ggpo.net/)
- [FightCade GGPO 구현](https://www.fightcade.com/)
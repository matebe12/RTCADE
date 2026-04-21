# RTCADE — 프로젝트 아키텍처 문서

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [디렉토리 구조](#3-디렉토리-구조)
4. [시스템 아키텍처](#4-시스템-아키텍처)
5. [프론트엔드 상세](#5-프론트엔드-상세)
6. [백엔드 서버 상세](#6-백엔드-서버-상세)
7. [넷플레이 시스템](#7-넷플레이-시스템)
8. [에뮬레이터 통합](#8-에뮬레이터-통합)
9. [SEO / PWA / 브랜딩](#9-seo--pwa--브랜딩)
10. [빌드 및 실행](#10-빌드-및-실행)
11. [트러블슈팅 & 설계 결정 히스토리](#11-트러블슈팅--설계-결정-히스토리)

---

## 1. 프로젝트 개요

RTCADE는 브라우저에서 레트로 게임을 실행하고, WebRTC 기반 P2P 넷플레이로 2인 대전을 지원하는 웹 애플리케이션이다.

- 솔로 모드는 로컬 ROM 파일 업로드로 실행한다.
- 넷플레이 모드는 6자리 방 코드로 매칭하고, 게임 데이터는 WebRTC DataChannel로 직접 주고받는다.
- 서버는 시그널링, ROM 제공, 운영 API만 담당한다.
- EmulatorJS는 iframe이 아니라 React 트리 안에 직접 마운트된다.

핵심 원칙은 다음과 같다.

1. HOST가 source of truth다.
2. 게임 상태와 입력은 P2P로만 흐른다.
3. 서버는 방 생성/참가와 SDP/ICE 릴레이만 담당한다.
4. PWA는 최소 수동 구성으로 유지한다.

---

## 2. 기술 스택

| 계층 | 기술 | 비고 |
| --- | --- | --- |
| 프론트엔드 | React 19 | Vite SPA |
| 빌드 | Vite 8 | `vite build` |
| 언어 | TypeScript 6 | strict 설정 |
| 서버 | Express 5 | `tsx server/index.ts` |
| 시그널링 | ws | WebSocket |
| 상태 관리 | Zustand | 로비 상태, 세션 상태 |
| 유틸 | pako | 상태 압축/해제 |
| UI | Tailwind CSS v4 + shadcn/ui | 다크 테마 |
| 알림 | sonner | `toast()` 사용 |
| 에뮬레이터 | EmulatorJS CDN | 직접 마운트 |
| P2P | WebRTC DataChannel | host authoritative |

타이포그래피는 Pretendard가 본문 기본이고, Press Start 2P가 강조용이다.

---

## 3. 디렉토리 구조

```text
index.html
public/
  og_image.png
  favicon.ico
  favicon-16.png
  favicon-32.png
  apple-touch-icon.png
  pwa-icon-192.png
  pwa-icon-512.png
  pwa-icon-512-maskable.png
  manifest.webmanifest
  sw.js
server/
  index.ts
  config.ts
  emulator.ts
  signaling.ts
  romApi.ts
  publicRoomApi.ts
  noticeApi.ts
  statsApi.ts
  visitorTracking.ts
  roomStore.ts
  playSessionStore.ts
  operationsDatabase.ts
shared/
  emulator-protocol.ts
src/
  main.tsx
  App.tsx
  index.css
  components/
    EmulatorPlayer.tsx
    NetplayLobby.tsx
    NetplayPlayingScreen.tsx
    layout/
    netplay/
      GuestVideoDisplay.tsx
      NetplayBrowseRomsScreen.tsx
      NetplayJoinRoomScreen.tsx
      NetplayMenuScreen.tsx
      NetplayModeTabs.tsx
      NetplayPlayingScreen.tsx
      NetplayPublicRoomsScreen.tsx
      NetplayWaitingScreen.tsx
  netplay/
    peer.ts
    signaling.ts
    useNetplaySession.ts
    useNetplayInitialSync.ts
    useNetplayResyncLoop.ts
    useNetplaySyncRuntime.ts
  pages/
    HomePage.tsx
    NetplayPage.tsx
    NoticesPage.tsx
    SettingsPage.tsx
  lib/
    emulator-runtime-bridge.ts
    seo.ts
    backend-url.ts
    utils.ts
```

---

## 4. 시스템 아키텍처

```text
┌──────────────────────────── 브라우저 HOST ────────────────────────────┐
│ React App                                                              │
│  ├─ EmulatorPlayer                                                     │
│  ├─ NetplayLobby / NetplayPlayingScreen                                │
│  └─ SEO, PWA, UI                                                       │
│                                                                        │
│ EmulatorJS 직접 마운트                                                 │
│  ├─ EJS_* 전역 설정                                                    │
│  ├─ 캔버스 렌더링                                                      │
│  ├─ 오디오 캡처                                                       │
│  └─ save-state / resync-state                                         │
│                                                                        │
│ WebRTC DataChannel                                                     │
│  ├─ input                                                              │
│  ├─ control                                                            │
│  ├─ state                                                              │
│  ├─ repair                                                             │
│  └─ chat                                                               │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ WebRTC P2P
                                   │
┌──────────────────────────── 브라우저 GUEST ────────────────────────────┐
│ React App                                                              │
│  ├─ GuestVideoDisplay                                                  │
│  ├─ 채팅 / 상태 표시                                                   │
│  └─ 키보드 입력 캡처                                                   │
│                                                                        │
│ HOST가 송출한 비디오/오디오 스트림을 수신                              │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │ WebSocket signaling
                                   ▼
┌────────────────────────────── Express 서버 ────────────────────────────┐
│ ROM 제공, 방 관리, 시그널링, 운영 API                                  │
│  ├─ /roms, /api/roms                                                   │
│  ├─ /api/rooms                                                         │
│  ├─ /api/notices, /api/admin/notices                                   │
│  ├─ /api/stats, /api/game-sessions, /api/active-play-sessions*         │
│  └─ WebSocket signaling                                                 │
└────────────────────────────────────────────────────────────────────────┘
```

핵심 원리:

1. 서버는 게임 프레임을 중계하지 않는다.
2. HOST는 입력과 상태의 기준점이다.
3. GUEST는 HOST 스트림과 상태를 따라간다.
4. 넷플레이는 비디오 스트리밍 우선으로 시작하고, 유휴 구간에서만 상태 동기화를 수행한다.

---

## 5. 프론트엔드 상세

### 5.1 `App.tsx`

- 애플리케이션의 모드 전환을 담당한다.
- `menu`, `solo`, `netplay` 흐름을 관리한다.
- `Toaster`와 `ThemeProvider`를 통해 전역 UI 환경을 구성한다.

### 5.2 `EmulatorPlayer.tsx`

- EmulatorJS를 부모 React DOM에 직접 마운트한다.
- `EJS_*` 전역을 세팅하고 정리한다.
- `window.EJS_emulator`를 직접 다루는 브릿지와 연결된다.
- 캔버스 `captureStream()`과 오디오 캡처를 사용해 HOST 비디오/오디오 송출을 준비한다.

주요 책임:

- `sendStartGame()`
- `requestSaveState()`
- `loadSaveState()`
- `requestResyncGetState()`
- `requestResyncLoadState()`
- `markGameRunning()`
- 오디오 캡처 설치/해제

### 5.3 넷플레이 화면

- `NetplayLobby.tsx`는 방 생성, 참가, 로비 상태, 세션 수명주기를 오케스트레이션한다.
- `NetplayPlayingScreen.tsx`는 HOST에는 `EmulatorPlayer`, GUEST에는 `GuestVideoDisplay`를 렌더한다.
- `GuestVideoDisplay.tsx`는 HOST 스트림을 보여주고, 키보드 입력과 끊김 오버레이를 처리한다.

### 5.4 페이지 레벨

- `HomePage.tsx`는 홈 화면과 운영 정보, 공지, SEO를 책임진다.
- `NetplayPage.tsx`는 넷플레이 진입 화면과 모바일 표시 정책을 담당한다.
- `SettingsPage.tsx`, `NoticesPage.tsx`는 운영성 페이지다.

### 5.5 UI 규칙

- Tailwind CSS v4를 사용한다.
- 인라인 스타일은 쓰지 않는다.
- shadcn/ui 컴포넌트를 우선 사용한다.
- 다크 중립 테마와 카드 중심 레이아웃을 유지한다.

---

## 6. 백엔드 서버 상세

### 6.1 서버 역할

1. ROM 파일 서빙 및 ROM 카탈로그 제공
2. 공개 방 목록 제공
3. WebSocket signaling
4. 공지, 통계, 방문자 추적, 플레이 세션 운영 API

### 6.2 모듈 구조

- `server/index.ts`: 부트스트랩 전용
- `server/config.ts`: 환경변수 및 서버 설정
- `server/romApi.ts`: ROM 서빙과 목록 조회
- `server/publicRoomApi.ts`: 공개 방 요약 반환
- `server/roomStore.ts`: 메모리 기반 방 저장소
- `server/signaling.ts`: offer/answer/ice-candidate 및 room lifecycle 릴레이
- `server/noticeApi.ts`: 운영 공지 API
- `server/statsApi.ts`: 통계 집계
- `server/visitorTracking.ts`: 방문자 식별과 추적
- `server/playSessionStore.ts`: 솔로 세션 TTL 저장소
- `server/operationsDatabase.ts`: 운영 DB 접근
- `server/emulator.ts`: deprecated 410 stub

### 6.3 환경변수

| 변수 | 용도 |
| --- | --- |
| `PORT` | 서버 포트 |
| `CORS_ORIGIN` | 허용 오리진 |
| `ROMS_PATH` | ROM 디렉토리 |
| `DATABASE_URL` | 운영 DB |
| `DATABASE_PRIVATE_URL` | 내부 DB |
| `DATABASE_PUBLIC_URL` | 외부 DB |
| `NOTICE_ADMIN_TOKEN` | 공지 관리자 토큰 |
| `EMULATORJS_DATA_URL` | EmulatorJS CDN data 경로 |

### 6.4 라우트

| 라우트 | 메서드 | 설명 |
| --- | --- | --- |
| `/roms/*` | GET | ROM 정적 파일 |
| `/api/roms` | GET | ROM 목록 JSON |
| `/api/rooms` | GET | 공개 방 목록 |
| `/api/notices` | GET | 공지 목록 |
| `/api/admin/notices` | POST/PUT | 공지 관리 |
| `/api/stats` | GET | 운영 통계 |
| `/api/game-sessions` | GET | 세션 통계 |
| `/api/active-play-sessions*` | GET | 활성 플레이 세션 |

---

## 7. 넷플레이 시스템

### 7.1 데이터 채널 분리

- `input`: 버튼 이벤트, unordered / unreliable
- `control`: `peer-ready`, `state-loaded`, `start-signal`, `resync-loaded`, `resync-failed`, `heartbeat`
- `state`: save-state와 resync state chunk 전송
- `repair`: held mask 보정용
- `chat`: 채팅 메시지와 typing 상태

### 7.2 현재 세션 흐름

1. HOST가 방을 생성한다.
2. GUEST가 방 코드로 참가한다.
3. `peer.ts`가 DataChannel을 열고 세션을 초기화한다.
4. HOST가 초기 save-state를 전송한다.
5. GUEST가 상태를 로드하고 ready를 응답한다.
6. HOST가 시작 신호를 보내고 양쪽이 재생을 시작한다.
7. 입력이 비는 구간에만 resync loop가 상태를 맞춘다.

### 7.3 동기화 오케스트레이션

- `useNetplaySession`는 chat, peer-room, sync runtime, lifecycle, history를 묶는 최상위 훅이다.
- `useNetplayInitialSync`는 초기 상태 전달과 video-streaming-first 시작을 담당한다.
- `useNetplayResyncLoop`는 idle window, timeout, backoff를 사용해 유휴 구간만 보정한다.
- `useNetplaySyncRuntime`는 initial sync와 resync loop를 조합한다.

### 7.4 현재 동작 특성

- HOST는 캔버스와 오디오 스트림을 GUEST에게 보낸다.
- GUEST는 `GuestVideoDisplay`로 원격 플레이를 본다.
- periodic resync는 videoStreamingMode에서는 건너뛴다.
- `HEARTBEAT_*`와 disconnect 조건은 shared protocol 상수에 맞춘다.

### 7.5 구현상 주의점

- 입력 순서가 깨지면 `resetRemoteSeq()`로 시퀀스를 정리한다.
- `startVideoStreaming()`은 renegotiation을 일으키므로 track 변경과 같이 다뤄야 한다.
- `sendInput()`은 local held mask, 전송, repair 갱신을 한 묶음으로 유지한다.
- `cleanup` 경로에서는 `_closing` 가드를 유지해야 한다.

---

## 8. 에뮬레이터 통합

### 8.1 직접 브릿지

- `src/lib/emulator-runtime-bridge.ts`가 `window.EJS_emulator`와 직접 연결한다.
- `postMessage` 기반 iframe 브릿지는 사용하지 않는다.
- 브릿지는 입력, 상태 저장, 상태 로드, 포커스, 리싱크 명령만 다룬다.

### 8.2 공유 프로토콜

- `shared/emulator-protocol.ts`는 버튼 매핑과 코어 리매핑을 정의한다.
- `KEY_TO_BUTTON`와 `CORE_REMAP`은 솔로와 넷플레이 모두에서 동일하게 사용한다.
- `EJS_BUTTONS_CONFIG`와 heartbeat / disconnect 타이밍도 여기서 함께 관리한다.

### 8.3 HOST 처리

- `EmulatorPlayer.tsx`는 `EJS_*` 전역을 설정하고 정리한다.
- 키보드 입력은 캡처 단계에서 차단한다.
- save-state와 resync-state는 chunked binary 전송으로 간다.
- MAME 코어는 첫 `getState()`가 실패할 수 있어 재시도한다.

### 8.4 GUEST 처리

- GUEST는 원격 스트림을 표시하고 로컬 키 입력을 DataChannel로 보낸다.
- 상태를 직접 렌더링하지 않고 HOST 화면을 따라간다.

---

## 9. SEO / PWA / 브랜딩

### 9.1 메타데이터

- `index.html`의 정적 메타와 `src/lib/seo.ts`의 동적 메타는 같은 기준을 사용한다.
- 대표 공유 이미지는 `/og_image.png`다.
- `og:image`, `twitter:image`, canonical, robots는 함께 맞춘다.

### 9.2 PWA

- `public/manifest.webmanifest`와 `public/sw.js`를 수동으로 유지한다.
- `src/main.tsx`는 production + secure context에서만 service worker를 등록한다.
- `vite-plugin-pwa`는 쓰지 않는다.

### 9.3 브랜딩 자산

- OG, favicon, apple-touch-icon, PWA 아이콘은 같은 브랜딩 원본에서 파생되어야 한다.
- 아이콘 세트가 바뀌면 관련 public 자산을 한 번에 정리한다.
- 브라우저 설치 안내는 보통 secure origin에서만 기대할 수 있다.

---

## 10. 빌드 및 실행

```bash
npm run dev:all       # Vite + Express 동시 실행
npm run dev           # 프론트엔드만 실행
npm run server        # 백엔드만 실행
npm run build         # 타입 체크 + 프로덕션 빌드
npx tsc --noEmit      # 타입 체크만 실행
```

---

## 11. 트러블슈팅 & 설계 결정 히스토리

### 채택하지 않은 접근

1. RAF Hook Lockstep — EmulatorJS가 rAF가 아니라 setTimeout 기반이라 프레임 카운터 동기화가 안정적이지 않았다.
2. Frame-tick heartbeat — 60fps DataChannel flooding으로 입력이 밀렸다.
3. Frame-delay lockstep — iframe 내부 프레임 제어가 불가능했다.
4. Pause-resume ACK 대기 — roundtrip 지연이 커서 체감이 나빴다.

### 현재 선택

- HOST 비디오 스트리밍 우선
- 입력은 실시간 P2P
- 상태는 유휴 시에만 보정
- 서버는 시그널링과 운영 API에 집중

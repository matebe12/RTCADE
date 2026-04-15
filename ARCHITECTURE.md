# Retro Emulator Web — 프로젝트 아키텍처 문서

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [디렉토리 구조](#3-디렉토리-구조)
4. [시스템 아키텍처](#4-시스템-아키텍처)
5. [프론트엔드 상세](#5-프론트엔드-상세)
6. [백엔드 서버 상세](#6-백엔드-서버-상세)
7. [넷플레이 시스템](#7-넷플레이-시스템)
8. [에뮬레이터 통합](#8-에뮬레이터-통합)
9. [데이터 흐름 다이어그램](#9-데이터-흐름-다이어그램)
10. [키 매핑](#10-키-매핑)
11. [ROM 관리](#11-rom-관리)
12. [빌드 및 실행](#12-빌드-및-실행)
13. [트러블슈팅 & 설계 결정 히스토리](#13-트러블슈팅--설계-결정-히스토리)

---

## 1. 프로젝트 개요

브라우저에서 레트로 게임을 에뮬레이션하고, **P2P 넷플레이**로 2인 온라인 대전을 지원하는 웹 애플리케이션.

- **솔로 모드**: 로컬 ROM 파일을 업로드하여 혼자 플레이
- **넷플레이 모드**: 6자리 방 코드로 상대방과 연결, WebRTC DataChannel을 통한 P2P 입력 공유 및 상태 동기화

EmulatorJS CDN(LibRetro 코어 기반)을 iframe으로 감싸고, postMessage API로 에뮬레이터와 통신하는 구조.

---

## 2. 기술 스택

| 계층            | 기술                                     | 버전          |
| --------------- | ---------------------------------------- | ------------- |
| **프론트엔드**  | React                                    | 19.2.4        |
| **빌드**        | Vite                                     | 8.0.4         |
| **언어**        | TypeScript                               | 6.0.2         |
| **서버**        | Express                                  | 5.2.1         |
| **서버 런타임** | tsx (Node.js)                            | 4.21.0        |
| **WebSocket**   | ws                                       | 8.20.0        |
| **에뮬레이터**  | EmulatorJS CDN                           | stable        |
| **P2P**         | WebRTC (RTCPeerConnection + DataChannel) | 브라우저 내장 |
| **린팅**        | ESLint + TypeScript ESLint               | 9.39.4        |
| **동시 실행**   | concurrently                             | 9.2.1         |
| **폰트**        | Press Start 2P (Google Fonts)            | -             |

---

## 3. 디렉토리 구조

```
snow-bros-web/
├── index.html                    # HTML 엔트리 (React root mount)
├── package.json                  # 의존성 및 스크립트
├── vite.config.ts                # Vite 설정 (React 플러그인)
├── tsconfig.json                 # TypeScript 프로젝트 참조 (app + node)
├── tsconfig.app.json             # 클라이언트 TS 설정
├── tsconfig.node.json            # 서버/빌드 TS 설정
├── eslint.config.js              # ESLint 설정
│
├── public/
│   ├── favicon.svg               # 브라우저 탭 아이콘
│   └── icons.svg                 # 아이콘 스프라이트
│
├── src/
│   ├── main.tsx                  # React 엔트리 포인트
│   ├── App.tsx                   # 메인 컴포넌트 (모드 선택)
│   ├── index.css                 # 글로벌 CSS 리셋
│   │
│   ├── assets/
│   │   └── react.svg, vite.svg   # (미사용)
│   │
│   ├── components/
│   │   ├── EmulatorPlayer.tsx    # 에뮬레이터 iframe 래퍼 + 헬퍼 함수
│   │   └── NetplayLobby.tsx     # 넷플레이 로비 + 동기화 오케스트레이션
│   │
│   └── netplay/
│       ├── peer.ts               # WebRTC P2P 연결 관리자
│       └── signaling.ts          # WebSocket 시그널링 클라이언트
│
└── server/
    ├── index.ts                  # Express + WebSocket + 에뮬레이터 엔드포인트
    └── roms/                     # ROM 파일 (코어별 서브폴더)
        ├── mame2003/
        │   ├── neogeo.zip        # BIOS
        │   ├── mslug3.zip        # Metal Slug 3
        │   └── mslug2.zip        # Metal Slug 2
        ├── arcade/
        │   └── neogeo.zip
        └── nes/
            └── *.zip
```

---

## 4. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        브라우저 (HOST)                           │
│  ┌──────────┐    postMessage    ┌──────────────────────────┐   │
│  │  React   │◄════════════════►│   iframe (EmulatorJS)     │   │
│  │  App     │                   │   - MAME/NES/SNES 코어   │   │
│  │          │                   │   - 키보드 입력 캡처      │   │
│  │          │                   │   - getState/loadState    │   │
│  └────┬─────┘                   └──────────────────────────┘   │
│       │                                                         │
│       │ WebRTC DataChannel (P2P)                                │
│       │ ├── 입력 메시지 (JSON, seq 번호)                        │
│       │ ├── 세이브 스테이트 (binary, chunked)                   │
│       │ └── 리싱크 스테이트 (binary, 256KB chunks)              │
│       │                                                         │
└───────┼─────────────────────────────────────────────────────────┘
        │
        │ WebRTC (LAN 직접 연결, iceServers: [])
        │
┌───────┼─────────────────────────────────────────────────────────┐
│       │                     브라우저 (GUEST)                     │
│  ┌────┴─────┐    postMessage    ┌──────────────────────────┐   │
│  │  React   │◄════════════════►│   iframe (EmulatorJS)     │   │
│  │  App     │                   │   - 동일 코어/ROM         │   │
│  └──────────┘                   └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

        │  WebSocket (시그널링만)
        ▼
┌─────────────────────────────┐
│   Node.js 서버 (:3001)      │
│   ├── Express (ROM 호스팅)   │
│   ├── /emulator (iframe HTML)│
│   ├── /api/roms (ROM 목록)   │
│   └── WebSocket (시그널링)    │
│       ├── 방 생성/참가       │
│       ├── SDP 교환 (offer/answer) │
│       └── ICE candidate 릴레이    │
└─────────────────────────────┘
```

### 핵심 원리

1. **서버는 시그널링만 담당** — 게임 데이터는 P2P로 직접 교환
2. **양쪽 모두 에뮬레이터를 독립 실행** — FightCade 스타일 (각자 에뮬레이터 인스턴스)
3. **입력을 실시간 공유** — DataChannel로 버튼 이벤트 교환
4. **유휴 시 상태 동기화** — 양쪽 입력이 1초 이상 없을 때만 HOST가 save state를 GUEST에 전송, 드리프트 보정

---

## 5. 프론트엔드 상세

### 5.1 App.tsx — 모드 선택

```
Mode: "menu" | "solo" | "netplay"
```

- **menu**: 솔로 플레이 / 넷플레이 버튼
- **solo**: `EmulatorLauncher` 컴포넌트 렌더 (로컬 ROM 업로드 + 코어 선택)
- **netplay**: `NetplayLobby` 컴포넌트 렌더

### 5.2 EmulatorPlayer.tsx — 에뮬레이터 래퍼

에뮬레이터를 iframe으로 감싸는 핵심 컴포넌트.

#### 두 가지 모드

| 모드          | 조건             | 동작                                                             |
| ------------- | ---------------- | ---------------------------------------------------------------- |
| **로컬 파일** | `romPath` 미제공 | Blob HTML 생성 → iframe src로 설정 → ROM 데이터 postMessage 전송 |
| **서버**      | `romPath` 제공   | `/emulator?core=...&rom=...&role=...` URL로 iframe src 설정      |

#### 익스포트 함수 (iframe → postMessage)

| 함수                                 | 용도                                  |
| ------------------------------------ | ------------------------------------- |
| `sendRemoteInput(ref, button, down)` | 상대방 입력을 iframe에 주입           |
| `sendStartGame(ref)`                 | 게임 시작 신호 (pause 해제)           |
| `requestSaveState(ref)`              | HOST: 세이브 스테이트 추출 요청       |
| `loadSaveState(ref, state)`          | GUEST: 세이브 스테이트 로드           |
| `requestResyncGetState(ref)`         | HOST: 리싱크용 micro-pause 상태 추출  |
| `requestResyncLoadState(ref, state)` | GUEST: 리싱크용 micro-pause 상태 로드 |

#### 지원 시스템 (24개 코어)

NES, SNES, N64, GB, GBA, NDS, PSX, PSP, Mega Drive, Master System, Game Gear, Saturn, Sega CD, 32X, MAME 2003+, FBNeo(아케이드), Atari 2600/7800/Lynx/Jaguar, 3DO, ColecoVision, Virtual Boy, DOS

### 5.3 NetplayLobby.tsx — 넷플레이 로비

#### 상태 머신

```
menu → browse → waiting → playing
                             ↑
menu → join-input ───────────┘
```

| 스텝         | 설명                           |
| ------------ | ------------------------------ |
| `menu`       | "방 만들기" / "방 참가" 버튼   |
| `browse`     | 서버 ROM 목록 조회 → 게임 선택 |
| `waiting`    | 6자리 코드 표시, GUEST 대기    |
| `join-input` | 코드 입력 화면                 |
| `playing`    | 에뮬레이터 + P2P 동기화 진행   |

#### 핵심 Ref 목록

| Ref                   | 타입                | 용도                                   |
| --------------------- | ------------------- | -------------------------------------- | --- | ------------------ | -------- | ----------------------------------- |
| `peerRef`             | `NetplayPeer`       | P2P 연결 인스턴스                      |
| `emulatorRef`         | `HTMLIFrameElement` | iframe DOM 참조                        |
| `roleRef`             | `"host" \| "guest"` | 현재 역할                              |
| `gameStartedRef`      | `boolean`           | 게임 시작 여부                         |
| `localReadyRef`       | `boolean`           | 내 에뮬레이터 로딩 완료                |
| `remoteReadyRef`      | `boolean`           | 상대방 에뮬레이터 로딩 완료            |
| `pendingStateRef`     | `ArrayBuffer`       | GUEST: 에뮬레이터 로딩 전 수신한 state |
| `resyncActiveRef`     | `boolean`           | 리싱크 루프 활성 여부                  |
| `resyncInProgressRef` | `boolean`           | 현재 리싱크 진행 중                    |
| `resyncIntervalRef`   | `timeout ID`        | 다음 리싱크 타이머                     |     | `lastInputTimeRef` | `number` | 마지막 입력(로컬+리모트) 타임스탬프 |

---

## 6. 백엔드 서버 상세

### 6.1 Express 라우트

| 라우트      | 메서드 | 설명                        |
| ----------- | ------ | --------------------------- |
| `/roms/*`   | GET    | 정적 ROM 파일 서빙          |
| `/api/roms` | GET    | ROM 목록 JSON 반환          |
| `/emulator` | GET    | EmulatorJS iframe HTML 생성 |

### 6.2 `/emulator` 엔드포인트

쿼리 파라미터:

| 파라미터 | 예시                  | 설명             |
| -------- | --------------------- | ---------------- |
| `core`   | `mame2003`            | 에뮬레이터 코어  |
| `rom`    | `mame2003/mslug3.zip` | ROM 경로         |
| `bios`   | `mame2003/neogeo.zip` | BIOS 경로 (선택) |
| `role`   | `host` / `guest`      | 넷플레이 역할    |

#### 코어 리매핑

```
mame2003 → mame2003_plus   (더 넓은 ROM 호환성)
arcade   → fbneo            (CDN에 'arcade' 코어 없음)
```

#### 생성되는 iframe HTML 구조

```html
<!DOCTYPE html>
<html>
  <head>
    <style>
      /* 전체화면 게임 영역 + 에러 오버레이 */
    </style>
  </head>
  <body>
    <div id="game"></div>
    <!-- EmulatorJS 마운트 포인트 -->
    <div id="error-overlay"></div>
    <script>
      // WakeLock 폴리필 (모바일 대응)
      // EmulatorJS 설정 (EJS_player, EJS_core, EJS_gameUrl, EJS_biosUrl 등)
      // 넷플레이 초기화 (EJS_onGameStart → pause → getState 검증 → emulator-ready)
      // 키보드 입력 캡처 → localInput postMessage
      // 넷플레이 프로토콜 핸들러 (postMessage 수신)
      //   - remoteInput: 상대방 입력 주입
      //   - start-game: 게임 시작 (play)
      //   - get-save-state: 상태 추출 (초기 싱크)
      //   - load-save-state: 상태 로드 (초기 싱크)
      //   - resync-get-state: 마이크로포즈 상태 추출 (주기적 리싱크)
      //   - resync-load-state: 마이크로포즈 상태 로드 (주기적 리싱크)
      // 에러 핸들러 (에러 오버레이 표시)
    </script>
    <script src="https://cdn.emulatorjs.org/stable/data/loader.js"></script>
  </body>
</html>
```

### 6.3 WebSocket 시그널링 서버

방(Room) 기반 P2P 매칭:

```typescript
interface Room {
  code: string; // 6자리 숫자 코드
  host: WebSocket; // HOST 연결
  guest: WebSocket | null; // GUEST 연결
  romFilename: string; // ROM 파일명
  core: string; // 에뮬레이터 코어
  bios?: string; // BIOS 파일명
}
```

#### 시그널링 메시지 흐름

```
HOST                     서버                      GUEST
  │                        │                         │
  │─── create-room ───────►│                         │
  │◄── room-created (code)─│                         │
  │                        │                         │
  │                        │◄── join-room (code) ────│
  │                        │──► room-joined (info) ──│
  │◄── guest-joined ───────│                         │
  │                        │                         │
  │─── offer (SDP) ───────►│──► offer (SDP) ────────►│
  │◄── answer (SDP) ───────│◄── answer (SDP) ────────│
  │─── ice-candidate ─────►│──► ice-candidate ──────►│
  │◄── ice-candidate ──────│◄── ice-candidate ───────│
  │                        │                         │
  │◄═══════ WebRTC P2P DataChannel 직접 연결 ════════►│
```

---

## 7. 넷플레이 시스템

### 7.1 네트워크 계층 구조

```
┌───────────────────────────────────────┐
│ Layer 3: 게임 상태 동기화              │
│   - 초기 세이브 스테이트 동기화         │
│   - 유휴 시 리싱크 (200ms 간격 체크)   │
├───────────────────────────────────────┤
│ Layer 2: 입력 교환                     │
│   - 시퀀스 번호 기반 입력 전달          │
│   - 즉시 적용 (버퍼링 없음)            │
├───────────────────────────────────────┤
│ Layer 1: P2P 데이터채널               │
│   - WebRTC RTCDataChannel             │
│   - JSON (입력/시그널) + Binary (상태) │
├───────────────────────────────────────┤
│ Layer 0: 시그널링                      │
│   - WebSocket (방 관리 + SDP/ICE)     │
│   - 연결 수립 후에는 미사용            │
└───────────────────────────────────────┘
```

### 7.2 peer.ts — P2P 연결 관리자

#### DataChannel 메시지 프로토콜

**JSON 메시지:**

| type                  | 방향       | 용도                                         |
| --------------------- | ---------- | -------------------------------------------- |
| `input`               | 양방향     | `{button, down, seq}` — 입력 이벤트          |
| `peer-ready`          | GUEST→HOST | GUEST 에뮬레이터 로딩 완료                   |
| `state-loaded`        | GUEST→HOST | GUEST 세이브 스테이트 로드 완료              |
| `start-signal`        | HOST→GUEST | 양쪽 시작 신호                               |
| `save-state-header`   | HOST→GUEST | 초기 상태 전송 헤더 `{totalBytes, chunks}`   |
| `resync-state-header` | HOST→GUEST | 리싱크 상태 전송 헤더 `{totalBytes, chunks}` |
| `resync-failed`       | 양방향     | 리싱크 실패 알림                             |

**Binary 메시지:**

초기 상태 및 리싱크 상태는 청크 단위로 전송:

| 용도                 | 청크 크기 | 전송 방식                       |
| -------------------- | --------- | ------------------------------- |
| 초기 세이브 스테이트 | 64KB      | header JSON → N개 binary chunks |
| 리싱크 스테이트      | 256KB     | header JSON → N개 binary chunks |

#### 입력 시퀀스 추적

```typescript
// 송신측: 매 입력마다 seq 증가
sendInput(button, down) {
  this.dc.send(JSON.stringify({ type: "input", button, down, seq: ++this._inputSeq }));
}

// 수신측: gap 감지
if (inp.seq !== expectedSeq) {
  handler.onInputSeqGap(expectedSeq, inp.seq);
}
expectedSeq = inp.seq + 1;
```

리싱크 후에는 `resetRemoteSeq()`로 시퀀스 카운터를 리셋하여 불필요한 gap 경고를 방지.

### 7.3 signaling.ts — 시그널링 클라이언트

WebSocket 래퍼. JSON 메시지 송수신만 담당.

```typescript
// 지원 메시지 타입
type SignalingMessage =
  | { type: "create-room"; romFilename; core; bios? }
  | { type: "join-room"; code }
  | { type: "room-created"; code }
  | { type: "room-joined"; code; romFilename; core; bios? }
  | { type: "guest-joined" }
  | { type: "peer-disconnected" }
  | { type: "error"; message }
  | { type: "offer"; sdp }
  | { type: "answer"; sdp }
  | { type: "ice-candidate"; candidate };
```

### 7.4 초기 동기화 프로토콜

양쪽 에뮬레이터가 동일한 상태에서 시작하도록 세이브 스테이트를 동기화:

```
 HOST                              GUEST
  │                                  │
  │◄── emulator-ready ──── iframe    │◄── emulator-ready ──── iframe
  │                                  │
  │                                  │─── peer-ready ──────────►│ (DC)
  │◄── peer-ready (DC) ─────────────│                          │
  │                                  │                          │
  │──► get-save-state ────► iframe   │                          │
  │◄── save-state ──────── iframe    │                          │
  │                                  │                          │
  │─── save-state-header ──────────────────────────────────────►│ (DC)
  │─── [binary chunk 1] ──────────────────────────────────────►│
  │─── [binary chunk 2] ──────────────────────────────────────►│
  │─── [binary chunk N] ──────────────────────────────────────►│
  │                                  │                          │
  │                                  │◄── onSaveState ──────────│
  │                                  │──► load-save-state → iframe
  │                                  │◄── state-loaded ── iframe│
  │                                  │                          │
  │◄── state-loaded (DC) ──────────│                          │
  │                                  │                          │
  │──► start-game ────────► iframe   │                          │
  │─── start-signal (DC) ─────────────────────────────────────►│
  │                                  │──► start-game ──► iframe │
  │                                  │                          │
  ▼                                  ▼
  [게임 시작 — 양쪽 동일 상태]
```

#### 초기화 시 MAME 코어 특이사항

MAME 코어는 첫 프레임 직후 `getState()`가 실패할 수 있음. 해결:

```javascript
// EJS_onGameStart 콜백에서:
1. pause()
2. getState() 시도
3. 실패 시: play() → 200ms 대기 → pause() → 재시도
4. 최대 10회 재시도
5. 성공 시 emulator-ready 전송
```

### 7.5 유휴 시 리싱크 파이프라인

두 에뮬레이터 인스턴스는 독립적으로 실행되므로 시간이 지나면 드리프트 발생. **유휴 감지 기반 리싱크**로 보정:

#### 핵심 파라미터

| 상수                 | 값     | 설명                                 |
| -------------------- | ------ | ------------------------------------ |
| `RESYNC_INTERVAL_MS` | 200ms  | 리싱크 시도 간격                     |
| `IDLE_THRESHOLD_MS`  | 1000ms | 이 시간 동안 입력 없으면 "유휴" 판정 |

#### 유휴 감지 로직

```typescript
// 로컬/리모트 입력 발생 시 타임스탬프 갱신
lastInputTimeRef.current = Date.now();

// 리싱크 스케줄러
function scheduleNextResync() {
  resyncIntervalRef.current = setTimeout(() => {
    // 아직 입력 중이면 리싱크 건너뜀
    if (Date.now() - lastInputTimeRef.current < IDLE_THRESHOLD_MS) {
      scheduleNextResync(); // 200ms 후 재시도
      return;
    }
    // 유휴 상태 → 리싱크 실행
    requestResyncGetState(emulatorRef);
  }, RESYNC_INTERVAL_MS);
}
```

#### 리싱크 흐름

```
HOST                                    GUEST
  │                                       │
  │ [scheduleNextResync: 200ms 후]        │
  │ [유휴 체크: 1초간 입력 없음?]          │
  │                                       │
  │──► resync-get-state ───► iframe       │
  │                                       │
  │    iframe: pause()                    │
  │           getState()                  │
  │           play()  ← 즉시 재개         │
  │                   (~16ms, 1프레임)     │
  │                                       │
  │◄── resync-state ──────── iframe       │
  │                                       │
  │─── resync-state-header (DC) ─────────►│
  │─── [256KB chunk 1] (DC) ─────────────►│
  │─── [256KB chunk N] (DC) ─────────────►│
  │                                       │
  │                                       │◄── onResyncState
  │                                       │──► resync-load-state → iframe
  │                                       │
  │                                       │    iframe: pause()
  │                                       │           loadState()
  │                                       │           play() ← 즉시 재개
  │                                       │                   (~16ms)
  │                                       │
  │ [scheduleNextResync: 200ms 후]        │
  │ [유휴 아니면 건너뜀 → 200ms 후 재체크] │
  │     ... 반복 ...                       │
```

#### 설계 원칙

- **ACK 없음**: HOST는 GUEST의 로드 완료를 기다리지 않음 (Fire-and-Forget)
- **Micro-pause**: pause→getState/loadState→play를 원자적으로 수행 (~16ms)
- **유휴 시에만 리싱크**: 입력 중에는 리싱크를 건너뛰어 입력 덮어쓰기 방지
- **양쪽 입력 추적**: 로컬 입력과 리모트 입력 모두 `lastInputTimeRef`를 갱신
- **실패 시 자동 재시도**: `resync-failed` 수신 시에도 다음 리싱크 스케줄

### 7.6 연결 해제 처리

상대방이 나가면 (`onDisconnected`):

1. 리싱크 루프 중지 (`resyncActiveRef = false`, 타이머 취소)
2. `alert("상대방이 나갔습니다.")` 표시
3. P2P 연결 정리 (`peer.close()`)
4. 모든 상태 초기화
5. 메뉴 화면으로 자동 복귀

감지 경로:

- WebSocket: `peer-disconnected` (서버가 소켓 close 감지 후 상대에게 발신)
- WebRTC: `RTCPeerConnection.onconnectionstatechange` (disconnected/failed)
- DataChannel: `dc.onclose` 이벤트

---

## 8. 에뮬레이터 통합

### 8.1 EmulatorJS

[EmulatorJS](https://emulatorjs.org/)는 LibRetro 코어를 WebAssembly로 컴파일한 브라우저 에뮬레이터.

```javascript
// CDN에서 로드
window.EJS_pathtodata = "https://cdn.emulatorjs.org/stable/data/";
// 코어 지정
window.EJS_core = "mame2003_plus";
// ROM URL
window.EJS_gameUrl = "/roms/mame2003/mslug3.zip";
// BIOS (선택)
window.EJS_biosUrl = "/roms/mame2003/neogeo.zip";
```

### 8.2 핵심 API (gameManager)

넷플레이에서 사용하는 EmulatorJS 내부 API:

| API                                                             | 용도                                          |
| --------------------------------------------------------------- | --------------------------------------------- |
| `EJS_emulator.pause()`                                          | 에뮬레이션 일시정지                           |
| `EJS_emulator.play()`                                           | 에뮬레이션 재개                               |
| `EJS_emulator.gameManager.getState()`                           | 세이브 스테이트 추출 (Uint8Array/ArrayBuffer) |
| `EJS_emulator.gameManager.loadState(arr)`                       | 세이브 스테이트 로드                          |
| `EJS_emulator.gameManager.simulateInput(player, button, value)` | 입력 시뮬레이션                               |

### 8.3 Player 매핑

| 역할  | 로컬 플레이어 | 리모트 플레이어 |
| ----- | ------------- | --------------- |
| HOST  | 0 (P1)        | 1 (P2)          |
| GUEST | 1 (P2)        | 0 (P1)          |

---

## 9. 데이터 흐름 다이어그램

### 9.1 입력 흐름 (HOST 키보드 → GUEST 화면)

```
HOST 키보드
    │
    ▼
iframe keydown 캡처
    │
    ├─► stopImmediatePropagation() + preventDefault()
    │   (EmulatorJS 내장 키보드 핸들러 완전 차단)
    │
    ├─► KEY_TO_BUTTON 매핑 확인
    │   (미매핑 키는 무시)
    │
    ├─► simulateInput(0, button, 1)  [HOST 로컬 적용]
    │
    └─► parent.postMessage({type:"localInput", button, down})
            │
            ▼
        EmulatorPlayer.tsx (onLocalInput 콜백)
            │
            ▼
        NetplayLobby.tsx → peerRef.sendInput(button, down)
            │
            ▼
        DataChannel.send({type:"input", button, down, seq})
            │
            ▼ (P2P 네트워크)
            │
        GUEST peer.ts DC onmessage
            │
            ▼
        NetplayLobby.tsx handleRemoteInput
            │
            ▼
        sendRemoteInput(emulatorRef, button, down)
            │
            ▼
        iframe.postMessage({type:"remoteInput", button, down})
            │
            ▼
        GUEST iframe: simulateInput(0, button, 1)  [GUEST 화면 반영]
```

### 9.2 상태 데이터 흐름 (리싱크)

```
scheduleNextResync (200ms 타이머 + 유휴 체크)
    │
    ▼
requestResyncGetState(emulatorRef)
    │
    ▼
iframe.postMessage({type:"resync-get-state"})
    │
    ▼
iframe 내부:
    pause() → getState() → play()
    │
    ▼
parent.postMessage({type:"resync-state", state: ArrayBuffer})
    │
    ▼
EmulatorPlayer.tsx onResyncState 콜백
    │
    ▼
NetplayLobby.tsx handleResyncState
    │
    ▼
peer.sendResyncState(state)  ─── 256KB chunks ──► GUEST
    │                                                │
    ▼                                                ▼
scheduleNextResync() [유휴 시만]        onResyncState 콜백
                                             │
                                             ▼
                                   requestResyncLoadState(ref, state)
                                             │
                                             ▼
                                   iframe: pause() → loadState() → play()
```

---

## 10. 키 매핑

### 넷플레이 모드 키 매핑 (LibRetro 버튼 인덱스)

| 키          | LibRetro 버튼 | 인덱스 | 일반적 용도      |
| ----------- | ------------- | ------ | ---------------- |
| Arrow Up    | D-Pad Up      | 4      | 위               |
| Arrow Down  | D-Pad Down    | 5      | 아래             |
| Arrow Left  | D-Pad Left    | 6      | 왼쪽             |
| Arrow Right | D-Pad Right   | 7      | 오른쪽           |
| A           | B             | 0      | 버튼 1 (약펀치)  |
| S           | A             | 8      | 버튼 2 (약킥)    |
| D           | Y             | 1      | 버튼 3 (강펀치)  |
| F           | X             | 9      | 버튼 4 (강킥)    |
| 1           | Start         | 3      | 시작             |
| 5           | Select        | 2      | 셀렉트/코인 투입 |
| Q           | L             | 10     | L 숄더           |
| E           | R             | 11     | R 숄더           |

> **키보드 블로킹**: 넷플레이 모드에서는 `keydown`/`keyup` 핸들러 최상단에서 `stopImmediatePropagation()` + `preventDefault()`를 호출하여 EmulatorJS의 내장 키보드 핸들러에 이벤트가 도달하지 않도록 차단합니다. 이렇게 하지 않으면 KEY_TO_BUTTON에 정의되지 않은 키가 EmulatorJS P1 입력으로 처리되어 GUEST 키가 HOST 캐릭터를 조종하는 버그가 발생합니다.

---

## 11. ROM 관리

### 디렉토리 규칙

```
server/roms/{코어명}/{ROM파일.zip}
```

코어명은 EmulatorJS 코어 식별자와 동일:

- `nes`, `snes`, `n64`, `gb`, `gba`, `nds`, `psx`, `psp`
- `segaMD`, `segaMS`, `segaGG`, `segaSaturn`, `segaCD`, `sega32x`
- `mame2003`, `arcade`
- `atari2600`, `atari7800`, `lynx`, `jaguar`
- `3do`, `coleco`, `vb`, `dosbox`

### BIOS 자동 감지

다음 파일명은 자동으로 BIOS로 인식되어 ROM 목록에서 제외:

```
neogeo.zip, pgm.zip, skns.zip, decocass.zip, neocdz.zip
```

해당 코어 폴더에 BIOS 파일이 있으면 같은 폴더의 모든 ROM에 자동 연결.

### ROM 목록 API

```
GET /api/roms

Response:
[
  {
    "filename": "mslug3.zip",
    "core": "mame2003",
    "path": "mame2003/mslug3.zip",
    "bios": "mame2003/neogeo.zip"
  }
]
```

---

## 12. 빌드 및 실행

### 개발 모드

```bash
npm install           # 의존성 설치
npm run dev:all       # Vite(5173) + Express(3001) 동시 시작
```

### 프로덕션 빌드

```bash
npm run build         # TypeScript 컴파일 + Vite 빌드 → dist/
npm run preview       # 빌드 결과 미리보기
```

### 개별 실행

```bash
npm run dev           # Vite 개발 서버만 (프론트엔드)
npm run server        # Express 서버만 (백엔드)
```

### TypeScript 타입 체크

```bash
npx tsc --noEmit      # 컴파일 없이 타입 검증만
```

### 포트

| 서비스  | 포트 | 바인드  | 용도                                            |
| ------- | ---- | ------- | ----------------------------------------------- |
| Vite    | 5173 | 0.0.0.0 | React 프론트엔드                                |
| Express | 3001 | 0.0.0.0 | ROM 서빙 + 에뮬레이터 HTML + WebSocket 시그널링 |

> 양쪽 서버 모두 `0.0.0.0`에 바인드되어 LAN 내 다른 기기에서도 접근 가능합니다.

---

## 13. 트러블슈팅 & 설계 결정 히스토리

### 시도했다가 실패한 접근법

#### 1. RAF Hook Lockstep (실패)

**아이디어**: `requestAnimationFrame`을 후킹하여 프레임 카운터 + 입력 큐 + 딜레이 기반 동기화.

**실패 원인**: EmulatorJS(Emscripten)는 메인 루프에 `setTimeout`을 사용, `requestAnimationFrame`이 아님. RAF 후킹이 에뮬레이터 프레임 진행과 무관하여 프레임 카운터가 0에 고정되거나 호스트/게스트 간 완전히 다름.

#### 2. Frame-tick 하트비트 (실패)

**아이디어**: 매 프레임마다 DataChannel로 프레임 번호를 교환, 상대방보다 2프레임 이상 앞서면 stall.

**실패 원인**: 60fps로 DC에 frame-tick을 보내면 입력 메시지가 밀림 (DC 메시지 플러딩). 결과적으로 HOST는 타이틀 화면, GUEST는 어트랙트 모드 게임 플레이 화면으로 완전히 다른 화면 표시.

#### 3. 주기적 Pause-Resume 리싱크 (개선됨)

**아이디어**: 3초마다 양쪽 pause → HOST getState → 전송 → GUEST loadState → 양쪽 resume.

**문제**: 5단계 라운드트립 (100-300ms 양쪽 정지) → 눈에 보이는 끊김. ACK 대기 시간이 체감됨.

**최종 해결**: Fire-and-forget micro-pause 연속 파이프라인으로 전환.

#### 4. Frame-delay Lockstep (실패)

**아이디어**: EmulatorJS `gameManager.getFrameNum()` API를 활용, INPUT_DELAY_FRAMES 만큼 입력을 지연시키고 프레임 동기 기반 롤백 없이 lockstep 동기화.

**구현 내용**: InputMessage에 `frame` 필드 추가, `_inputQueue` 버퍼링, 프레임 번호 기반 입력 적용.

**실패 원인**: EmulatorJS iframe 내부에서 프레임 레벨 제어가 불가능. 두 인스턴스의 프레임 카운터가 완전히 다르게 진행되어 양쪽 입력 타이밍이 전혀 맞지 않음. → 전체 코드 원복.

**교훈**: EmulatorJS는 외부에서 프레임 단위 제어가 사실상 불가능하므로, 프레임 기반 동기화 방식은 현재 아키텍처에서 적용할 수 없음.

#### 5. 주기적 리싱크 중 입력 덮어쓰기 (개선됨)

**문제**: 500ms 고정 간격 리싱크가 입력 도중에도 발생하여 GUEST의 키 입력이 HOST 상태로 덮어써짐 → GUEST 키가 먹히지 않는 현상.

**해결**: 유휴 감지 기반 리싱크 도입 (`IDLE_THRESHOLD_MS=1000`). 양쪽 입력이 1초간 없을 때만 리싱크 실행. 리싱크 간격도 200ms로 단축하여 유휴 상태 진입 후 빠르게 동기화.

#### 6. EmulatorJS 키보드 핸들러 간섭 (해결됨)

**문제**: KEY_TO_BUTTON에 정의되지 않은 키(예: `KeyS`)를 GUEST가 누르면, EmulatorJS 내장 키보드 핸들러가 이를 P1 입력으로 처리하여 HOST 캐릭터가 움직이는 버그 발생.

**해결**: keydown/keyup 핸들러 최상단에서 `stopImmediatePropagation()` + `preventDefault()`를 호출하여, 넷플레이 모드에서 모든 키보드 이벤트가 EmulatorJS에 도달하지 않도록 차단. KEY_TO_BUTTON에 매핑된 키만 수동으로 `simulateInput()`을 통해 입력 주입.

### 현재 아키텍처의 한계

1. **네트워크 지연**: P2P라 해도 입력 전달에 수십ms 소요 → 상대방 화면에서 입력 반영이 약간 늦음
2. **리싱크 미세 끊김**: Micro-pause가 ~16ms이지만 MAME 코어의 getState/loadState 비용에 따라 더 길어질 수 있음
3. **단방향 동기화**: HOST→GUEST만 state 전송. HOST가 진실의 원천(source of truth)
4. **1:1 전용**: 2인 넷플레이만 지원 (방당 HOST + GUEST)
5. **LAN 전용**: `iceServers: []` 설정으로 STUN/TURN 없음 → 같은 네트워크(LAN)에서만 P2P 연결 가능

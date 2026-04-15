# 🕹 RTCADE

**브라우저에서 레트로 게임을 P2P 넷플레이로 즐기는 웹 애플리케이션**

WebRTC DataChannel을 통해 서버 중계 없이 1:1 P2P로 직접 연결하여 대전합니다.  
서버는 방 매칭(시그널링)만 담당하고, 모든 게임 데이터는 플레이어 간 직접 교환됩니다.

---

## 주요 기능

- **P2P 넷플레이** — 6자리 방 코드로 상대방과 연결, WebRTC DataChannel로 입력 공유
- **24개 시스템 지원** — NES, SNES, N64, GBA, PSX, MAME 2003+, FBNeo 등
- **자동 상태 동기화** — 초기 세이브 스테이트 싱크 + 주기적 리싱크로 드리프트 보정
- **유저 프로필** — 닉네임 + 이모지 아바타 (localStorage 저장)
- **게임명 자동 변환** — MAME ROM 파일명(`mslug3.zip`)을 읽기 쉬운 이름(`Metal Slug 3`)으로 표시
- **배포 대응** — Vercel(프론트) + Railway(백엔드) 환경변수 기반 설정

---

## 기술 스택

| 계층       | 기술                                     |
| ---------- | ---------------------------------------- |
| 프론트엔드 | React 19 + TypeScript 6 + Vite 8         |
| UI         | Tailwind CSS v4 + shadcn/ui (dark theme) |
| 에뮬레이터 | EmulatorJS CDN (LibRetro WASM cores)     |
| P2P        | WebRTC RTCPeerConnection + DataChannel   |
| 시그널링   | WebSocket (ws 8)                         |
| 백엔드     | Express 5 + Node.js (tsx)                |
| 폰트       | Press Start 2P (Google Fonts)            |

---

## 시스템 아키텍처

```
  HOST 브라우저                                    GUEST 브라우저
┌──────────────────┐                           ┌──────────────────┐
│ React App        │                           │ React App        │
│  ├─ NetplayLobby │                           │  ├─ NetplayLobby │
│  └─ EmulatorPlayer                           │  └─ EmulatorPlayer
│       │ postMessage                          │       │ postMessage
│  ┌────▼─────────┐│                           │┌─────▼──────────┐│
│  │ iframe        ││    WebRTC DataChannel     ││ iframe         ││
│  │ (EmulatorJS)  ││◄════════════════════════►││ (EmulatorJS)   ││
│  │ MAME/NES/etc  ││  입력(JSON) + 상태(Binary)│ MAME/NES/etc  ││
│  └───────────────┘│                           │└────────────────┘│
└──────────────────┘                           └──────────────────┘
         │  WebSocket (시그널링)                          │
         └──────────────┬────────────────────────────────┘
                        ▼
               ┌─────────────────┐
               │ Express 서버     │
               │ ├─ /api/roms    │  ROM 목록
               │ ├─ /emulator    │  iframe HTML 생성
               │ ├─ /roms/*      │  ROM 파일 서빙
               │ └─ WebSocket    │  방 생성/SDP교환/ICE릴레이
               └─────────────────┘
```

### 핵심 원리

1. **서버는 시그널링만** — 게임 데이터는 P2P로 직접 교환
2. **양쪽 에뮬레이터 독립 실행** — 각자 EmulatorJS 인스턴스를 구동 (FightCade 스타일)
3. **입력 실시간 공유** — DataChannel로 버튼 이벤트를 시퀀스 번호와 함께 교환
4. **HOST가 진실의 원천** — HOST 상태를 주기적으로 GUEST에 동기화 (단방향)

---

## 빠른 시작

```bash
# 의존성 설치
npm install

# 개발 서버 시작 (Vite:5173 + Express:3001)
npm run dev:all
```

양쪽 서버 모두 `0.0.0.0`에 바인드 → LAN 내 다른 기기에서 `http://<호스트IP>:5173`으로 접근 가능

### ROM 추가

```
server/roms/{코어명}/{ROM파일.zip}
```

예시:

```
server/roms/mame2003/mslug3.zip     # Metal Slug 3
server/roms/mame2003/neogeo.zip     # BIOS (자동 감지)
server/roms/nes/contra.zip          # Contra
```

BIOS 파일(`neogeo.zip`, `pgm.zip` 등)은 자동으로 인식되어 같은 폴더의 ROM에 자동 연결됩니다.

---

## 넷플레이 흐름

### 연결

```
HOST: 넷플레이 → 방 만들기 → 게임 선택 → 6자리 코드 공유
GUEST: 넷플레이 → 방 참가 → 코드 입력
```

### 초기 동기화

```
1. 양쪽 에뮬레이터 로딩 완료
2. HOST: 세이브 스테이트 추출 → DataChannel로 GUEST에 전송 (64KB 청크)
3. GUEST: 세이브 스테이트 로드
4. HOST: 시작 신호 전송 → 양쪽 동시 게임 시작
```

### 주기적 리싱크 (게임 중)

두 에뮬레이터가 독립 실행되므로 시간이 지나면 드리프트 발생합니다.  
HOST가 500ms 간격으로 자신의 상태를 GUEST에 전송하여 보정합니다.

```
HOST: pause → getState → play (micro-pause ~16ms)
       └→ 256KB 청크로 GUEST에 전송
GUEST: pause → loadState → play (micro-pause ~16ms)
```

- **Fire-and-Forget** — ACK 없이 연속 전송
- **3초 타임아웃 안전장치** — 응답 없으면 자동 잠금 해제

---

## 넷플레이 프로토콜

### 시그널링 (WebSocket)

| 메시지              | 방향       | 용도                      |
| ------------------- | ---------- | ------------------------- |
| `create-room`       | HOST→서버  | 방 생성 (ROM/코어/닉네임) |
| `room-created`      | 서버→HOST  | 6자리 코드 반환           |
| `join-room`         | GUEST→서버 | 코드로 방 참가            |
| `room-joined`       | 서버→GUEST | ROM/코어/HOST 프로필 정보 |
| `guest-joined`      | 서버→HOST  | GUEST 프로필 정보         |
| `offer/answer`      | 릴레이     | SDP 교환                  |
| `ice-candidate`     | 릴레이     | ICE candidate 교환        |
| `peer-disconnected` | 서버→상대  | 연결 해제 알림            |

### DataChannel (P2P)

**JSON 메시지:**

| type                  | 방향       | 용도                              |
| --------------------- | ---------- | --------------------------------- |
| `input`               | 양방향     | `{button, down, seq}` 입력 이벤트 |
| `peer-ready`          | GUEST→HOST | 에뮬레이터 로딩 완료              |
| `save-state-header`   | HOST→GUEST | 초기 상태 전송 헤더               |
| `resync-state-header` | HOST→GUEST | 리싱크 상태 전송 헤더             |
| `state-loaded`        | GUEST→HOST | 상태 로드 완료                    |
| `start-signal`        | HOST→GUEST | 게임 시작                         |

**Binary 메시지:**

| 용도                 | 청크 크기 |
| -------------------- | --------- |
| 초기 세이브 스테이트 | 64KB      |
| 리싱크 스테이트      | 256KB     |

---

## 키 매핑

| 키      | LibRetro 버튼 | 용도            |
| ------- | ------------- | --------------- |
| ← → ↑ ↓ | D-Pad         | 이동            |
| A       | B (0)         | 버튼 1 (약펀치) |
| S       | A (8)         | 버튼 2 (약킥)   |
| D       | Y (1)         | 버튼 3 (강펀치) |
| F       | X (9)         | 버튼 4 (강킥)   |
| 1       | Start (3)     | 시작            |
| 5       | Select (2)    | 셀렉트/코인     |
| Q / E   | L / R (10/11) | 숄더            |

> 넷플레이 모드에서는 모든 키보드 이벤트를 캡처하여 EmulatorJS 내장 핸들러를 차단합니다.

---

## 디렉토리 구조

```
RTCADE/
├── index.html                     # HTML 엔트리
├── package.json
├── vite.config.ts                 # Vite + Tailwind + @ alias
├── vercel.json                    # Vercel 배포 설정
├── railway.json                   # Railway 배포 설정
├── .env.example                   # 환경변수 예시
│
├── server/
│   ├── index.ts                   # Express + WebSocket + EmulatorJS HTML
│   └── roms/                      # ROM 파일 (코어별 폴더)
│       ├── mame2003/
│       ├── arcade/
│       └── nes/
│
└── src/
    ├── App.tsx                    # 메인 셸 (모드 전환 + 프로필)
    ├── index.css                  # Tailwind + shadcn CSS 변수
    ├── main.tsx                   # React 엔트리
    │
    ├── components/
    │   ├── NetplayLobby.tsx       # 넷플레이 로비 + 동기화 오케스트레이션
    │   ├── EmulatorPlayer.tsx     # EmulatorJS iframe 래퍼
    │   ├── NicknameSetup.tsx      # 프로필 설정 다이얼로그
    │   ├── GameCard.tsx           # 게임 목록 카드
    │   ├── UserBadge.tsx          # 아바타 + 닉네임 뱃지
    │   ├── RoomCodeDisplay.tsx    # 6자리 코드 표시 + 복사
    │   ├── CodeInput.tsx          # OTP 스타일 코드 입력
    │   └── ui/                    # shadcn/ui 컴포넌트
    │
    ├── netplay/
    │   ├── peer.ts                # WebRTC P2P 연결 관리자
    │   └── signaling.ts           # WebSocket 시그널링 클라이언트
    │
    └── lib/
        ├── game-names.ts          # MAME ROM명 → 표시명 변환
        ├── user-profile.ts        # 닉네임/아바타 관리 (localStorage)
        └── utils.ts               # cn() 유틸리티
```

---

## 지원 시스템 (24개 코어)

| 시스템               | 코어명       | 비고                       |
| -------------------- | ------------ | -------------------------- |
| NES                  | `nes`        |                            |
| SNES                 | `snes`       |                            |
| N64                  | `n64`        |                            |
| Game Boy / Color     | `gb`         |                            |
| Game Boy Advance     | `gba`        |                            |
| Nintendo DS          | `nds`        |                            |
| PlayStation          | `psx`        |                            |
| PSP                  | `psp`        |                            |
| Mega Drive / Genesis | `segaMD`     |                            |
| Master System        | `segaMS`     |                            |
| Game Gear            | `segaGG`     |                            |
| Saturn               | `segaSaturn` |                            |
| Sega CD              | `segaCD`     |                            |
| 32X                  | `sega32x`    |                            |
| MAME 2003+           | `mame2003`   | → `mame2003_plus`로 리매핑 |
| Arcade (FBNeo)       | `arcade`     | → `fbneo`로 리매핑         |
| Atari 2600           | `atari2600`  |                            |
| Atari 7800           | `atari7800`  |                            |
| Lynx                 | `lynx`       |                            |
| Jaguar               | `jaguar`     |                            |
| 3DO                  | `3do`        |                            |
| ColecoVision         | `coleco`     |                            |
| Virtual Boy          | `vb`         |                            |
| DOS                  | `dosbox`     |                            |

---

## 배포

### Vercel (프론트엔드)

1. GitHub repo 연결
2. 환경변수 설정:
   ```
   VITE_API_URL=https://your-app.up.railway.app
   VITE_WS_URL=wss://your-app.up.railway.app
   ```

### Railway (백엔드)

1. GitHub repo 연결 — `railway.json` 자동 인식
2. 환경변수 설정:
   ```
   CORS_ORIGIN=https://your-app.vercel.app
   ```
3. `PORT`는 Railway가 자동 주입
4. ROM 파일은 `server/roms/`에 포함하거나 볼륨 연결

### 로컬 개발

환경변수 없이 기본값(`localhost:3001`)으로 동작합니다.

---

## 설계 결정 & 한계

### 시도했다가 포기한 방식

| 방식                 | 실패 원인                                             |
| -------------------- | ----------------------------------------------------- |
| RAF Hook Lockstep    | EmulatorJS는 rAF가 아닌 setTimeout으로 메인 루프 구동 |
| Frame-tick 하트비트  | 60fps DC 메시지 플러딩으로 입력 밀림                  |
| Frame-delay Lockstep | iframe 내부 프레임 레벨 제어 불가                     |
| Pause-Resume 리싱크  | 5단계 라운드트립 100~300ms 정지 → 체감 끊김           |

### 현재 한계

- **네트워크 지연** — 입력 전달에 수십ms 소요, 상대방 화면에서 약간 늦게 반영
- **리싱크 미세 끊김** — micro-pause ~16ms이나 MAME 코어에 따라 더 길어질 수 있음
- **단방향 동기화** — HOST→GUEST만 상태 전송 (HOST가 source of truth)
- **1:1 전용** — 2인 넷플레이만 지원

---

## 상세 아키텍처

더 깊은 기술 문서는 [ARCHITECTURE.md](ARCHITECTURE.md) 참조

---

## License

MIT

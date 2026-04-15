# Retro Emulator Web

브라우저에서 레트로 게임을 에뮬레이션하고, **LAN P2P 넷플레이**로 2인 대전을 지원하는 웹 애플리케이션.

## 주요 기능

- **솔로 모드** — 로컬 ROM 파일 업로드 후 혼자 플레이
- **넷플레이 모드** — 6자리 방 코드 기반 LAN 2인 대전 (WebRTC DataChannel P2P)
- **24개 코어 지원** — NES, SNES, N64, GBA, PSX, MAME 2003+, FBNeo 등
- **아케이드 키매핑** — A/S/D/F + 방향키 + 1/5(Start/Select) + Q/E(L/R)

## 기술 스택

| 계층       | 기술                                            |
| ---------- | ----------------------------------------------- |
| 프론트엔드 | React 19 + TypeScript 6                         |
| 빌드       | Vite 8                                          |
| 서버       | Express 5 + ws (WebSocket)                      |
| 에뮬레이터 | EmulatorJS CDN (LibRetro WASM)                  |
| P2P        | WebRTC DataChannel (`iceServers: []`, LAN 전용) |

## 빠른 시작

```bash
npm install
npm run dev:all       # Vite(:5173) + Express(:3001) 동시 시작
```

양쪽 서버 모두 `0.0.0.0`에 바인드되어 LAN 내 다른 기기에서 `http://<호스트IP>:5173`으로 접근 가능합니다.

### ROM 추가

```
server/roms/{코어명}/{ROM파일.zip}
```

예: `server/roms/mame2003/mslug3.zip`, `server/roms/mame2003/neogeo.zip` (BIOS)

## 넷플레이 사용법

1. HOST: 넷플레이 → 방 만들기 → 게임 선택 → 6자리 코드 공유
2. GUEST: 넷플레이 → 방 참가 → 코드 입력
3. 양쪽 에뮬레이터 로딩 완료 시 자동으로 상태 동기화 후 게임 시작

## 키 매핑

| 키     | 용도            |
| ------ | --------------- |
| 방향키 | 이동            |
| A      | 버튼 1 (약펀치) |
| S      | 버튼 2 (약킥)   |
| D      | 버튼 3 (강펀치) |
| F      | 버튼 4 (강킥)   |
| 1      | Start           |
| 5      | Select/Coin     |
| Q / E  | L / R 숄더      |

## 상세 아키텍처

[ARCHITECTURE.md](ARCHITECTURE.md) 참조

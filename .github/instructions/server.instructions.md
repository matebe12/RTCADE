---
description: "Use when modifying Express server, route modules, WebSocket signaling, ROM/public-room APIs, stats/notice APIs, or the deprecated emulator route"
applyTo: "server/**"
---

# 백엔드 서버 가이드

## 현재 역할

1. ROM 서빙 — `/roms/*`, `/api/roms`
2. 방/시그널링 — `/api/rooms`, WebSocket signaling, room cleanup
3. 운영 데이터 — `/api/notices`, `/api/admin/notices`, `/api/stats`, `/api/game-sessions`, `/api/active-play-sessions*`, visitor tracking

- `server/index.ts`는 bootstrap만 담당한다.
- 게임 데이터 중계는 금지다. WebSocket은 offer/answer/ice-candidate와 room lifecycle만 릴레이한다.
- `/emulator`는 `server/emulator.ts`의 410 stub이다. 서버에서 EmulatorJS HTML을 다시 만들지 말 것.

## 환경변수

| 변수                                                            | 용도                          |
| --------------------------------------------------------------- | ----------------------------- |
| `PORT`                                                          | 서버 포트 (Railway 자동 주입) |
| `CORS_ORIGIN`                                                   | 허용 오리진(쉼표 구분)        |
| `ROMS_PATH`                                                     | ROM 디렉토리                  |
| `DATABASE_URL` / `DATABASE_PRIVATE_URL` / `DATABASE_PUBLIC_URL` | 운영 DB 연결                  |
| `NOTICE_ADMIN_TOKEN`                                            | 관리자 공지 API 토큰          |
| `EMULATORJS_DATA_URL`                                           | EmulatorJS CDN data 경로      |

- EmulatorJS CDN URL을 바꿀 때는 서버 config와 클라이언트 env helper를 같이 맞춘다.

## 룸/방 생명주기

```
create-room → Room 생성 (host WS 저장)
join-room → Room에 guest WS 저장 → room-joined/guest-joined 전송
WS close → peer-disconnected 전송 → Room 삭제
```

- 방 코드는 6자리 숫자다.
- 1:1 전용이다. 방당 host + guest만 허용한다.
- public room 목록은 guest가 없는 공개 방만 반환한다.
- room store는 메모리 기반이라 서버 재시작 시 소실된다.

## 라우트 수정

- `/roms`는 정적 파일 서빙과 ROM catalog를 담당한다.
- `/api/rooms`는 공개 방 목록이다.
- `/api/stats`는 visitor, room, solo session 지표를 합산한다.
- middleware 순서와 CORS / visitor tracking은 유지한다.

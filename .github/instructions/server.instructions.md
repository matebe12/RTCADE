---
description: "Use when modifying Express server, WebSocket signaling, ROM API, emulator HTML endpoint, or server/index.ts"
applyTo: "server/**"
---

# 백엔드 서버 가이드

## 서버 역할 (3가지만)

1. **ROM 서빙** — `/roms/*` 정적 파일, `/api/roms` 목록 JSON
2. **EmulatorJS HTML 생성** — `/emulator?core=...&rom=...&role=...`
3. **WebSocket 시그널링** — 방 관리 + SDP/ICE 릴레이

게임 데이터 중계 금지. 서버는 시그널링만.

## 환경변수

| 변수          | 기본값 | 용도                                               |
| ------------- | ------ | -------------------------------------------------- |
| `PORT`        | `3001` | 서버 포트 (Railway 자동 주입)                      |
| `CORS_ORIGIN` | `*`    | 허용 오리진 (쉼표 구분, 프로덕션에서는 Vercel URL) |

## 방(Room) 생명주기

```
create-room → Room 생성 (host WS 저장)
join-room → Room에 guest WS 저장 → room-joined/guest-joined 전송
WS close → peer-disconnected 전송 → Room 삭제
```

- 방 코드: 6자리 숫자 (`Math.random().toString().slice(2,8)`)
- 1:1 전용: 방당 host + guest만. 3인 이상 참가 시 에러 반환

## `/emulator` HTML 수정 시 주의

- 이 HTML은 **문자열 템플릿**으로 생성됨 (JSX 아님)
- `${변수}` 보간이 Express 핸들러 안에서 이루어짐
- EmulatorJS `<script>` 태그보다 먼저 설정 변수(`EJS_*`, `KEY_TO_BUTTON` 등) 선언 필수
- `EJS_Buttons`와 CSS `[data-btn]` 숨김이 이중으로 적용됨 (API + CSS fallback)

## BIOS 자동 감지

`neogeo.zip`, `pgm.zip`, `skns.zip`, `decocass.zip`, `neocdz.zip`은 BIOS로 인식 → ROM 목록에서 제외, 같은 폴더 ROM에 자동 연결

# RTCADE — Project Guidelines

## Architecture

- **프론트/백 분리**: React(Vite) 프론트 + Express 백엔드, 별도 배포 (Vercel + Railway)
- **iframe 기반 에뮬레이터**: EmulatorJS는 iframe 안에서 실행, React와 postMessage로 통신
- **P2P 넷플레이**: WebRTC DataChannel로 입력/상태 교환, 서버는 시그널링만 담당
- **HOST가 source of truth**: 상태 동기화는 항상 HOST→GUEST 단방향
- 상세 설계는 [ARCHITECTURE.md](../ARCHITECTURE.md) 참조

## Code Style

- TypeScript strict, `@/` path alias 사용 (`@/components/...`, `@/lib/...`)
- UI: Tailwind CSS v4 + shadcn/ui (dark theme), 인라인 스타일 금지
- 컴포넌트: shadcn/ui 기본 컴포넌트 우선 사용 (`Button`, `Card`, `Dialog` 등)
- `cn()` 유틸리티로 클래스 합성 (`@/lib/utils`)
- 한국어 UI 텍스트

## Build & Verify

```bash
npm run dev:all       # 개발 (Vite:5173 + Express:3001)
npx tsc --noEmit      # 타입 체크 — 코드 수정 후 반드시 실행
npx vite build        # 프로덕션 빌드
```

## Conventions

- 환경변수: `VITE_API_URL`, `VITE_WS_URL` (프론트), `PORT`, `CORS_ORIGIN` (백엔드). **URL 하드코딩 금지**
- alert() 사용 금지 → `sonner`의 `toast()` 사용
- 파괴적 액션(나가기 등)은 `AlertDialog`로 확인 필수
- ROM 파일은 git에 포함하지 않음 (`.gitignore`에 등록됨)

## Git

### 브랜치 전략

- 기본 브랜치: `main` — 항상 배포 가능한 상태 유지
- 기능 브랜치: `feat/<기능명>` (예: `feat/chat`, `feat/save-state`)
- 버그픽스 브랜치: `fix/<이슈명>` (예: `fix/resync-timeout`)
- 리팩터링/기타: `chore/<설명>`, `refactor/<설명>`
- 브랜치 생명주기:
  1. `main`에서 분기 → 작업 → `main`으로 머지 → 브랜치 삭제
  2. 작업 브랜치는 가능한 짧게 유지 (1~3일 이내 머지 목표)
- **머지 방식**: squash merge 권장 (커밋 히스토리 깔끔하게 유지)
- 브랜치 생성/삭제는 사용자 확인 후 실행
- 직접 `main`에 커밋: 단순 문서 수정, 설정 변경 등 소규모 작업만 허용

### 커밋 규칙

- 커밋 메시지: [Conventional Commits](https://www.conventionalcommits.org/) 형식
  - `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `style:`, `perf:`, `test:`
  - 한국어 본문 허용, **prefix는 영어**
  - 예: `feat: 넷플레이 채팅 기능 추가`
- 커밋 전 `npx tsc --noEmit` 타입 체크 통과 필수
- 대규모 변경은 의미 단위로 커밋 분리 (UI / 로직 / 설정 등)

### 금지 사항

- `git push --force` 금지 — 반드시 사용자 확인 후 실행
- `.env`, `.env.*` 파일 커밋 금지 (`.gitignore`에 등록됨)
- ROM 파일(`*.nes`, `*.zip` 등) 커밋 금지

## Known Failures — Do NOT Retry

과거 시도했다가 실패한 접근법. 같은 시도 반복 금지:

1. **RAF Hook Lockstep** — EmulatorJS는 rAF가 아닌 setTimeout으로 메인 루프 구동, 프레임 카운터 동기화 불가
2. **Frame-tick 하트비트** — 60fps DC 메시지 플러딩으로 입력이 밀림
3. **Frame-delay Lockstep** — iframe 내부 프레임 레벨 제어 불가, `gameManager.getFrameNum()` 양쪽 불일치
4. **Pause-Resume 리싱크 (ACK 대기)** — 5단계 라운드트립 100~300ms 정지 → 체감 끊김 심함

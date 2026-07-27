---
description: "main 병합 전 또는 배포 전 체크리스트 — 타입 체크, 빌드, 금지 패턴 검출"
---

# 배포 전 검증

main 브랜치 병합 전이나 프로덕션 배포 전에 실행하는 종합 검증이다.

## 1. 타입 체크

```bash
npx tsc --noEmit
```

실패 시 중단. 모든 타입 에러를 먼저 수정한다.

## 2. 프로덕션 빌드

```bash
npm run build
```

`tsc -b && vite build`를 실행한다. 실패 시 중단.

## 3. 빌드 결과 확인

```bash
# dist/index.html 존재 확인
Test-Path dist/index.html

# dist/assets/ 에 .js, .css 파일 존재 확인
Get-ChildItem dist/assets/
```

## 4. Git Diff 검사

다음 패턴이 staged diff에 있는지 확인한다:

### 하드코딩된 URL
```
grep -E "https?://" (Get-ChildItem src/ -Recurse -Include *.ts,*.tsx)
```
단, `VITE_API_URL`, `VITE_WS_URL`, `CORS_ORIGIN` 환경변수 참조는 제외.
`src/lib/backend-url.ts`의 상수화된 URL도 허용.

### .env 파일
```
git diff --cached --name-only | grep "\.env"
```
`.env.example`만 허용. `.env`, `.env.local`, `.env.production` 등이 staged 되면 차단.

### ROM 파일
```
git diff --cached --name-only | grep -E "\.(zip|nes|sfc|gba|bin)$"
```
`server/roms/` 내 파일이 staged 되면 경고.

## 5. 브랜치명 확인

```bash
git branch --show-current
```

`feat/*`, `fix/*`, `chore/*`, `refactor/*`, `main` 이외의 브랜치명은 경고.

## 6. 배포 리마인더

- **Vercel (프론트엔드)**: `vercel.json` → `npm run build` → `dist/` 배포
- **Railway (백엔드)**: `railway.json` → `node --import tsx server/index.ts` → healthcheck `/api/roms`

## 결과 요약

전체 통과 시:
```
✅ Pre-deploy: 모든 검증 통과
```

일부 실패 시 항목별로 수정 방법을 제시한다.

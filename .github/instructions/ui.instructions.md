---
description: "Use when creating or modifying UI components, styling, Tailwind classes, shadcn/ui usage, or layout"
applyTo: ["src/components/**", "src/index.css"]
---

# UI 컴포넌트 가이드

## 필수 패턴

- **Tailwind CSS v4**: `@tailwindcss/vite` 플러그인 사용, `tailwind.config.ts` 없음
- **CSS 변수**: `src/index.css`에 oklch 색상 변수 정의 (shadcn neutral dark theme)
- **클래스 합성**: `cn()` 유틸리티 사용 (`@/lib/utils` — clsx + tailwind-merge)
- **인라인 스타일 금지**: 항상 Tailwind 클래스 사용

## shadcn/ui 컴포넌트

설치된 컴포넌트 (`src/components/ui/`):
`button`, `input`, `card`, `badge`, `avatar`, `dialog`, `scroll-area`, `tooltip`, `separator`, `sonner`, `alert-dialog`

새 컴포넌트 추가 시:

1. `npm install @radix-ui/react-{컴포넌트}`
2. `src/components/ui/{컴포넌트}.tsx`에 직접 생성 (shadcn CLI가 `components.json` 이슈로 동작 안 함)
3. 기존 컴포넌트 파일 참고하여 같은 패턴으로 작성

## 알림/확인

- `alert()` 금지 → `toast()` from `sonner` 사용
- 파괴적 액션 → `AlertDialog` 필수 (나가기, 삭제 등)
- `<Toaster />` 는 `App.tsx`에 이미 마운트됨

## 폰트

- 타이틀: `font-[family-name:var(--font-arcade)]` (Press Start 2P)
- 본문: 시스템 sans-serif (Tailwind 기본)

## path alias

- `@/` → `./src/` (vite.config.ts + tsconfig.app.json 둘 다 설정됨)
- 항상 `@/components/...`, `@/lib/...` 형태로 import

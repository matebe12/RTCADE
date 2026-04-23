---
description: "Use when creating or modifying UI components, styling, Tailwind classes, shadcn/ui usage, or layout"
applyTo:
  - "src/components/**"
  - "src/pages/**"
  - "src/index.css"
---

# UI 컴포넌트 가이드

## 필수 패턴

- Tailwind CSS v4를 사용한다. `tailwind.config.ts`는 없다.
- 인라인 스타일 금지. 항상 Tailwind 클래스 또는 `cn()`을 사용한다.
- `src/index.css`의 CSS 변수와 폰트 정의를 우선 따른다.

## 타이포그래피

- 본문은 Pretendard(`--font-sans`)가 기본이다.
- `font-arcade`는 Press Start 2P이며, 제목/버튼/강조 포인트처럼 적게 쓴다.
- 폰트를 임의로 바꾸지 말고 기존 텍스트 계층을 유지한다.

## 현재 룩앤필

- 어두운 중립 테마, 둥근 카드, 미세한 그라데이션/투명도 레이어를 유지한다.
- 전체를 평평한 단색 배경으로 밀어버리지 말 것.
- HomePage와 NetplayPage처럼 카드 중심의 레이아웃과 조밀한 spacing이 현재 언어다.
- 큰 액션에는 shadcn `Button` / `AlertDialog`, 상태에는 `Badge` / `Card`를 우선 사용한다.

## shadcn/ui 컴포넌트

설치된 컴포넌트:
`button`, `input`, `card`, `badge`, `avatar`, `dialog`, `scroll-area`, `tooltip`, `separator`, `sonner`, `alert-dialog`

새 컴포넌트가 필요하면 기존 패턴을 보고 직접 `src/components/ui/`에 추가한다.

## 알림 / 확인

- `alert()` 대신 `toast()`를 사용한다.
- 파괴적 액션은 `AlertDialog`로 확인한다.
- `<Toaster />`는 `App.tsx`에 이미 마운트되어 있다.

## path alias

- `@/`는 `./src/`를 가리킨다.
- import는 항상 `@/components/...`, `@/lib/...` 형태로 유지한다.

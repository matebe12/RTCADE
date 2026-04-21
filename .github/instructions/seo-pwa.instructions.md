---
description: "Use when modifying index.html, SEO metadata, service worker registration, manifest, or public favicon/OG/PWA assets"
applyTo:
  - "index.html"
  - "src/lib/seo.ts"
  - "src/main.tsx"
  - "public/manifest.webmanifest"
  - "public/sw.js"
  - "public/*.png"
  - "public/*.ico"
---

# SEO / PWA / Asset 가이드

## 메타데이터 동기화

- `index.html`의 정적 메타와 `src/lib/seo.ts`의 동적 메타는 같은 기준을 써야 한다.
- `og:title`, `og:description`, `twitter:*`, canonical, robots를 분리해서 관리하지 말 것.
- 공유용 대표 이미지는 `/og_image.png`다. width / height / alt 값을 양쪽에서 일치시킨다.

## PWA 구성

- PWA는 `manifest.webmanifest` + `sw.js` + `src/main.tsx`의 production secure-context 등록으로 유지한다.
- `vite-plugin-pwa`를 추가하지 말고, 현재의 최소 수동 구성을 유지한다.
- service worker 등록은 production + `window.isSecureContext`에서만 한다.

## 자산 규칙

- manifest의 icon 경로는 실제 public 파일과 정확히 맞춰야 한다.
- 아이콘 세트가 바뀌면 `favicon.ico`, `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`, `pwa-icon-*`를 한 번에 정리한다.
- OG / favicon / PWA 아이콘은 서로 다른 용도지만 브랜딩 원본이 바뀌면 함께 업데이트해야 한다.

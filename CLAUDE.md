# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev:all       # Vite dev server (5173) + Express backend (3001) concurrently
npm run dev           # Frontend only (Vite)
npm run server        # Backend only (tsx server/index.ts)
npm run build         # TypeScript type check + Vite production build
npx tsc --noEmit      # Type check only — must pass before commit
npm run lint          # ESLint
```

## Architecture Overview

RTCADE is a browser-based retro game P2P netplay app. Two separate netplay architectures coexist:

### Current (EmulatorJS + Video Streaming)
- **EmulatorJS runs directly in React DOM** (not iframe) via `window.EJS_emulator` global
- HOST renders the game, captures canvas+audio via `captureStream()`, streams to GUEST via WebRTC
- GUEST watches the video stream and sends keyboard input back via DataChannel
- HOST is source of truth; periodic resync via save-state transfer corrects drift
- Key files: `src/components/EmulatorPlayer.tsx`, `src/components/NetplayLobby.tsx`, `src/netplay/peer.ts`, `src/netplay/signaling.ts`
- Netplay session orchestration hooks: `src/netplay/useNetplaySession.ts`, `useNetplayInitialSync.ts`, `useNetplayResyncLoop.ts`, `useNetplaySyncRuntime.ts`
- Shared protocol: `shared/emulator-protocol.ts` — button mappings, core remaps, heartbeat constants

### New WIP (FBNeo WASM + Video Streaming)
- Located on `feature/ggpo-netplay` branch (current branch)
- **GGPO rollback was attempted then abandoned** — now uses the same video streaming pattern as the EmulatorJS system, but with FBNeo WASM instead of EmulatorJS
- HOST runs FBNeo WASM locally → renders to Canvas → `captureStream(60fps)` → WebRTC `addTrack()` → GUEST
- GUEST watches `<video>` element, sends keyboard input back via DataChannel `input` channel
- `src/lib/fbneo/` — FBNeo WASM wrapper (`ArcadeWrapper.ts`), keyboard→bitmask input mapping (`input.ts`), canvas renderer (`render.ts`)
- `src/netplay-ggpo/` — WebRTC peer with video streaming + input relay (`GGPONetplayPeer.ts`), session hook (`useGGPOSession.ts`). The `ggpo/` subdirectory (GGPOEngine, InputQueue, StateHistory, RollbackController) are GGPO rollback remnants — **not actively used** in the current streaming approach
- Test page: `src/pages/GGPOTestPage.tsx` — solo/host/guest via URL hash (`/ggpo-test#host`, `/ggpo-test#guest=CODE`), uses Neo Geo WASM variant
- Original design doc (now outdated): `docs/ggpo-netplay-design.md`
- DataChannel split: `input` (unreliable — keyboard input), `control` (reliable — binary state sync, peer-ready, heartbeat), `chat` (reliable)

### WebRTC DataChannel Split
- **EmulatorJS system**: Five channels — `input`, `control` (commands), `state` (binary), `repair` (held mask correction), `chat`
- **FBNeo system**: Three channels — `input` (unreliable, keyboard input), `control` (reliable, binary state + commands), `chat` (reliable)

### Backend (Express 5 + WebSocket)
- `server/index.ts` — bootstrap only
- `server/signaling.ts` — room create/join, SDP/ICE relay via WebSocket
- `server/config.ts` — env vars (`PORT`, `CORS_ORIGIN`, `ROMS_PATH`, `DATABASE_URL`, `NOTICE_ADMIN_TOKEN`, STUN/TURN config)
- `server/romApi.ts` — ROM file serving + catalog from `server/roms/{coreName}/*.zip`
- `server/roomStore.ts` — in-memory room state
- `server/noticeApi.ts`, `server/statsApi.ts`, `server/visitorTracking.ts` — operational APIs
- DB is PostgreSQL, optional — server runs without it (stats/notices disabled)

## Key Conventions

- **TypeScript strict** — `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `erasableSyntaxOnly`
- **`@/` path alias** maps to `src/` (e.g. `@/components/...`, `@/lib/...`)
- **UI**: Tailwind CSS v4 + shadcn/ui dark theme. No inline styles. Use `cn()` from `@/lib/utils` for class merging.
- **Responsive**: Mobile-first — 360px 최소 지원. 기본(모바일) 스타일이 360px에서 깨지지 않아야 함. `sm:`(640px) 브레이크포인트로 데스크탑 확장. Flex/grid row는 모바일에서 `flex-col`로 쌓고 `sm:flex-row`로 전환. 카드는 모바일에서 `w-full`, 데스크탑에서 `sm:flex-1` 또는 `sm:w-auto`. 텍스트는 모바일 `text-base`, 데스크탑 `sm:text-lg`. 플레이 페이지 툴바: `gap-2`, 버튼 텍스트 `hidden sm:inline`. CodeInput: `size-10 sm:size-12`. 다이얼로그 스크롤: `h-72 sm:h-[420px]`. 가상 리스트: `h-64 sm:h-96`.
- **Notifications**: `sonner` toast — never use `alert()`
- **Destructive actions**: require `AlertDialog` confirmation
- **URLs**: environment variables only (`VITE_API_URL`, `VITE_WS_URL`, `CORS_ORIGIN`) — never hardcode
- **ROM files**: never committed to git (`.gitignore`d)
- **UI text**: Korean
- **Module style**: `verbatimModuleSyntax` enabled — use `import type` for type-only imports

## Git Conventions

- **Branch naming**: `feat/<name>`, `fix/<name>`, `chore/<name>`, `refactor/<name>`
- **Commit style**: [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, etc. (English prefix, Korean body OK)
- **Merge**: squash merge preferred for clean history
- **No force push**, no `.env` commits, no ROM file commits

## Known Failed Approaches (DO NOT RETRY)

1. **RAF Hook Lockstep** — EmulatorJS uses setTimeout, not rAF; frame counter sync impossible
2. **Frame-tick heartbeat** — 60fps DataChannel flooding causes input lag
3. **Frame-delay Lockstep** — iframe/internal frame-level control impossible, `getFrameNum()` mismatch
4. **Pause-Resume resync with ACK wait** — 5-step roundtrip 100~300ms pause → perceptible stutter
5. **GGPO Rollback** — `saveState()`/`loadState()` per frame was too heavy for FBNeo WASM (state snapshots too large), and rollback caused audio glitches. Replaced with video streaming — same pattern as the EmulatorJS system but using FBNeo WASM for local rendering on HOST side

## Vite Configuration Notes

- FBNeo WASM files served as static assets (`assetsInclude: ["**/*.wasm"]`)
- COOP/COEP headers set for SharedArrayBuffer support (needed by FBNeo threads)
- `@mantou/fbneo` excluded from optimizeDeps (WASM cannot be pre-bundled)
- Sentry sourcemap upload enabled only when `SENTRY_AUTH_TOKEN` env var is set
- Chunk size warning threshold raised to 50MB for FBNeo WASM

## Deployment

- **Frontend**: Vercel (`vercel.json` — SPA rewrites, build command `npm run build`, output `dist/`)
- **Backend**: Railway (`railway.json` — Nixpacks, start: `node --import tsx server/index.ts`, healthcheck: `/api/roms`)

import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT 환경변수가 있을 때만 소스맵을 업로드한다.
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            sourcemaps: {
              filesToDeleteAfterUpload: ["./dist/**/*.map"],
            },
          }),
        ]
      : []),
  ],
  build: {
    sourcemap: true,
    // FBNeo WASM 파일을 위한 chunk 크기 경고 임계값 상향
    chunkSizeWarningLimit: 50 * 1024, // 50 MB
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    // COOP/COEP 헤더 — FBNeo WASM SharedArrayBuffer 지원 (추후 threads 활성화 시 필요)
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  // FBNeo WASM 파일을 정적 에셋으로 처리
  assetsInclude: ["**/*.wasm"],
  optimizeDeps: {
    exclude: ["@mantou/fbneo", "@rtcade/emulator"],
  },
});

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
    // CSS를 비동기 로딩으로 전환하여 렌더블로킹 제거 (모바일 FCP/LCP 개선)
    {
      name: "async-css",
      enforce: "post",
      apply: "build",
      transformIndexHtml(html) {
        return html.replace(
          /<link rel="stylesheet"([^>]*?)href="([^"]*?)"([^>]*?)>/g,
          '<link rel="preload" as="style"$1href="$2"$3 onload="this.onload=null;this.rel=\'stylesheet\'">'
          + '<noscript><link rel="stylesheet"$1href="$2"$3></noscript>',
        );
      },
    },
  ],
  build: {
    target: "esnext",
    sourcemap: true,
    cssMinify: "lightningcss",
    // FBNeo WASM 파일을 위한 chunk 크기 경고 임계값 상향
    chunkSizeWarningLimit: 50 * 1024, // 50 MB
    modulePreload: {
      polyfill: false,
      // vendor-analytics, vendor-sentry는 동적/지연 로딩 대상이므로 초기 preload 제외
      resolveDependencies(_filename, deps) {
        return deps.filter(
          (d) => !d.includes("vendor-analytics") && !d.includes("vendor-sentry"),
        );
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/react-router")) {
            return "vendor-router";
          }
          if (id.includes("node_modules/@sentry")) {
            return "vendor-sentry";
          }
          if (id.includes("node_modules/@amplitude")) {
            return "vendor-analytics";
          }
          if (id.includes("node_modules/lucide-react") || id.includes("node_modules/sonner")) {
            return "vendor-ui";
          }
        },
      },
    },
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

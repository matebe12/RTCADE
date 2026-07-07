import { init, track } from "@amplitude/analytics-browser";

let ready = false;

/**
 * Amplitude SDK를 초기화한다. API key가 없으면 no-op.
 * main.tsx에서 createRoot 이전에 한 번만 호출한다.
 */
export function initAnalytics(apiKey?: string) {
  if (!apiKey || ready) return;

  init(apiKey, undefined, {
    defaultTracking: false,
    autocapture: false,
  });
  ready = true;
}

/**
 * 이벤트를 Amplitude로 전송한다. initAnalytics가 호출되지 않았으면 no-op.
 */
export function trackEvent(name: string, props?: Record<string, unknown>) {
  if (!ready) return;
  track(name, props);
}

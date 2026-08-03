let ready = false;
let trackFn: ((name: string, props?: Record<string, unknown>) => unknown) | null = null;
let pendingEvents: Array<{ name: string; props?: Record<string, unknown> }> = [];

/**
 * Amplitude SDK(209KB)를 동적 import로 지연 로딩한다.
 * main.tsx에서 requestIdleCallback 시점에 호출된다.
 */
export async function initAnalytics(apiKey?: string) {
  if (!apiKey || ready) return;

  try {
    const amp = await import("@amplitude/analytics-browser");
    amp.init(apiKey, undefined, {
      defaultTracking: false,
      autocapture: false,
    });
    trackFn = amp.track;
    ready = true;

    // 지연 로딩 동안 쌓인 이벤트 flush
    for (const event of pendingEvents) {
      trackFn!(event.name, event.props);
    }
    pendingEvents = [];
  } catch {
    // Analytics 로딩 실패 시 조용히 무시
  }
}

/**
 * 이벤트를 Amplitude로 전송한다. initAnalytics가 호출되기 전에는 큐에 쌓아뒀다가 flush.
 */
export function trackEvent(name: string, props?: Record<string, unknown>) {
  if (ready && trackFn) {
    trackFn(name, props);
  } else {
    pendingEvents.push({ name, props });
  }
}

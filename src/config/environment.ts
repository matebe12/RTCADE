const defaultApiUrl = `${window.location.protocol}//${window.location.hostname}:3001`;
const defaultWsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:3001`;
const defaultEmulatorJsDataUrl = "https://cdn.emulatorjs.org/stable/data/";

export type AdProvider = "none" | "placeholder" | "coupang" | "adsense";

function normalizeBooleanEnv(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  return value.trim().toLowerCase() === "true";
}

function normalizeNumberEnv(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeOptionalEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeEmulatorJsDataUrl(url: string) {
  return url.endsWith("/") ? url : `${url}/`;
}

const apiBaseUrl = import.meta.env.VITE_API_URL || defaultApiUrl;
const wsUrl = import.meta.env.VITE_WS_URL || defaultWsUrl;
const emulatorJsDataUrl = normalizeEmulatorJsDataUrl(
  import.meta.env.VITE_EMULATORJS_DATA_URL || defaultEmulatorJsDataUrl,
);
const adProvider: AdProvider = "none";

export const appEnvironment = {
  siteName: "RTCADE",
  siteTagline: "추억의 게임을 다시 연결하는 공간",
  apiBaseUrl,
  wsUrl,
  emulatorJsDataUrl,
  emulatorJsLoaderUrl: new URL("loader.js", emulatorJsDataUrl).toString(),
  sideAds: {
    enabled: false,
    provider: adProvider,
    desktopMinWidth: normalizeNumberEnv(import.meta.env.VITE_AD_DESKTOP_MIN_WIDTH, 1536),
    rightRailMinWidth: normalizeNumberEnv(import.meta.env.VITE_AD_RIGHT_RAIL_MIN_WIDTH, 1280),
    disclosureText: import.meta.env.VITE_AD_DISCLOSURE_TEXT || "광고",
    leftSlotId: import.meta.env.VITE_AD_LEFT_SLOT_ID || "left-rail",
    rightSlotId: import.meta.env.VITE_AD_RIGHT_SLOT_ID || "right-rail",
    coupangTrackingCode: normalizeOptionalEnv(import.meta.env.VITE_COUPANG_TRACKING_CODE),
    coupangSubId: normalizeOptionalEnv(import.meta.env.VITE_COUPANG_SUB_ID),
    coupangTemplate: import.meta.env.VITE_COUPANG_TEMPLATE || "carousel",
    coupangRailWidth: normalizeNumberEnv(import.meta.env.VITE_COUPANG_RAIL_WIDTH, 180),
    coupangRailHeight: normalizeNumberEnv(import.meta.env.VITE_COUPANG_RAIL_HEIGHT, 600),
    adsenseClientId: normalizeOptionalEnv(import.meta.env.VITE_ADSENSE_CLIENT_ID),
    adsenseTestMode: normalizeBooleanEnv(import.meta.env.VITE_ADSENSE_TEST_MODE, true),
  },
  monitoring: {
    amplitudeApiKey: normalizeOptionalEnv(import.meta.env.VITE_AMPLITUDE_API_KEY),
    sentryDsn: normalizeOptionalEnv(import.meta.env.VITE_SENTRY_DSN),
    sentryRelease: normalizeOptionalEnv(import.meta.env.VITE_SENTRY_RELEASE),
    appEnv: (import.meta.env.VITE_APP_ENV as string | undefined) || import.meta.env.MODE || "development",
  },
} as const;

const defaultApiUrl = `${window.location.protocol}//${window.location.hostname}:3001`;
const defaultWsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:3001`;
const defaultEmulatorJsDataUrl = "https://cdn.emulatorjs.org/stable/data/";

function normalizeEmulatorJsDataUrl(url: string) {
  return url.endsWith("/") ? url : `${url}/`;
}

const apiBaseUrl = import.meta.env.VITE_API_URL || defaultApiUrl;
const wsUrl = import.meta.env.VITE_WS_URL || defaultWsUrl;
const emulatorJsDataUrl = normalizeEmulatorJsDataUrl(
  import.meta.env.VITE_EMULATORJS_DATA_URL || defaultEmulatorJsDataUrl,
);

export const appEnvironment = {
  siteName: "RTCADE",
  siteTagline: "추억의 게임을 다시 연결하는 공간",
  apiBaseUrl,
  wsUrl,
  emulatorJsDataUrl,
  emulatorJsLoaderUrl: new URL("loader.js", emulatorJsDataUrl).toString(),
} as const;

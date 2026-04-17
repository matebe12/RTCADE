const defaultApiUrl = `${window.location.protocol}//${window.location.hostname}:3001`;
const defaultWsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:3001`;

const apiBaseUrl = import.meta.env.VITE_API_URL || defaultApiUrl;
const wsUrl = import.meta.env.VITE_WS_URL || defaultWsUrl;

export const appEnvironment = {
  siteName: "RTCADE",
  siteTagline: "추억의 게임을 다시 연결하는 공간",
  apiBaseUrl,
  wsUrl,
} as const;

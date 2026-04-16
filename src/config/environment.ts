function stripProtocol(value: string) {
  return value.replace(/(^\w+:|^)\/\//, "");
}

const defaultApiUrl = `${window.location.protocol}//${window.location.hostname}:3001`;
const defaultWsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:3001`;

const apiBaseUrl = import.meta.env.VITE_API_URL || defaultApiUrl;
const wsUrl = import.meta.env.VITE_WS_URL || defaultWsUrl;

export const appEnvironment = {
  siteName: "RETRO EMULATOR",
  siteTagline: "브라우저 기반 레트로 넷플레이 허브",
  apiBaseUrl,
  wsUrl,
  apiHostLabel: stripProtocol(apiBaseUrl),
  wsHostLabel: stripProtocol(wsUrl),
} as const;

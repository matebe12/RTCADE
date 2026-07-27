import { buildBackendUrl } from "@/lib/backend-url";

/** 운영 통계 갱신 요청을 알리는 커스텀 DOM 이벤트 이름. */
const OPERATIONS_STATS_REFRESH_EVENT = "rtcade:operations-stats-refresh";

/** 인기 게임 요약 정보. */
export interface PopularGameSummary {
  core?: string;
  gameName: string;
  playCount: number;
  romPath?: string;
  totalPlayTimeMs: number;
}

interface IceServerResponse {
  iceServers?: unknown;
}

const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

let cachedRtcConfiguration: RTCConfiguration | null = null;
let rtcConfigurationPromise: Promise<RTCConfiguration> | null = null;

/** `/api/stats` 응답 스키마. 서버 운영 지표와 인기 게임 정보를 포함한다. */
export interface OperationsStats {
  activeRooms: number;
  activeNetplayRooms: number;
  connectedPlayers: number;
  dbEnabled: boolean;
  monthlyPopularGames: PopularGameSummary[];
  monthlyPopularGame: PopularGameSummary | null;
  openRooms: number;
  soloSessions: number;
  todayGames: number;
  todayPopularGames: PopularGameSummary[];
  todayPopularGame: PopularGameSummary | null;
  totalGames: number;
  todayVisitors: number;
  totalVisitors: number;
  waitingRooms: number;
  weeklyPopularGames: PopularGameSummary[];
  weeklyPopularGame: PopularGameSummary | null;
}

/** `/api/game-sessions` POST 요청 본문 타입. 게임 세션 시작 시 기록한다. */
export interface RecordGameSessionInput {
  core: string;
  gameName: string;
  romPath: string;
  sessionId: string;
}

/** `/api/active-play-sessions` POST 요청 본문 타입. 솔로 플레이 세션 등록 시 사용한다. */
export interface ActivePlaySessionInput {
  core: string;
  gameName: string;
  mode: "solo";
  romPath: string;
  sessionId: string;
}

/** 관리자 공지 항목. `/api/notices` 응답에 포함된다. */
export interface NoticeItem {
  body: string;
  createdAt: string;
  id: number;
  isPinned: boolean;
  isPublished: boolean;
  publishedAt: string;
  title: string;
  updatedAt: string;
}

interface NoticeResponse {
  items: NoticeItem[];
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toPopularGameSummary(value: unknown): PopularGameSummary | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    core?: unknown;
    gameName?: unknown;
    playCount?: unknown;
    romPath?: unknown;
    totalPlayTimeMs?: unknown;
  };

  if (typeof candidate.gameName !== "string" || candidate.gameName.trim().length === 0) {
    return null;
  }

  return {
    core:
      typeof candidate.core === "string" && candidate.core.trim().length > 0
        ? candidate.core
        : undefined,
    gameName: candidate.gameName,
    playCount: toNumber(candidate.playCount),
    romPath:
      typeof candidate.romPath === "string" && candidate.romPath.trim().length > 0
        ? candidate.romPath
        : undefined,
    totalPlayTimeMs: toNumber(candidate.totalPlayTimeMs),
  };
}

function toIceServer(value: unknown): RTCIceServer | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    credential?: unknown;
    urls?: unknown;
    username?: unknown;
  };

  const urls = Array.isArray(candidate.urls)
    ? candidate.urls.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : typeof candidate.urls === "string" && candidate.urls.trim().length > 0
      ? [candidate.urls]
      : [];

  if (urls.length === 0) {
    return null;
  }

  return {
    urls,
    username:
      typeof candidate.username === "string" && candidate.username.trim().length > 0
        ? candidate.username
        : undefined,
    credential:
      typeof candidate.credential === "string" && candidate.credential.trim().length > 0
        ? candidate.credential
        : undefined,
  };
}

function normalizeRtcConfiguration(value: unknown): RTCConfiguration {
  const candidate = value && typeof value === "object" ? (value as IceServerResponse) : {};
  const iceServers = Array.isArray(candidate.iceServers)
    ? candidate.iceServers
        .map((entry) => toIceServer(entry))
        .filter((entry): entry is RTCIceServer => entry !== null)
    : [];

  return {
    iceServers: iceServers.length > 0 ? iceServers : FALLBACK_ICE_SERVERS,
  };
}

function toPopularGameSummaries(value: unknown): PopularGameSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => toPopularGameSummary(item))
    .filter((item): item is PopularGameSummary => item !== null);
}

function normalizePopularGameSummaries(listValue: unknown, singleValue: unknown) {
  const list = toPopularGameSummaries(listValue);

  if (list.length > 0) {
    return list;
  }

  const single = toPopularGameSummary(singleValue);
  return single ? [single] : [];
}

function normalizeOperationsStats(value: unknown): OperationsStats {
  const candidate = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const monthlyPopularGames = normalizePopularGameSummaries(
    candidate.monthlyPopularGames,
    candidate.monthlyPopularGame,
  );
  const todayPopularGames = normalizePopularGameSummaries(
    candidate.todayPopularGames,
    candidate.todayPopularGame,
  );
  const weeklyPopularGames = normalizePopularGameSummaries(
    candidate.weeklyPopularGames,
    candidate.weeklyPopularGame,
  );

  return {
    activeRooms: toNumber(candidate.activeRooms),
    activeNetplayRooms: toNumber(candidate.activeNetplayRooms),
    connectedPlayers: toNumber(candidate.connectedPlayers),
    dbEnabled: candidate.dbEnabled === true,
    monthlyPopularGames,
    monthlyPopularGame: monthlyPopularGames[0] ?? null,
    openRooms: toNumber(candidate.openRooms),
    soloSessions: toNumber(candidate.soloSessions),
    todayGames: toNumber(candidate.todayGames),
    todayPopularGames,
    todayPopularGame: todayPopularGames[0] ?? null,
    totalGames: toNumber(candidate.totalGames),
    todayVisitors: toNumber(candidate.todayVisitors),
    totalVisitors: toNumber(candidate.totalVisitors),
    waitingRooms: toNumber(candidate.waitingRooms),
    weeklyPopularGames,
    weeklyPopularGame: weeklyPopularGames[0] ?? null,
  };
}

async function request(pathname: string, init?: RequestInit) {
  const response = await fetch(buildBackendUrl(pathname), init);

  if (!response.ok) {
    throw new Error("잠시 후 다시 시도해 주세요.");
  }

  return response;
}

async function fetchJson<T>(pathname: string, init?: RequestInit): Promise<T> {
  const response = await request(pathname, init);

  return (await response.json()) as T;
}

/**
 * 운영 통계 갱신 이벤트를 주사한다. 통계 지표를 바라보는 컴포넌트가 새로고침 신호로 활용한다.
 */
export function notifyOperationsStatsRefresh() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(OPERATIONS_STATS_REFRESH_EVENT));
}

/**
 * 운영 통계 갱신 이벤트 이름을 반환한다. `addEventListener` 등록 시 사용한다.
 * @returns DOM 커스텀 이벤트 이름 문자열
 */
export function getOperationsStatsRefreshEventName() {
  return OPERATIONS_STATS_REFRESH_EVENT;
}

/**
 * `navigator.sendBeacon`으로 솔로 플레이 세션을 종료한다.
 * 페이지 닫혀도 안정적으로 요청이 전송된다.
 * @param sessionId - 종료할 세션 ID
 * @returns 비콘 전송 성공 여부
 */
export function endActivePlaySessionWithBeacon(sessionId: string) {
  if (
    typeof window === "undefined" ||
    typeof navigator === "undefined" ||
    typeof navigator.sendBeacon !== "function"
  ) {
    return false;
  }

  const trimmedSessionId = sessionId.trim();

  if (trimmedSessionId.length === 0) {
    return false;
  }

  const targetUrl = buildBackendUrl(
    `/api/active-play-sessions/${encodeURIComponent(trimmedSessionId)}/end`,
  );

  return navigator.sendBeacon(targetUrl);
}

/**
 * `navigator.sendBeacon`으로 게임 세션을 완료 상태로 멈쪸다.
 * 페이지 닫혀도 안정적으로 요청이 전송된다.
 * @param sessionId - 완료할 게임 세션 ID
 * @returns 비콜 전송 성공 여부
 */
export function completeGameSessionWithBeacon(sessionId: string) {
  if (
    typeof window === "undefined" ||
    typeof navigator === "undefined" ||
    typeof navigator.sendBeacon !== "function"
  ) {
    return false;
  }

  const trimmedSessionId = sessionId.trim();

  if (trimmedSessionId.length === 0) {
    return false;
  }

  const targetUrl = buildBackendUrl(`/api/game-sessions/${encodeURIComponent(trimmedSessionId)}/end`);

  return navigator.sendBeacon(targetUrl);
}

/**
 * 서버에서 운영 통계를 조회한다.
 * @returns 정상화된 {@link OperationsStats} 객체
 */
export function fetchOperationsStats() {
  return fetchJson<unknown>("/api/stats").then(normalizeOperationsStats);
}

/**
 * WebRTC ICE 서버 설정을 서버에서 가져온다.
 * 응답은 모눣스로 기복하며, 실패 시 STUN 폴스백 서버를 사용한다.
 * @param forceRefresh - `true`이면 캐시를 무시하고 다시 가져온다
 * @returns RTCConfiguration 객체 (iceServers 포함)
 */
export function fetchNetplayRtcConfiguration(forceRefresh = false) {
  if (!forceRefresh && cachedRtcConfiguration) {
    return Promise.resolve(cachedRtcConfiguration);
  }

  if (!forceRefresh && rtcConfigurationPromise) {
    return rtcConfigurationPromise;
  }

  rtcConfigurationPromise = fetchJson<unknown>("/api/ice-servers")
    .then((response) => {
      cachedRtcConfiguration = normalizeRtcConfiguration(response);
      return cachedRtcConfiguration;
    })
    .catch(() => ({ iceServers: FALLBACK_ICE_SERVERS }))
    .finally(() => {
      rtcConfigurationPromise = null;
    });

  return rtcConfigurationPromise;
}

/**
 * 게임 세션 시작을 서버에 기록한다.
 * @param input - 코어, 게임명, ROM 경로, 세션 ID
 */
export async function recordGameSession(input: RecordGameSessionInput) {
  await request("/api/game-sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  notifyOperationsStatsRefresh();
}

/**
 * 게임 세션을 완료 상태로 멈쪸다.
 * @param sessionId - 완료할 게임 세션 ID
 */
export async function completeGameSession(sessionId: string) {
  await request(`/api/game-sessions/${encodeURIComponent(sessionId)}/end`, {
    method: "POST",
  });

  notifyOperationsStatsRefresh();
}

/**
 * 솔로 플레이 세션을 등록하거나 업데이트한다. TTL 기반 자동 만료를 서버가 관리한다.
 * @param input - 코어, 게임명, ROM 경로, 세션 ID, 모드
 */
export async function upsertActivePlaySession(input: ActivePlaySessionInput) {
  await request("/api/active-play-sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

/**
 * 솔로 플레이 세션을 종료한다.
 * @param sessionId - 종료할 세션 ID
 */
export async function endActivePlaySession(sessionId: string) {
  await request(`/api/active-play-sessions/${encodeURIComponent(sessionId)}/end`, {
    method: "POST",
    keepalive: true,
  });

  notifyOperationsStatsRefresh();
}

/**
 * 관리자 공지 목록을 가져온다.
 * @returns 공지 항목 배열 ({@link NoticeItem}[])
 */
export async function fetchNotices() {
  const response = await fetchJson<NoticeResponse>("/api/notices");
  return response.items;
}
